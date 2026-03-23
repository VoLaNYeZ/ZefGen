import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const APPSTORE_REVIEW_EVENT_TYPE = 'APP_STORE_VERSION_APP_VERSION_STATE_UPDATED';
export const APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY = 'APPSTORE_CONNECT_PRIVATE_KEY_P8';

const APPLE_API_ORIGIN = 'https://api.appstoreconnect.apple.com';
const WEBHOOK_EVENT_TYPES = [APPSTORE_REVIEW_EVENT_TYPE];
const WEBHOOK_SELECT = [
    'app_id',
    'user_id',
    'public_token',
    'secret',
    'public_subdomain',
    'public_page_published_at',
    'key_mode',
    'key_id',
    'issuer_id',
    'public_webhook_url',
    'asc_app_id',
    'asc_app_name',
    'asc_bundle_id',
    'apple_webhook_id',
    'latest_event_type',
    'latest_review_state',
    'latest_previous_state',
    'latest_event_at',
    'last_snapshot_at',
    'last_delivery_at',
    'last_delivery_status',
    'last_error',
    'last_sync_at',
    'last_sync_status',
    'last_sync_error',
    'created_at',
    'updated_at',
].join(', ');
const EVENT_SELECT = [
    'id',
    'app_id',
    'user_id',
    'event_type',
    'payload_type',
    'state_from',
    'state_to',
    'event_at',
    'delivery_status',
    'raw_payload',
    'created_at',
].join(', ');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const inputError = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
};

const env = (primaryKey, fallbackKeys = []) => {
    const keys = [primaryKey, ...fallbackKeys];
    for (const key of keys) {
        const value = String(process.env[key] || '').trim();
        if (value) return value;
    }
    return '';
};

export const json = (res, status, payload) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
};

export const readHeader = (req, key) => {
    const value = req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()] ?? req?.headers?.[key.toUpperCase()];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
};

export const buildRequestUrl = (req) => {
    const host = readHeader(req, 'x-forwarded-host') || readHeader(req, 'host') || 'localhost';
    const proto = readHeader(req, 'x-forwarded-proto') || 'http';
    return new URL(String(req?.url || '/'), `${proto}://${host}`);
};

export const getQueryParam = (req, key) => {
    const fromQuery = req?.query?.[key];
    if (Array.isArray(fromQuery)) return String(fromQuery[0] || '').trim();
    if (isNonEmptyString(fromQuery)) return fromQuery.trim();
    return String(buildRequestUrl(req).searchParams.get(key) || '').trim();
};

export const readJsonBody = async (req) => {
    if (req?.body != null && req.body !== '') {
        if (typeof req.body === 'string') {
            return req.body.trim() ? JSON.parse(req.body) : {};
        }
        return req.body;
    }

    let rawBody = '';
    for await (const chunk of req) {
        rawBody += String(chunk || '');
    }
    if (!rawBody.trim()) return {};
    return JSON.parse(rawBody);
};

export const extractBearerToken = (authorization) => {
    if (!isNonEmptyString(authorization)) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
};

export const createUserSupabaseClient = () => {
    const supabaseUrl = env('VITE_SUPABASE_URL', ['SUPABASE_URL']);
    const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']);
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY).');
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
};

export const createServiceSupabaseClient = () => {
    const supabaseUrl = env('VITE_SUPABASE_URL', ['SUPABASE_URL']);
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', ['SERVICE_ROLE_KEY']);
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.');
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
};

export const requireAuthenticatedUser = async (req) => {
    const token = extractBearerToken(readHeader(req, 'authorization'));
    if (!token) {
        const error = new Error('Missing Authorization bearer token.');
        error.status = 401;
        throw error;
    }

    const supabase = createUserSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
        const authError = new Error('Auth session is invalid or expired. Please log in again.');
        authError.status = 401;
        throw authError;
    }
    return { token, user: data.user };
};

export const requireOwnedApp = async ({ service, userId, appId }) => {
    const normalizedAppId = String(appId || '').trim();
    if (!normalizedAppId) {
        const error = new Error('Missing appId.');
        error.status = 400;
        throw error;
    }

    const { data, error } = await service
        .from('apps')
        .select('id, name, alias')
        .eq('id', normalizedAppId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!data) {
        const appError = new Error('App not found.');
        appError.status = 404;
        throw appError;
    }
    return data;
};

