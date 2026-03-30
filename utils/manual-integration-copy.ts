import type { AppItem } from '../types/zefgen';

type BuildManualIntegrationCopyTextPayload = {
    selectedApp: Pick<AppItem, 'alias' | 'name'> | null;
    variables?: Record<string, any> | null;
    legalLinks?: {
        privacy_policy_url?: unknown;
        terms_of_use_url?: unknown;
        support_form_url?: unknown;
    } | null;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const quoteValue = (value: unknown) => `"${normalizeText(value)}"`;

export const buildManualIntegrationCopyText = ({
    selectedApp,
    variables,
    legalLinks,
}: BuildManualIntegrationCopyTextPayload) => {
    const normalizedVariables = variables && typeof variables === 'object' ? variables : {};
    const alias = normalizeText(selectedApp?.alias).toUpperCase();
    const appName = normalizeText(normalizedVariables.appstore_name) || normalizeText(selectedApp?.name);
    const apphudKey = normalizeText(normalizedVariables.apphud_api_key) || normalizeText(normalizedVariables.apphud_api_url);
    const analyticsUrl = normalizeText(normalizedVariables.domain);
    const privacyUrl =
        normalizeText(legalLinks?.privacy_policy_url) || normalizeText(normalizedVariables.privacy_policy_url);
    const termsUrl =
        normalizeText(legalLinks?.terms_of_use_url) || normalizeText(normalizedVariables.terms_of_use_url);
    const supportUrl =
        normalizeText(legalLinks?.support_form_url) || normalizeText(normalizedVariables.support_form_url);
    const bundleId = normalizeText(normalizedVariables.bundle_id);
    const iapProductId = normalizeText(normalizedVariables.id_purchases) || 'без покупок';

    const appLabel = [alias ? `[${alias}]` : '', appName].filter(Boolean).join(' ');
    const introLine = appLabel ? `Привет, нужна интеграция - ${appLabel}` : 'Привет, нужна интеграция -';

    return [
        introLine,
        `Apphud Key - ${quoteValue(apphudKey)}`,
        `Analytics URL - ${quoteValue(analyticsUrl)}`,
        `privacy - ${quoteValue(privacyUrl)}`,
        `terms - ${quoteValue(termsUrl)}`,
        `support - ${quoteValue(supportUrl)}`,
        `Bundle ID - ${quoteValue(bundleId)}`,
        `*IAP Product ID - ${iapProductId}`,
        '+ Firebase нужно создать',
        '+ Пуш подрубить',
    ].join('\n');
};
