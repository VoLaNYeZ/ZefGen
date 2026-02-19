const COUNTRY_RE = /^[a-z]{2}$/i;
const APP_ID_RE = /^\d+$/;

const normalizeCountryCode = (raw: string | null | undefined) => {
    const value = String(raw || '').trim().toLowerCase();
    return COUNTRY_RE.test(value) ? value : 'us';
};

const normalizeAppId = (raw: string | null | undefined) => {
    const value = String(raw || '').trim();
    return APP_ID_RE.test(value) ? value : '';
};

export const parseAppStoreInput = (raw: string): { appId: string; countryCode: string } | null => {
    const input = String(raw || '').trim();
    if (!input) return null;

    if (APP_ID_RE.test(input)) {
        return { appId: input, countryCode: 'us' };
    }

    const idOnlyMatch = input.match(/^id(\d+)$/i);
    if (idOnlyMatch) {
        return { appId: idOnlyMatch[1], countryCode: 'us' };
    }

    let candidate = input;
    if (!/^https?:\/\//i.test(candidate)) {
        if (/^(?:www\.)?(?:apps|itunes)\.apple\.com\//i.test(candidate)) {
            candidate = `https://${candidate}`;
        } else {
            return null;
        }
    }

    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== 'apps.apple.com' && host !== 'itunes.apple.com') return null;

        const idMatch = parsed.pathname.match(/id(\d+)/i);
        if (!idMatch) return null;

        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const first = String(pathParts[0] || '').trim();
        const countryCode = COUNTRY_RE.test(first) ? first.toLowerCase() : 'us';

        return {
            appId: idMatch[1],
            countryCode,
        };
    } catch {
        return null;
    }
};

export const buildCanonicalAppStoreUrl = (appId: string, countryCode: string) => {
    const normalizedAppId = normalizeAppId(appId);
    const normalizedCountryCode = normalizeCountryCode(countryCode);
    return `https://apps.apple.com/${normalizedCountryCode}/app/id${normalizedAppId}`;
};

export const buildGeoAppStoreUrls = (appId: string, countryCodes: string[]) => {
    const normalizedAppId = normalizeAppId(appId);
    if (!normalizedAppId) return [] as Array<{ code: string; url: string }>;

    const seen = new Set<string>();
    const normalizedCountryCodes: string[] = [];

    for (const rawCode of countryCodes || []) {
        const code = String(rawCode || '').trim().toLowerCase();
        if (!COUNTRY_RE.test(code)) continue;
        if (seen.has(code)) continue;
        seen.add(code);
        normalizedCountryCodes.push(code);
    }

    if (!normalizedCountryCodes.length) {
        normalizedCountryCodes.push('us');
    }

    return normalizedCountryCodes.map((code) => ({
        code: code.toUpperCase(),
        url: buildCanonicalAppStoreUrl(normalizedAppId, code),
    }));
};