export const fetchWebhookRow = async ({ service, userId, appId }) => {
    const { data, error } = await service
        .from('appstore_review_webhooks')
        .select(WEBHOOK_SELECT)
        .eq('user_id', userId)
        .eq('app_id', appId)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

export const ensureWebhookRow = async ({ service, userId, appId }) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await service
        .from('appstore_review_webhooks')
        .upsert(
            {
                app_id: appId,
                user_id: userId,
                updated_at: nowIso,
            },
            { onConflict: 'app_id' }
        )
        .select(WEBHOOK_SELECT)
        .single();
    if (error) throw error;
    return data;
};

export const updateWebhookRow = async ({ service, userId, appId, patch }) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await service
        .from('appstore_review_webhooks')
        .update({ ...patch, updated_at: nowIso })
        .eq('user_id', userId)
        .eq('app_id', appId)
        .select(WEBHOOK_SELECT)
        .single();
    if (error) throw error;
    return data;
};

export const fetchBundleIdForApp = async ({ service, userId, appId }) => {
    const { data, error } = await service
        .from('connector_app_configs')
        .select('variables')
        .eq('user_id', userId)
        .eq('app_id', appId)
        .maybeSingle();
    if (error) throw error;
    const bundleId = String(data?.variables?.bundle_id || '').trim();
    return bundleId || null;
};

export const fetchAppNamingHints = async ({ service, userId, appId }) => {
    const [appRes, configRes] = await Promise.all([
        service.from('apps').select('name, alias').eq('id', appId).eq('user_id', userId).maybeSingle(),
        service.from('connector_app_configs').select('variables').eq('app_id', appId).eq('user_id', userId).maybeSingle(),
    ]);
    if (appRes.error) throw appRes.error;
    if (configRes.error) throw configRes.error;
    return {
        appName: String(appRes.data?.name || '').trim(),
        appAlias: String(appRes.data?.alias || '').trim(),
        appstoreName: String(configRes.data?.variables?.appstore_name || '').trim(),
    };
};

export const findAvailablePublicSubdomain = async ({ service, base, currentAppId }) => {
    const normalizedBase = normalizePublicSubdomain(base);
    let suffix = 1;
    while (suffix < 10_000) {
        const candidate = withSubdomainSuffix(normalizedBase, suffix);
        const { data, error } = await service
            .from('appstore_review_webhooks')
            .select('app_id')
            .eq('public_subdomain', candidate)
            .limit(1);
        if (error) throw error;
        const conflict = Array.isArray(data) && data.some((row) => String(row?.app_id || '').trim() !== String(currentAppId || '').trim());
        if (!conflict) return candidate;
        suffix += 1;
    }
    throw new Error('Could not allocate a unique public subdomain.');
};

export const claimManagedPublicSubdomain = async ({ service, userId, appId, webhook, requested }) => {
    const normalizedRequested = String(requested || '').trim();
    const existingManagedSubdomain = extractManagedPublicSubdomainFromUrl(webhook?.public_webhook_url);
    if (!normalizedRequested && String(webhook?.public_subdomain || '').trim()) {
        return webhook;
    }

    const nameHints = await fetchAppNamingHints({ service, userId, appId });
    const desiredBase =
        normalizedRequested ||
        existingManagedSubdomain ||
        nameHints.appstoreName;
    if (!desiredBase) {
        throw inputError("Fill App's App Store name first.");
    }
    const candidate = await findAvailablePublicSubdomain({
        service,
        base: desiredBase,
        currentAppId: appId,
    });
    if (candidate === String(webhook?.public_subdomain || '').trim()) {
        return webhook;
    }
    return updateWebhookRow({
        service,
        userId,
        appId,
        patch: {
            public_subdomain: candidate,
        },
    });
};

