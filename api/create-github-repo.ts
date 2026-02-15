// Vercel Serverless Function: POST /api/create-github-repo
//
// Creates a private GitHub repo, adds default collaborators, and seeds it with template files.
// GitHub token is server-side only (GITHUB_TOKEN).

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type CreateGithubRepoRequestBody = {
    appId: string;
    appAlias: string;
    appName: string;
    brandName: string;
    brandSlug: string;
};

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const extractBearerToken = (authorization: unknown) => {
    if (!isNonEmptyString(authorization)) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
};

const verifySupabaseToken = async (token: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    }

    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
        },
    });

    return resp.ok;
};

const createUserSupabaseClient = (token: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
};

const toRepoName = (appDisplayName: string) => {
    // Keep behavior close to: replace non-alnum with '-', collapse repeats, trim trailing dashes.
    // Intentionally does NOT trim leading dashes, matching the example "-143-HW-...".
    const raw = String(appDisplayName || '').trim();
    const dashed = raw.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+/g, '-');
    return dashed.replace(/-+$/g, '');
};

const readTemplates = (vars: Record<string, string>) => {
    const root = path.join(process.cwd(), 'templates', 'github');
    const out: Array<{ repoPath: string; content: string }> = [];

    const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.isFile()) continue;
            if (!entry.name.endsWith('.tpl')) continue;

            const rel = path.relative(root, full).replace(/\\/g, '/');
            const repoPath = rel.replace(/\.tpl$/i, '');
            const raw = fs.readFileSync(full, 'utf8');
            const content = raw.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, key) => vars[String(key)] ?? '');
            out.push({ repoPath, content });
        }
    };

    if (fs.existsSync(root)) walk(root);
    return out;
};

const gh = async (token: string, url: string, init?: RequestInit) => {
    const resp = await fetch(url, {
        ...init,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(init?.headers || {}),
        },
    });

    const text = await resp.text();
    let payload: any = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = text;
    }
    return { ok: resp.ok, status: resp.status, payload };
};

const encodeRepoPath = (repoPath: string) =>
    repoPath
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');

const mustEndWithJpg = (p: string) => /\.jpg$/i.test(String(p || '').trim());

