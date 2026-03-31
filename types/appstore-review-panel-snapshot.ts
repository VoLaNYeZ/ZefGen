import type {
    AppstoreConnectAppCandidate,
    AppstoreReviewWebhookStatus,
} from './zefgen';

export type AppStoreReviewPanelSnapshot = {
    appId: string;
    status: AppstoreReviewWebhookStatus | null;
    appStoreNameHint: string;
    appleCandidates: AppstoreConnectAppCandidate[];
    appleCandidatesLoaded: boolean;
    expanded: boolean;
    quickSetupEditing: boolean;
};

export const buildAppStoreReviewPanelSnapshot = (payload: {
    appId: string;
    status: AppstoreReviewWebhookStatus | null;
    appStoreNameHint: string;
    appleCandidates: AppstoreConnectAppCandidate[];
    appleCandidatesLoaded: boolean;
    expanded: boolean;
    quickSetupEditing: boolean;
    hasDraftChanges: boolean;
    privateKeyDraft?: string | null;
}): AppStoreReviewPanelSnapshot | null => {
    const appId = String(payload.appId || '').trim();
    if (!appId || payload.hasDraftChanges) return null;
    const statusAppId = String(payload.status?.webhook?.app_id || '').trim();
    if (statusAppId && statusAppId !== appId) return null;

    return {
        appId,
        status: payload.status || null,
        appStoreNameHint: String(payload.appStoreNameHint || '').trim(),
        appleCandidates: Array.isArray(payload.appleCandidates) ? [...payload.appleCandidates] : [],
        appleCandidatesLoaded: Boolean(payload.appleCandidatesLoaded),
        expanded: Boolean(payload.expanded),
        quickSetupEditing: Boolean(payload.quickSetupEditing),
    };
};
