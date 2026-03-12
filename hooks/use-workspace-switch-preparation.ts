import { useCallback, type MutableRefObject } from 'react';
import {
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_LOCK_ENFORCEMENT_ENABLED,
} from '../constants/zefgen';
import type { TranslationKey } from '../i18n';
import type { AppItem, BrandLockResult } from '../types/zefgen';
import type { WorkspacePreparationResult, WorkspaceSwitchGuard } from '../types/workspace-switch';

type Params = {
    appFormOpen: boolean;
    appStoreLinkGuardRef: MutableRefObject<WorkspaceSwitchGuard | null>;
    appStoreReviewGuardRef: MutableRefObject<WorkspaceSwitchGuard | null>;
    brandFormOpen: boolean;
    brandReleaseInfoGuardRef: MutableRefObject<WorkspaceSwitchGuard | null>;
    flushAppScreenshotPrompts: () => Promise<boolean>;
    flushConnectorFormPending: () => Promise<boolean>;
    getAppSwitchBlockReason: () => string | null;
    getBrandSwitchBlockReason: () => string | null;
    handleNoBrandIconPromptSave: (value: string) => Promise<boolean>;
    isNoBrandMode: boolean;
    lockedBrandIdSet: Set<string>;
    noBrandIconPromptDraft: string;
    releaseCurrentBrand: () => Promise<void>;
    saveCurrentAppEditForSwitch: () => Promise<boolean>;
    saveCurrentBrandEditForSwitch: () => Promise<boolean>;
    selectedApp: AppItem | null;
    selectedAppId: string | null;
    selectedBrandId: string | null;
    softLockViewModeEnabled: boolean;
    text: (key: TranslationKey) => string;
    tryClaimBrand: (brandId: string) => Promise<BrandLockResult>;
};

