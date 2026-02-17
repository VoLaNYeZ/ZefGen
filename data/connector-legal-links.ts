import { supabase } from '../lib/supabase';

export type GenerateLegalLinksResponse = {
    status: 'generated' | 'confirm_required';
    urls: {
        privacy_policy_url: string;
        terms_of_use_url: string;
        support_form_url: string;
    };
    fingerprint: string;
    runId?: string | null;
};

export type LatestSucceededLegalLinksRun = {
    id: string;
    fingerprint: string;
    privacy_url: string;
    terms_url: string;
    support_url: string;
    created_at: string;
};

const AUTH_EXPIRED_MESSAGE = 'Auth session is invalid or expired. Please log in again.';

const isAuthRetryable = (responseError: any) => {
    const status = Number(responseError?.context?.status || 0);
    const msg = String(responseError?.message || '');
    return status === 401 || /invalid jwt|jwt/i.test(msg);
};

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

const normalizeFingerprintPart = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

export const computeLegalLinksFingerprint = async (payload: {
    companyName: string;
    appStoreName: string;
    accountEmail: string;
}) => {
    const source = [
        normalizeFingerprintPart(String(payload.companyName || '')),
        normalizeFingerprintPart(String(payload.appStoreName || '')),
        normalizeFingerprintPart(String(payload.accountEmail || '')),
    ].join('|');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return toHex(new Uint8Array(digest));
};

export const fetchLatestSucceededLegalLinksRun = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('connector_legal_links')
        .select('id,fingerprint,privacy_url,terms_url,support_url,created_at')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

export const invokeGenerateLegalLinks = async (payload: {
    appId: string;
    confirmRegenerate?: boolean;
    accessTokenHint?: string;
}) =>
    (async () => {
        const invoke = (token: string) =>
            supabase.functions.invoke<GenerateLegalLinksResponse>('generate-legal-links', {
                headers: {
                    apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || ''),
                    Authorization: `Bearer ${token}`,
                },
                body: {
                    appId: payload.appId,
                    confirmRegenerate: payload.confirmRegenerate === true,
                },
            });

        let token = await getCurrentAccessToken(payload.accessTokenHint);
        let response = await invoke(token);
        if (!response.error || !isAuthRetryable(response.error)) return response;

        try {
            token = await getRefreshedAccessToken();
            response = await invoke(token);
        } catch {
            throw new Error(AUTH_EXPIRED_MESSAGE);
        }

        if (response.error && isAuthRetryable(response.error)) {
            // One more attempt with the newest session snapshot in case another
            // tab/process rotated tokens between refresh and invoke.
            token = await getCurrentAccessToken(payload.accessTokenHint);
            response = await invoke(token);
        }

        if (response.error && isAuthRetryable(response.error)) {
            throw new Error(AUTH_EXPIRED_MESSAGE);
        }
        return response;
    })();
