import type { AppItem } from '../types/zefgen';

type BuildManualIntegrationCopyTextPayload = {
    selectedApp: Pick<AppItem, 'alias' | 'name'> | null;
    variables?: Record<string, any> | null;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const quoteValue = (value: unknown) => `"${normalizeText(value)}"`;

export const buildManualIntegrationCopyText = ({
    selectedApp,
    variables,
}: BuildManualIntegrationCopyTextPayload) => {
    const normalizedVariables = variables && typeof variables === 'object' ? variables : {};
    const alias = normalizeText(selectedApp?.alias).toUpperCase();
    const appName = normalizeText(normalizedVariables.appstore_name) || normalizeText(selectedApp?.name);
    const apphudKey = normalizeText(normalizedVariables.apphud_api_key) || normalizeText(normalizedVariables.apphud_api_url);
    const analyticsUrl = normalizeText(normalizedVariables.domain);
    const bundleId = normalizeText(normalizedVariables.bundle_id);
    const iapProductId = normalizeText(normalizedVariables.id_purchases) || 'без покупок';

    const appLabel = [alias ? `[${alias}]` : '', appName].filter(Boolean).join(' ');
    const introLine = appLabel ? `Привет, нужна интеграция - ${appLabel}` : 'Привет, нужна интеграция -';

    return [
        introLine,
        `Apphud Key - ${quoteValue(apphudKey)}`,
        `Analytics URL - ${quoteValue(analyticsUrl)}`,
        `Bundle ID - ${quoteValue(bundleId)}`,
        `*IAP Product ID - ${iapProductId}`,
        '+ Firebase нужно создать',
        '+ Пуш подрубить',
    ].join('\n');
};