export const fetchRecentWebhookEvents = async ({ service, userId, appId, limit = 6 }) => {
    const { data, error } = await service
        .from('appstore_review_events')
        .select(EVENT_SELECT)
        .eq('user_id', userId)
        .eq('app_id', appId)
        .order('event_at', { ascending: false })
        .limit(Math.max(1, Math.min(12, Math.floor(limit || 6))));
    if (error) throw error;
    return Array.isArray(data) ? data : [];
};

export const fetchPrivateKeySecret = async ({ service, userId, appId }) => {
    const { data, error } = await service
        .from('connector_app_secrets')
        .select('value')
        .eq('user_id', userId)
        .eq('app_id', appId)
        .eq('key', APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY)
        .maybeSingle();
    if (error) throw error;
    return String(data?.value || '');
};

const base64UrlEncode = (value) => {
    let buffer;
    if (Buffer.isBuffer(value)) {
        buffer = value;
    } else if (value instanceof Uint8Array) {
        buffer = Buffer.from(value);
    } else if (typeof value === 'string') {
        buffer = Buffer.from(value);
    } else {
        buffer = Buffer.from(JSON.stringify(value));
    }

    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const readDerLength = (buffer, state) => {
    const first = buffer[state.offset++];
    if (first == null) throw inputError('Failed to sign App Store Connect token.');
    if ((first & 0x80) === 0) return first;

    const byteCount = first & 0x7f;
    if (!byteCount || byteCount > 4 || state.offset + byteCount > buffer.length) {
        throw inputError('Failed to sign App Store Connect token.');
    }

    let length = 0;
    for (let index = 0; index < byteCount; index += 1) {
        length = (length << 8) | buffer[state.offset++];
    }
    return length;
};

const normalizeEcdsaJwtSignature = (signature, componentSize = 32) => {
    const bytes = Buffer.isBuffer(signature) ? Buffer.from(signature) : Buffer.from(signature || []);
    if (bytes.length === componentSize * 2) {
        return bytes;
    }
    if (bytes[0] !== 0x30) {
        throw inputError('Failed to sign App Store Connect token.');
    }

    const state = { offset: 1 };
    const sequenceLength = readDerLength(bytes, state);
    if (state.offset + sequenceLength !== bytes.length) {
        throw inputError('Failed to sign App Store Connect token.');
    }

    const readInteger = () => {
        if (bytes[state.offset++] !== 0x02) {
            throw inputError('Failed to sign App Store Connect token.');
        }
        const length = readDerLength(bytes, state);
        if (length <= 0 || state.offset + length > bytes.length) {
            throw inputError('Failed to sign App Store Connect token.');
        }
        let value = bytes.slice(state.offset, state.offset + length);
        state.offset += length;
        while (value.length > 1 && value[0] === 0x00) {
            value = value.slice(1);
        }
        if (value.length > componentSize) {
            throw inputError('Failed to sign App Store Connect token.');
        }
        return Buffer.concat([Buffer.alloc(componentSize - value.length, 0), value]);
    };

    const r = readInteger();
    const s = readInteger();
    if (state.offset !== bytes.length) {
        throw inputError('Failed to sign App Store Connect token.');
    }
    return Buffer.concat([r, s]);
};

const signEcdsaJwtInput = (signingInput, privateKeyPem) => {
    const message = Buffer.from(signingInput);
    try {
        const signature = crypto.sign('sha256', message, {
            key: privateKeyPem,
            dsaEncoding: 'ieee-p1363',
        });
        return normalizeEcdsaJwtSignature(signature);
    } catch {
        const signature = crypto.sign('sha256', message, {
            key: privateKeyPem,
        });
        return normalizeEcdsaJwtSignature(signature);
    }
};

export const normalizeApplePrivateKeyPem = (value) => {
    const raw = String(value || '')
        .replace(/\r/g, '')
        .replace(/\\n/g, '\n')
        .trim();
    if (!raw) return '';
    if (/-----BEGIN [A-Z ]+-----/.test(raw)) {
        return `${raw.replace(/\n+$/g, '')}\n`;
    }
    const compact = raw.replace(/\s+/g, '');
    const lines = compact.match(/.{1,64}/g) || [compact];
    return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----', ''].join('\n');
};

export const createAppStoreConnectJwt = ({
    keyMode,
    keyId,
    issuerId,
    privateKeyPem,
    nowMs = Date.now(),
    lifetimeSeconds = 20 * 60,
    scope,
}) => {
    const normalizedKeyMode = String(keyMode || '').trim().toLowerCase();
    const normalizedKeyId = String(keyId || '').trim();
    const normalizedIssuerId = String(issuerId || '').trim();
    const normalizedPrivateKey = normalizeApplePrivateKeyPem(privateKeyPem);
    if (!['team', 'individual'].includes(normalizedKeyMode)) {
        throw inputError('Select App Store Connect key mode.');
    }
    if (!normalizedKeyId) {
        throw inputError('App Store Connect key ID is required.');
    }
    if (normalizedKeyMode === 'team' && !normalizedIssuerId) {
        throw inputError('Issuer ID is required for team keys.');
    }
    if (!normalizedPrivateKey) {
        throw inputError('Private key is required.');
    }

    const iat = Math.floor(nowMs / 1000);
    const exp = iat + Math.max(60, Math.min(20 * 60, Math.floor(lifetimeSeconds || 20 * 60)));
    const header = { alg: 'ES256', kid: normalizedKeyId, typ: 'JWT' };
    const payload = {
        iat,
        exp,
        aud: 'appstoreconnect-v1',
        ...(normalizedKeyMode === 'team' ? { iss: normalizedIssuerId } : { sub: 'user' }),
    };
    if (Array.isArray(scope) && scope.length) payload.scope = scope;

    const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
    try {
        crypto.createPrivateKey(normalizedPrivateKey);
    } catch {
        throw inputError('Private key is not a valid .p8 key.');
    }
    const signature = signEcdsaJwtInput(signingInput, normalizedPrivateKey);
    return `${signingInput}.${base64UrlEncode(signature)}`;
};

export const getAppleCredentialIssues = ({ keyMode, keyId, issuerId, privateKeyConfigured }) => {
    const issues = [];
    const normalizedKeyMode = String(keyMode || '').trim().toLowerCase();
    if (!['team', 'individual'].includes(normalizedKeyMode)) {
        issues.push('Select key mode.');
    }
    if (!String(keyId || '').trim()) {
        issues.push('Enter key ID.');
    }
    if (normalizedKeyMode === 'team' && !String(issuerId || '').trim()) {
        issues.push('Enter issuer ID.');
    }
    if (!privateKeyConfigured) {
        issues.push('Upload the .p8 private key.');
    }
    return issues;
};

export const formatAppleApiError = (status, payload) => {
    const errors = Array.isArray(payload?.errors) ? payload.errors : [];
    const details = errors
        .map((entry) => {
            const parts = [entry?.code, entry?.title, entry?.detail]
                .map((value) => String(value || '').trim())
                .filter(Boolean);
            return parts.join(': ');
        })
        .filter(Boolean);
    if (details.length) {
        return `Apple API ${status}: ${details.join(' | ')}`.slice(0, 1000);
    }

    const fallback =
        String(payload?.error || '').trim() ||
        String(payload?.message || '').trim() ||
        `Apple API ${status} request failed.`;
    return fallback.slice(0, 1000);
};

export const appleRequest = async ({ token, url, method = 'GET', body }) => {
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await response.text();
    let payload = null;
    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = { raw };
        }
    }

    if (!response.ok) {
        const error = new Error(formatAppleApiError(response.status, payload));
        error.status = response.status;
        error.body = payload;
        error.isAppleApiError = true;
        throw error;
    }

    return payload;
};

