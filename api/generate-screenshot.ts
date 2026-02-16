// Vercel Serverless Function: POST /api/generate-screenshot
//
// This runs server-side so provider API keys are never exposed to the Vite client.

import Replicate from 'replicate';

type ProviderId = 'replicate:nano-banana-pro' | 'replicate:seedream-4' | 'openai:gpt-image-1.5';

type GenerateScreenshotRequestBody = {
    providerId: ProviderId;
    prompt: string;
    simulatorImageUrl: string;
    brandRefImageUrl: string;
    width: number;
    height: number;
    // Replicate providers can return a direct output URL to speed up UI (no base64 in JSON).
    // OpenAI always returns base64.
    responseMode?: 'b64' | 'url';
};

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-ZefGen-Api', 'generate-screenshot');
    const deploySha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (deploySha) {
        res.setHeader('X-ZefGen-Deploy', deploySha);
    }
    res.end(JSON.stringify(payload));
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const extractBearerToken = (authorization: unknown) => {
    if (!isNonEmptyString(authorization)) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
};

const extractFirstUrl = (output: unknown): string | null => {
    if (typeof output === 'string') return output;
    if (typeof URL !== 'undefined' && output instanceof URL) return output.toString();

    if (Array.isArray(output)) {
        for (const item of output) {
            const url = extractFirstUrl(item);
            if (url) return url;
        }
        return null;
    }

    if (output && typeof output === 'object') {
        const maybeAny = output as any;

        // Replicate SDK may return FileOutput objects by default (url(): URL, toString(): string).
        if (typeof maybeAny.url === 'function') {
            try {
                const url = maybeAny.url();
                if (url) return String(url);
            } catch {
                // ignore
            }
        }
        if (typeof maybeAny.toString === 'function') {
            try {
                const value = maybeAny.toString();
                if (typeof value === 'string' && (value.startsWith('https:') || value.startsWith('data:'))) {
                    return value;
                }
            } catch {
                // ignore
            }
        }

        // URL-like objects
        if (typeof maybeAny.href === 'string') return maybeAny.href;

        if (typeof maybeAny.url === 'string') return maybeAny.url;
        if (typeof maybeAny.output === 'string') return maybeAny.output;
        if (Array.isArray(maybeAny.output)) {
            for (const item of maybeAny.output) {
                const url = extractFirstUrl(item);
                if (url) return url;
            }
        }
    }

    return null;
};

const fetchAsBlob = async (url: string) => {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`Failed to fetch image (${resp.status}).`);
    }
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await resp.arrayBuffer();
    return new Blob([arrayBuffer], { type: contentType });
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

const runReplicateNanoBananaPro = async (payload: {
    prompt: string;
    simulatorImageUrl: string;
    brandRefImageUrl: string;
    responseMode?: 'b64' | 'url';
}) => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        const error = new Error('Provider not configured');
        (error as any).statusCode = 500;
        throw error;
    }

    try {
        const replicate = new Replicate({ auth: token });
        const output = await replicate.run('google/nano-banana-pro', {
            input: {
                prompt: payload.prompt,
                image_input: [payload.simulatorImageUrl, payload.brandRefImageUrl],
                aspect_ratio: 'match_input_image',
                resolution: '2K',
                output_format: 'jpg',
                safety_filter_level: 'block_only_high',
            },
        });

        const url = extractFirstUrl(output);
        if (!url) {
            throw new Error('Replicate response missing output URL.');
        }

        if (payload.responseMode === 'url') {
            return { outputUrl: url } as const;
        }

        const imageResp = await fetch(url);
        if (!imageResp.ok) {
            throw new Error(`Failed to fetch Replicate output (${imageResp.status}).`);
        }
        const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageResp.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString('base64');

        return { mimeType, b64 } as const;
    } catch (err: any) {
        const message = String(err?.message || 'Replicate request failed').slice(0, 500);
        const status =
            Number(err?.statusCode) ||
            Number(err?.status) ||
            Number(err?.response?.status) ||
            502;
        const looksLikeInsufficientCredit =
            status === 402 || /insufficient\s+credit/i.test(message) || /payment\s+required/i.test(message);
        if (looksLikeInsufficientCredit) {
            const billingUrl = 'https://replicate.com/account/billing#billing';
            const error = new Error(
                `Replicate: insufficient credit for this token. Check billing or token/account ownership: ${billingUrl}.`
            );
            (error as any).statusCode = 402;
            throw error;
        }

        const error = new Error(message);
        (error as any).statusCode = status;
        throw error;
    }
};

