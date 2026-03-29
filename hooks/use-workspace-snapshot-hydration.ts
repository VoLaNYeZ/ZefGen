import { useCallback, type MutableRefObject } from 'react';
import { fetchConnectorAppConfig } from '../data/connector-app-config';
import { fetchCurrentConnectorLegalLinks } from '../data/connector-legal-links';
import { fetchConnectorSecretMetas } from '../data/connector-secrets';
import { fetchAppstoreReviewEvents, fetchAppstoreReviewWebhook } from '../data/appstore-review-webhooks';
import { fetchScreenshotSets } from '../data/screenshot-sets';
import { fetchAssetPicks } from '../data/asset-picks';
import { fetchExportStatus } from '../data/export-status';
import { fetchAppScreenshotPrompts } from '../data/app-screenshot-prompts';
import {
    buildFallbackAppstoreReviewWebhookStatus,
    extractAppStoreNameHintFromConnectorConfig,
} from '../components/app/AppStoreReviewWebhookRow';
import type { TranslationKey } from '../i18n';
import type { AppExportStatus, AppItem, AppScreenshotSet, AssetPick, Brand } from '../types/zefgen';
import type { AppWorkspaceSnapshot } from '../types/workspace-snapshot';
import {
    buildManagedAppstoreReviewPublicPageUrl,
    extractManagedAppstoreReviewPublicSubdomain,
} from '../utils/appstore-review-webhook';

const DEFAULT_BASE_BRANCH = 'main';

type Params = {
    sessionUserId: string;
    text: (key: TranslationKey) => string;
    workspaceSnapshotsRef: MutableRefObject<Record<string, AppWorkspaceSnapshot>>;
};

