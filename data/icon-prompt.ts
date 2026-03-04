import { supabase } from '../lib/supabase';

export type GenerateNoBrandIconPromptPayload = {
    clientSpec: string;
    appName?: string;
    appAlias?: string;
    accessTokenHint?: string;
};

export type GenerateNoBrandIconPromptResponse =
    | {
          status: 'generated';
          text: string;
          model: string;
          usedLineCount: number;
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

const invokeApi = async (token: string, payload: GenerateNoBrandIconPromptPayload) => {
    const response = await fetch('/api/generate-icon-prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            clientSpec: payload.clientSpec,
            appName: payload.appName,
            appAlias: payload.appAlias,
        }),
    });

    const body = await response.json().catch(() => ({}));
    return { response, body };
};

export const generateNoBrandIconPrompt = async (
    payload: GenerateNoBrandIconPromptPayload
): Promise<GenerateNoBrandIconPromptResponse> => {
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
                        error: 'Unauthorized by icon prompt API. Check Vercel VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.',
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
                model: String(body?.model || ''),
                usedLineCount: Number(body?.usedLineCount || 0),
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
            error: String(body?.error || 'Unexpected response from icon prompt API.'),
        };
    } catch (err: any) {
        const message = String(err?.message || err);
        if (/invalid jwt|jwt/i.test(message)) {
            return { status: 'error', error: AUTH_EXPIRED_MESSAGE };
        }
        return { status: 'error', error: message || 'Failed to generate icon prompt.' };
    }
};