const runReplicateSeedream4 = async (payload: {
    prompt: string;
    simulatorImageUrl: string;
    brandRefImageUrl: string;
    width: number;
    height: number;
    responseMode?: 'b64' | 'url';
}) => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        const error = new Error('Provider not configured');
        (error as any).statusCode = 500;
        throw error;
    }

    try {
        const replicate = new Replicate({ auth: token });
        const output = await replicate.run('bytedance/seedream-4', {
            input: {
                // Use strict "custom" sizing so we can hit App Store pixel-perfect targets.
                size: 'custom',
                width: payload.width,
                height: payload.height,
                prompt: payload.prompt,
                image_input: [payload.simulatorImageUrl, payload.brandRefImageUrl],
                sequential_image_generation: 'disabled',
                max_images: 1,
            },
        });

        const url = extractFirstUrl(output);
        if (!url) {
            throw new Error('Replicate response missing output URL.');
        }

        if (payload.responseMode === 'url') {
            return { outputUrl: url } as const;
        }

        const imageResp = await fetch(url);
        if (!imageResp.ok) {
            throw new Error(`Failed to fetch Replicate output (${imageResp.status}).`);
        }
        const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageResp.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString('base64');

        return { mimeType, b64 } as const;
    } catch (err: any) {
        const message = String(err?.message || 'Replicate request failed').slice(0, 500);
        const status =
            Number(err?.statusCode) ||
            Number(err?.status) ||
            Number(err?.response?.status) ||
            502;
        const looksLikeInsufficientCredit =
            status === 402 || /insufficient\s+credit/i.test(message) || /payment\s+required/i.test(message);
        if (looksLikeInsufficientCredit) {
            const billingUrl = 'https://replicate.com/account/billing#billing';
            const error = new Error(
                `Replicate: insufficient credit for this token. Check billing or token/account ownership: ${billingUrl}.`
            );
            (error as any).statusCode = 402;
            throw error;
        }

        const error = new Error(message);
        (error as any).statusCode = status;
        throw error;
    }
};

const runOpenAI = async (payload: {
    prompt: string;
    simulatorImageUrl: string;
    brandRefImageUrl: string;
    width: number;
    height: number;
}) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const error = new Error('Provider not configured');
        (error as any).statusCode = 500;
        throw error;
    }

    const form = new FormData();
    form.append('model', 'gpt-image-1.5');
    form.append('prompt', payload.prompt);
    form.append('input_fidelity', 'high');
    // OpenAI only supports a limited set of sizes. For icons we can request an exact square.
    const size =
        payload.width === 1024 && payload.height === 1024
            ? '1024x1024'
            : 'auto';
    form.append('size', size);
    form.append('response_format', 'b64_json');

    const simulatorBlob = await fetchAsBlob(payload.simulatorImageUrl);
    const brandRefBlob = await fetchAsBlob(payload.brandRefImageUrl);
    form.append('image[]', simulatorBlob, 'simulator.png');
    form.append('image[]', brandRefBlob, 'brand-reference.png');

    const resp = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: form,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const message = (data as any)?.error?.message || `OpenAI request failed (${resp.status}).`;
        const error = new Error(message);
        (error as any).statusCode = resp.status;
        throw error;
    }

    const b64 = (data as any)?.data?.[0]?.b64_json;
    if (!isNonEmptyString(b64)) {
        throw new Error('OpenAI response missing b64_json.');
    }

    return { mimeType: 'image/png', b64 };
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
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

        const body: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const parsed = body as Partial<GenerateScreenshotRequestBody>;

        if (
            !parsed ||
            !isNonEmptyString(parsed.providerId) ||
            !isNonEmptyString(parsed.prompt) ||
            !isNonEmptyString(parsed.simulatorImageUrl) ||
            !isNonEmptyString(parsed.brandRefImageUrl) ||
            typeof parsed.width !== 'number' ||
            typeof parsed.height !== 'number'
        ) {
            return json(res, 400, { error: 'Missing required fields.' });
        }

        const providerId = parsed.providerId as ProviderId;
        if (
            providerId !== 'replicate:nano-banana-pro' &&
            providerId !== 'replicate:seedream-4' &&
            providerId !== 'openai:gpt-image-1.5'
        ) {
            return json(res, 400, { error: 'Invalid providerId.' });
        }

        console.log(`[generate-screenshot] provider=${providerId}`);

        const responseMode = parsed.responseMode === 'url' ? 'url' : 'b64';
        let result: { mimeType: string; b64: string } | { outputUrl: string };
        if (providerId === 'replicate:nano-banana-pro') {
            result = await runReplicateNanoBananaPro({
                prompt: parsed.prompt,
                simulatorImageUrl: parsed.simulatorImageUrl,
                brandRefImageUrl: parsed.brandRefImageUrl,
                responseMode,
            });
        } else if (providerId === 'replicate:seedream-4') {
            result = await runReplicateSeedream4({
                prompt: parsed.prompt,
                simulatorImageUrl: parsed.simulatorImageUrl,
                brandRefImageUrl: parsed.brandRefImageUrl,
                width: parsed.width,
                height: parsed.height,
                responseMode,
            });
        } else {
            result = await runOpenAI({
                prompt: parsed.prompt,
                simulatorImageUrl: parsed.simulatorImageUrl,
                brandRefImageUrl: parsed.brandRefImageUrl,
                width: parsed.width,
                height: parsed.height,
            });
        }

        return json(res, 200, result);
    } catch (err: any) {
        const statusCode = Number(err?.statusCode) || 502;
        const message = String(err?.message || 'Provider request failed').slice(0, 500);
        console.error('[generate-screenshot] error', { statusCode, message });
        return json(res, statusCode, { error: message });
    }
}