export const listAppStoreConnectApps = async ({ token }) => {
    const apps = [];
    let nextUrl = new URL('/v1/apps', APPLE_API_ORIGIN);
    nextUrl.searchParams.set('fields[apps]', 'name,bundleId,sku');
    nextUrl.searchParams.set('limit', '200');
    nextUrl.searchParams.set('sort', 'name');

    for (let index = 0; nextUrl && index < 10; index += 1) {
        const payload = await appleRequest({ token, url: nextUrl.toString(), method: 'GET' });
        if (Array.isArray(payload?.data)) apps.push(...payload.data);
        const nextHref = String(payload?.links?.next || '').trim();
        nextUrl = nextHref ? new URL(nextHref, APPLE_API_ORIGIN) : null;
    }

    return apps;
};

export const normalizeAppleAppCandidates = (items, bundleIdHint) => {
    const normalizedHint = String(bundleIdHint || '').trim().toLowerCase();
    const candidates = (Array.isArray(items) ? items : []).map((item) => {
        const bundleId = String(item?.attributes?.bundleId || '').trim();
        return {
            id: String(item?.id || '').trim(),
            name: String(item?.attributes?.name || '').trim(),
            bundle_id: bundleId,
            sku: String(item?.attributes?.sku || '').trim(),
            bundle_match: Boolean(normalizedHint) && bundleId.toLowerCase() === normalizedHint,
        };
    });

    return candidates
        .filter((candidate) => candidate.id)
        .sort((left, right) => {
            if (left.bundle_match !== right.bundle_match) return left.bundle_match ? -1 : 1;
            const leftName = `${left.name} ${left.bundle_id}`.toLowerCase();
            const rightName = `${right.name} ${right.bundle_id}`.toLowerCase();
            return leftName.localeCompare(rightName);
        });
};