export default async function handler(req: any, res: any) {
    try {
        if (req.method !== 'POST') {
            json(res, 405, { message: 'Method not allowed' });
            return;
        }

        const token = extractBearerToken(req.headers?.authorization);
        if (!token) {
            json(res, 401, { message: 'Missing Authorization: Bearer token' });
            return;
        }

        const ok = await verifySupabaseToken(token);
        if (!ok) {
            json(res, 401, { message: 'Unauthorized' });
            return;
        }

        const ghToken = process.env.GITHUB_TOKEN;
        if (!ghToken) {
            json(res, 500, { message: 'GitHub token not configured' });
            return;
        }

        const body: CreateGithubRepoRequestBody =
            typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const required: Array<keyof CreateGithubRepoRequestBody> = ['appId', 'appAlias', 'appName', 'brandName', 'brandSlug'];
        for (const key of required) {
            if (!isNonEmptyString((body as any)[key])) {
                json(res, 400, { message: `Missing field: ${key}` });
                return;
            }
        }

        const appDisplayName = `[${body.appAlias}] ${body.appName}`.trim();
        const repoName = toRepoName(appDisplayName);
        if (!repoName) {
            json(res, 400, { message: 'Could not derive repo name.' });
            return;
        }

        // Enforce: must have a picked icon BEFORE repo creation.
        // We also enforce the icon is a JPG so downstream iOS app tooling is predictable.
        let iconB64: string | null = null;
        {
            const supabase = createUserSupabaseClient(token);
            const { data: pick, error: pickErr } = await supabase
                .from('app_asset_picks')
                .select('generated_asset_id')
                .eq('app_id', body.appId)
                .eq('kind', 'icon')
                .maybeSingle();
            if (pickErr) throw pickErr;
            const assetId = String((pick as any)?.generated_asset_id || '').trim();
            if (!assetId) {
                json(res, 400, { message: 'Pick an icon first (Generate icon -> Pick). Then create repo.' });
                return;
            }

            const { data: asset, error: assetErr } = await supabase
                .from('app_generated_assets')
                .select('image_path')
                .eq('id', assetId)
                .maybeSingle();
            if (assetErr) throw assetErr;
            const imagePath = String((asset as any)?.image_path || '').trim();
            if (!imagePath) {
                json(res, 400, { message: 'Picked icon is missing its stored image_path. Re-generate and pick again.' });
                return;
            }
            if (!mustEndWithJpg(imagePath)) {
                json(res, 400, { message: 'Picked icon must be a .jpg. Re-generate the icon (JPG) and pick again.' });
                return;
            }

            const { data: signed, error: signErr } = await supabase.storage
                .from('generated-assets')
                .createSignedUrl(imagePath, 3600);
            if (signErr) throw signErr;
            const signedUrl = String((signed as any)?.signedUrl || '').trim();
            if (!signedUrl) {
                json(res, 400, { message: 'Could not create signed URL for picked icon. Try again.' });
                return;
            }

            const imgResp = await fetch(signedUrl);
            if (!imgResp.ok) {
                json(res, 400, { message: 'Could not download the picked icon. Try again.' });
                return;
            }
            const buf = Buffer.from(await imgResp.arrayBuffer());
            iconB64 = buf.toString('base64');
        }

        // Identify owner for follow-up collaborator calls.
        const me = await gh(ghToken, 'https://api.github.com/user', { method: 'GET' });
        if (!me.ok) {
            json(res, 502, { message: 'GitHub auth failed', details: me.payload });
            return;
        }
        const owner = String(me.payload?.login || '');
        if (!owner) {
            json(res, 502, { message: 'GitHub response missing login.' });
            return;
        }

        const createResp = await gh(ghToken, 'https://api.github.com/user/repos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: repoName,
                private: true,
                auto_init: true,
                description: `Workspace for ${appDisplayName}`,
            }),
        });

        if (!createResp.ok) {
            json(res, createResp.status === 422 ? 409 : 502, {
                message: 'Failed to create repo.',
                details: createResp.payload,
            });
            return;
        }

        const repoHtmlUrl = String(createResp.payload?.html_url || '');
        const repoFullName = String(createResp.payload?.full_name || `${owner}/${repoName}`);

        const collaboratorsEnv = process.env.GITHUB_DEFAULT_COLLABORATORS || 'VoLaNYeZ';
        const collaborators = collaboratorsEnv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        // Best-effort collaborator invites (do not fail the whole operation).
        const collabResults: Array<{ username: string; ok: boolean; status: number }> = [];
        for (const username of collaborators) {
            if (!username) continue;
            const r = await gh(ghToken, `https://api.github.com/repos/${repoFullName}/collaborators/${encodeURIComponent(username)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permission: 'push' }),
            });
            collabResults.push({ username, ok: r.ok, status: r.status });
        }

        // Seed template files.
        const vars = {
            REPO_NAME: repoName,
            APP_DISPLAY_NAME: appDisplayName,
            APP_ID: body.appId,
            APP_ALIAS: body.appAlias,
            APP_NAME: body.appName,
            BRAND_NAME: body.brandName,
            BRAND_SLUG: body.brandSlug,
        };

        const files = readTemplates(vars);
        const seeded: Array<{ path: string; ok: boolean; status: number }> = [];

        // If README exists (auto_init), update it; otherwise create.
        for (const file of files) {
            const repoPath = file.repoPath;
            const contentB64 = Buffer.from(file.content, 'utf8').toString('base64');

            let sha: string | null = null;
            const existing = await gh(ghToken, `https://api.github.com/repos/${repoFullName}/contents/${encodeRepoPath(repoPath)}`, {
                method: 'GET',
            });
            if (existing.ok && typeof existing.payload?.sha === 'string') {
                sha = existing.payload.sha;
            }

            const putResp = await gh(ghToken, `https://api.github.com/repos/${repoFullName}/contents/${encodeRepoPath(repoPath)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Seed ${repoPath}`,
                    content: contentB64,
                    ...(sha ? { sha } : {}),
                }),
            });

            seeded.push({ path: repoPath, ok: putResp.ok, status: putResp.status });
        }

        // Required: seed assets/app_icon.jpg (always JPG).
        const iconRepoPath = 'assets/app_icon.jpg';
        try {
            let sha: string | null = null;
            const existing = await gh(
                ghToken,
                `https://api.github.com/repos/${repoFullName}/contents/${encodeRepoPath(iconRepoPath)}`,
                { method: 'GET' }
            );
            if (existing.ok && typeof existing.payload?.sha === 'string') sha = existing.payload.sha;

            const putIcon = await gh(ghToken, `https://api.github.com/repos/${repoFullName}/contents/${encodeRepoPath(iconRepoPath)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Seed ${iconRepoPath}`,
                    content: iconB64,
                    ...(sha ? { sha } : {}),
                }),
            });

            seeded.push({ path: iconRepoPath, ok: putIcon.ok, status: putIcon.status });
            if (!putIcon.ok) {
                // Rollback: delete repo so the invariant "repos always have a JPG icon" holds.
                await gh(ghToken, `https://api.github.com/repos/${repoFullName}`, { method: 'DELETE' });
                json(res, 502, { message: 'Failed to seed app_icon.jpg; repo creation rolled back. Try again.' });
                return;
            }
        } catch {
            // Rollback: best-effort repo delete.
            try {
                await gh(ghToken, `https://api.github.com/repos/${repoFullName}`, { method: 'DELETE' });
            } catch {
                // ignore
            }
            json(res, 502, { message: 'Failed to seed app_icon.jpg; repo creation rolled back. Try again.' });
            return;
        }

        json(res, 200, {
            repoName,
            repoFullName,
            repoUrl: repoHtmlUrl,
            collaborators: collabResults,
            seeded,
        });
    } catch (error: any) {
        const status = Number(error?.statusCode) || 500;
        json(res, status, { message: String(error?.message || 'Server error').slice(0, 500) });
    }
}
