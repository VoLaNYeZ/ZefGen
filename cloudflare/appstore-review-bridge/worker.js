import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const APPSTORE_REVIEW_EVENT_TYPE = 'APP_STORE_VERSION_APP_VERSION_STATE_UPDATED';
const APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY = 'APPSTORE_CONNECT_PRIVATE_KEY_P8';
const APPLE_API_ORIGIN = 'https://api.appstoreconnect.apple.com';
const WEBHOOK_EVENT_TYPES = [APPSTORE_REVIEW_EVENT_TYPE];

const json = (payload, init = {}) =>
    new Response(JSON.stringify(payload, null, 2), {
        ...init,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            ...(init.headers || {}),
        },
    });

const html = (markup, init = {}) =>
    new Response(markup, {
        ...init,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            ...(init.headers || {}),
        },
    });

const PUBLIC_CONTENT_SECURITY_POLICY = [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'none'",
    "connect-src 'none'",
    "img-src 'self' data:",
    "style-src 'unsafe-inline'",
    "font-src 'self'",
].join('; ');

export const buildPublicSecurityHeaders = (headers = {}) => ({
    'content-security-policy': PUBLIC_CONTENT_SECURITY_POLICY,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    ...headers,
});

export const withPublicHeaders = (response, headers = {}) => {
    const nextHeaders = new Headers(response.headers);
    Object.entries(buildPublicSecurityHeaders(headers)).forEach(([key, value]) => nextHeaders.set(key, value));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: nextHeaders,
    });
};

export const publicTextResponse = (message, init = {}) =>
    withPublicHeaders(
        new Response(String(message || ''), {
            ...init,
            headers: {
                'content-type': 'text/plain; charset=utf-8',
                ...(init.headers || {}),
            },
        })
    );

const escapeHtml = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const normalizeRootDomain = (value) =>
    String(value || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+.*$/g, '')
        .replace(/\.+$/g, '')
        .toLowerCase();

const mergeQueryStrings = (targetUrl, incomingUrl) => {
    const merged = new URL(targetUrl);
    const incoming = new URL(incomingUrl);
    incoming.searchParams.forEach((value, key) => {
        merged.searchParams.set(key, value);
    });
    return merged;
};

const getPublicSubdomainFromHost = (host, rootDomain) => {
    const normalizedHost = String(host || '').trim().toLowerCase();
    const normalizedRootDomain = normalizeRootDomain(rootDomain);
    if (!normalizedHost || !normalizedRootDomain) return '';
    const suffix = `.${normalizedRootDomain}`;
    if (!normalizedHost.endsWith(suffix)) return '';
    return normalizedHost.slice(0, -suffix.length).replace(/\.+$/g, '').trim();
};

const extractBearerToken = (authorization) => {
    const raw = String(authorization || '').trim();
    if (!raw) return '';
    const match = raw.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || '';
};

const buildCorsHeaders = (request) => ({
    'access-control-allow-origin': request.headers.get('Origin') || '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
});