export const pickAutoBoundAppleApp = (candidates, bundleIdHint) => {
    const normalizedHint = String(bundleIdHint || '').trim().toLowerCase();
    if (!normalizedHint) return null;
    const matches = (Array.isArray(candidates) ? candidates : []).filter(
        (candidate) => String(candidate?.bundle_id || '').trim().toLowerCase() === normalizedHint
    );
    return matches.length === 1 ? matches[0] : null;
};

export const normalizeProxyRootDomain = (value) =>
    String(value || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+.*$/g, '')
        .replace(/\.+$/g, '')
        .toLowerCase();

export const getProxyRootDomain = () =>
    normalizeProxyRootDomain(env('APPSTORE_REVIEW_PROXY_ROOT_DOMAIN', ['VITE_APPSTORE_REVIEW_PROXY_ROOT_DOMAIN']));

export const normalizePublicSubdomain = (value) => {
    const normalized = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-+|-+$)/g, '')
        .slice(0, 63)
        .replace(/-+$/g, '');
    return normalized || 'app';
};

export const withSubdomainSuffix = (base, suffix) => {
    const normalizedBase = normalizePublicSubdomain(base);
    const numericSuffix = Number(suffix || 0);
    if (!numericSuffix || numericSuffix <= 1) return normalizedBase;
    const suffixText = `-${numericSuffix}`;
    const truncatedBase = normalizedBase.slice(0, Math.max(1, 63 - suffixText.length)).replace(/-+$/g, '') || 'app';
    return `${truncatedBase}${suffixText}`;
};

export const extractManagedPublicSubdomainFromUrl = (value, rootDomain = getProxyRootDomain()) => {
    const raw = String(value || '').trim();
    const normalizedRootDomain = normalizeProxyRootDomain(rootDomain);
    if (!raw || !normalizedRootDomain) return '';
    try {
        const parsed = new URL(raw);
        const host = String(parsed.host || '').trim().toLowerCase();
        const suffix = `.${normalizedRootDomain}`;
        if (!host.endsWith(suffix)) return '';
        return host.slice(0, -suffix.length).replace(/\.+$/g, '').trim();
    } catch {
        return '';
    }
};

const withTokenQuery = (baseUrl, publicToken) => {
    const rawBase = String(baseUrl || '').trim();
    const normalizedToken = String(publicToken || '').trim();
    if (!rawBase || !normalizedToken) return '';
    const separator = rawBase.includes('?') ? '&' : '?';
    return `${rawBase}${separator}token=${encodeURIComponent(normalizedToken)}`;
};

export const buildManagedPublicWebhookUrl = ({ publicToken, publicSubdomain, rootDomain }) => {
    const normalizedSubdomain = String(publicSubdomain || '').trim();
    const normalizedRootDomain = normalizeProxyRootDomain(rootDomain);
    if (!normalizedSubdomain || !normalizedRootDomain) return '';
    return withTokenQuery(`https://${normalizedSubdomain}.${normalizedRootDomain}/appstore-review`, publicToken);
};

