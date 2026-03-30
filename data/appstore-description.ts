import { supabase } from '../lib/supabase';

export type GenerateAppstoreDescriptionPayload = {
    clientSpec: string;
    appStoreName?: string;
    companyName?: string;
    appCategoryHint?: string;
    generateDescription?: boolean;
    existingDescription?: string;
    generateSubtitleOptions?: boolean;
    generateKeywords?: boolean;
    accessTokenHint?: string;
};

export type GenerateAppstoreDescriptionResponse =
    | {
          status: 'generated';
          text: string;
          subtitleOptions: string[];
          keywords: string;
          promptKey: string;
          model: string;
          descriptionStatus: 'generated' | 'reused';
          metadataStatus: 'generated' | 'skipped' | 'error';
          metadataError: string | null;
      }
    | {
          status: 'skipped_short_spec';
          reason: string;
      }
    | {
          status: 'error';
          error: string;
      };

const AUTH_EXPIRED_MESSAGE = 'Auth session is invalid or expired. Please log in again.';

const decodeJwtExpMs = (token: string) => {
    try {
        const payloadRaw = String(token || '').split('.')[1] || '';
        if (!payloadRaw) return null;
        const base64 = payloadRaw.replace(/-/g, '+').replace(/_/g, '/');
        const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        const parsed = JSON.parse(atob(normalized));
        const exp = Number(parsed?.exp || 0);
        if (!Number.isFinite(exp) || exp <= 0) return null;
        return exp * 1000;
    } catch {
        return null;
    }
};

const isUsableToken = (token: string, minTtlMs = 30_000) => {
    const raw = String(token || '').trim();
    if (!raw) return false;
    const expMs = decodeJwtExpMs(raw);
    if (!expMs) return true;
    return expMs - Date.now() > minTtlMs;
};

const getCurrentAccessToken = async (preferred?: string) => {
    const preferredToken = String(preferred || '').trim();
    if (isUsableToken(preferredToken)) return preferredToken;

    const current = await supabase.auth.getSession();
    if (current.error) throw current.error;
    const token = String(current.data.session?.access_token || '').trim();
    if (isUsableToken(token)) return token;

    if (preferredToken) return preferredToken;
    if (token) return token;
    throw new Error(AUTH_EXPIRED_MESSAGE);
};

const getRefreshedAccessToken = async () => {
    const refreshed = await supabase.auth.refreshSession();
    const refreshedToken = String(refreshed.data.session?.access_token || '').trim();
    if (!refreshed.error && refreshedToken) return refreshedToken;

    const current = await supabase.auth.getSession();
    if (current.error) throw current.error;
    const token = String(current.data.session?.access_token || '').trim();
    if (token) return token;

    if (refreshed.error) throw refreshed.error;
    throw new Error(AUTH_EXPIRED_MESSAGE);
};

const isAuthRetryable = (status: number, message: string) => {
    const normalized = String(message || '').toLowerCase();
    return status === 401 || normalized.includes('invalid jwt') || normalized.includes('jwt');
};

const invokeApi = async (token: string, payload: GenerateAppstoreDescriptionPayload) => {
    const response = await fetch('/api/generate-appstore-description', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            clientSpec: payload.clientSpec,
            appStoreName: payload.appStoreName,
            companyName: payload.companyName,
            appCategoryHint: payload.appCategoryHint,
            generateDescription: payload.generateDescription !== false,
            existingDescription: payload.existingDescription,
            generateSubtitleOptions: payload.generateSubtitleOptions !== false,
            generateKeywords: payload.generateKeywords !== false,
        }),
    });

    const body = await response.json().catch(() => ({}));
    return { response, body };
};

export const generateAppstoreDescription = async (
    payload: GenerateAppstoreDescriptionPayload
): Promise<GenerateAppstoreDescriptionResponse> => {
    try {
        let token = await getCurrentAccessToken(payload.accessTokenHint);
        let { response, body } = await invokeApi(token, payload);

        if (!response.ok) {
            const status = Number(response.status || 0);
            const message = String(body?.error || body?.message || `Request failed (${status || 'unknown'})`);
            if (isAuthRetryable(status, message)) {
                token = await getRefreshedAccessToken();
                ({ response, body } = await invokeApi(token, payload));
            }
        }

        if (!response.ok) {
            const status = Number(response.status || 0);
            const message = String(body?.error || body?.message || `Request failed (${status || 'unknown'})`);
            if (isAuthRetryable(status, message)) {
                // One more attempt with the latest session snapshot in case another
                // tab/process rotated tokens between refresh and invoke.
                token = await getCurrentAccessToken(payload.accessTokenHint);
                ({ response, body } = await invokeApi(token, payload));
            }
        }

        if (!response.ok) {
            const status = Number(response.status || 0);
            const message = String(body?.error || body?.message || `Request failed (${status || 'unknown'})`);
            if (isAuthRetryable(status, message)) {
                const tokenExpMs = decodeJwtExpMs(token);
                if (tokenExpMs && tokenExpMs - Date.now() > 30_000) {
                    return {
                        status: 'error',
                        error: 'Unauthorized by description API. Check Vercel VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.',
                    };
                }
                throw new Error(AUTH_EXPIRED_MESSAGE);
            }
            return {
                status: 'error',
                error: message,
            };
        }

        const parsedStatus = String(body?.status || '').trim();
        if (parsedStatus === 'generated') {
            return {
                status: 'generated',
                text: String(body?.text || ''),
                subtitleOptions: Array.isArray(body?.subtitleOptions)
                    ? body.subtitleOptions.map((item: unknown) => String(item || '')).filter(Boolean)
                    : [],
                keywords: String(body?.keywords || ''),
                promptKey: String(body?.promptKey || ''),
                model: String(body?.model || ''),
                descriptionStatus: body?.descriptionStatus === 'reused' ? 'reused' : 'generated',
                metadataStatus:
                    body?.metadataStatus === 'error'
                        ? 'error'
                        : body?.metadataStatus === 'skipped'
                          ? 'skipped'
                          : 'generated',
                metadataError: String(body?.metadataError || '').trim() || null,
            };
        }

        if (parsedStatus === 'skipped_short_spec') {
            return {
                status: 'skipped_short_spec',
                reason: String(body?.reason || ''),
            };
        }

        return {
            status: 'error',
            error: String(body?.error || 'Unexpected response from appstore description API.'),
        };
    } catch (err: any) {
        const message = String(err?.message || err);
        if (/invalid jwt|jwt/i.test(message)) {
            return { status: 'error', error: AUTH_EXPIRED_MESSAGE };
        }
        return { status: 'error', error: message || 'Failed to generate App Store description.' };
    }
};
