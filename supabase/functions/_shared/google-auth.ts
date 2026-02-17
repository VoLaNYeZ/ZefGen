type OAuthRefreshCredentials = {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
};

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/forms.body',
];

type TokenCache = {
    accessToken: string;
    expiresAtMs: number;
    mode: 'oauth_refresh';
};

let tokenCache: TokenCache | null = null;

const parseOAuthRefreshCredentials = (): OAuthRefreshCredentials => {
    const clientId = String(Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '').trim();
    const clientSecret = String(Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '').trim();
    const refreshToken = String(Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN') || '').trim();

    const missing = [
        clientId ? null : 'GOOGLE_OAUTH_CLIENT_ID',
        clientSecret ? null : 'GOOGLE_OAUTH_CLIENT_SECRET',
        refreshToken ? null : 'GOOGLE_OAUTH_REFRESH_TOKEN',
    ].filter(Boolean);

    if (missing.length > 0) {
        throw new Error(
            `OAuth-only mode requires GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN. Missing: ${missing.join(
                ', '
            )}.`
        );
    }

    return { clientId, clientSecret, refreshToken };
};

const requestAccessTokenByOAuthRefresh = async (credentials: OAuthRefreshCredentials) => {
    const body = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
    });

    const resp = await fetch(GOOGLE_TOKEN_URI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const payload = await resp.json().catch(() => null);
    if (!resp.ok || !payload?.access_token) {
        throw new Error(
            `Google OAuth refresh token request failed (${resp.status}): ${String(
                payload?.error_description || payload?.error || 'unknown error'
            )}`
        );
    }

    return {
        accessToken: String(payload.access_token),
        expiresInSec: Number(payload.expires_in) || 3600,
    };
};

export const getGoogleAccessToken = async () => {
    const oauthCredentials = parseOAuthRefreshCredentials();
    const mode: TokenCache['mode'] = 'oauth_refresh';

    const nowMs = Date.now();
    if (tokenCache && tokenCache.mode === mode && tokenCache.expiresAtMs - 60_000 > nowMs) {
        return tokenCache.accessToken;
    }

    const tokenResponse = await requestAccessTokenByOAuthRefresh(oauthCredentials);

    tokenCache = {
        accessToken: tokenResponse.accessToken,
        expiresAtMs: Date.now() + tokenResponse.expiresInSec * 1000,
        mode,
    };
    return tokenResponse.accessToken;
};
