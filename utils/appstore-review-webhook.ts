import { slugify } from './slug';

export const APPSTORE_REVIEW_EVENT_TYPE = 'APP_STORE_VERSION_APP_VERSION_STATE_UPDATED';
export const APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY = 'APPSTORE_CONNECT_PRIVATE_KEY_P8';

const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');

const withTokenQuery = (baseUrl: string, publicToken: string) => {
    const rawBase = String(baseUrl || '').trim();
    if (!rawBase) return '';
    const separator = rawBase.includes('?') ? '&' : '?';
    return `${rawBase}${separator}token=${encodeURIComponent(publicToken)}`;
};

export const buildDirectAppstoreReviewWebhookUrl = (publicToken: string) => {
    const normalizedToken = String(publicToken || '').trim();
    if (!normalizedToken) return '';

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    if (!supabaseUrl) return '';
    return withTokenQuery(`${supabaseUrl}/functions/v1/appstore-review-webhook`, normalizedToken);
};

export const buildAppstoreReviewWebhookUrl = (publicToken: string, publicSubdomain?: string | null) => {
    const normalizedToken = String(publicToken || '').trim();
    if (!normalizedToken) return '';

    const managedUrl = buildManagedAppstoreReviewWebhookUrl({
        publicToken: normalizedToken,
        publicSubdomain,
    });
    if (managedUrl) return managedUrl;

    const publicBaseUrl = String(import.meta.env.VITE_APPSTORE_REVIEW_WEBHOOK_BASE_URL || '').trim();
    if (publicBaseUrl) return withTokenQuery(publicBaseUrl, normalizedToken);

    return buildDirectAppstoreReviewWebhookUrl(normalizedToken);
};

export const normalizeAppstoreReviewProxyRootDomain = (value: string) =>
    String(value || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+.*$/g, '')
        .replace(/\.+$/g, '')
        .toLowerCase();

export const getAppstoreReviewProxyRootDomain = () =>
    normalizeAppstoreReviewProxyRootDomain(String(import.meta.env.VITE_APPSTORE_REVIEW_PROXY_ROOT_DOMAIN || ''));

export const normalizeAppstoreReviewPublicSubdomain = (value: string) => {
    const normalized = slugify(String(value || '').trim() || 'app')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63)
        .replace(/-+$/g, '');
    return normalized || 'app';
};

export const buildManagedAppstoreReviewPublicPageUrl = (payload: {
    publicSubdomain?: string | null;
}) => {
    const normalizedSubdomain = String(payload.publicSubdomain || '').trim();
    const rootDomain = getAppstoreReviewProxyRootDomain();
    if (!normalizedSubdomain || !rootDomain) return '';
    return `https://${normalizedSubdomain}.${rootDomain}/`;
};

export const buildManagedAppstoreReviewWebhookUrl = (payload: {
    publicToken: string;
    publicSubdomain?: string | null;
}) => {
    const normalizedToken = String(payload.publicToken || '').trim();
    const normalizedSubdomain = String(payload.publicSubdomain || '').trim();
    const rootDomain = getAppstoreReviewProxyRootDomain();
    if (!normalizedToken || !normalizedSubdomain || !rootDomain) return '';
    return withTokenQuery(`https://${normalizedSubdomain}.${rootDomain}/appstore-review`, normalizedToken);
};

export const buildManagedAppstoreReviewBridgeUrl = (payload: {
    publicSubdomain?: string | null;
    path: string;
}) => {
    const normalizedSubdomain = String(payload.publicSubdomain || '').trim();
    const normalizedPath = `/${String(payload.path || '').trim().replace(/^\/+/, '')}`;
    const rootDomain = getAppstoreReviewProxyRootDomain();
    if (!normalizedSubdomain || !rootDomain) return '';
    return `https://${normalizedSubdomain}.${rootDomain}${normalizedPath}`;
};

export const extractManagedAppstoreReviewPublicSubdomain = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    const rootDomain = getAppstoreReviewProxyRootDomain();
    if (!raw || !rootDomain) return '';
    try {
        const parsed = new URL(raw);
        const host = parsed.host.toLowerCase();
        const suffix = `.${rootDomain}`;
        if (!host.endsWith(suffix)) return '';
        return host.slice(0, -suffix.length).replace(/\.+$/g, '').trim();
    } catch {
        return '';
    }
};

export const isManagedAppstoreReviewWebhookUrl = (value: string | null | undefined) =>
    Boolean(extractManagedAppstoreReviewPublicSubdomain(value));

export const buildSuggestedAppstoreReviewPublicSubdomain = (nameHint: string) =>
    String(nameHint || '').trim() ? normalizeAppstoreReviewPublicSubdomain(nameHint) : '';

export const buildWildcardAppstoreReviewWebhookUrl = (payload: {
    publicToken: string;
    publicSubdomain?: string | null;
}) => {
    const managedUrl = buildManagedAppstoreReviewWebhookUrl(payload);
    if (managedUrl) return managedUrl;
    return buildAppstoreReviewWebhookUrl(payload.publicToken);
};

export const generateAppstoreReviewWebhookToken = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
};

export const generateAppstoreReviewWebhookSecret = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
};

export const formatAppstoreReviewState = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
};
