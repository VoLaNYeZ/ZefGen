import { supabase } from '../lib/supabase';
import type {
    AppstoreConnectAppCandidate,
    AppstoreReviewWebhook,
    AppstoreReviewWebhookStatus,
} from '../types/zefgen';
import { buildManagedAppstoreReviewBridgeUrl } from '../utils/appstore-review-webhook';

const AUTH_EXPIRED_MESSAGE = 'Auth session is invalid or expired. Please log in again.';

const isAuthRetryable = (status: number, errorMessage: string) =>
    status === 401 || /invalid jwt|jwt/i.test(String(errorMessage || ''));

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

const parseApiResponse = async (response: Response) => {
    const raw = await response.text();
    let payload: any = null;
    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = { error: raw };
        }
    }

    if (!response.ok) {
        const error = new Error(String(payload?.error || `Request failed (${response.status})`));
        (error as any).context = {
            status: response.status,
            payload,
        };
        throw error;
    }

    return payload;
};

const requestApi = async <T>(payload: {
    path?: string;
    url?: string;
    method?: 'GET' | 'POST';
    body?: Record<string, any>;
    accessTokenHint?: string;
}) =>
    (async () => {
        const invoke = async (token: string) => {
            const targetUrl = String(payload.url || payload.path || '').trim();
            const response = await fetch(targetUrl, {
                method: payload.method || 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(payload.body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: payload.body ? JSON.stringify(payload.body) : undefined,
            });
            return parseApiResponse(response) as Promise<T>;
        };

        let token = await getCurrentAccessToken(payload.accessTokenHint);
        try {
            return await invoke(token);
        } catch (error: any) {
            const status = Number(error?.context?.status || 0);
            const errorMessage = String(error?.message || '');
            if (!isAuthRetryable(status, errorMessage)) throw error;
        }

        try {
            token = await getRefreshedAccessToken();
        } catch {
            throw new Error(AUTH_EXPIRED_MESSAGE);
        }

        try {
            return await invoke(token);
        } catch (error: any) {
            const status = Number(error?.context?.status || 0);
            const errorMessage = String(error?.message || '');
            if (!isAuthRetryable(status, errorMessage)) throw error;
        }

        token = await getCurrentAccessToken(payload.accessTokenHint);
        const response = await invoke(token);
        return response;
    })();

const requestBridgeApi = async <T>(payload: {
    publicSubdomain: string;
    path: string;
    method?: 'GET' | 'POST';
    body?: Record<string, any>;
    accessTokenHint?: string;
}) => {
    const url = buildManagedAppstoreReviewBridgeUrl({
        publicSubdomain: payload.publicSubdomain,
        path: payload.path,
    });
    if (!url) {
        throw new Error('Public subdomain is required before calling the appshelp.cc Apple bridge.');
    }
    return requestApi<T>({
        url,
        method: payload.method,
        body: payload.body,
        accessTokenHint: payload.accessTokenHint,
    });
};

export const fetchAppstoreReviewWebhookStatus = async (payload: {
    appId: string;
    accessTokenHint?: string;
}) =>
    requestApi<AppstoreReviewWebhookStatus>({
        path: `/api/appstore-review-webhook-status?appId=${encodeURIComponent(payload.appId)}`,
        method: 'GET',
        accessTokenHint: payload.accessTokenHint,
    });

export const fetchAppstoreReviewAppleApps = async (payload: {
    publicSubdomain: string;
    accessTokenHint?: string;
}) =>
    requestBridgeApi<{
        candidates: AppstoreConnectAppCandidate[];
        auto_bound_app_id: string | null;
        webhook: AppstoreReviewWebhook | null;
    }>({
        publicSubdomain: payload.publicSubdomain,
        path: '/_bridge/appstore/apps',
        method: 'POST',
        accessTokenHint: payload.accessTokenHint,
    });

export const syncAppstoreReviewWebhook = async (payload: {
    publicSubdomain: string;
    accessTokenHint?: string;
}) =>
    requestBridgeApi<{
        ok: boolean;
        webhook: AppstoreReviewWebhook;
        effective_public_webhook_url: string;
        internal_listener_url: string;
    }>({
        publicSubdomain: payload.publicSubdomain,
        path: '/_bridge/appstore/sync',
        method: 'POST',
        accessTokenHint: payload.accessTokenHint,
    });

export const pingAppstoreReviewWebhook = async (payload: {
    publicSubdomain: string;
    accessTokenHint?: string;
}) =>
    requestBridgeApi<{
        ok: boolean;
        data: Record<string, any> | null;
    }>({
        publicSubdomain: payload.publicSubdomain,
        path: '/_bridge/appstore/ping',
        method: 'POST',
        accessTokenHint: payload.accessTokenHint,
    });
