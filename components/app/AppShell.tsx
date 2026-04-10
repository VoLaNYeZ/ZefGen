import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { t, TranslationKey } from '../../i18n';
import {
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_COLLAB_POLL_MS,
    WORKSPACE_COLLAB_TTL_SECONDS,
} from '../../constants/zefgen';
import { syncAutoGrowTextarea } from '../../utils/dom';
import {
    assignFirstAvailableAppstoreAccountToApp,
    useAppShellActions,
} from '../../hooks/use-app-shell-actions';
import { useAppShellDerivedState } from '../../hooks/use-app-shell-derived-state';
import { useAppShellSelectionModels } from '../../hooks/use-app-shell-selection-models';
import { useAppShellUiState } from '../../hooks/use-app-shell-ui-state';
import { useAppScreenshotDownloads } from '../../hooks/use-app-screenshot-downloads';
import { useRouteSync } from '../../hooks/use-route-sync';
import { useSlotMappings } from '../../hooks/use-slot-mappings';
import { useAppFolderLayout } from '../../hooks/use-app-folder-layout';
import { useAppPillPan } from '../../hooks/use-app-pill-pan';
import { useWorkspaceCollaboration } from '../../hooks/use-workspace-collaboration';
import { useWorkspaceNavigationActions } from '../../hooks/use-workspace-navigation-actions';
import { useWorkspaceNavigationController } from '../../hooks/use-workspace-navigation-controller';
import { useWorkspaceLockSideEffects } from '../../hooks/use-workspace-lock-side-effects';
import {
    useNoBrandIconPromptActions,
    useNoBrandMoveToBrand,
    useNoBrandScreenshotPromptAutogenActions,
} from '../../hooks/use-no-brand-workspace-actions';
import { useAppShellNotices } from '../../hooks/use-app-shell-notices';
import { useWorkspaceAssetsLayout } from '../../hooks/use-workspace-assets-layout';
import { useWorkspaceBusyGuards } from '../../hooks/use-workspace-busy-guards';
import { useWorkspacePresentationState } from '../../hooks/use-workspace-presentation-state';
import { useWorkspaceReadOnlyState } from '../../hooks/use-workspace-readonly-state';
import { useWorkspaceStepReadiness } from '../../hooks/use-workspace-step-readiness';
import { useWorkspaceSnapshotCache } from '../../hooks/use-workspace-snapshot-cache';
import { useWorkspaceSnapshotHydration } from '../../hooks/use-workspace-snapshot-hydration';
import { useWorkspaceSwitchPreparation } from '../../hooks/use-workspace-switch-preparation';
import { useWorkspaceSwitchOverlay } from '../../hooks/use-workspace-switch-overlay';
import { useBrandAppSummaries } from '../../hooks/use-brand-app-summaries';
import { useBrands } from '../../hooks/use-brands';
import { useApps } from '../../hooks/use-apps';
import { useAppstoreAccounts } from '../../hooks/use-appstore-accounts';
import { useAppIdeas } from '../../hooks/use-app-ideas';
import { useBrandReferences } from '../../hooks/use-brand-references';
import { useAppScreenshots } from '../../hooks/use-app-screenshots';
import { useGeneratedAssets } from '../../hooks/use-generated-assets';
import { useAppScreenshotPrompts } from '../../hooks/use-app-screenshot-prompts';
import { useConnectorJobs } from '../../hooks/use-connector-jobs';
import { useConnectorJobQueue } from '../../hooks/use-connector-job-queue';
import { createConnectorJob } from '../../data/connector-jobs';
import { AppShellLayout } from './AppShellLayout';
import { AppShellOverlays } from './AppShellOverlays';
import { AppShellPageContent } from './AppShellPageContent';
import { HELP_CENTER_RUNTIME_LANG } from './help-center-content';
import { Sidebar } from './Sidebar';
import type { AppStoreReviewPanelSnapshot } from '../../types/appstore-review-panel-snapshot';
import type { ConnectorExecutionPanelSnapshot } from '../../types/connector-execution-snapshot';
import { WorkspaceShellChrome } from './WorkspaceShellChrome';
import type { AppItem, AppstoreAccount } from '../../types/zefgen';
import {
    EMAPPSTORE777_OWNER,
    toEmappstore777RepoFullNameFromSource,
    toEmappstore777RepoNameFromSourceName,
    toGithubRepoFullNameFromUrl,
} from '../../utils/client-github';
import type { AppWorkspaceSnapshot } from '../../types/workspace-snapshot';
import type { WorkspaceSwitchGuard } from '../../types/workspace-switch';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import { writeLastWorkspaceSelection } from '../../utils/workspace-selection';

type AppShellProps = {
    session: Session;
};

type WorkspaceSwitchState = {
    label: string;
};

