// Vercel Serverless Function: GET /api/provider-status
//
// Returns a minimal "configured/not configured" view of provider env vars.
// Protected by Supabase Bearer token so this doesn't leak to anonymous users.

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

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed' });
    }

    const token = extractBearerToken(req.headers?.authorization ?? req.headers?.Authorization);
    if (!token) {
        return json(res, 401, { error: 'Missing bearer token' });
    }

    try {
        const ok = await verifySupabaseToken(token);
        if (!ok) {
            return json(res, 401, { error: 'Unauthorized' });
        }

        return json(res, 200, {
            replicateConfigured: Boolean(process.env.REPLICATE_API_TOKEN),
            openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        });
    } catch (err: any) {
        return json(res, 500, { error: String(err?.message || 'Server error').slice(0, 500) });
    }
}