export function useWorkspaceSnapshotHydration({ sessionUserId, text, workspaceSnapshotsRef }: Params) {
    const resolveActiveScreenshotSetId = useCallback((appId: string, sets: AppScreenshotSet[], originalId?: string | null) => {
        const storageKey = `zefgen.activeScreenshotSet.${appId}`;
        const storedId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const resolvedId =
            storedId && sets.some((set) => set.id === storedId)
                ? storedId
                : (String(originalId || '').trim() || sets[0]?.id || null);
        if (typeof window !== 'undefined') {
            if (resolvedId) window.localStorage.setItem(storageKey, resolvedId);
            else window.localStorage.removeItem(storageKey);
        }
        return resolvedId;
    }, []);

    const hydrateWorkspaceSnapshot = useCallback(
        async (brand: Brand | null, app: AppItem | null): Promise<AppWorkspaceSnapshot | null> => {
            if (!brand || !app) return null;

            const cached = workspaceSnapshotsRef.current[app.id];
            if (cached && cached.brandId === brand.id) {
                return cached;
            }

            const readPayload = <T,>(result: PromiseSettledResult<{ data?: T | null; error?: unknown }>): T | null => {
                if (result.status !== 'fulfilled') return null;
                if (result.value?.error) return null;
                return (result.value.data as T | null) ?? null;
            };

            const emptyLegalLinks = {
                id: null,
                fingerprint: null,
                privacy_policy_url: '',
                terms_of_use_url: '',
                support_form_url: '',
                updated_at: null,
                created_at: null,
            };

            const [configResp, secretsResp, legalLinksResp, webhookResp, eventsResp, setsResp, picksResp, statusResp, promptsResp] =
                await Promise.allSettled([
                    fetchConnectorAppConfig({ userId: sessionUserId, appId: app.id }),
                    fetchConnectorSecretMetas({ userId: sessionUserId, appId: app.id }),
                    fetchCurrentConnectorLegalLinks({ appId: app.id }),
                    fetchAppstoreReviewWebhook({ userId: sessionUserId, appId: app.id }),
                    fetchAppstoreReviewEvents({ userId: sessionUserId, appId: app.id, limit: 6 }),
                    fetchScreenshotSets({ userId: sessionUserId, appId: app.id }),
                    fetchAssetPicks({ userId: sessionUserId, appId: app.id }),
                    fetchExportStatus({ userId: sessionUserId, appId: app.id }),
                    fetchAppScreenshotPrompts({ userId: sessionUserId, brandId: brand.id, appId: app.id }),
                ]);

            const connectorConfig = readPayload<any>(configResp);
            const secretMetas = readPayload<any[]>(secretsResp) ?? [];
            const legalLinks = readPayload<any>(legalLinksResp);
            const webhook = readPayload<any>(webhookResp);
            const events = readPayload<any[]>(eventsResp) ?? [];
            const screenshotSetsForApp = readPayload<AppScreenshotSet[]>(setsResp) ?? [];
            const assetPicks = readPayload<AssetPick[]>(picksResp) ?? [];
            const exportStatus = readPayload<AppExportStatus>(statusResp);
            const prompts = readPayload<Array<{ brand_reference_id?: string | null; prompt?: string | null }>>(promptsResp) ?? [];
            const publicSubdomain =
                String((webhook as any)?.public_subdomain || '').trim() ||
                extractManagedAppstoreReviewPublicSubdomain((webhook as any)?.public_webhook_url);
            const promptsByRefId: Record<string, string> = {};
            for (const row of prompts) {
                const refId = String((row as any)?.brand_reference_id || '').trim();
                if (!refId) continue;
                promptsByRefId[refId] = String((row as any)?.prompt || '');
            }

            const snapshot: AppWorkspaceSnapshot = {
                appId: app.id,
                brandId: brand.id,
                connectorForm: {
                    appId: app.id,
                    projectBrief: String((connectorConfig as any)?.project_brief || ''),
                    ideaId: String((connectorConfig as any)?.idea_id || '').trim() || null,
                    baseBranch: String((connectorConfig as any)?.base_branch || '').trim() || DEFAULT_BASE_BRANCH,
                    variables: { ...((connectorConfig as any)?.variables || {}) },
                    configUpdatedAt: String((connectorConfig as any)?.updated_at || '').trim() || null,
                    legalLinks:
                        ((legalLinks as any) && typeof legalLinks === 'object'
                            ? { ...(legalLinks as any) }
                            : emptyLegalLinks) as any,
                    secretMetas: Array.isArray(secretMetas) ? ([...secretMetas] as any) : [],
                    publicWebpageUrl: publicSubdomain
                        ? buildManagedAppstoreReviewPublicPageUrl({
                              publicSubdomain,
                          })
                        : '',
                    publicPagePublishedAt: String((webhook as any)?.public_page_published_at || '').trim() || null,
                },
                generatedAssets: {
                    appId: app.id,
                    screenshotSets: screenshotSetsForApp,
                    activeScreenshotSetId: screenshotSetsForApp.length
                        ? resolveActiveScreenshotSetId(app.id, screenshotSetsForApp, null)
                        : null,
                    assetPicks: assetPicks.slice(),
                    exportStatus: exportStatus ? ({ ...exportStatus } as AppExportStatus) : null,
                },
                screenshotPrompts: {
                    appId: app.id,
                    brandId: brand.id,
                    promptsByRefId,
                },
                appStoreReviewPanel: {
                    appId: app.id,
                    status: buildFallbackAppstoreReviewWebhookStatus({
                        webhook: webhook || null,
                        events,
                        connectorConfig: connectorConfig || null,
                        secretMetas,
                        text,
                    }),
                    appStoreNameHint: extractAppStoreNameHintFromConnectorConfig(connectorConfig || null),
                    appleCandidates: [],
                    appleCandidatesLoaded: false,
                    expanded: false,
                    quickSetupEditing: false,
                },
            };

            workspaceSnapshotsRef.current[app.id] = snapshot;
            return snapshot;
        },
        [resolveActiveScreenshotSetId, sessionUserId, text, workspaceSnapshotsRef]
    );

    return {
        hydrateWorkspaceSnapshot,
    };
}