export function AppShell({ session }: AppShellProps) {
    const {
        accountsFocusAppId,
        accountsHasUnsavedChanges,
        activePage,
        draggingAppId,
        dragOverAppId,
        gooeyDebug,
        ideasHasUnsavedChanges,
        isSidebarOpen,
        lang,
        logoContainerRef,
        logoFontReady,
        logoVariantIndex,
        logoWord,
        mainScrollRef,
        setAccountsFocusAppId,
        setAccountsHasUnsavedChanges,
        setActivePage,
        setDraggingAppId,
        setDragOverAppId,
        setIdeasHasUnsavedChanges,
        setIsSidebarOpen,
        setLang,
        setLogoVariantIndex,
        stickyHeaderRef,
    } = useAppShellUiState();
    const text = useCallback((key: TranslationKey) => t(lang, key), [lang]);

    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [requestedBrandId, setRequestedBrandId] = useState<string | null>(null);
    const [requestedAppId, setRequestedAppId] = useState<string | null>(null);
    const [dataError, setDataError] = useState<string | null>(null);
    const [hasParsedRoute, setHasParsedRoute] = useState(false);
    const [heartbeatBrandId, setHeartbeatBrandId] = useState<string | null>(null);
    const [pendingAutoAssignAppIds, setPendingAutoAssignAppIds] = useState<string[]>([]);
    const [appReviewStateOverridesByAppId, setAppReviewStateOverridesByAppId] = useState<Record<string, string | null>>({});
    const pendingAutoAssignAppIdsRef = useRef<string[]>([]);
    const pendingAutoAssignAppByIdRef = useRef<Map<string, AppItem>>(new Map());
    const pendingAutoAssignDrainInFlightRef = useRef(false);
    const appsRef = useRef<AppItem[]>([]);
    const appstoreAccountsRef = useRef<AppstoreAccount[]>([]);
    const appstoreAccountsLoadingRef = useRef(true);
    const workspaceSnapshotsRef = useRef<Record<string, AppWorkspaceSnapshot>>({});
    const brandReleaseInfoGuardRef = useRef<WorkspaceSwitchGuard | null>(null);
    const appStoreLinkGuardRef = useRef<WorkspaceSwitchGuard | null>(null);
    const appStoreReviewGuardRef = useRef<WorkspaceSwitchGuard | null>(null);
    const workspaceSwitchSeqRef = useRef(0);
    const [workspaceSwitchState, setWorkspaceSwitchState] = useState<WorkspaceSwitchState | null>(null);
    const [isWorkspaceCommitPending, startWorkspaceCommitTransition] = React.useTransition();

    const {
        actionError,
        aliasNotice,
        collabWarning,
        reportActionError,
        reportCollabWarning,
        reportLockedBrandWarning,
        reportReadOnlyBlocked,
        showAliasNotice,
    } = useAppShellNotices({ text });
    const reportActionErrorRef = useRef(reportActionError);
    const textRef = useRef(text);

    const {
        brands,
        loading: brandsLoading,
        refresh: refreshBrands,
        brandFormOpen,
        brandForm,
        brandFormError,
        brandFormLoading,
        editingBrandId,
        brandSlugPreview,
        openBrandForm,
        submitBrandForm,
        saveCurrentEditForSwitch: saveCurrentBrandEditForSwitch,
        getBrandSwitchBlockReason,
        setBrandForm,
        closeBrandForm,
        patchBrand,
        reorderBrands,
    } = useBrands({
        session,
        text,
        setSelectedBrandId,
        onDataError: setDataError,
    });
    const selectedBrand = useMemo(
        () => brands.find((brand) => brand.id === selectedBrandId) || null,
        [brands, selectedBrandId]
    );
    const routeBrandId = requestedBrandId ?? selectedBrandId;
    const routeAppId = requestedAppId ?? selectedAppId;
    const requestedBrand = useMemo(
        () => brands.find((brand) => brand.id === routeBrandId) || null,
        [brands, routeBrandId]
    );

    const {
        activeSessionCount,
        activeSessionCountries,
        lockedBrandIdSet,
        lockConflictBrandId,
        takeOverBrand,
        tryClaimBrand,
        releaseCurrentBrand,
        refreshSnapshot,
    } = useWorkspaceCollaboration({
        session,
        activePage,
        selectedBrandId,
        heartbeatBrandId,
        enabled: WORKSPACE_COLLAB_ENABLED,
        pollMs: WORKSPACE_COLLAB_POLL_MS,
        ttlSeconds: WORKSPACE_COLLAB_TTL_SECONDS,
        onSoftWarning: reportCollabWarning,
    });
    const { isCurrentBrandReadOnly, sidebarLockedBrandIdSet, softLockViewModeEnabled } = useWorkspaceReadOnlyState({
        activePage,
        lockConflictBrandId,
        lockedBrandIdSet,
        selectedBrandId,
    });

    const {
        accounts: appstoreAccounts,
        loading: appstoreAccountsLoading,
        error: appstoreAccountsError,
        refresh: refreshAppstoreAccounts,
        createAccount: createAppstoreAccount,
        updateAccount: updateAppstoreAccount,
        deleteAccount: deleteAppstoreAccount,
    } = useAppstoreAccounts({
        session,
        onDataError: setDataError,
    });
    const updateAppstoreAccountRef = useRef(updateAppstoreAccount);

    const enqueuePendingAutoAssignApp = useCallback((app: AppItem) => {
        pendingAutoAssignAppByIdRef.current.set(app.id, app);
        if (!pendingAutoAssignAppIdsRef.current.includes(app.id)) {
            pendingAutoAssignAppIdsRef.current = [...pendingAutoAssignAppIdsRef.current, app.id];
        }
        setPendingAutoAssignAppIds((current) => {
            if (current.includes(app.id)) return current;
            return [...current, app.id];
        });
    }, []);

    const handleAutoAssignAccountForNewApp = useCallback((app: AppItem) => {
        enqueuePendingAutoAssignApp(app);
    }, [enqueuePendingAutoAssignApp]);

    const {
        apps,
        loading: appsLoading,
        refresh: refreshApps,
        orderedApps,
        bannedApps,
        visibleActiveApps,
        visibleApps,
        canAddApp,
        showBannedToggle,
        appFormOpen,
        appForm,
        appFormError,
        appFormLoading,
        editingAppId,
        appAliasPreview,
        newAppAliasPlaceholder,
        isEditingBanned,
        isBannedView,
        setIsBannedView,
        openAppForm,
        closeAppForm,
        submitAppForm,
        saveCurrentEditForSwitch: saveCurrentAppEditForSwitch,
        getAppSwitchBlockReason,
        handleDeleteApp,
        handleBanApp,
        handleUnbanApp,
        patchApp,
        reorderBrandApps,
        setAppForm,
    } = useApps({
        session,
        selectedBrand,
        selectedBrandId,
        selectedAppId,
        setSelectedAppId,
        text,
        onDataError: setDataError,
        onAliasAutoApplied: ({ from, to }) => {
            const message = String(text('alias_auto_applied') || '')
                .replace('{from}', from)
                .replace('{to}', to);
            showAliasNotice(message);
        },
        onAfterCreateApp: handleAutoAssignAccountForNewApp,
    });

    const {
        isNoBrandMode,
        regularBrands,
        requestedApp,
        selectedApp,
        selectedAppSnapshot,
    } = useAppShellSelectionModels({
        apps,
        brands,
        requestedBrand,
        routeAppId,
        selectedBrand,
        selectedAppId,
        workspaceSnapshotsRef,
    });
    const connectorExecutionHydrationSnapshotAppIdRef = useRef('');
    const connectorExecutionHydrationSnapshotRef = useRef<ConnectorExecutionPanelSnapshot | null>(null);
    const clientRepoRefreshJobKeyRef = useRef('');
    const matchingConnectorExecutionHydrationSnapshot =
        selectedAppSnapshot?.connectorExecution &&
        String(selectedAppSnapshot.connectorExecution.appId || '').trim() === String(selectedApp?.id || '').trim()
            ? selectedAppSnapshot.connectorExecution
            : null;
    if (connectorExecutionHydrationSnapshotAppIdRef.current !== String(selectedApp?.id || '').trim()) {
        connectorExecutionHydrationSnapshotAppIdRef.current = String(selectedApp?.id || '').trim();
        connectorExecutionHydrationSnapshotRef.current = matchingConnectorExecutionHydrationSnapshot;
    }
    const stableConnectorExecutionHydrationSnapshot =
        connectorExecutionHydrationSnapshotRef.current &&
        String(connectorExecutionHydrationSnapshotRef.current.appId || '').trim() === String(selectedApp?.id || '').trim()
            ? connectorExecutionHydrationSnapshotRef.current
            : null;
    const connectorJobRepoUrl = useMemo(() => {
        const fromDb = String((selectedApp as any)?.github_repo_url || '').trim();
        if (fromDb) return fromDb;
        const appId = String(selectedApp?.id || '').trim();
        if (!appId || typeof window === 'undefined') return null;
        return String(window.localStorage.getItem(`zefgen.githubRepoUrl.${appId}`) || '').trim() || null;
    }, [selectedApp?.id, (selectedApp as any)?.github_repo_url]);
    const connectorExecution = useConnectorJobs({
        session,
        selectedApp,
        githubRepoUrl: connectorJobRepoUrl,
        hydrationSnapshot: stableConnectorExecutionHydrationSnapshot,
        pollMs: 3_000,
        idlePollMs: null,
    });
    const latestPublishClientRepoJob = useMemo(
        () => connectorExecution.jobs.find((job) => String(job?.kind || '') === 'publish_client_repo') ?? null,
        [connectorExecution.jobs]
    );

    useEffect(() => {
        const jobId = String(latestPublishClientRepoJob?.id || '').trim();
        const status = String(latestPublishClientRepoJob?.status || '').trim();
        const updatedAt = String(latestPublishClientRepoJob?.updated_at || latestPublishClientRepoJob?.ended_at || '').trim();
        if (!jobId || status !== 'succeeded' || !updatedAt) return;
        const nextKey = `${jobId}:${updatedAt}`;
        if (clientRepoRefreshJobKeyRef.current === nextKey) return;
        clientRepoRefreshJobKeyRef.current = nextKey;
        void refreshApps();
    }, [latestPublishClientRepoJob, refreshApps]);

    const handleBrandReleaseInfoGuardChange = useCallback((guard: WorkspaceSwitchGuard | null) => {
        brandReleaseInfoGuardRef.current = guard;
    }, []);
    const handleAppStoreLinkGuardChange = useCallback((guard: WorkspaceSwitchGuard | null) => {
        appStoreLinkGuardRef.current = guard;
    }, []);
    const handleAppStoreReviewGuardChange = useCallback((guard: WorkspaceSwitchGuard | null) => {
        appStoreReviewGuardRef.current = guard;
    }, []);

    const selectedAppstoreAccount = useMemo(() => {
        if (!selectedApp) return null;
        return appstoreAccounts.find((a) => a.app_id === selectedApp.id) || null;
    }, [appstoreAccounts, selectedApp]);

    useEffect(() => {
        pendingAutoAssignAppIdsRef.current = pendingAutoAssignAppIds;
    }, [pendingAutoAssignAppIds]);

    useEffect(() => {
        appsRef.current = apps;
    }, [apps]);

    useEffect(() => {
        appstoreAccountsRef.current = appstoreAccounts;
    }, [appstoreAccounts]);

    useEffect(() => {
        appstoreAccountsLoadingRef.current = appstoreAccountsLoading;
    }, [appstoreAccountsLoading]);

    useEffect(() => {
        reportActionErrorRef.current = reportActionError;
    }, [reportActionError]);

    useEffect(() => {
        textRef.current = text;
    }, [text]);

    useEffect(() => {
        updateAppstoreAccountRef.current = updateAppstoreAccount;
    }, [updateAppstoreAccount]);

    const removePendingAutoAssignAppId = useCallback((appId: string) => {
        pendingAutoAssignAppIdsRef.current = pendingAutoAssignAppIdsRef.current.filter((queuedAppId) => queuedAppId !== appId);
        pendingAutoAssignAppByIdRef.current.delete(appId);
        setPendingAutoAssignAppIds((current) => {
            return current.filter((queuedAppId) => queuedAppId !== appId);
        });
    }, []);

    const drainPendingAutoAssignQueue = useCallback(async () => {
        if (pendingAutoAssignDrainInFlightRef.current) return;
        if (appstoreAccountsLoadingRef.current) return;
        if (!pendingAutoAssignAppIdsRef.current.length) return;

        pendingAutoAssignDrainInFlightRef.current = true;
        let workingAccounts = appstoreAccountsRef.current;

        try {
            while (!appstoreAccountsLoadingRef.current && pendingAutoAssignAppIdsRef.current.length) {
                const appId = pendingAutoAssignAppIdsRef.current[0];
                if (!appId) break;

                const pendingApp =
                    appsRef.current.find((app) => app.id === appId) || pendingAutoAssignAppByIdRef.current.get(appId) || null;
                if (!pendingApp) {
                    removePendingAutoAssignAppId(appId);
                    continue;
                }

                const alreadyAssigned = workingAccounts.some((account) => account.app_id === pendingApp.id);
                if (alreadyAssigned) {
                    removePendingAutoAssignAppId(appId);
                    continue;
                }

                try {
                    const assignedAccount = await assignFirstAvailableAppstoreAccountToApp({
                        app: pendingApp,
                        appstoreAccounts: workingAccounts,
                        reportActionError: reportActionErrorRef.current,
                        text: textRef.current,
                        updateAppstoreAccount: updateAppstoreAccountRef.current,
                    });

                    if (assignedAccount) {
                        workingAccounts = workingAccounts.map((account) =>
                            account.id === assignedAccount.id ? { ...account, app_id: pendingApp.id } : account
                        );
                    }
                } catch (error) {
                    void error;
                }

                removePendingAutoAssignAppId(appId);
            }
        } finally {
            pendingAutoAssignDrainInFlightRef.current = false;
            if (!appstoreAccountsLoadingRef.current && pendingAutoAssignAppIdsRef.current.length) {
                void drainPendingAutoAssignQueue();
            }
        }
    }, [removePendingAutoAssignAppId]);

    useEffect(() => {
        if (!pendingAutoAssignAppIds.length) return;
        if (appstoreAccountsLoading) return;
        void drainPendingAutoAssignQueue();
    }, [appstoreAccountsLoading, drainPendingAutoAssignQueue, pendingAutoAssignAppIds]);

    const {
        categories: appIdeaCategories,
        ideas: appIdeas,
        ideaAssignments: appIdeaAssignments,
        loading: appIdeasLoading,
        error: appIdeasError,
        refresh: refreshAppIdeas,
        createIdea: createAppIdea,
        updateIdea: updateAppIdea,
        deleteIdea: deleteAppIdea,
    } = useAppIdeas({
        session,
        onDataError: setDataError,
    });

    useEffect(() => {
        if (activePage !== 'ideas') return;
        void refreshAppIdeas();
    }, [activePage, refreshAppIdeas]);

    const { brandAppSummaryByBrandId } = useBrandAppSummaries({
        apps,
        brands,
        session,
        reviewStateOverridesByAppId: appReviewStateOverridesByAppId,
    });

    const {
        loading: brandReferencesLoading,
        refresh: refreshBrandReferences,
        brandRefUrls,
        brandIconUrls,
        brandIconReference,
        brandScreenshotReferences,
        brandIconUploading,
        brandScreenshotsUploading,
        isBrandRefDropActive,
        handleBrandIconUpload,
        handleBrandScreenshotUpload,
        handleBrandReferenceDrop,
        handleBrandReferenceDragOver,
        handleBrandReferenceDragLeave,
        handleReorderBrandReference,
        handleDeleteBrandReference,
        handleBrandPromptChange,
        handleBrandPromptSave,
    } = useBrandReferences({
        session,
        selectedBrand,
        text,
        reportError: reportActionError,
        onDataError: setDataError,
    });

    const {
        loading: appScreenshotsLoading,
        refresh: refreshAppScreenshots,
        selectedAppScreenshots,
        appScreenshotUrls,
        runnerImportWarnings,
        appScreenshotsUploading,
        appScreenshotsDeletingAll,
        isScreenshotDropActive,
        handleReorderAppScreenshot,
        handleDeleteAppScreenshot,
        handleDeleteAllAppScreenshots,
        handleScreenshotDragOver,
        handleScreenshotDragLeave,
        handleScreenshotDrop,
        handleAppScreenshotsUpload,
        canUploadAppScreenshots,
    } = useAppScreenshots({
        session,
        selectedBrand,
        selectedApp,
        connectorJobs: connectorExecution.jobs,
        text,
        reportError: reportActionError,
        onDataError: setDataError,
    });

    const {
        promptsByRefId,
        isDirty: appScreenshotPromptsDirty,
        setPrompt,
        flushPending: flushAppScreenshotPrompts,
        buildSnapshot: buildAppScreenshotPromptsSnapshot,
    } = useAppScreenshotPrompts({
        session,
        selectedBrand,
        selectedApp,
        hydrationSnapshot: selectedAppSnapshot?.screenshotPrompts ?? null,
        reportError: reportActionError,
    });

    const { slotMappings, setSlotMappings } = useSlotMappings(selectedAppId);

    const getSlotMapping = (slotIndex: number) => {
        const stored = (
            slotMappings as Record<
                number,
                Partial<{
                    brandRefSource: 'screenshot_ref' | 'picked_export_icon' | null;
                    brandRefId: string | null;
                    simShotId: string | null;
                    styleRefAssetId: string | null;
                }>
            >
        )[slotIndex] || {};
        const hasBrandRefSource = Object.prototype.hasOwnProperty.call(stored, 'brandRefSource');
        const hasBrandRefId = Object.prototype.hasOwnProperty.call(stored, 'brandRefId');
        const hasSimShotId = Object.prototype.hasOwnProperty.call(stored, 'simShotId');
        const hasStyleRefAssetId = Object.prototype.hasOwnProperty.call(stored, 'styleRefAssetId');
        const defaultBrandRefId = brandScreenshotReferences[slotIndex - 1]?.id ?? null;
        const resolvedBrandRefSource = isNoBrandMode
            ? null
            : hasBrandRefSource
                ? (stored.brandRefSource ?? null)
                : hasBrandRefId
                    ? 'screenshot_ref'
                    : hasStyleRefAssetId && Boolean(stored.styleRefAssetId)
                        ? null
                    : defaultBrandRefId
                        ? 'screenshot_ref'
                        : null;
        const resolvedBrandRefId =
            resolvedBrandRefSource === 'screenshot_ref'
                ? (hasBrandRefId ? (stored.brandRefId ?? null) : defaultBrandRefId)
                : null;
        return {
            // Important: allow explicit null (stored value) to persist. Only fallback when the key is missing.
            brandRefSource: resolvedBrandRefSource,
            brandRefId: isNoBrandMode ? null : resolvedBrandRefId,
            simShotId: hasSimShotId ? (stored.simShotId ?? null) : selectedAppScreenshots[slotIndex - 1]?.id ?? null,
            styleRefAssetId: hasStyleRefAssetId ? (stored.styleRefAssetId ?? null) : null,
        };
    };
    const updateSlotMapping = (
        slotIndex: number,
        patch: {
            brandRefSource?: 'screenshot_ref' | 'picked_export_icon' | null;
            brandRefId?: string | null;
            simShotId?: string | null;
            styleRefAssetId?: string | null;
        }
    ) => {
        const normalizedPatch = isNoBrandMode
            ? { ...patch, brandRefSource: null, brandRefId: null }
            : patch;
        setSlotMappings((prev) => ({
            ...prev,
            [slotIndex]: (() => {
                const current = prev[slotIndex] ?? {};
                const next = { ...current, ...normalizedPatch };

                if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'brandRefSource') ||
                    Object.prototype.hasOwnProperty.call(normalizedPatch, 'brandRefId')) {
                    if (next.brandRefSource === 'screenshot_ref' && !next.brandRefId) {
                        next.brandRefSource = null;
                    }
                    if (next.brandRefSource) {
                        next.styleRefAssetId = null;
                    } else {
                        next.brandRefId = null;
                    }
                }

                if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'styleRefAssetId')) {
                    if (next.styleRefAssetId) {
                        next.brandRefSource = null;
                        next.brandRefId = null;
                    }
                }

                return next;
            })(),
        }));
    };

    const {
        screenshotSets,
        activeScreenshotSetId,
        setActiveScreenshotSetId,
        buildMetadataSnapshot,
        handleAddScreenshotSet,
        handleDeleteScreenshotSet,
        assetPicks,
        exportStatus,
        pickedIconAssetId,
        pickedScreenshotAssetIdBySlotIndex,
        handlePickIcon,
        handlePickScreenshot,
        handleMarkAsCompleted,
        handleDownloadScreenshotSetZip,
        selectedGeneratedAssets,
        generatedPreviewUrls,
        generatedUrls,
        inflightScreenshotPreviewByKey,
        generationJobs,
        hasRunningJobs,
        cancelGenerationJob,
        dismissJob,
        clearFinished,
        queueCreateJob,
        queueSetJobProgress,
        queueSetJobMessage,
        queueFinishJob,
        githubRepoUrl,
        handleCreateGithubRepo,
        handleDeleteGithubRepo,
        loading: generatedAssetsLoading,
        refresh: refreshGeneratedAssets,
        generatedIconSlots,
        enhancedIconSlots,
        generatedScreenshotSlots,
        enhancedScreenshotSlots,
        iconUploading,
        iconGenerating,
        iconSlotGenerating,
        enhanceIconSlotGenerating,
        screenshotsGenerating,
        slotGenerating,
        enhanceSlotGenerating,
        generationCount,
        setGenerationCount,
        generationSize,
        setGenerationSize,
        iconVariationsCount,
        setIconVariationsCount,
        slotPromptBySlotIndex,
        setSlotPrompt,
        iconProviderId,
        setIconProviderId,
        screenshotProviderId,
        setScreenshotProviderId,
        slotHeadlineBySlotIndex,
        slotHeadlinePosBySlotIndex,
        setSlotHeadline,
        setSlotHeadlinePosition,
        beginSlotHeadlineDrag,
        beginSlotHeadlineTextEdit,
        undoSlotHeadline,
        redoSlotHeadline,
        editAssetId,
        editDrafts,
        editSaving,
        beginEditAsset,
        resetEditDraft,
        updateLayer,
        addLayer,
        removeLayer,
        handleSaveEdit,
        handleUploadCustomIconFiles,
        handleGenerateIcon,
        handleEnhanceIconSlot,
        handleGenerateSlot,
        handleEnhanceSlot,
        handleGenerateAllScreenshots,
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset,
        getIconSystemPrompt,
        setIconSystemPromptOverride,
        resetIconSystemPromptOverride,
        getSystemPromptForSlot,
        getSystemPromptTemplateForSlot,
        setSystemPromptTemplateForSlot,
        setSystemPromptOverride,
        resetSystemPromptOverride,
        targetSlotCount,
        noBrandStyleReferenceOptions,
        existingSlotCount,
        slotsToCreate,
        canGenerateIcon,
        canGenerateScreenshots,
        slotGenerateBlockedReasonBySlotIndex,
        generateAllBlockedReason,
    } = useGeneratedAssets({
        session,
        selectedBrand,
        selectedApp,
        patchApp,
        metadataSnapshot: selectedAppSnapshot?.generatedAssets ?? null,
        selectedAppScreenshots,
        appScreenshotUrls,
        brandIconReference,
        brandScreenshotReferences,
        brandRefUrls,
        getSlotMapping,
        promptsByRefId,
        text,
        reportError: reportActionError,
        onDataError: setDataError,
    });

    const clientGithubRepoUrl = useMemo(
        () => String((selectedApp as any)?.client_github_repo_url || '').trim() || null,
        [selectedApp]
    );

    const isPublishingClientGithubRepo = useMemo(
        () =>
            generationJobs.some(
                (job) =>
                    job.kind === 'connector_publish_client_repo' &&
                    (job.status === 'running' || job.status === 'queued')
            ),
        [generationJobs]
    );

    const handlePublishClientGithubRepo = useCallback(async () => {
        if (!session || !selectedApp) return;

        const sourceRepoUrl = String((selectedApp as any)?.github_repo_url || githubRepoUrl || '').trim();
        const sourceRepoFullName =
            String((selectedApp as any)?.github_repo_full_name || '').trim() ||
            toGithubRepoFullNameFromUrl(sourceRepoUrl);

        if (!sourceRepoFullName) {
            reportActionError(text('publish_client_repo_missing_source'));
            return;
        }

        const sourceRepoName = sourceRepoFullName.split('/').at(1) || '';
        const targetRepoName = toEmappstore777RepoNameFromSourceName(sourceRepoName);
        const targetRepoFullName = toEmappstore777RepoFullNameFromSource(sourceRepoFullName);
        if (!targetRepoName || !targetRepoFullName) {
            reportActionError(text('publish_client_repo_failed_name'));
            return;
        }

        const localJobId = queueCreateJob({
            title: 'Publish to emappstore777',
            kind: 'connector_publish_client_repo',
            progressTotal: 2,
        });
        queueSetJobProgress(localJobId, { current: 0, total: 2 });

        try {
            queueSetJobMessage(localJobId, 'Queueing cloud publish job…');
            const { error } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'publish_client_repo',
                repoFullName: sourceRepoFullName,
                baseBranch: 'main',
                input: {
                    source_repo_full_name: sourceRepoFullName,
                    source_repo_url: sourceRepoUrl || null,
                    target_owner: EMAPPSTORE777_OWNER,
                    target_repo_name: targetRepoName,
                    target_repo_full_name: targetRepoFullName,
                    target_label: EMAPPSTORE777_OWNER,
                },
            });
            if (error) throw error;

            queueSetJobProgress(localJobId, { current: 1, total: 2 });
            queueSetJobMessage(localJobId, 'Refreshing runner state…');
            await connectorExecution.refresh();
            queueSetJobProgress(localJobId, { current: 2, total: 2 });
            queueSetJobMessage(localJobId, 'Queued');
            queueFinishJob(localJobId, { status: 'success' });
        } catch (error: any) {
            const message = String(error?.message || 'Failed to queue publish job.');
            reportActionError(message);
            queueFinishJob(localJobId, { status: 'error', message });
        }
    }, [
        connectorExecution,
        githubRepoUrl,
        queueCreateJob,
        queueFinishJob,
        queueSetJobMessage,
        queueSetJobProgress,
        reportActionError,
        selectedApp,
        session,
        text,
    ]);

    const connectorForm = useConnectorConfigForm({
        session,
        selectedApp,
        hydrationSnapshot: selectedAppSnapshot?.connectorForm ?? null,
        reportError: reportActionError,
        queueJobs: {
            createJob: queueCreateJob,
            setJobProgress: queueSetJobProgress,
            setJobMessage: queueSetJobMessage,
            finishJob: queueFinishJob,
        },
    });
    const buildConnectorFormSnapshot = connectorForm.buildSnapshot;
    const flushConnectorFormPending = connectorForm.flushPending;
    const { handleDownloadSimulatorScreenshotsZip } = useAppScreenshotDownloads({
        appScreenshotUrls,
        queueJobs: {
            createJob: queueCreateJob,
            setJobProgress: queueSetJobProgress,
            setJobMessage: queueSetJobMessage,
            finishJob: queueFinishJob,
        },
        reportError: reportActionError,
        selectedApp,
        selectedAppScreenshots,
        text,
    });

    const workspaceSwitchPending = Boolean(workspaceSwitchState) || isWorkspaceCommitPending;
    const workspaceSwitchOverlay = useWorkspaceSwitchOverlay(workspaceSwitchPending);

    const { hydrateWorkspaceSnapshot } = useWorkspaceSnapshotHydration({
        sessionUserId: session.user.id,
        text,
        workspaceSnapshotsRef,
    });

    const {
        handleNoBrandIconPromptAutogen,
        handleNoBrandIconPromptChange,
        handleNoBrandIconPromptSave,
        noBrandIconPromptAutogenBusy,
        noBrandIconPromptDraft,
    } = useNoBrandIconPromptActions({
        clientSpec: connectorForm.projectBrief,
        isNoBrandMode,
        patchApp,
        reportActionError,
        selectedApp,
        session,
        showAliasNotice,
        text,
    });

    const {
        canScreenshotPromptAutogen,
        handleScreenshotPromptAutogen,
        screenshotPromptAutogenBusy,
    } = useNoBrandScreenshotPromptAutogenActions({
        clientSpec: connectorForm.projectBrief,
        isNoBrandMode,
        reportActionError,
        selectedApp,
        session,
        setSlotPrompt,
        showAliasNotice,
        targetSlotCount,
        text,
    });

    const { prepareWorkspaceForSwitch, prepareWorkspaceLockForSelection } = useWorkspaceSwitchPreparation({
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
    });

    const { requestWorkspaceSelection, requestPageNavigation } = useWorkspaceNavigationController({
        activePage,
        accountsFocusAppId,
        accountsHasUnsavedChanges,
        apps,
        orderedApps,
        brands,
        connectorHasStaleConflict: connectorForm.staleConflict,
        hydrateWorkspaceSnapshot,
        prepareWorkspaceForSwitch,
        prepareWorkspaceLockForSelection,
        reportActionError,
        requestedAppId,
        requestedBrandId,
        routeAppId,
        routeBrandId,
        selectedApp,
        selectedAppId,
        selectedBrand,
        selectedBrandId,
        ideasHasUnsavedChanges,
        setAccountsFocusAppId,
        setActivePage,
        setIsSidebarOpen,
        setRequestedAppId,
        setRequestedBrandId,
        setSelectedAppId,
        setSelectedBrandId,
        setWorkspaceSwitchState,
        startWorkspaceCommitTransition,
        text,
        workspaceSnapshotsRef,
        workspaceSwitchPending,
        workspaceSwitchSeqRef,
    });

    const {
        handleMoveNoBrandAppToBrand,
        moveTargetBrandId,
        moveToBrandLoading,
        setMoveTargetBrandId,
    } = useNoBrandMoveToBrand({
        apps,
        isCurrentBrandReadOnly,
        isNoBrandMode,
        lockedBrandIdSet,
        refreshAppScreenshots,
        refreshApps,
        refreshGeneratedAssets,
        regularBrands,
        reportActionError,
        reportLockedBrandWarning,
        reportReadOnlyBlocked,
        requestWorkspaceSelection,
        selectedApp,
        selectedBrand,
        session,
        showAliasNotice,
        text,
        tryClaimBrand,
    });

    const { openAccounts, openHelp, openIdeas, openWorkspaceForApp, selectBrandFromSidebar } = useWorkspaceNavigationActions({
        activePage,
        accountsHasUnsavedChanges,
        apps,
        brands,
        ideasHasUnsavedChanges,
        reportActionError,
        requestPageNavigation,
        requestWorkspaceSelection,
        text,
    });

    const { handleAppStoreReviewSnapshotChange, handleConnectorExecutionSnapshotChange } = useWorkspaceSnapshotCache({
        workspaceSnapshotsRef,
        selectedBrand,
        selectedApp,
        connectorLoading: connectorForm.loading,
        buildConnectorFormSnapshot,
        buildMetadataSnapshot,
        buildAppScreenshotPromptsSnapshot,
    });

    useEffect(() => {
        setAppReviewStateOverridesByAppId({});
    }, [session.user.id]);

    const handleAppStoreReviewSnapshotChangeWithSummary = useCallback(
        (snapshot: AppStoreReviewPanelSnapshot | null) => {
            handleAppStoreReviewSnapshotChange(snapshot);
            if (!snapshot?.status) return;

            const appId = String(snapshot.appId || '').trim();
            if (!appId) return;

            const latestReviewState = String(snapshot.status.webhook?.latest_review_state || '').trim() || null;
            setAppReviewStateOverridesByAppId((prev) => {
                if (prev[appId] === latestReviewState) return prev;
                return {
                    ...prev,
                    [appId]: latestReviewState,
                };
            });
        },
        [handleAppStoreReviewSnapshotChange]
    );

    const handleConnectorExecutionSnapshotChangeWithCache = useCallback(
        (snapshot: ConnectorExecutionPanelSnapshot | null) => {
            handleConnectorExecutionSnapshotChange(snapshot);
        },
        [handleConnectorExecutionSnapshotChange]
    );

    const connectorJobQueue = useConnectorJobQueue({
        session,
        apps,
        brands,
        pollMs: 2500,
        idlePollMs: 15_000,
    });

    // Note: we intentionally do NOT "live sync" these per-selected app anymore because it caused
    // visible count jitter in the sidebar. We'll replace this whole indicator pipeline later.

    const {
        appFolderTheme,
        appSwitching,
        bodyCornerRadius,
        closeLightbox,
        hasAnyAppsForBrand,
        isAppReorderMode,
        isFirstApp,
        lightbox,
        openLightbox,
        showNoAppsEmptyState,
    } = useWorkspacePresentationState({
        appFormOpen,
        bannedAppsLength: bannedApps.length,
        editingAppId,
        isBannedView,
        selectedAppId,
        hasSelectedBrand: Boolean(selectedBrand),
        visibleActiveAppsLength: visibleActiveApps.length,
        visibleAppIds: visibleApps.map((app) => app.id),
    });

    const {
        appFolderLayout,
        appFolderWrapRef,
        appPickerRef,
        appSimulatorRef,
        appGenerationRef,
        appFolderContentRef,
        appFolderEndRef,
        appActivePillRef,
        appPillScrollRef,
        appPillRowRef,
        tabButtonWidth,
        tabButtonHeight,
    } = useAppFolderLayout({
        enabled: activePage === 'workspace',
        selectedBrandId,
        selectedAppId,
        appsLength: apps.length,
        visibleApps,
        isBannedView,
        showBannedToggle,
        isAppFormOpen: appFormOpen,
    });

    const {
        assetsCollapsed,
        deliverablesAnchorRef,
        deliverablesRailRef,
        deliverablesRailStyle,
        toggleAssetsCollapsed,
    } = useWorkspaceAssetsLayout({
        activePage,
        appFolderWrapRef,
        appGenerationRef,
        exportStatus,
        hasSelectedApp: Boolean(selectedApp),
        mainScrollRef,
        reportActionError,
        selectedAppId,
        stickyHeaderRef,
        text,
    });

    const { isPanning: isAppPillPanning, panRef: appPillPanRef, handlers: appPillPanHandlers } = useAppPillPan({
        isReorderMode: isAppReorderMode,
        scrollRef: appPillScrollRef,
    });

    const {
        connectorEnabled,
        dataLoading,
        isCreatingGithubRepo,
        isDeletingGithubRepo,
        isTabMotionDisabled,
        pickedIconAsset,
        routeLoading,
        setReadiness,
        unpickedCount,
    } = useAppShellDerivedState({
        appScreenshotsLoading,
        appsLoading,
        assetPicks,
        brandReferencesLoading,
        brandsLoading,
        draggingAppId,
        generatedAssetsLoading,
        generationJobs,
        isAppPillPanning,
        isAppReorderMode,
        pickedIconAssetId,
        screenshotSets,
        selectedApp,
        selectedGeneratedAssets,
    });

    useRouteSync({
        dataLoading: routeLoading,
        hasParsedRoute,
        setHasParsedRoute,
        activePage,
        setActivePage,
        brands,
        apps,
        orderedApps,
        routeBrand: requestedBrand,
        routeApp: requestedApp,
        requestWorkspaceSelection: ({ brandId, appId }) => {
            void requestWorkspaceSelection({
                brandId,
                appId,
                historyMode: 'none',
            });
        },
        requestPageNavigation: (page, options) => {
            void requestPageNavigation(page, {
                historyMode: options?.historyMode ?? 'none',
                fromPopState: options?.fromPopState,
            });
        },
        canNavigate: (next) => {
            if (activePage === 'accounts' && accountsHasUnsavedChanges && next.page !== 'accounts') {
                reportActionError(text('accounts_unsaved_block'));
                return false;
            }
            if (activePage === 'ideas' && ideasHasUnsavedChanges && next.page !== 'ideas') {
                reportActionError(text('ideas_unsaved_block'));
                return false;
            }
            return true;
        },
    });

    useEffect(() => {
        if (activePage !== 'workspace') return;
        if (!selectedBrand || !selectedApp) return;
        if (selectedBrand.is_inactive || selectedApp.is_banned) return;
        writeLastWorkspaceSelection({
            brandId: selectedBrand.id,
            appId: selectedApp.id,
        });
    }, [activePage, selectedBrand, selectedApp]);

    const { handleTakeOverEditing, isTakingOverEditLock, takeOverEditLockError } = useWorkspaceLockSideEffects({
        activePage,
        brands,
        isCurrentBrandReadOnly,
        lockConflictBrandId,
        lockedBrandIdSet,
        orderedApps,
        refreshSnapshot,
        reportLockedBrandWarning,
        requestWorkspaceSelection,
        selectedBrandId,
        setHeartbeatBrandId,
        softLockViewModeEnabled,
        takeOverBrand,
        text,
        tryClaimBrand,
        workspaceSwitchPending,
    });

    const {
        handleAutoGrowInput,
        handleLogout,
        handleRetry,
        pickAccountForSelectedApp,
        runWriteAction,
    } = useAppShellActions({
        appstoreAccounts,
        appstoreAccountsLoading,
        isCurrentBrandReadOnly,
        refreshAppIdeas,
        refreshApps,
        refreshAppScreenshots,
        refreshAppstoreAccounts,
        refreshBrandReferences,
        refreshBrands,
        refreshGeneratedAssets,
        reportActionError,
        reportReadOnlyBlocked,
        selectedApp,
        selectedAppstoreAccount,
        setDataError,
        text,
        updateAppstoreAccount,
    });

    useEffect(() => {
        const elements = document.querySelectorAll<HTMLTextAreaElement>('.auto-grow');
        elements.forEach((element) => syncAutoGrowTextarea(element));
    }, [brandIconReference?.prompt, noBrandIconPromptDraft, brandScreenshotReferences, promptsByRefId, slotPromptBySlotIndex]);
    const {
        githubStepDone,
        iconStepNumber,
        ideaStepNumber,
        integrationReady,
        setupStepDone,
        step1Done,
        step2Done,
        step5Done,
        step6Done,
        step7Done,
        step8Done,
        step9Done,
        step10Done,
    } = useWorkspaceStepReadiness({
        brandScreenshotReferences,
        connectorEnabled,
        connectorRunnerJobs: connectorExecution.jobs,
        enhancedScreenshotSlots,
        exportStatus,
        generatedScreenshotSlots,
        githubRepoUrl,
        isNoBrandMode,
        legalLinks: connectorForm.legalLinks,
        pickedIconAssetId,
        projectBrief: connectorForm.projectBrief,
        promptsByRefId,
        secretMetas: connectorForm.secretMetas,
        selectedApp,
        selectedAppScreenshots,
        selectedAppstoreAccount,
        slotPromptBySlotIndex,
        targetSlotCount,
        variables: connectorForm.variables,
    });
    const {
        allQueueJobs,
        handleCancelQueueJob,
        handleClearFinishedQueueJobs,
        handleDismissQueueJob,
    } = useWorkspaceBusyGuards({
        accountsHasUnsavedChanges,
        cancelConnectorJob: connectorJobQueue.cancel,
        cancelGenerationJob,
        clearFinishedConnectorJobs: connectorJobQueue.clearFinished,
        clearFinishedGenerationJobs: clearFinished,
        connectorJobs: connectorJobQueue.jobs || [],
        dismissConnectorJob: connectorJobQueue.dismiss,
        dismissGenerationJob: dismissJob,
        enhanceIconSlotGenerating,
        enhanceSlotGenerating,
        generationJobs,
        hasRunningJobs,
        iconGenerating,
        iconSlotGenerating,
        iconUploading,
        ideasHasUnsavedChanges,
        isCurrentBrandReadOnly,
        reportReadOnlyBlocked,
        screenshotsGenerating,
        slotGenerating,
    });
    const workspaceFolder = {
        folder: {
            appFolderLayout,
            appFolderTheme,
            bodyCornerRadius,
            isTabMotionDisabled,
            appSwitching,
            isFirstApp,
            gooeyDebug,
            appFolderWrapRef,
            appFolderContentRef,
            appFolderEndRef,
            appPickerRef,
            appSimulatorRef,
            appGenerationRef,
            isAssetsCollapsed: assetsCollapsed,
        },
        collapsedDeliverables: {
            isCompleted: Boolean(exportStatus?.is_completed),
            pickedIconAsset,
            pickedIconPreviewUrl: pickedIconAsset
                ? generatedPreviewUrls[pickedIconAsset.id] || generatedUrls[pickedIconAsset.id] || null
                : null,
            screenshotSets,
            simulatorScreenshotCount: selectedAppScreenshots.length,
            selectedApp,
            onDownloadIcon: () => {
                if (!pickedIconAsset || !selectedApp) return;
                handleDownloadGeneratedAsset(
                    pickedIconAsset,
                    `icon-${selectedApp.alias || selectedApp.id}.jpg`
                );
            },
            onDownloadSetZip: (setId: string) => {
                handleDownloadScreenshotSetZip({ setId, preferPicks: true });
            },
            onDownloadSimulatorScreenshotsZip: () => {
                void handleDownloadSimulatorScreenshotsZip();
            },
            onShowWorkspace: () => {
                if (!assetsCollapsed) return;
                toggleAssetsCollapsed();
            },
            text,
        },
        picker: {
            appActivePillRef,
            appAliasPreview,
            appForm,
            appFormError,
            appFormLoading,
            appFormOpen,
            aliasPlaceholder: newAppAliasPlaceholder,
            appPillPanHandlers,
            appPillPanRef,
            appPillRowRef,
            appPillScrollRef,
            bannedApps,
            canAddApp,
            draggingAppId,
            dragOverAppId,
            editingAppId,
            hasAnyAppsForBrand,
            isAppPillPanning,
            isAppReorderMode,
            isBannedView,
            isCurrentBrandReadOnly,
            isEditingBanned,
            lockedAppId: appFormOpen && editingAppId ? editingAppId : null,
            onBanApp: handleBanApp,
            onCloseAppForm: closeAppForm,
            onDeleteApp: handleDeleteApp,
            onOpenAppForm: openAppForm,
            onReadOnlyBlocked: reportReadOnlyBlocked,
            onReorderBrandApps: reorderBrandApps,
            onReportActionError: reportActionError,
            onRequestWorkspaceSelection: (appId: string | null) => {
                void requestWorkspaceSelection({
                    brandId: selectedBrandId,
                    appId,
                    historyMode: 'push',
                });
            },
            onRunWriteAction: runWriteAction,
            onSubmitAppForm: submitAppForm,
            onUnbanApp: handleUnbanApp,
            selectedApp,
            selectedAppId,
            selectedBrandName: selectedBrand?.name,
            selectedBrandSlug: selectedBrand?.slug,
            setAppForm,
            setDraggingAppId,
            setDragOverAppId,
            setIsBannedView,
            showBannedToggle,
            showNoAppsEmptyState,
            tabButtonHeight,
            tabButtonWidth,
            text,
            visibleActiveApps,
            visibleApps,
        },
        setup: {
            appIdeaAssignments,
            appIdeaCategories,
            appIdeas,
            brands,
            appStoreReviewHydrationSnapshot: selectedAppSnapshot?.appStoreReviewPanel ?? null,
            connectorExecutionHydrationSnapshot: stableConnectorExecutionHydrationSnapshot,
            allAccounts: appstoreAccounts,
            canAddApp,
            connectorEnabled,
            connectorExecution,
            connectorForm,
            connectorRunnerJobs: connectorExecution.jobs,
            clientGithubRepoUrl,
            githubRepoUrl,
            githubStepDone,
            iconStepNumber,
            ideaStepNumber,
            integrationReady,
            isCreatingGithubRepo,
            isCurrentBrandReadOnly,
            isDeletingGithubRepo,
            isPublishingClientGithubRepo,
            isNoBrandMode,
            onAppStoreLinkGuardChange: handleAppStoreLinkGuardChange,
            onAppStoreReviewGuardChange: handleAppStoreReviewGuardChange,
            onAppStoreReviewSnapshotChange: handleAppStoreReviewSnapshotChangeWithSummary,
            onConnectorExecutionSnapshotChange: handleConnectorExecutionSnapshotChangeWithCache,
            onCreateGithubRepo: handleCreateGithubRepo,
            onDeleteGithubRepo: handleDeleteGithubRepo,
            onPublishClientGithubRepo: handlePublishClientGithubRepo,
            onOpenAccounts: openAccounts,
            onOpenCreateApp: () => openAppForm(),
            onOpenIdeas: openIdeas,
            onPatchApp: patchApp,
            onPickAccount: pickAccountForSelectedApp,
            onReadOnlyBlocked: reportReadOnlyBlocked,
            onRefreshIntegrationJobs: connectorExecution.refresh,
            onReportActionError: reportActionError,
            onRunWriteAction: runWriteAction,
            pickedIcon: Boolean(pickedIconAssetId),
            selectedApp,
            selectedAppstoreAccount,
            selectedBrand,
            session,
            setupStepDone,
            showNoAppsEmptyState,
            showManualCopyAction: true,
            step1Done,
            step2Done,
            step5Done,
            step6Done,
            step7Done,
            text,
        },
        generationViewModel: {
            activeScreenshotSetId,
            addLayer,
            appScreenshotUrls,
            appScreenshotsUploading,
            appScreenshotsDeletingAll,
            assetExportStatus: exportStatus,
            beginEditAsset,
            beginSlotHeadlineDrag,
            beginSlotHeadlineTextEdit,
            brandIconReference,
            brandScreenshotReferences,
            canGenerateIcon,
            canGenerateScreenshots,
            canUploadAppScreenshots,
            deliverablesAnchorRef,
            editAssetId,
            editDrafts,
            editSaving,
            enhanceIconSlotGenerating,
            enhanceSlotGenerating,
            enhancedIconSlots,
            enhancedScreenshotSlots,
            generatedIconSlots,
            generatedPreviewUrls,
            generatedScreenshotSlots,
            generatedUrls,
            generationCount,
            generationSize,
            getIconSystemPrompt,
            getSlotMapping,
            getSystemPromptForSlot,
            getSystemPromptTemplateForSlot,
            handleAddScreenshotSet,
            handleAppScreenshotsUpload,
            handleAutoGrowInput,
            handleBrandPromptChange,
            handleBrandPromptSave,
            handleDeleteAppScreenshot,
            handleDeleteAllAppScreenshots,
            handleDownloadSimulatorScreenshotsZip: () => {
                void handleDownloadSimulatorScreenshotsZip();
            },
            handleDeleteGeneratedAsset,
            handleDeleteScreenshotSet,
            handleDownloadAllScreenshots,
            handleDownloadGeneratedAsset,
            handleEnhanceIconSlot,
            handleEnhanceSlot,
            handleGenerateAllScreenshots,
            handleGenerateIcon,
            handleGenerateSlot,
            handleMarkAsCompleted,
            handleMoveNoBrandAppToBrand,
            handleNoBrandIconPromptAutogen,
            handleNoBrandIconPromptChange,
            handleNoBrandIconPromptSave,
            handleScreenshotPromptAutogen,
            handlePickIcon,
            handlePickScreenshot,
            handleReorderAppScreenshot,
            handleSaveEdit,
            handleScreenshotDragLeave,
            handleScreenshotDragOver,
            handleScreenshotDrop,
            handleUploadCustomIconFiles,
            iconGenerating,
            iconProviderId,
            iconSlotGenerating,
            iconUploading,
            iconVariationsCount,
            inflightScreenshotPreviewByKey,
            isCurrentBrandReadOnly,
            isNoBrandMode,
            isScreenshotDropActive,
            runnerImportWarnings,
            moveTargetBrandId,
            moveToBrandLoading,
            noBrandIconPromptAutogenBusy,
            noBrandIconPromptValue: noBrandIconPromptDraft,
            noBrandStyleReferenceOptions,
            canScreenshotPromptAutogen,
            screenshotPromptAutogenBusy,
            onCreateBrand: () => openBrandForm(),
            openLightbox,
            pickedIconAssetId,
            pickedScreenshotAssetIdBySlotIndex,
            promptsByRefId,
            regularBrands,
            removeLayer,
            reportReadOnlyBlocked,
            resetEditDraft,
            resetIconSystemPromptOverride,
            resetSystemPromptOverride,
            redoSlotHeadline,
            runWriteAction,
            screenshotProviderId,
            screenshotSets,
            screenshotsGenerating,
            generateAllBlockedReason,
            selectedApp,
            selectedAppScreenshots,
            setActiveScreenshotSetId,
            setGenerationCount,
            setGenerationSize,
            setIconProviderId,
            setIconSystemPromptOverride,
            setIconVariationsCount,
            setMoveTargetBrandId,
            setPrompt,
            setScreenshotProviderId,
            setSlotHeadline,
            setSlotHeadlinePosition,
            setSlotPrompt,
            setSystemPromptOverride,
            setSystemPromptTemplateForSlot,
            showNoAppsEmptyState,
            slotGenerating,
            slotGenerateBlockedReasonBySlotIndex,
            slotHeadlineBySlotIndex,
            slotHeadlinePosBySlotIndex,
            slotPromptBySlotIndex,
            step8Done,
            step9Done,
            step10Done,
            targetSlotCount,
            text,
            undoSlotHeadline,
            updateLayer,
            updateSlotMapping,
        },
    };
    const showWorkspaceSwitchOverlay = activePage === 'workspace' && workspaceSwitchOverlay.showOverlay;
    const workspaceSwitchLabel =
        workspaceSwitchState?.label || requestedApp?.name || requestedBrand?.name || text('loading');

    const workspaceContent = {
        brandRefUrls,
        brandScreenshotReferences,
        brandScreenshotsUploading,
        handleBrandReferenceDragLeave,
        handleBrandReferenceDragOver,
        handleBrandReferenceDrop,
        handleBrandScreenshotUpload,
        handleDeleteBrandReference,
        handleReorderBrandReference,
        isBrandRefDropActive,
        isCurrentBrandReadOnly,
        isNoBrandMode,
        loadingLabel: text('loading'),
        onBrandReleaseInfoGuardChange: handleBrandReleaseInfoGuardChange,
        onPatchBrand: patchBrand,
        onReadOnlyBlocked: reportReadOnlyBlocked,
        onReportError: reportActionError,
        onRunWriteAction: runWriteAction,
        openLightbox,
        selectedBrand,
        showWorkspaceSwitchOverlay,
        text,
        workspaceFolder,
        workspaceSwitchLabel,
        workspaceSwitchShowLoader: workspaceSwitchOverlay.showLoader,
        workspaceSwitchStage: workspaceSwitchOverlay.stage,
    };
    const sidebarProps: React.ComponentProps<typeof Sidebar> = {
        isSidebarOpen,
        setIsSidebarOpen,
        activePage,
        onSelectAccounts: () => openAccounts(),
        onSelectHelp: () => openHelp(),
        onSelectIdeas: () => openIdeas(),
        logoContainerRef,
        logoVariantIndex,
        setLogoVariantIndex,
        logoFontReady,
        logoWord,
        lang,
        setLang,
        sessionEmail: session.user.email ?? '',
        brands,
        brandAppSummaryByBrandId,
        selectedBrandId,
        activeSessionCount,
        activeSessionCountries,
        lockedBrandIdSet: sidebarLockedBrandIdSet,
        brandIconUrls,
        brandFormOpen,
        brandForm,
        brandFormError,
        brandFormLoading,
        editingBrandId,
        brandSlugPreview,
        brandsLoading,
        isBusy: false,
        onBlockedAction: () => reportActionError(text('generation_in_progress')),
        reorderBrands: (sourceId, targetId) => {
            void runWriteAction(() => reorderBrands(sourceId, targetId));
        },
        openBrandForm,
        submitBrandForm,
        setBrandForm,
        closeBrandForm,
        setSelectedBrandId: selectBrandFromSidebar,
        onActivateInactiveBrand: (brandId) => {
            void runWriteAction(() => patchBrand(brandId, { is_inactive: false }));
        },
        onLockedBrandAction: reportLockedBrandWarning,
        openLightbox,
        handleLogout,
        text,
    };

    const shellChromeProps: React.ComponentProps<typeof WorkspaceShellChrome> = {
        activePage,
        actionError,
        brandAppSummaryByBrandId,
        brandFormLoading,
        brandFormOpen,
        brandIconReference,
        brandIconUploading,
        brandRefUrls,
        brandsCount: brands.length,
        dataError,
        dataLoading,
        editingBrandId,
        isTakingOverEditLock,
        isCurrentBrandReadOnly,
        isNoBrandMode,
        onBrandIconUpload: handleBrandIconUpload,
        onCloseBrandForm: closeBrandForm,
        onCreateBrand: () => openBrandForm(),
        onDeleteBrandIcon: () => {
            if (!brandIconReference) return;
            void runWriteAction(() => handleDeleteBrandReference(brandIconReference));
        },
        onEditBrand: () => {
            if (!selectedBrand) return;
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            openBrandForm(selectedBrand);
        },
        onOpenLightbox: openLightbox,
        onRetry: handleRetry,
        onSaveBrand: () => runWriteAction(() => submitBrandForm()),
        onTakeOverEditing: handleTakeOverEditing,
        selectedBrand,
        stickyHeaderRef,
        takeOverEditLockError,
        text,
    };

    const overlayProps: React.ComponentProps<typeof AppShellOverlays> = {
        aliasNotice,
        assetsCollapsed,
        closeLabel: text('close'),
        collabWarning,
        deliverablesRailRef,
        deliverablesRailStyle,
        isDeliverablesCompleted: Boolean(exportStatus?.is_completed),
        lightbox,
        onCancelJob: handleCancelQueueJob,
        onClearFinished: handleClearFinishedQueueJobs,
        onCloseLightbox: closeLightbox,
        onDismissJob: handleDismissQueueJob,
        onMarkCompleted: () => {
            void runWriteAction(() => handleMarkAsCompleted({ pruneUnpicked: true }));
        },
        onToggleAssetsCollapsed: toggleAssetsCollapsed,
        pickedIcon: Boolean(pickedIconAssetId),
        queueJobs: allQueueJobs,
        setReadiness,
        showDeliverablesRail: activePage === 'workspace' && Boolean(selectedApp) && !assetsCollapsed,
        text,
        unpickedCount,
    };

    const helpContent = {
        lang: HELP_CENTER_RUNTIME_LANG,
        mainScrollContainerRef: mainScrollRef,
    };

    const accountsContent = {
        accounts: appstoreAccounts,
        loading: appstoreAccountsLoading,
        error: appstoreAccountsError,
        refresh: refreshAppstoreAccounts,
        createAccount: createAppstoreAccount,
        updateAccount: updateAppstoreAccount,
        deleteAccount: deleteAppstoreAccount,
        apps,
        brands,
        onOpenApp: openWorkspaceForApp,
        focusAppId: accountsFocusAppId,
        consumeFocus: () => setAccountsFocusAppId(null),
        onUnsavedChangesChange: setAccountsHasUnsavedChanges,
        reportError: reportActionError,
        text,
    };

    const ideasContent = {
        session,
        ideas: appIdeas,
        categories: appIdeaCategories,
        ideaAssignments: appIdeaAssignments,
        apps,
        brands,
        selectedBrand,
        loading: appIdeasLoading,
        error: appIdeasError,
        refresh: refreshAppIdeas,
        createIdea: createAppIdea,
        updateIdea: updateAppIdea,
        deleteIdea: deleteAppIdea,
        onOpenApp: openWorkspaceForApp,
        onUnsavedChangesChange: setIdeasHasUnsavedChanges,
        reportError: reportActionError,
        text,
    };
    const pageContentProps: React.ComponentProps<typeof AppShellPageContent> = {
        activePage,
        workspace: workspaceContent,
        accounts: accountsContent,
        help: helpContent,
        ideas: ideasContent,
        loadingLabel: text('loading'),
    };
    
    return (
        <AppShellLayout
            isSidebarOpen={isSidebarOpen}
            mainScrollRef={mainScrollRef}
            setIsSidebarOpen={setIsSidebarOpen}
            sidebarProps={sidebarProps}
            shellChromeProps={shellChromeProps}
            pageContentProps={pageContentProps}
            overlayProps={overlayProps}
        />
    );
}

export default AppShell;
