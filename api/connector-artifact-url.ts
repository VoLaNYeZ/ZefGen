import { createClient } from '@supabase/supabase-js';

type ConnectorArtifactUrlRequestBody = {
    artifactId?: string;
    expiresIn?: number;
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

const getSupabaseUrl = () => {
    const value = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!value) throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
    return value;
};

const getSupabaseAnonKey = () => {
    const value = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!value) throw new Error('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.');
    return value;
};

const getSupabaseServiceRoleKey = () => {
    const value = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!value) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
    return value;
};

const verifySupabaseToken = async (token: string) => {
    const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: getSupabaseAnonKey(),
            Authorization: `Bearer ${token}`,
        },
    });

    return response.ok;
};

const createUserSupabaseClient = (token: string) =>
    createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });

const createServiceSupabaseClient = () =>
    createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
    });

const normalizeExpiresIn = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 3600;
    return Math.max(60, Math.min(86400, Math.floor(numeric)));
};

export default async function handler(req: any, res: any) {
    try {
        if (req.method !== 'POST') {
            json(res, 405, { message: 'Method not allowed' });
            return;
        }

        const token = extractBearerToken(req.headers?.authorization ?? req.headers?.Authorization);
        if (!token) {
            json(res, 401, { message: 'Missing Authorization: Bearer token' });
            return;
        }

        const tokenValid = await verifySupabaseToken(token);
        if (!tokenValid) {
            json(res, 401, { message: 'Unauthorized' });
            return;
        }

        const body: ConnectorArtifactUrlRequestBody =
            typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const artifactId = String(body.artifactId || '').trim();
        if (!artifactId) {
            json(res, 400, { message: 'Missing field: artifactId' });
            return;
        }

        const userSupabase = createUserSupabaseClient(token);
        const { data: artifact, error: artifactError } = await userSupabase
            .from('connector_job_artifacts')
            .select('id, bucket, object_path')
            .eq('id', artifactId)
            .maybeSingle();

        if (artifactError) {
            json(res, 500, { message: String(artifactError.message || artifactError) });
            return;
        }

        if (!artifact) {
            json(res, 404, { message: 'Artifact not found.' });
            return;
        }

        const bucket = String((artifact as any).bucket || '').trim();
        const objectPath = String((artifact as any).object_path || '').trim();
        if (!bucket || !objectPath) {
            json(res, 404, { message: 'Artifact file reference is missing.' });
            return;
        }

        const serviceSupabase = createServiceSupabaseClient();
        const { data, error } = await serviceSupabase.storage
            .from(bucket)
            .createSignedUrl(objectPath, normalizeExpiresIn(body.expiresIn));

        if (error || !data?.signedUrl) {
            json(res, 500, { message: String(error?.message || 'Failed to create artifact signed URL.') });
            return;
        }

        json(res, 200, {
            signedUrl: data.signedUrl,
        });
    } catch (error: any) {
        json(res, 500, { message: String(error?.message || error || 'Unexpected server error.') });
    }
}