export const buildManagedPublicPageUrl = ({ publicSubdomain, rootDomain }) => {
    const normalizedSubdomain = String(publicSubdomain || '').trim();
    const normalizedRootDomain = normalizeProxyRootDomain(rootDomain);
    if (!normalizedSubdomain || !normalizedRootDomain) return '';
    return `https://${normalizedSubdomain}.${normalizedRootDomain}/`;
};

export const buildWebhookReceiverPreview = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        const normalizedPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/g, '') : '';
        return `${parsed.host}${normalizedPath}`;
    } catch {
        return raw
            .replace(/^https?:\/\//i, '')
            .replace(/[?#].*$/g, '')
            .replace(/\/+$/g, '');
    }
};

export const normalizePublicWebhookUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw inputError('Public webhook URL must be a valid absolute URL.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw inputError('Public webhook URL must start with http:// or https://.');
    }
    return parsed.toString();
};

export const validateExplicitPublicWebhookUrl = ({ value, supabaseUrl, rootDomain = getProxyRootDomain() }) => {
    const normalizedValue = normalizePublicWebhookUrl(value);
    if (!normalizedValue) {
        return {
            url: '',
            issue: '',
        };
    }

    const managedSubdomain = extractManagedPublicSubdomainFromUrl(normalizedValue, rootDomain);
    if (managedSubdomain) {
        return {
            url: '',
            issue: '',
        };
    }

    try {
        const explicitHost = new URL(normalizedValue).host;
        const normalizedSupabaseUrl = String(supabaseUrl || '').trim();
        if (normalizedSupabaseUrl && explicitHost === new URL(normalizedSupabaseUrl).host) {
            return {
                url: '',
                issue: 'Direct Supabase webhook URLs are not allowed here. Use appshelp.cc or a custom public proxy URL.',
            };
        }
    } catch {
        return {
            url: '',
            issue: 'Public webhook URL must be a valid absolute HTTPS URL.',
        };
    }

    return {
        url: normalizedValue,
        issue: '',
    };
};

export const resolveEffectivePublicWebhookUrl = ({ webhook, rootDomain = getProxyRootDomain(), supabaseUrl }) => {
    const managedUrl = buildManagedPublicWebhookUrl({
        publicToken: webhook?.public_token,
        publicSubdomain: webhook?.public_subdomain,
        rootDomain,
    });
    const explicitValidation = validateExplicitPublicWebhookUrl({
        value: webhook?.public_webhook_url,
        supabaseUrl,
        rootDomain,
    });
    return {
        effectiveUrl: explicitValidation.url || managedUrl,
        explicitUrl: explicitValidation.url,
        managedUrl,
        issue: explicitValidation.issue,
    };
};

export const getWebhookStatusPayload = async ({ service, userId, appId }) => {
    const [webhook, events, bundleId, privateKey, namingHints] = await Promise.all([
        fetchWebhookRow({ service, userId, appId }),
        fetchRecentWebhookEvents({ service, userId, appId, limit: 6 }),
        fetchBundleIdForApp({ service, userId, appId }),
        fetchPrivateKeySecret({ service, userId, appId }),
        fetchAppNamingHints({ service, userId, appId }),
    ]);

    const supabaseUrl = env('VITE_SUPABASE_URL', ['SUPABASE_URL']);
    const rootDomain = getProxyRootDomain();
    const resolvedPublicSubdomain =
        String(webhook?.public_subdomain || '').trim() ||
        extractManagedPublicSubdomainFromUrl(webhook?.public_webhook_url, rootDomain);
    const resolvedWebhook =
        webhook && resolvedPublicSubdomain && resolvedPublicSubdomain !== String(webhook.public_subdomain || '').trim()
            ? { ...webhook, public_subdomain: resolvedPublicSubdomain }
            : webhook;
    const resolvedPublicWebhookTarget = resolvedWebhook
        ? resolveEffectivePublicWebhookUrl({
              webhook: resolvedWebhook,
              supabaseUrl,
              rootDomain,
          })
        : { effectiveUrl: '', issue: '' };
    const effectivePublicPageUrl = buildManagedPublicPageUrl({
        publicSubdomain: resolvedWebhook?.public_subdomain,
        rootDomain,
    });
    const webhookReadinessIssues = [];
    if (
        !String(resolvedWebhook?.public_subdomain || '').trim() &&
        !String(namingHints?.appstoreName || '').trim()
    ) {
        webhookReadinessIssues.push("Fill App's App Store name first.");
    }
    if (resolvedPublicWebhookTarget.issue) {
        webhookReadinessIssues.push(resolvedPublicWebhookTarget.issue);
    }
    if (resolvedWebhook && !resolvedPublicWebhookTarget.effectiveUrl && !resolvedPublicWebhookTarget.issue) {
        webhookReadinessIssues.push('Public webhook URL is not ready yet for this app.');
    }

    return {
        webhook: resolvedWebhook,
        events,
        bundle_id: bundleId,
        private_key_configured: Boolean(String(privateKey || '').trim()),
        effective_public_webhook_url: resolvedPublicWebhookTarget.effectiveUrl,
        effective_public_page_url: effectivePublicPageUrl,
        credential_issues: getAppleCredentialIssues({
            keyMode: resolvedWebhook?.key_mode,
            keyId: resolvedWebhook?.key_id,
            issuerId: resolvedWebhook?.issuer_id,
            privateKeyConfigured: Boolean(String(privateKey || '').trim()),
        }),
        webhook_readiness_issues: webhookReadinessIssues,
    };
};

export const getAppleCredentialsForApp = async ({ service, userId, appId }) => {
    const webhook = await ensureWebhookRow({ service, userId, appId });
    const privateKey = await fetchPrivateKeySecret({ service, userId, appId });
    const issues = getAppleCredentialIssues({
        keyMode: webhook?.key_mode,
        keyId: webhook?.key_id,
        issuerId: webhook?.issuer_id,
        privateKeyConfigured: Boolean(String(privateKey || '').trim()),
    });
    if (issues.length) {
        const error = new Error(`App Store Connect credentials are incomplete. ${issues.join(' ')}`);
        error.status = 400;
        throw error;
    }

    return {
        webhook,
        jwt: createAppStoreConnectJwt({
            keyMode: webhook.key_mode,
            keyId: webhook.key_id,
            issuerId: webhook.issuer_id,
            privateKeyPem: privateKey,
        }),
    };
};

export const syncWebhookBindingFromCandidate = async ({ service, userId, appId, webhook, candidate }) => {
    if (!candidate?.id) return webhook;
    return updateWebhookRow({
        service,
        userId,
        appId,
        patch: {
            asc_app_id: candidate.id,
            asc_app_name: candidate.name || null,
            asc_bundle_id: candidate.bundle_id || null,
            last_sync_status: 'idle',
            last_sync_error: null,
        },
    });
};

export const getPublicWebhookTarget = ({ webhook }) => {
    const supabaseUrl = env('VITE_SUPABASE_URL', ['SUPABASE_URL']);
    const rootDomain = getProxyRootDomain();
    const resolvedPublicSubdomain =
        String(webhook?.public_subdomain || '').trim() ||
        extractManagedPublicSubdomainFromUrl(webhook?.public_webhook_url, rootDomain);
    const { effectiveUrl, explicitUrl, managedUrl, issue } = resolveEffectivePublicWebhookUrl({
        webhook: {
            ...webhook,
            public_subdomain: resolvedPublicSubdomain,
        },
        supabaseUrl,
        rootDomain,
    });
    return {
        explicitUrl,
        managedUrl,
        effectiveUrl,
        issue,
    };
};

export const toPublicErrorStatus = (error) => {
    const status = Number(error?.status || 0);
    if (!status) return 500;
    if (error?.isAppleApiError) {
        if (status === 404) return 404;
        if (status >= 500) return 502;
        return 400;
    }
    if (status === 401) return 401;
    if (status === 404) return 404;
    if (status >= 500) return 502;
    return 400;
};

export const webhookAttributesPayload = ({ effectiveUrl, secret, name }) => ({
    enabled: true,
    eventTypes: WEBHOOK_EVENT_TYPES,
    name: String(name || 'Review status webhook').trim() || 'Review status webhook',
    secret: String(secret || '').trim(),
    url: effectiveUrl,
});