const withCors = (response, request) => {
    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

const envValue = (env, key) => String(env?.[key] || '').trim();

const getSupabaseHeaders = (env, payload = {}) => {
    const role = payload.role === 'anon' ? 'anon' : 'service';
    const apiKey = role === 'anon' ? envValue(env, 'SUPABASE_ANON_KEY') : envValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
    if (!apiKey) {
        throw new Error(
            role === 'anon'
                ? 'Missing SUPABASE_ANON_KEY.'
                : 'Missing SUPABASE_SERVICE_ROLE_KEY.'
        );
    }
    return {
        apikey: apiKey,
        Authorization: payload.accessToken ? `Bearer ${payload.accessToken}` : `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(payload.includeJson ? { 'content-type': 'application/json' } : {}),
        ...(payload.extraHeaders || {}),
    };
};

const parseJsonResponse = async (response) => {
    const raw = await response.text();
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

const createHttpError = (status, message, details) => {
    const error = new Error(String(message || 'Request failed.'));
    error.status = status;
    error.details = details;
    return error;
};

const sameHost = (left, right) => {
    const normalizedLeft = String(left || '').trim();
    const normalizedRight = String(right || '').trim();
    if (!normalizedLeft || !normalizedRight) return false;
    try {
        return new URL(normalizedLeft).host === new URL(normalizedRight).host;
    } catch {
        return false;
    }
};

const supabaseTableUrl = (env, table) => {
    const supabaseUrl = envValue(env, 'SUPABASE_URL');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    return new URL(`${supabaseUrl}/rest/v1/${table}`);
};

const supabaseTableRequest = async (env, payload) => {
    const url = supabaseTableUrl(env, payload.table);
    const params = payload.params || {};
    Object.entries(params).forEach(([key, value]) => {
        if (value != null) url.searchParams.set(key, String(value));
    });
    const response = await fetch(url.toString(), {
        method: payload.method || 'GET',
        headers: getSupabaseHeaders(env, {
            role: payload.role,
            includeJson: payload.body !== undefined,
            accessToken: payload.accessToken,
            extraHeaders: payload.extraHeaders,
        }),
        body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
        throw createHttpError(response.status, `Supabase ${payload.table} request failed.`, parsed);
    }
    return parsed;
};

const supabaseRpcRequest = async (env, name, body) => {
    const supabaseUrl = envValue(env, 'SUPABASE_URL');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: getSupabaseHeaders(env, { includeJson: true }),
        body: JSON.stringify(body || {}),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
        throw createHttpError(response.status, `Supabase RPC ${name} failed.`, parsed);
    }
    return parsed;
};

const fetchWebhookBySubdomain = async (env, subdomain) => {
    const payload = await supabaseTableRequest(env, {
        table: 'appstore_review_webhooks',
        params: {
            select: [
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
                'last_sync_status',
                'last_sync_error',
                'last_sync_at',
            ].join(','),
            public_subdomain: `eq.${subdomain}`,
            limit: '1',
        },
    });
    return Array.isArray(payload) ? payload[0] || null : null;
};

const fetchConnectorConfig = async (env, appId) => {
    const payload = await supabaseTableRequest(env, {
        table: 'connector_app_configs',
        params: {
            select: 'variables',
            app_id: `eq.${appId}`,
            limit: '1',
        },
    });
    return Array.isArray(payload) ? payload[0] || null : null;
};

const fetchAppRecord = async (env, appId) => {
    const payload = await supabaseTableRequest(env, {
        table: 'apps',
        params: {
            select: 'id,name,alias',
            id: `eq.${appId}`,
            limit: '1',
        },
    });
    return Array.isArray(payload) ? payload[0] || null : null;
};

const fetchPrivateKeySecret = async (env, appId, userId) => {
    const payload = await supabaseTableRequest(env, {
        table: 'connector_app_secrets',
        params: {
            select: 'value',
            app_id: `eq.${appId}`,
            user_id: `eq.${userId}`,
            key: `eq.${APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY}`,
            limit: '1',
        },
    });
    if (!Array.isArray(payload) || !payload.length) return '';
    return String(payload[0]?.value || '');
};

const insertWebhookEvent = async (env, payload) =>
    supabaseTableRequest(env, {
        table: 'appstore_review_events',
        method: 'POST',
        extraHeaders: {
            Prefer: 'return=minimal',
        },
        body: {
            app_id: payload.appId,
            user_id: payload.userId,
            event_type: payload.eventType,
            payload_type: payload.payloadType,
            state_from: payload.stateFrom ?? null,
            state_to: payload.stateTo ?? null,
            event_at: payload.eventAt,
            delivery_status: payload.deliveryStatus,
            raw_payload: payload.rawPayload ?? null,
        },
    });

const updateWebhookRow = async (env, payload) => {
    const response = await supabaseTableRequest(env, {
        table: 'appstore_review_webhooks',
        method: 'PATCH',
        params: {
            app_id: `eq.${payload.appId}`,
            user_id: `eq.${payload.userId}`,
            select: [
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
                'last_delivery_at',
                'last_delivery_status',
                'last_error',
                'last_sync_status',
                'last_sync_error',
                'last_sync_at',
            ].join(','),
        },
        extraHeaders: {
            Prefer: 'return=representation',
        },
        body: {
            ...payload.patch,
            updated_at: new Date().toISOString(),
        },
    });
    return Array.isArray(response) ? response[0] || null : response;
};

const parseComparableTimestamp = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? ts : 0;
};

const APPLE_VERSION_STATE_PRIORITY = {
    IN_REVIEW: 1000,
    WAITING_FOR_REVIEW: 950,
    ACCEPTED: 900,
    PENDING_APPLE_RELEASE: 875,
    PENDING_DEVELOPER_RELEASE: 850,
    PROCESSING_FOR_APP_STORE: 825,
    READY_FOR_SALE: 800,
    REJECTED: 775,
    METADATA_REJECTED: 760,
    INVALID_BINARY: 750,
    DEVELOPER_REJECTED: 740,
    PENDING_CONTRACT: 725,
    DEVELOPER_REMOVED_FROM_SALE: 500,
    REMOVED_FROM_SALE: 490,
    PREPARE_FOR_SUBMISSION: 100,
};

const normalizeAppleVersionSnapshots = (items) =>
    (Array.isArray(items) ? items : [])
        .map((item) => {
            const attributes = item && typeof item === 'object' ? item.attributes || {} : {};
            const appStoreState = String(attributes?.appStoreState || attributes?.appStoreVersionState || '')
                .trim()
                .toUpperCase();
            return {
                id: String(item?.id || '').trim(),
                versionString: String(attributes?.versionString || '').trim(),
                state: appStoreState,
                platform: String(attributes?.platform || '').trim().toUpperCase(),
                createdDate: String(
                    attributes?.createdDate || attributes?.releaseDate || attributes?.earliestReleaseDate || ''
                ).trim(),
                raw: item,
            };
        })
        .filter((item) => item.id && item.state);

export const pickBestAppleVersionSnapshot = (items) => {
    const normalized = normalizeAppleVersionSnapshots(items);
    if (!normalized.length) return null;
    return normalized
        .slice()
        .sort((left, right) => {
            const rightPriority = APPLE_VERSION_STATE_PRIORITY[right.state] ?? 0;
            const leftPriority = APPLE_VERSION_STATE_PRIORITY[left.state] ?? 0;
            if (rightPriority !== leftPriority) return rightPriority - leftPriority;

            const rightTimestamp = parseComparableTimestamp(right.createdDate);
            const leftTimestamp = parseComparableTimestamp(left.createdDate);
            if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp;

            return String(right.versionString || '').localeCompare(String(left.versionString || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        })[0];
};

const fetchAuthenticatedUser = async (env, request) => {
    const accessToken = extractBearerToken(request.headers.get('Authorization'));
    if (!accessToken) throw createHttpError(401, 'Missing Authorization bearer token.');
    const supabaseUrl = envValue(env, 'SUPABASE_URL');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: getSupabaseHeaders(env, {
            role: 'anon',
            accessToken,
        }),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok || !parsed?.id) {
        throw createHttpError(401, 'Auth session is invalid or expired. Please log in again.', parsed);
    }
    return parsed;
};

const requireBridgeContext = async (env, request, subdomain) => {
    const user = await fetchAuthenticatedUser(env, request);
    const webhook = await fetchWebhookBySubdomain(env, subdomain);
    if (!webhook) {
        throw createHttpError(404, 'Webhook bridge not found for this app.');
    }
    if (String(webhook.user_id || '').trim() !== String(user.id || '').trim()) {
        throw createHttpError(403, 'You do not have access to this app bridge.');
    }
    const [connectorConfig, app] = await Promise.all([
        fetchConnectorConfig(env, webhook.app_id),
        fetchAppRecord(env, webhook.app_id),
    ]);
    return {
        user,
        app,
        webhook,
        variables: connectorConfig?.variables || {},
        bundleId: String(connectorConfig?.variables?.bundle_id || '').trim(),
    };
};

const normalizeApplePrivateKeyPem = (value) => {
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

const base64UrlEncode = (value) => {
    const buffer = Buffer.isBuffer(value)
        ? value
        : value instanceof Uint8Array
          ? Buffer.from(value)
          : typeof value === 'string'
            ? Buffer.from(value)
            : Buffer.from(JSON.stringify(value));
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const readDerLength = (buffer, state) => {
    const first = buffer[state.offset++];
    if (first == null) throw createHttpError(500, 'Failed to sign App Store Connect token.');
    if ((first & 0x80) === 0) return first;

    const byteCount = first & 0x7f;
    if (!byteCount || byteCount > 4 || state.offset + byteCount > buffer.length) {
        throw createHttpError(500, 'Failed to sign App Store Connect token.');
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
        throw createHttpError(500, 'Failed to sign App Store Connect token.');
    }

    const state = { offset: 1 };
    const sequenceLength = readDerLength(bytes, state);
    if (state.offset + sequenceLength !== bytes.length) {
        throw createHttpError(500, 'Failed to sign App Store Connect token.');
    }

    const readInteger = () => {
        if (bytes[state.offset++] !== 0x02) {
            throw createHttpError(500, 'Failed to sign App Store Connect token.');
        }
        const length = readDerLength(bytes, state);
        if (length <= 0 || state.offset + length > bytes.length) {
            throw createHttpError(500, 'Failed to sign App Store Connect token.');
        }
        let value = bytes.slice(state.offset, state.offset + length);
        state.offset += length;
        while (value.length > 1 && value[0] === 0x00) {
            value = value.slice(1);
        }
        if (value.length > componentSize) {
            throw createHttpError(500, 'Failed to sign App Store Connect token.');
        }
        return Buffer.concat([Buffer.alloc(componentSize - value.length, 0), value]);
    };

    const r = readInteger();
    const s = readInteger();
    if (state.offset !== bytes.length) {
        throw createHttpError(500, 'Failed to sign App Store Connect token.');
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

const createAppStoreConnectJwt = (payload) => {
    const normalizedKeyMode = String(payload?.keyMode || '').trim().toLowerCase();
    const normalizedKeyId = String(payload?.keyId || '').trim();
    const normalizedIssuerId = String(payload?.issuerId || '').trim();
    const normalizedPrivateKey = normalizeApplePrivateKeyPem(payload?.privateKeyPem);
    if (!['team', 'individual'].includes(normalizedKeyMode)) {
        throw createHttpError(400, 'Select App Store Connect key mode.');
    }
    if (!normalizedKeyId) {
        throw createHttpError(400, 'App Store Connect key ID is required.');
    }
    if (normalizedKeyMode === 'team' && !normalizedIssuerId) {
        throw createHttpError(400, 'Issuer ID is required for team keys.');
    }
    if (!normalizedPrivateKey) {
        throw createHttpError(400, 'Private key is required.');
    }

    const nowMs = Date.now();
    const iat = Math.floor(nowMs / 1000);
    const exp = iat + 20 * 60;
    const header = { alg: 'ES256', kid: normalizedKeyId, typ: 'JWT' };
    const tokenPayload = {
        iat,
        exp,
        aud: 'appstoreconnect-v1',
        ...(normalizedKeyMode === 'team' ? { iss: normalizedIssuerId } : { sub: 'user' }),
    };
    const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(tokenPayload)}`;
    try {
        crypto.createPrivateKey(normalizedPrivateKey);
    } catch {
        throw createHttpError(400, 'Private key is not a valid .p8 key.');
    }
    const signature = signEcdsaJwtInput(signingInput, normalizedPrivateKey);
    return `${signingInput}.${base64UrlEncode(signature)}`;
};

const getAppleCredentialIssues = ({ keyMode, keyId, issuerId, privateKeyConfigured }) => {
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

const formatAppleApiError = (status, payload) => {
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

const appleRequest = async (payload) => {
    const response = await fetch(payload.url, {
        method: payload.method || 'GET',
        headers: {
            Authorization: `Bearer ${payload.token}`,
            Accept: 'application/json',
            ...(payload.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
        const error = createHttpError(response.status, formatAppleApiError(response.status, parsed), parsed);
        error.isAppleApiError = true;
        throw error;
    }
    return parsed;
};

const listAppStoreConnectApps = async (payload) => {
    const apps = [];
    let nextUrl = new URL('/v1/apps', APPLE_API_ORIGIN);
    nextUrl.searchParams.set('fields[apps]', 'name,bundleId,sku');
    nextUrl.searchParams.set('limit', '200');
    nextUrl.searchParams.set('sort', 'name');

    for (let index = 0; nextUrl && index < 10; index += 1) {
        const response = await appleRequest({
            token: payload.token,
            url: nextUrl.toString(),
            method: 'GET',
        });
        if (Array.isArray(response?.data)) apps.push(...response.data);
        const nextHref = String(response?.links?.next || '').trim();
        nextUrl = nextHref ? new URL(nextHref, APPLE_API_ORIGIN) : null;
    }

    return apps;
};

const listAppleAppStoreVersions = async (payload) => {
    const versions = [];
    let nextUrl = new URL(`/v1/apps/${encodeURIComponent(String(payload?.appId || '').trim())}/appStoreVersions`, APPLE_API_ORIGIN);
    nextUrl.searchParams.set('limit', '200');

    for (let index = 0; nextUrl && index < 10; index += 1) {
        const response = await appleRequest({
            token: payload.token,
            url: nextUrl.toString(),
            method: 'GET',
        });
        if (Array.isArray(response?.data)) versions.push(...response.data);
        const nextHref = String(response?.links?.next || '').trim();
        nextUrl = nextHref ? new URL(nextHref, APPLE_API_ORIGIN) : null;
    }

    return versions;
};

const normalizeAppleAppCandidates = (items, bundleIdHint) => {
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

const pickAutoBoundAppleApp = (candidates, bundleIdHint) => {
    const normalizedHint = String(bundleIdHint || '').trim().toLowerCase();
    if (!normalizedHint) return null;
    const matches = (Array.isArray(candidates) ? candidates : []).filter(
        (candidate) => String(candidate?.bundle_id || '').trim().toLowerCase() === normalizedHint
    );
    return matches.length === 1 ? matches[0] : null;
};

const normalizePublicWebhookUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        return parsed.toString();
    } catch {
        return '';
    }
};

export const validateExplicitPublicWebhookUrl = (env, value) => {
    const normalizedUrl = normalizePublicWebhookUrl(value);
    if (!normalizedUrl) {
        return {
            url: '',
            issue: '',
        };
    }

    const rootDomain = envValue(env, 'PUBLIC_ROOT_DOMAIN');
    if (extractManagedPublicSubdomainFromUrl(normalizedUrl, rootDomain)) {
        return {
            url: '',
            issue: '',
        };
    }

    if (sameHost(normalizedUrl, envValue(env, 'SUPABASE_URL'))) {
        return {
            url: '',
            issue: 'Direct Supabase webhook URLs are not allowed here. Use appshelp.cc or a custom public proxy URL.',
        };
    }

    return {
        url: normalizedUrl,
        issue: '',
    };
};

const extractManagedPublicSubdomainFromUrl = (value, rootDomain) => {
    const raw = normalizePublicWebhookUrl(value);
    const normalizedRootDomain = normalizeRootDomain(rootDomain);
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

const buildManagedPublicWebhookUrl = (payload) => {
    const normalizedSubdomain = String(payload?.publicSubdomain || '').trim();
    const normalizedToken = String(payload?.publicToken || '').trim();
    const normalizedRootDomain = normalizeRootDomain(payload?.rootDomain);
    if (!normalizedSubdomain || !normalizedToken || !normalizedRootDomain) return '';
    return withTokenQuery(
        `https://${normalizedSubdomain}.${normalizedRootDomain}/appstore-review`,
        normalizedToken
    );
};

export const buildEffectivePublicWebhookUrl = (env, webhook) => {
    const rootDomain = envValue(env, 'PUBLIC_ROOT_DOMAIN');
    const explicitValidation = validateExplicitPublicWebhookUrl(env, webhook?.public_webhook_url);
    const managedUrl = buildManagedPublicWebhookUrl({
        publicToken: webhook?.public_token,
        publicSubdomain: webhook?.public_subdomain,
        rootDomain,
    });
    return {
        effectiveUrl: explicitValidation.url || managedUrl,
        issue: explicitValidation.issue,
    };
};

const webhookAttributesPayload = (payload) => ({
    enabled: true,
    eventTypes: WEBHOOK_EVENT_TYPES,
    name: String(payload?.name || 'Review status webhook').trim() || 'Review status webhook',
    secret: String(payload?.secret || '').trim(),
    url: String(payload?.effectiveUrl || '').trim(),
});

const getPrivateAppleCredentials = async (env, webhook) => {
    const privateKey = await fetchPrivateKeySecret(env, webhook.app_id, webhook.user_id);
    const issues = getAppleCredentialIssues({
        keyMode: webhook?.key_mode,
        keyId: webhook?.key_id,
        issuerId: webhook?.issuer_id,
        privateKeyConfigured: Boolean(String(privateKey || '').trim()),
    });
    if (issues.length) {
        throw createHttpError(
            400,
            `App Store Connect credentials are incomplete. ${issues.join(' ')}`
        );
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

const handleBridgeApps = async (request, env, subdomain) => {
    const { user, webhook, bundleId } = await requireBridgeContext(env, request, subdomain);
    const { jwt } = await getPrivateAppleCredentials(env, webhook);
    const rawApps = await listAppStoreConnectApps({ token: jwt });
    const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
    const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
    let nextWebhook = webhook;

    if (autoBoundCandidate && autoBoundCandidate.id !== webhook.asc_app_id) {
        nextWebhook = await updateWebhookRow(env, {
            userId: user.id,
            appId: webhook.app_id,
            patch: {
                asc_app_id: autoBoundCandidate.id,
                asc_app_name: autoBoundCandidate.name || null,
                asc_bundle_id: autoBoundCandidate.bundle_id || null,
                last_sync_status: 'idle',
                last_sync_error: null,
            },
        });
    }

    return json({
        candidates,
        auto_bound_app_id: autoBoundCandidate?.id || null,
        webhook: nextWebhook,
    });
};

const handleBridgeSync = async (request, env, subdomain) => {
    const { user, webhook, bundleId, app } = await requireBridgeContext(env, request, subdomain);
    let workingWebhook = webhook;

    try {
        const { jwt } = await getPrivateAppleCredentials(env, webhook);

        if (!String(workingWebhook?.asc_app_id || '').trim()) {
            const rawApps = await listAppStoreConnectApps({ token: jwt });
            const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
            const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
            if (!autoBoundCandidate) {
                throw createHttpError(400, 'Select the App Store Connect app first, then sync the webhook.');
            }
            workingWebhook = await updateWebhookRow(env, {
                userId: user.id,
                appId: workingWebhook.app_id,
                patch: {
                    asc_app_id: autoBoundCandidate.id,
                    asc_app_name: autoBoundCandidate.name || null,
                    asc_bundle_id: autoBoundCandidate.bundle_id || null,
                    last_sync_status: 'idle',
                    last_sync_error: null,
                },
            });
        }

        const { effectiveUrl, issue } = buildEffectivePublicWebhookUrl(env, workingWebhook);
        if (!effectiveUrl) {
            throw createHttpError(400, issue || 'Public webhook URL is not ready yet for this app.');
        }

        const attributes = webhookAttributesPayload({
            effectiveUrl,
            secret: workingWebhook.secret,
            name: `${String(app?.name || 'App').trim() || 'App'} review status`,
        });

        let appleWebhookId = String(workingWebhook?.apple_webhook_id || '').trim();
        let responsePayload = null;

        if (appleWebhookId) {
            try {
                responsePayload = await appleRequest({
                    token: jwt,
                    url: `${APPLE_API_ORIGIN}/v1/webhooks/${encodeURIComponent(appleWebhookId)}`,
                    method: 'PATCH',
                    body: {
                        data: {
                            id: appleWebhookId,
                            type: 'webhooks',
                            attributes,
                        },
                    },
                });
            } catch (error) {
                if (Number(error?.status || 0) !== 404) throw error;
                appleWebhookId = '';
            }
        }

        if (!appleWebhookId) {
            responsePayload = await appleRequest({
                token: jwt,
                url: `${APPLE_API_ORIGIN}/v1/webhooks`,
                method: 'POST',
                body: {
                    data: {
                        type: 'webhooks',
                        attributes,
                        relationships: {
                            app: {
                                data: {
                                    type: 'apps',
                                    id: workingWebhook.asc_app_id,
                                },
                            },
                        },
                    },
                },
            });
            appleWebhookId = String(responsePayload?.data?.id || '').trim();
        }

        if (!appleWebhookId) {
            throw createHttpError(502, 'Apple did not return a webhook ID.');
        }

        let updatedWebhook = await updateWebhookRow(env, {
            userId: user.id,
            appId: workingWebhook.app_id,
            patch: {
                apple_webhook_id: appleWebhookId,
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'connected',
                last_sync_error: null,
            },
        });

        try {
            const versions = await listAppleAppStoreVersions({
                token: jwt,
                appId: workingWebhook.asc_app_id,
            });
            const snapshot = pickBestAppleVersionSnapshot(versions);
            if (snapshot?.state) {
                const snapshotAt = new Date().toISOString();
                updatedWebhook = await updateWebhookRow(env, {
                    userId: user.id,
                    appId: workingWebhook.app_id,
                    patch: {
                        latest_event_type: 'APPLE_STATUS_SNAPSHOT',
                        latest_previous_state: null,
                        latest_review_state: snapshot.state,
                        latest_event_at: snapshotAt,
                    },
                });
                await insertWebhookEvent(env, {
                    appId: workingWebhook.app_id,
                    userId: user.id,
                    eventType: 'APPLE_STATUS_SNAPSHOT',
                    payloadType: 'appStoreVersionSnapshot',
                    stateFrom: null,
                    stateTo: snapshot.state,
                    eventAt: snapshotAt,
                    deliveryStatus: 'snapshot',
                    rawPayload: {
                        selected_version: {
                            id: snapshot.id,
                            versionString: snapshot.versionString,
                            platform: snapshot.platform,
                            createdDate: snapshot.createdDate,
                            state: snapshot.state,
                        },
                        versions: normalizeAppleVersionSnapshots(versions).map((item) => ({
                            id: item.id,
                            versionString: item.versionString,
                            platform: item.platform,
                            createdDate: item.createdDate,
                            state: item.state,
                        })),
                    },
                });
            }
        } catch {
            // Do not fail a successful webhook sync just because the current-state snapshot could not be fetched.
        }

        return json({
            ok: true,
            webhook: updatedWebhook,
            effective_public_webhook_url: effectiveUrl,
        });
    } catch (error) {
        try {
            await updateWebhookRow(env, {
                userId: user.id,
                appId: workingWebhook.app_id,
                patch: {
                    last_sync_at: new Date().toISOString(),
                    last_sync_status: 'error',
                    last_sync_error: String(error?.message || 'Webhook sync failed.').slice(0, 1000),
                },
            });
        } catch {
            // Ignore secondary persistence failure.
        }
        throw error;
    }
};

const handleBridgePing = async (request, env, subdomain) => {
    const { webhook } = await requireBridgeContext(env, request, subdomain);
    const { jwt } = await getPrivateAppleCredentials(env, webhook);
    const appleWebhookId = String(webhook?.apple_webhook_id || '').trim();
    if (!appleWebhookId) {
        throw createHttpError(400, 'Sync the Apple webhook first, then send a test ping.');
    }

    const payload = await appleRequest({
        token: jwt,
        url: `${APPLE_API_ORIGIN}/v1/webhookPings`,
        method: 'POST',
        body: {
            data: {
                type: 'webhookPings',
                relationships: {
                    webhook: {
                        data: {
                            type: 'webhooks',
                            id: appleWebhookId,
                        },
                    },
                },
            },
        },
    });

    return json({
        ok: true,
        data: payload?.data || null,
    });
};

const streamGeneratedIcon = async (env, imagePath) => {
    const supabaseUrl = envValue(env, 'SUPABASE_URL');
    if (!supabaseUrl || !String(imagePath || '').trim()) {
        return publicTextResponse('Not found.', { status: 404 });
    }

    const encodedPath = String(imagePath || '')
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
    const response = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/generated-assets/${encodedPath}`, {
        headers: getSupabaseHeaders(env),
    });
    if (!response.ok) {
        return publicTextResponse(response.status === 404 ? 'Not found.' : 'Server error.', {
            status: response.status === 404 ? 404 : 502,
        });
    }

    return withPublicHeaders(
        new Response(response.body, {
            status: response.status,
            headers: {
                'content-type': response.headers.get('content-type') || 'image/png',
                'cache-control': 'public, max-age=300',
            },
        })
    );
};

const normalizePublicRedirectUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
        return '';
    }
};

export const redirectTo = (targetUrl) => {
    const normalizedTargetUrl = normalizePublicRedirectUrl(targetUrl);
    if (!normalizedTargetUrl) {
        return publicTextResponse('Not found.', { status: 404 });
    }
    return withPublicHeaders(Response.redirect(normalizedTargetUrl, 302));
};

const renderLandingPage = (surface, requestUrl) => {
    const title = String(surface?.title || surface?.app_name || 'App').trim() || 'App';
    const description = String(surface?.description || '').trim();
    const appstoreUrl = String(surface?.appstore_url || '').trim();
    const privacyUrl = String(surface?.privacy_policy_url || '').trim();
    const termsUrl = String(surface?.terms_of_use_url || '').trim();
    const supportUrl = String(surface?.support_form_url || '').trim();
    const iconUrl = String(surface?.icon_image_path || '').trim() ? `${requestUrl.origin}/icon` : '';
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description).replace(/\n+/g, '<br />');
    const safeOrigin = escapeHtml(requestUrl.host);

    const button = (href, label, variant = 'secondary') =>
        href
            ? `<a class="btn ${variant}" href="${escapeHtml(href)}"${href.startsWith('/') ? '' : ' target="_blank" rel="noreferrer"'}>${escapeHtml(label)}</a>`
            : '';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${escapeHtml(description || title)}" />
    <style>
      :root {
        color-scheme: dark;
        --bg-a: #06111f;
        --bg-b: #13233d;
        --card: rgba(7, 15, 30, 0.72);
        --line: rgba(255, 255, 255, 0.1);
        --text: #eef4ff;
        --muted: rgba(220, 230, 255, 0.66);
        --accent: #7dd3fc;
        --accent-strong: #c084fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Roboto Flex", "SF Pro Display", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%),
          radial-gradient(circle at top right, rgba(192, 132, 252, 0.18), transparent 32%),
          linear-gradient(160deg, var(--bg-a), var(--bg-b));
        color: var(--text);
      }
      .shell {
        max-width: 920px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .card {
        margin-top: 18px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--card);
        backdrop-filter: blur(18px);
        box-shadow: 0 18px 70px rgba(2, 8, 23, 0.36);
      }
      .hero {
        display: grid;
        gap: 24px;
        align-items: center;
      }
      @media (min-width: 760px) {
        .hero { grid-template-columns: 140px minmax(0, 1fr); }
      }
      .icon {
        width: 120px;
        height: 120px;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.28);
        object-fit: cover;
        background: rgba(255, 255, 255, 0.05);
      }
      h1 {
        margin: 0;
        font-size: clamp(34px, 6vw, 58px);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
        font-size: 15px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }
      .btn.primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        color: #06111f;
        border: none;
      }
      .btn.secondary {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: rgba(220, 230, 255, 0.46);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="eyebrow">${safeOrigin}</div>
      <section class="card">
        <div class="hero">
          ${iconUrl ? `<img class="icon" src="${escapeHtml(iconUrl)}" alt="${safeTitle} icon" />` : '<div class="icon"></div>'}
          <div>
            <h1>${safeTitle}</h1>
            ${description ? `<p style="margin-top:16px">${safeDescription}</p>` : ''}
            <div class="actions">
              ${button(appstoreUrl, 'View on the App Store', 'primary')}
              ${button(privacyUrl ? '/privacy' : '', 'Privacy')}
              ${button(termsUrl ? '/terms' : '', 'Terms')}
              ${button(supportUrl ? '/support' : '', 'Support')}
            </div>
          </div>
        </div>
      </section>
      <div class="footer">Powered by appshelp.cc</div>
    </main>
  </body>
</html>`;
};

const fetchPublicSurface = async (env, subdomain) => {
    const payload = await supabaseRpcRequest(env, 'appstore_review_webhook_public_surface', {
        p_subdomain: subdomain,
    });
    return payload && typeof payload === 'object' ? payload : null;
};

const handleBridgeRequest = async (request, env, url) => {
    const subdomain = getPublicSubdomainFromHost(url.host, env.PUBLIC_ROOT_DOMAIN);
    if (!subdomain) {
        throw createHttpError(404, 'Bridge host not found.');
    }

    if (request.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }), request);
    }
    if (request.method !== 'POST') {
        return withCors(json({ error: 'Method not allowed.' }, { status: 405 }), request);
    }

    try {
        let response;
        if (url.pathname === '/_bridge/appstore/apps') {
            response = await handleBridgeApps(request, env, subdomain);
        } else if (url.pathname === '/_bridge/appstore/sync') {
            response = await handleBridgeSync(request, env, subdomain);
        } else if (url.pathname === '/_bridge/appstore/ping') {
            response = await handleBridgePing(request, env, subdomain);
        } else {
            response = json({ error: 'Not found.' }, { status: 404 });
        }
        return withCors(response, request);
    } catch (error) {
        return withCors(
            json(
                {
                    error: String(error?.message || error || 'Bridge request failed.').slice(0, 1000),
                },
                { status: Number(error?.status || 500) || 500 }
            ),
            request
        );
    }
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/_bridge/')) {
            return handleBridgeRequest(request, env, url);
        }

        if (url.pathname === '/appstore-review') {
            const targetBase = envValue(env, 'INTERNAL_WEBHOOK_BASE_URL');
            if (!targetBase) {
                return publicTextResponse('Server error.', { status: 500 });
            }

            const targetUrl = mergeQueryStrings(targetBase, request.url);
            const headers = new Headers(request.headers);
            headers.set('x-forwarded-host', url.host);
            headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
            headers.set('x-original-host', url.host);

            return fetch(targetUrl, {
                method: request.method,
                headers,
                body: request.body,
                redirect: 'manual',
            });
        }

        const publicSubdomain = getPublicSubdomainFromHost(url.host, env.PUBLIC_ROOT_DOMAIN);
        if (!publicSubdomain) {
            return publicTextResponse('Not found.', { status: 404 });
        }

        let surface = null;
        try {
            surface = await fetchPublicSurface(env, publicSubdomain);
        } catch (error) {
            return publicTextResponse('Server error.', { status: 502 });
        }

        if (!surface) {
            return publicTextResponse('Not found.', { status: 404 });
        }

        if (!String(surface.public_page_published_at || '').trim()) {
            return publicTextResponse('Not found.', { status: 404 });
        }

        if (url.pathname === '/' || url.pathname === '') {
            return withPublicHeaders(
                html(renderLandingPage(surface, url), {
                    headers: {
                        'cache-control': 'public, max-age=120',
                    },
                })
            );
        }

        if (url.pathname === '/privacy') {
            return surface.privacy_policy_url ? redirectTo(surface.privacy_policy_url) : publicTextResponse('Not found.', { status: 404 });
        }

        if (url.pathname === '/terms') {
            return surface.terms_of_use_url ? redirectTo(surface.terms_of_use_url) : publicTextResponse('Not found.', { status: 404 });
        }

        if (url.pathname === '/support') {
            return surface.support_form_url ? redirectTo(surface.support_form_url) : publicTextResponse('Not found.', { status: 404 });
        }

        if (url.pathname === '/icon' || url.pathname === '/icon.png') {
            return streamGeneratedIcon(env, surface.icon_image_path);
        }

        return publicTextResponse('Not found.', { status: 404 });
    },
};
