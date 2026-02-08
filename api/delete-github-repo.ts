// Vercel Serverless Function: POST /api/delete-github-repo
//
// Deletes a GitHub repo previously created for an app and clears the stored link on `public.apps`.
// GitHub token is server-side only (GITHUB_TOKEN).

type DeleteGithubRepoRequestBody = {
    appId: string;
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

const verifySupabaseTokenAndGetUserId = async (token: string) => {
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

    if (!resp.ok) return null;
    const payload = await resp.json().catch(() => null);
    const id = String(payload?.id || '');
    return id || null;
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

        const userId = await verifySupabaseTokenAndGetUserId(token);
        if (!userId) {
            json(res, 401, { message: 'Unauthorized' });
            return;
        }

        const ghToken = process.env.GITHUB_TOKEN;
        if (!ghToken) {
            json(res, 500, { message: 'GitHub token not configured' });
            return;
        }

        const body: DeleteGithubRepoRequestBody =
            typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!isNonEmptyString(body.appId)) {
            json(res, 400, { message: 'Missing field: appId' });
            return;
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            json(res, 500, { message: 'Supabase not configured' });
            return;
        }

        // Read stored repo info for this app (RLS ensures user can only access their own rows).
        const appResp = await fetch(
            `${supabaseUrl}/rest/v1/apps?id=eq.${encodeURIComponent(body.appId)}&select=id,user_id,github_repo_full_name,github_repo_url`,
            {
                method: 'GET',
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        const appText = await appResp.text();
        let appPayload: any = null;
        try {
            appPayload = appText ? JSON.parse(appText) : null;
        } catch {
            appPayload = appText;
        }

        if (!appResp.ok) {
            const msg = String(appPayload?.message || appPayload || 'Failed to load app.');
            if (msg.toLowerCase().includes('github_repo_url') || msg.toLowerCase().includes('github_repo_full_name')) {
                json(res, 500, {
                    message:
                        'DB schema missing GitHub repo columns. Run supabase/migrations/2026-02-08_app_github_repo.sql in Supabase SQL editor, then retry.',
                });
                return;
            }
            json(res, 502, { message: 'Supabase query failed', details: appPayload });
            return;
        }

        const row = Array.isArray(appPayload) ? appPayload[0] : null;
        if (!row || String(row.user_id || '') !== userId) {
            json(res, 404, { message: 'App not found' });
            return;
        }

        const repoFullName = String(row.github_repo_full_name || '').trim();
        if (!repoFullName) {
            json(res, 404, { message: 'No GitHub repo stored for this app.' });
            return;
        }

        // Delete repo.
        const del = await gh(ghToken, `https://api.github.com/repos/${repoFullName}`, {
            method: 'DELETE',
        });
        if (!del.ok && del.status !== 404) {
            json(res, 502, { message: 'Failed to delete repo.', details: del.payload });
            return;
        }

        // Clear app fields (best-effort; RLS protected).
        const nowIso = new Date().toISOString();
        const patchResp = await fetch(
            `${supabaseUrl}/rest/v1/apps?id=eq.${encodeURIComponent(body.appId)}&user_id=eq.${encodeURIComponent(userId)}`,
            {
                method: 'PATCH',
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation',
                },
                body: JSON.stringify({
                    github_repo_url: null,
                    github_repo_full_name: null,
                    github_repo_updated_at: nowIso,
                }),
            }
        );

        if (!patchResp.ok) {
            const t = await patchResp.text();
            json(res, 502, { message: 'Repo deleted, but failed to clear app link.', details: t });
            return;
        }

        json(res, 200, { ok: true });
    } catch (error: any) {
        json(res, 500, { message: String(error?.message || 'Unexpected error') });
    }
}

