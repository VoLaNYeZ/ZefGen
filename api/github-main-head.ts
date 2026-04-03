// Vercel Serverless Function: POST /api/github-main-head
//
// Resolves the current GitHub main HEAD SHA for an app-owned repository.
// GitHub token is server-side only (GITHUB_TOKEN).

type GithubMainHeadRequestBody = {
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
    const id = String(payload?.id || '').trim();
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

const toRepoFullNameFromUrl = (url: string | null | undefined) => {
    let value = String(url || '').trim();
    if (!value) return '';
    value = value.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
    const match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    return match ? `${match[1]}/${match[2]}` : '';
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

        const body: GithubMainHeadRequestBody =
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
            json(res, 502, { message: 'Supabase query failed', details: appPayload });
            return;
        }

        const row = Array.isArray(appPayload) ? appPayload[0] : null;
        if (!row || String(row.user_id || '') !== userId) {
            json(res, 404, { message: 'App not found' });
            return;
        }

        const repoFullName =
            String(row.github_repo_full_name || '').trim() || toRepoFullNameFromUrl(row.github_repo_url);
        if (!repoFullName) {
            json(res, 404, { message: 'No GitHub repo stored for this app.' });
            return;
        }

        const branch = 'main';
        const branchResp = await gh(
            ghToken,
            `https://api.github.com/repos/${repoFullName}/branches/${encodeURIComponent(branch)}`
        );
        if (!branchResp.ok) {
            json(res, 502, { message: 'Failed to load GitHub main HEAD.', details: branchResp.payload });
            return;
        }

        const sha = String(branchResp.payload?.commit?.sha || '').trim();
        if (!sha) {
            json(res, 502, { message: 'GitHub main HEAD response did not include a commit SHA.' });
            return;
        }

        json(res, 200, {
            ok: true,
            branch,
            repoFullName,
            sha,
        });
    } catch (error: any) {
        json(res, 500, { message: String(error?.message || 'Unexpected error') });
    }
}