export function useWorkspaceSwitchPreparation({
    appFormOpen,
    appStoreLinkGuardRef,
    appStoreReviewGuardRef,
    brandFormOpen,
    brandReleaseInfoGuardRef,
    flushAppScreenshotPrompts,
    flushConnectorFormPending,
    getAppSwitchBlockReason,
    getBrandSwitchBlockReason,
    handleNoBrandIconPromptSave,
    isNoBrandMode,
    lockedBrandIdSet,
    noBrandIconPromptDraft,
    releaseCurrentBrand,
    saveCurrentAppEditForSwitch,
    saveCurrentBrandEditForSwitch,
    selectedApp,
    selectedAppId,
    selectedBrandId,
    softLockViewModeEnabled,
    text,
    tryClaimBrand,
}: Params) {
    const prepareWorkspaceForSwitch = useCallback(
        async (
            nextSelection: { brandId: string | null; appId: string | null },
            options?: { normalizeVisibleWorkspaceState?: boolean }
        ): Promise<WorkspacePreparationResult> => {
            const normalizeVisibleWorkspaceState = Boolean(options?.normalizeVisibleWorkspaceState);
            const brandWillChange = nextSelection.brandId !== selectedBrandId;
            const appWillChange = nextSelection.appId !== selectedAppId || brandWillChange;
            const shouldNormalizeBrandState = normalizeVisibleWorkspaceState || brandWillChange;
            const shouldNormalizeAppState = normalizeVisibleWorkspaceState || appWillChange;

            if (shouldNormalizeBrandState) {
                const brandFormBlockReason = getBrandSwitchBlockReason();
                if (brandFormOpen) {
                    const ok = await saveCurrentBrandEditForSwitch();
                    if (!ok) {
                        if (brandFormBlockReason) {
                            return { status: 'blocked', message: brandFormBlockReason };
                        }
                        return { status: 'failed' };
                    }
                }

                const brandReleaseInfoGuard = brandReleaseInfoGuardRef.current;
                if (brandReleaseInfoGuard?.isDirty) {
                    const ok = await brandReleaseInfoGuard.flushPending();
                    if (!ok) {
                        if (brandReleaseInfoGuard.blockReason) {
                            return { status: 'blocked', message: brandReleaseInfoGuard.blockReason };
                        }
                        return { status: 'failed' };
                    }
                }
            }

            if (shouldNormalizeAppState) {
                const appFormBlockReason = getAppSwitchBlockReason();
                if (appFormOpen) {
                    const ok = await saveCurrentAppEditForSwitch();
                    if (!ok) {
                        if (appFormBlockReason) {
                            return { status: 'blocked', message: appFormBlockReason };
                        }
                        return { status: 'failed' };
                    }
                }

                const appStoreLinkGuard = appStoreLinkGuardRef.current;
                if (appStoreLinkGuard?.isDirty) {
                    const ok = await appStoreLinkGuard.flushPending();
                    if (!ok) {
                        if (appStoreLinkGuard.blockReason) {
                            return { status: 'blocked', message: appStoreLinkGuard.blockReason };
                        }
                        return { status: 'failed' };
                    }
                }

                const appStoreReviewGuard = appStoreReviewGuardRef.current;
                if (appStoreReviewGuard?.isDirty) {
                    const ok = await appStoreReviewGuard.flushPending();
                    if (!ok) {
                        if (appStoreReviewGuard.blockReason) {
                            return { status: 'blocked', message: appStoreReviewGuard.blockReason };
                        }
                        return { status: 'failed' };
                    }
                }

                if (
                    selectedApp &&
                    isNoBrandMode &&
                    String(noBrandIconPromptDraft || '') !== String(selectedApp.icon_prompt || '')
                ) {
                    const ok = await handleNoBrandIconPromptSave(noBrandIconPromptDraft);
                    if (!ok) return { status: 'failed' };
                }

                const connectorFlushes = await Promise.all([
                    flushConnectorFormPending(),
                    flushAppScreenshotPrompts(),
                ]);
                if (connectorFlushes.some((result) => !result)) {
                    return { status: 'failed' };
                }
            }

            return { status: 'ready' };
        },
        [
            appFormOpen,
            appStoreLinkGuardRef,
            appStoreReviewGuardRef,
            brandFormOpen,
            brandReleaseInfoGuardRef,
            flushAppScreenshotPrompts,
            flushConnectorFormPending,
            getAppSwitchBlockReason,
            getBrandSwitchBlockReason,
            handleNoBrandIconPromptSave,
            isNoBrandMode,
            noBrandIconPromptDraft,
            saveCurrentAppEditForSwitch,
            saveCurrentBrandEditForSwitch,
            selectedApp,
            selectedAppId,
            selectedBrandId,
            text,
        ]
    );

    const prepareWorkspaceLockForSelection = useCallback(
        async (targetBrandId: string | null): Promise<WorkspacePreparationResult> => {
            if (!WORKSPACE_COLLAB_ENABLED) {
                return { status: 'ready' };
            }

            const normalizedTargetBrandId = String(targetBrandId || '').trim() || null;
            if (normalizedTargetBrandId === selectedBrandId) {
                return { status: 'ready' };
            }

            if (!normalizedTargetBrandId) {
                if (selectedBrandId) {
                    await releaseCurrentBrand();
                }
                return { status: 'ready' };
            }

            if (WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
                const brandBusyByOtherDevice = lockedBrandIdSet.has(normalizedTargetBrandId);
                if (brandBusyByOtherDevice) {
                    if (!softLockViewModeEnabled) {
                        return { status: 'blocked', message: text('brand_under_work_readonly') };
                    }
                    await releaseCurrentBrand();
                    return { status: 'ready' };
                }

                const claim = await tryClaimBrand(normalizedTargetBrandId);
                if (!claim.ok) {
                    if (softLockViewModeEnabled && claim.reason === 'locked_by_other_device') {
                        await releaseCurrentBrand();
                        return { status: 'ready' };
                    }
                    if (claim.reason === 'locked_by_other_device') {
                        return { status: 'blocked', message: text('brand_under_work_readonly') };
                    }
                    if (claim.reason === 'unavailable') {
                        return { status: 'failed' };
                    }
                    return { status: 'failed' };
                }
                return { status: 'ready' };
            }

            void tryClaimBrand(normalizedTargetBrandId);
            return { status: 'ready' };
        },
        [
            lockedBrandIdSet,
            releaseCurrentBrand,
            selectedBrandId,
            softLockViewModeEnabled,
            text,
            tryClaimBrand,
        ]
    );

    return {
        prepareWorkspaceForSwitch,
        prepareWorkspaceLockForSelection,
    };
}
