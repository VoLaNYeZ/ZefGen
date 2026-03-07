import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { t, TranslationKey } from '../../i18n';
import {
    EDIT_FONTS,
    MAX_SCREENSHOT_REFS,
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_COLLAB_POLL_MS,
    WORKSPACE_COLLAB_TTL_SECONDS,
    WORKSPACE_LOCK_ENFORCEMENT_ENABLED,
    WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED,
} from '../../constants/zefgen';
import { syncAutoGrowTextarea } from '../../utils/dom';
import { useRouteSync } from '../../hooks/use-route-sync';
import { useSlotMappings } from '../../hooks/use-slot-mappings';
import { useAppFolderLayout } from '../../hooks/use-app-folder-layout';
import { useAppPillPan } from '../../hooks/use-app-pill-pan';
import { useWorkspaceCollaboration } from '../../hooks/use-workspace-collaboration';
import { useBrands } from '../../hooks/use-brands';
import { useApps } from '../../hooks/use-apps';
import { useAppstoreAccounts } from '../../hooks/use-appstore-accounts';
import { useAppIdeas } from '../../hooks/use-app-ideas';
import { useBrandReferences } from '../../hooks/use-brand-references';
import { useAppScreenshots } from '../../hooks/use-app-screenshots';
import { useGeneratedAssets } from '../../hooks/use-generated-assets';
import { useAppScreenshotPrompts } from '../../hooks/use-app-screenshot-prompts';
import { signOut } from '../../data/auth';
import { moveAppToBrand } from '../../data/apps';
import { generateNoBrandIconPrompt } from '../../data/icon-prompt';
import { fetchAllExportStatuses, fetchAllScreenshotSetCounts } from '../../data/app-indicators';
import { useConnectorJobs } from '../../hooks/use-connector-jobs';
import { useConnectorJobQueue } from '../../hooks/use-connector-job-queue';
import { Sidebar } from './Sidebar';
import { BrandReleaseInfoPanel } from './BrandReleaseInfoPanel';
import { BrandReferencesPanel } from './BrandReferencesPanel';
import { AppFolder } from './AppFolder';
import { AppPills } from './AppPills';
import { AppFormCard } from './AppFormCard';
import { AppSimulatorSection } from './AppSimulatorSection';
import { GeneratedScreenshotsModule, IconGenerationModule, ScreenshotPromptsModule } from './AppGenerationSection';
import { Lightbox } from './Lightbox';
import { GenerationQueueWidget } from './GenerationQueueWidget';
import { ConfirmIconButton } from './ConfirmIconButton';
import { DeliverablesPanel } from './DeliverablesPanel';
import { ExportCompletionRail } from './ExportCompletionRail';
import { DevFilesPanel } from './DevFilesPanel';
import { ConnectorRunnerPanel } from './ConnectorRunnerPanel';
import { ConnectorClientSpecPanel } from './ConnectorClientSpecPanel';
import { ConnectorVariablesSecretsPanel } from './ConnectorVariablesSecretsPanel';
import { IntegrationModulePanel } from './IntegrationModulePanel';
import { AutoReleaseModulePanel } from './AutoReleaseModulePanel';
import { AppStoreLinkRow } from './AppStoreLinkRow';
import { AppStoreReviewWebhookRow } from './AppStoreReviewWebhookRow';
import { StepBlock } from './StepBlock';
import { AccountsPage } from './AccountsPage';
import { IdeasPage } from './IdeasPage';
import type { GeneratedAsset, TextLayer } from '../../types/zefgen';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type { AppPage } from '../../utils/routes';
import { buildAccountsRoute, buildIdeasRoute, buildRoute, parseRoute } from '../../utils/routes';
import { makeUniqueAlias, slugify } from '../../utils/slug';
import { isNoBrand } from '../../utils/no-brand';
import {
    findLatestSuccessfulIntegrationForBranch,
    getIntegrationReadiness,
} from '../../utils/connector-runner-state.js';

type AppShellProps = {
    session: Session;
};
const MAIN_BRANCH = 'main';
export function AppShell({ session }: AppShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lang, setLang] = useState<'en' | 'ru'>(() => {
        try {
            const raw = window.localStorage.getItem('zefgen.lang');
            return raw === 'ru' ? 'ru' : 'en';
        } catch {
            return 'en';
        }
    });
    const [activePage, setActivePage] = useState<AppPage>(() => {
        try {
            return parseRoute().page;
        } catch {
            return 'workspace';
        }
    });
    const [accountsFocusAppId, setAccountsFocusAppId] = useState<string | null>(null);
    const [accountsHasUnsavedChanges, setAccountsHasUnsavedChanges] = useState(false);
    const text = useCallback((key: TranslationKey) => t(lang, key), [lang]);

    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [assetsCollapsed, setAssetsCollapsed] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);
    const [hasParsedRoute, setHasParsedRoute] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [collabWarning, setCollabWarning] = useState<string | null>(null);
    const [aliasNotice, setAliasNotice] = useState<string | null>(null);
    const [logoVariantIndex, setLogoVariantIndex] = useState(4);
    const logoWord = 'ZEFGEN';
    const logoContainerRef = useRef<HTMLDivElement>(null);
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const deliverablesRailRef = useRef<HTMLDivElement>(null);
    const deliverablesAnchorRef = useRef<HTMLDivElement>(null);
    const wasCurrentBrandReadOnlyRef = useRef(false);
    const [deliverablesRailStyle, setDeliverablesRailStyle] = useState<{ top: number; left: number; opacity: number }>({
        top: 96,
        left: 16,
        opacity: 0,
    });
    const [logoFontReady, setLogoFontReady] = useState(false);
    const [gooeyDebug, _setGooeyDebug] = useState(false);
    const [appSwitching, setAppSwitching] = useState(false);
    const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
    const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{
        src: string;
        alt: string;
        layers?: TextLayer[];
        fullSrc?: string;
        overlayBaseWidth?: number;
        overlayBaseHeight?: number;
    } | null>(null);
    const [appScreenshotSetCountByAppId, setAppScreenshotSetCountByAppId] = useState<Record<string, number>>({});
    const [appCompletedByAppId, setAppCompletedByAppId] = useState<Record<string, boolean>>({});
    const [heartbeatBrandId, setHeartbeatBrandId] = useState<string | null>(null);
    const [isClaimingEditLock, setIsClaimingEditLock] = useState(false);
    const [noBrandIconPromptDraft, setNoBrandIconPromptDraft] = useState('');
    const [noBrandIconPromptAutogenBusy, setNoBrandIconPromptAutogenBusy] = useState(false);
    const [moveTargetBrandId, setMoveTargetBrandId] = useState<string>('');
    const [moveToBrandLoading, setMoveToBrandLoading] = useState(false);
    const seenExportCompletedByAppRef = useRef<Record<string, boolean>>({});

    const reportActionError = useCallback((message: string) => {
        setActionError(message);
        setTimeout(() => {
            setActionError((prev) => (prev === message ? null : prev));
        }, 6000);
    }, []);

    const showCollabWarning = useCallback((message: string) => {
        setCollabWarning(message);
        setTimeout(() => {
            setCollabWarning((prev) => (prev === message ? null : prev));
        }, 6000);
    }, []);

    const showAliasNotice = useCallback((message: string) => {
        setAliasNotice(message);
        setTimeout(() => {
            setAliasNotice((prev) => (prev === message ? null : prev));
        }, 6000);
    }, []);

    const reportCollabWarning = useCallback(() => {
        showCollabWarning(text('collab_sync_offline'));
    }, [showCollabWarning, text]);

    const reportLockedBrandWarning = useCallback(() => {
        showCollabWarning(text('brand_under_work_readonly'));
    }, [showCollabWarning, text]);

    const reportReadOnlyBlocked = useCallback(() => {
        showCollabWarning(text('brand_readonly_write_blocked'));
    }, [showCollabWarning, text]);

    useEffect(() => {
        try {
            window.localStorage.setItem('zefgen.lang', lang);
        } catch {
            // ignore
        }
    }, [lang]);

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
        setBrandForm,
        setBrandFormOpen,
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
    const isNoBrandMode = isNoBrand(selectedBrand);

    const {
        activeSessionCount,
        activeSessionCountries,
        lockedBrandIdSet,
        lockConflictBrandId,
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
    const sidebarLockedBrandIdSet = useMemo(
        () => (WORKSPACE_LOCK_ENFORCEMENT_ENABLED ? lockedBrandIdSet : new Set<string>()),
        [lockedBrandIdSet]
    );
    const softLockViewModeEnabled =
        WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED && WORKSPACE_COLLAB_ENABLED && WORKSPACE_LOCK_ENFORCEMENT_ENABLED;
    const isCurrentBrandBusyByOtherDevice = Boolean(
        activePage === 'workspace' && selectedBrandId && sidebarLockedBrandIdSet.has(selectedBrandId)
    );
    const isCurrentBrandReadOnly = Boolean(
        softLockViewModeEnabled &&
            activePage === 'workspace' &&
            selectedBrandId &&
            (isCurrentBrandBusyByOtherDevice || lockConflictBrandId === selectedBrandId)
    );

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
        handleDeleteApp,
        handleBanApp,
        handleUnbanApp,
        patchApp,
        reorderBrandApps,
        setAppForm,
        setAppFormOpen,
        setEditingAppId,
        setAppFormError,
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
    });

    const selectedApp = useMemo(
        () => apps.find((app) => app.id === selectedAppId) || null,
        [apps, selectedAppId]
    );
    const regularBrands = useMemo(
        () => brands.filter((brand) => !isNoBrand(brand)),
        [brands]
    );

    useEffect(() => {
        if (!selectedApp || !isNoBrandMode) {
            setNoBrandIconPromptDraft('');
            return;
        }
        setNoBrandIconPromptDraft(String(selectedApp.icon_prompt || ''));
    }, [selectedApp?.id, selectedApp?.icon_prompt, isNoBrandMode]);

    useEffect(() => {
        setNoBrandIconPromptAutogenBusy(false);
    }, [selectedApp?.id, isNoBrandMode]);

    useEffect(() => {
        if (!selectedApp || !isNoBrandMode) {
            setMoveTargetBrandId('');
            return;
        }
        if (!regularBrands.length) {
            setMoveTargetBrandId('');
            return;
        }
        setMoveTargetBrandId((prev) => {
            if (prev && regularBrands.some((brand) => brand.id === prev)) return prev;
            return regularBrands[0]!.id;
        });
    }, [selectedApp?.id, isNoBrandMode, regularBrands]);

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

    const selectedAppstoreAccount = useMemo(() => {
        if (!selectedApp) return null;
        return appstoreAccounts.find((a) => a.app_id === selectedApp.id) || null;
    }, [appstoreAccounts, selectedApp]);

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

    const brandAppSummaryByBrandId = useMemo(() => {
        const byBrand: Record<
            string,
            { total: number; active: number; green: number; yellow: number; red: number }
        > = {};

        for (const brand of brands) {
            const brandApps = (apps || [])
                .filter((a) => a.brand_id === brand.id)
                .sort((a, b) => {
                    const ai = a.order_index ?? Number.MAX_SAFE_INTEGER;
                    const bi = b.order_index ?? Number.MAX_SAFE_INTEGER;
                    if (ai !== bi) return ai - bi;
                    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return at - bt;
                });

            let green = 0;
            let yellow = 0;
            let red = 0;
            for (const app of brandApps) {
                if (app.is_banned) {
                    red += 1;
                    continue;
                }
                const setCount = appScreenshotSetCountByAppId[app.id] || 0;
                if (setCount > 1) {
                    green += 1;
                    continue;
                }
                const done = Boolean(appCompletedByAppId[app.id]);
                if (done) {
                    yellow += 1;
                }
            }

            byBrand[brand.id] = {
                total: brandApps.length,
                active: Math.max(0, brandApps.length - red),
                green,
                yellow,
                red,
            };
        }
        return byBrand;
    }, [brands, apps, appScreenshotSetCountByAppId, appCompletedByAppId]);

    // Sidebar indicators (best-effort):
    // - AB tests: app has more than 1 screenshot set (Original + any A/B sets)
    // - Ready: export status completed
    // These will later be replaced by the edgefunction-backed DB the product will use.
    useEffect(() => {
        if (!session) {
            setAppScreenshotSetCountByAppId({});
            setAppCompletedByAppId({});
            return;
        }
        if (!apps.length) {
            setAppScreenshotSetCountByAppId({});
            setAppCompletedByAppId({});
            return;
        }

        let active = true;
        (async () => {
            const [setsResp, statusResp] = await Promise.all([
                fetchAllScreenshotSetCounts(session.user.id),
                fetchAllExportStatuses(session.user.id),
            ]);

            if (!active) return;

            if (!setsResp.error) {
                const counts: Record<string, number> = {};
                for (const row of setsResp.data || []) {
                    const appId = String((row as any).app_id || '');
                    if (!appId) continue;
                    counts[appId] = (counts[appId] || 0) + 1;
                }
                setAppScreenshotSetCountByAppId(counts);
            }

            if (!statusResp.error) {
                const completed: Record<string, boolean> = {};
                for (const row of statusResp.data || []) {
                    const appId = String((row as any).app_id || '');
                    if (!appId) continue;
                    completed[appId] = Boolean((row as any).is_completed);
                }
                setAppCompletedByAppId(completed);
            }
        })();

        return () => {
            active = false;
        };
    }, [session, apps.length]);

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
        appScreenshotsUploading,
        isScreenshotDropActive,
        handleReorderAppScreenshot,
        handleDeleteAppScreenshot,
        handleScreenshotDragOver,
        handleScreenshotDragLeave,
        handleScreenshotDrop,
        handleAppScreenshotsUpload,
        canUploadAppScreenshots,
    } = useAppScreenshots({
        session,
        selectedBrand,
        selectedApp,
        text,
        reportError: reportActionError,
        onDataError: setDataError,
    });

    const {
        promptsByRefId,
        setPrompt,
    } = useAppScreenshotPrompts({
        session,
        selectedBrand,
        selectedApp,
        reportError: reportActionError,
    });

    const { slotMappings, setSlotMappings } = useSlotMappings(selectedAppId);

    const getSlotMapping = (slotIndex: number) => {
        const stored = (
            slotMappings as Record<
                number,
                Partial<{ brandRefId: string | null; simShotId: string | null; styleRefAssetId: string | null }>
            >
        )[slotIndex] || {};
        const hasBrandRefId = Object.prototype.hasOwnProperty.call(stored, 'brandRefId');
        const hasSimShotId = Object.prototype.hasOwnProperty.call(stored, 'simShotId');
        const hasStyleRefAssetId = Object.prototype.hasOwnProperty.call(stored, 'styleRefAssetId');
        const resolvedBrandRefId = hasBrandRefId ? (stored.brandRefId ?? null) : brandScreenshotReferences[slotIndex - 1]?.id ?? null;
        return {
            // Important: allow explicit null (stored value) to persist. Only fallback when the key is missing.
            brandRefId: isNoBrandMode ? null : resolvedBrandRefId,
            simShotId: hasSimShotId ? (stored.simShotId ?? null) : selectedAppScreenshots[slotIndex - 1]?.id ?? null,
            styleRefAssetId: hasStyleRefAssetId ? (stored.styleRefAssetId ?? null) : null,
        };
    };
    const updateSlotMapping = (
        slotIndex: number,
        patch: { brandRefId?: string | null; simShotId?: string | null; styleRefAssetId?: string | null }
    ) => {
        const normalizedPatch = isNoBrandMode ? { ...patch, brandRefId: null } : patch;
        setSlotMappings((prev) => ({
            ...prev,
            [slotIndex]: { ...prev[slotIndex], ...normalizedPatch },
        }));
    };

    const {
        screenshotSets,
        activeScreenshotSetId,
        setActiveScreenshotSetId,
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
    } = useGeneratedAssets({
        session,
        selectedBrand,
        selectedApp,
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

    const connectorForm = useConnectorConfigForm({
        session,
        selectedApp,
        reportError: reportActionError,
        queueJobs: {
            createJob: queueCreateJob,
            setJobProgress: queueSetJobProgress,
            setJobMessage: queueSetJobMessage,
            finishJob: queueFinishJob,
        },
    });

    const selectedAppAccountCompanyName = useMemo(() => {
        return String(selectedAppstoreAccount?.company_name || '').trim();
    }, [selectedAppstoreAccount?.company_name]);
    const selectedAppAccountUsable = Boolean(
        selectedAppstoreAccount && selectedAppstoreAccount.usability && !selectedAppstoreAccount.was_used_before
    );
    const currentCompanyName = String((connectorForm.variables as any)?.company_name || '').trim();

    useEffect(() => {
        if (!selectedApp) return;
        if (appstoreAccountsLoading) return;
        const next = selectedAppAccountUsable ? selectedAppAccountCompanyName : '';
        if (currentCompanyName === next) return;
        connectorForm.setVariable('company_name', next);
    }, [
        selectedApp?.id,
        appstoreAccountsLoading,
        selectedAppAccountUsable,
        selectedAppAccountCompanyName,
        currentCompanyName,
        connectorForm.setVariable,
    ]);

    // Used only for Step 5 "Runner" completion badge (read-only polling; does not affect runner behavior).
    const { jobs: connectorRunnerJobs, refresh: refreshConnectorRunnerJobs } = useConnectorJobs({
        session,
        selectedApp,
        githubRepoUrl,
        pollMs: 10_000,
    });

    const connectorJobQueue = useConnectorJobQueue({
        session,
        apps,
        pollMs: 2500,
    });

    // Note: we intentionally do NOT "live sync" these per-selected app anymore because it caused
    // visible count jitter in the sidebar. We'll replace this whole indicator pipeline later.

    const routeLoading = brandsLoading || appsLoading;
    const dataLoading =
        brandsLoading ||
        appsLoading ||
        brandReferencesLoading ||
        appScreenshotsLoading ||
        generatedAssetsLoading;
    useEffect(() => {
        let active = true;
        const ready = () => {
            if (active) setLogoFontReady(true);
        };
        if (document?.fonts?.ready) {
            document.fonts.ready.then(ready).catch(ready);
        } else {
            ready();
        }
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedAppId) return;
        setAppSwitching(true);
        const timer = window.setTimeout(() => setAppSwitching(false), 320);
        return () => window.clearTimeout(timer);
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) {
            setAssetsCollapsed(false);
            return;
        }
        const key = `zefgen.assetsCollapsed.${selectedAppId}`;
        const raw = window.localStorage.getItem(key);
        setAssetsCollapsed(raw === '1');
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        const isCompleted = Boolean(exportStatus?.is_completed);
        const wasCompleted = Boolean(seenExportCompletedByAppRef.current[selectedAppId]);

        if (isCompleted && !wasCompleted) {
            setAssetsCollapsed(true);
            window.localStorage.setItem(`zefgen.assetsCollapsed.${selectedAppId}`, '1');
        }

        seenExportCompletedByAppRef.current[selectedAppId] = isCompleted;
    }, [selectedAppId, exportStatus?.is_completed]);

    const toggleAssetsCollapsed = useCallback(() => {
        if (!selectedAppId) return;
        if (!exportStatus?.is_completed) {
            reportActionError(text('need_picks_to_complete'));
            return;
        }
        setAssetsCollapsed((prev) => {
            const next = !prev;
            const key = `zefgen.assetsCollapsed.${selectedAppId}`;
            window.localStorage.setItem(key, next ? '1' : '0');
            return next;
        });
    }, [selectedAppId, exportStatus?.is_completed, reportActionError, text]);
    const activeAppIndex = useMemo(
        () => visibleApps.findIndex((app) => app.id === selectedAppId),
        [visibleApps, selectedAppId]
    );
    const hasAnyAppsForBrand = visibleActiveApps.length + bannedApps.length > 0;
    const showNoAppsEmptyState = Boolean(selectedBrand) && !hasAnyAppsForBrand;
    const hasApps = visibleApps.length > 0;
    const isSingleApp = hasApps && visibleApps.length === 1;
    const isFirstApp = hasApps && activeAppIndex === 0;
    const bodyCornerRadius = `${isFirstApp || isSingleApp ? 0 : 26}px 26px 26px 26px`;
    // Opaque folder background so modules don't "blend" with the page and the background never looks cut off.
    const appFolderTheme = isBannedView ? 'rgb(127, 29, 29)' : 'rgb(30, 41, 59)';
    const isAppReorderMode = Boolean(appFormOpen && editingAppId);

    const pickedIconAsset = useMemo(() => {
        if (!pickedIconAssetId) return null;
        return selectedGeneratedAssets.find((a) => a.id === pickedIconAssetId) ?? null;
    }, [selectedGeneratedAssets, pickedIconAssetId]);

    const unpickedCount = useMemo(() => {
        const keep = new Set((assetPicks || []).map((p) => p.generated_asset_id));
        return (selectedGeneratedAssets || []).filter((a) => !keep.has(a.id)).length;
    }, [selectedGeneratedAssets, assetPicks]);

    const isCreatingGithubRepo = useMemo(
        () => generationJobs.some((j) => j.kind === 'github_repo_create' && (j.status === 'running' || j.status === 'queued')),
        [generationJobs]
    );
    const isDeletingGithubRepo = useMemo(
        () => generationJobs.some((j) => j.kind === 'github_repo_delete' && (j.status === 'running' || j.status === 'queued')),
        [generationJobs]
    );

    const setReadiness = useMemo(() => {
        return (screenshotSets || []).map((set) => {
            const requiredCount = Math.min(6, Math.max(3, Number(set.slot_count) || 3));
            const pickedCount = (assetPicks || []).filter(
                (p) =>
                    p.kind === 'screenshot' &&
                    p.screenshot_set_id === set.id &&
                    typeof p.slot_index === 'number' &&
                    p.slot_index >= 1 &&
                    p.slot_index <= requiredCount
            ).length;
            return { set, pickedCount, requiredCount };
        });
    }, [screenshotSets, assetPicks]);

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

    useEffect(() => {
        if (activePage !== 'workspace') {
            setDeliverablesRailStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }
        if (!selectedApp || assetsCollapsed) {
            setDeliverablesRailStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }

        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = window.requestAnimationFrame(() => {
                const gen = appGenerationRef.current;
                const wrap = appFolderWrapRef.current;
                const rail = deliverablesRailRef.current;
                const anchor = deliverablesAnchorRef.current;
                if (!gen || !wrap || !rail || !anchor) return;

                const genRect = gen.getBoundingClientRect();
                const anchorRect = anchor.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();
                const railRect = rail.getBoundingClientRect();

                const headerBottom = stickyHeaderRef.current?.getBoundingClientRect().bottom ?? 96;
                const topOffset = Math.round(headerBottom + 12);

                const railH = railRect.height || rail.offsetHeight || 0;
                const railW = railRect.width || rail.offsetWidth || 0;
                if (!railH || !railW) return;

                const minTop = anchorRect.top;
                const maxTop = genRect.bottom - railH;
                let top = topOffset;
                if (maxTop < minTop) {
                    top = minTop;
                } else {
                    top = Math.min(Math.max(topOffset, minTop), maxTop);
                }

                const gutter = 14;
                // Prefer placing the rail just outside the folder body (so it doesn't cover cards),
                // but clamp into the viewport if there isn't enough room.
                let left = wrapRect.right + gutter;
                left = Math.min(left, window.innerWidth - railW - 16);
                left = Math.max(16, left);

                // Fade in only once we reach the screenshots workspace (anchor sits right before Step 08).
                // Using the generation section rect can cause the rail to appear while still viewing Step 05–07
                // if the next section is partially within the viewport on tall screens.
                const inView = genRect.bottom > topOffset + 40 && anchorRect.top < window.innerHeight - 80;
                setDeliverablesRailStyle({ top, left, opacity: inView ? 1 : 0 });
            });
        };

        schedule();
        const scrollEl = mainScrollRef.current;
        scrollEl?.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        const ro = new ResizeObserver(schedule);
        if (appFolderWrapRef.current) ro.observe(appFolderWrapRef.current);
        if (appGenerationRef.current) ro.observe(appGenerationRef.current);
        if (deliverablesAnchorRef.current) ro.observe(deliverablesAnchorRef.current);
        if (stickyHeaderRef.current) ro.observe(stickyHeaderRef.current);

        return () => {
            cancelAnimationFrame(raf);
            scrollEl?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            ro.disconnect();
        };
    }, [activePage, selectedApp?.id, assetsCollapsed]);

    const { isPanning: isAppPillPanning, panRef: appPillPanRef, handlers: appPillPanHandlers } = useAppPillPan({
        isReorderMode: isAppReorderMode,
        scrollRef: appPillScrollRef,
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
        selectedBrand,
        selectedApp,
        setSelectedBrandId,
        setSelectedAppId,
        canNavigate: (next) => {
            if (activePage === 'accounts' && accountsHasUnsavedChanges && next.page !== 'accounts') {
                reportActionError(text('accounts_unsaved_block'));
                return false;
            }
            return true;
        },
    });

    useEffect(() => {
        if (!WORKSPACE_COLLAB_ENABLED) {
            setHeartbeatBrandId(null);
            return;
        }
        if (activePage !== 'workspace' || !selectedBrandId || isCurrentBrandReadOnly) {
            setHeartbeatBrandId(null);
            return;
        }
        setHeartbeatBrandId(selectedBrandId);
    }, [activePage, selectedBrandId, isCurrentBrandReadOnly]);

    useEffect(() => {
        if (isCurrentBrandReadOnly && !wasCurrentBrandReadOnlyRef.current) {
            reportLockedBrandWarning();
        }
        wasCurrentBrandReadOnlyRef.current = isCurrentBrandReadOnly;
    }, [isCurrentBrandReadOnly, reportLockedBrandWarning]);

    useEffect(() => {
        if (!WORKSPACE_COLLAB_ENABLED || !WORKSPACE_LOCK_ENFORCEMENT_ENABLED) return;
        if (softLockViewModeEnabled) return;
        if (activePage !== 'workspace') return;
        if (!selectedBrandId) return;

        const conflictOnSelectedBrand =
            (lockConflictBrandId && lockConflictBrandId === selectedBrandId) ||
            lockedBrandIdSet.has(selectedBrandId);
        if (!conflictOnSelectedBrand) return;

        const fallbackBrand = brands.find((brand) => !lockedBrandIdSet.has(brand.id)) || null;
        if (!fallbackBrand) {
            setSelectedBrandId(null);
            setSelectedAppId(null);
            window.history.replaceState({}, '', '/');
            return;
        }

        if (fallbackBrand.id === selectedBrandId) return;

        const fallbackApp = orderedApps.find((app) => app.brand_id === fallbackBrand.id) || null;
        setSelectedBrandId(fallbackBrand.id);
        setSelectedAppId(fallbackApp?.id ?? null);
        window.history.replaceState({}, '', buildRoute(fallbackBrand, fallbackApp));
    }, [
        activePage,
        selectedBrandId,
        lockConflictBrandId,
        lockedBrandIdSet,
        brands,
        orderedApps,
        setSelectedBrandId,
        setSelectedAppId,
        softLockViewModeEnabled,
    ]);

    const handleRetry = () => {
        setDataError(null);
        refreshBrands();
        refreshApps();
        refreshAppstoreAccounts();
        refreshAppIdeas();
        refreshBrandReferences();
        refreshAppScreenshots();
        refreshGeneratedAssets();
    };

    useEffect(() => {
        const elements = document.querySelectorAll<HTMLTextAreaElement>('.auto-grow');
        elements.forEach((element) => syncAutoGrowTextarea(element));
    }, [brandIconReference?.prompt, noBrandIconPromptDraft, brandScreenshotReferences, promptsByRefId]);

    const handleLogout = async () => {
        await signOut();
    };

    const openAccounts = useCallback(
        (focusAppId?: string | null) => {
            setAccountsFocusAppId(focusAppId || null);
            setActivePage('accounts');
            window.history.pushState({}, '', buildAccountsRoute());
            if (window.innerWidth < 768) setIsSidebarOpen(false);
        },
        [setActivePage]
    );

    const openIdeas = useCallback(() => {
        if (activePage === 'accounts' && accountsHasUnsavedChanges) {
            reportActionError(text('accounts_unsaved_block'));
            return;
        }
        setAccountsFocusAppId(null);
        setActivePage('ideas');
        window.history.pushState({}, '', buildIdeasRoute());
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    }, [activePage, accountsHasUnsavedChanges, reportActionError, setActivePage, text]);

    const openWorkspaceForApp = useCallback(
        (appId: string) => {
            void (async () => {
                if (activePage === 'accounts' && accountsHasUnsavedChanges) {
                    reportActionError(text('accounts_unsaved_block'));
                    return;
                }
                const app = apps.find((a) => a.id === appId) || null;
                if (!app) return;
                const brand = brands.find((b) => b.id === app.brand_id) || null;
                if (!brand) return;

                if (WORKSPACE_COLLAB_ENABLED && WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
                    const brandBusyByOtherDevice = lockedBrandIdSet.has(brand.id);
                    if (brandBusyByOtherDevice) {
                        if (!softLockViewModeEnabled) {
                            reportLockedBrandWarning();
                            return;
                        }
                        void releaseCurrentBrand();
                    } else {
                        const claim = await tryClaimBrand(brand.id);
                        if (!claim.ok) {
                            if (softLockViewModeEnabled && claim.reason === 'locked_by_other_device') {
                                void releaseCurrentBrand();
                            } else {
                                if (claim.reason === 'locked_by_other_device') {
                                    reportLockedBrandWarning();
                                }
                                return;
                            }
                        }
                    }
                } else if (WORKSPACE_COLLAB_ENABLED) {
                    void tryClaimBrand(brand.id);
                }

                setAccountsFocusAppId(null);
                setActivePage('workspace');
                setSelectedBrandId(brand.id);
                setSelectedAppId(app.id);
                window.history.pushState({}, '', buildRoute(brand, app));
                if (window.innerWidth < 768) setIsSidebarOpen(false);
            })();
        },
        [
            activePage,
            accountsHasUnsavedChanges,
            reportActionError,
            text,
            apps,
            brands,
            lockedBrandIdSet,
            tryClaimBrand,
            softLockViewModeEnabled,
            reportLockedBrandWarning,
            releaseCurrentBrand,
            setActivePage,
            setSelectedBrandId,
            setSelectedAppId,
        ]
    );

    const pickAccountForSelectedApp = useCallback(
        async (modeOrId: 'auto' | null | string) => {
            if (!selectedApp) return;
            if (appstoreAccountsLoading) return;

            const current = selectedAppstoreAccount;

            const pickAuto = () =>
                appstoreAccounts.find((a) => !a.app_id && a.usability && !a.was_used_before) || null;

            try {
                if (modeOrId === null) {
                    if (!current) return;
                    await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
                    return;
                }

                const next =
                    modeOrId === 'auto'
                        ? pickAuto()
                        : appstoreAccounts.find((a) => a.id === modeOrId) || null;

                if (!next) {
                    if (modeOrId === 'auto') {
                        reportActionError(text('accounts_no_usable_accounts'));
                        return;
                    }
                    reportActionError(text('download_failed'));
                    return;
                }

                // Already assigned to this app.
                if (current && next.id === current.id) return;

                // Detach current first to satisfy unique index on app_id.
                if (current && current.id !== next.id) {
                    await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
                }

                await updateAppstoreAccount({ id: next.id, patch: { app_id: selectedApp.id } });
            } catch (e: any) {
                const msg = String(e?.message || e);
                reportActionError(msg);
                throw e;
            }
        },
        [
            selectedApp,
            appstoreAccountsLoading,
            appstoreAccounts,
            selectedAppstoreAccount,
            updateAppstoreAccount,
            reportActionError,
            text,
        ]
    );

    const selectBrandFromSidebar = useCallback(
        (brandId: string | null) => {
            void (async () => {
                if (activePage === 'accounts' && accountsHasUnsavedChanges) {
                    reportActionError(text('accounts_unsaved_block'));
                    return;
                }

                if (WORKSPACE_COLLAB_ENABLED) {
                    if (brandId) {
                        if (WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
                            const brandBusyByOtherDevice = lockedBrandIdSet.has(brandId);
                            if (brandBusyByOtherDevice) {
                                if (!softLockViewModeEnabled) {
                                    reportLockedBrandWarning();
                                    return;
                                }
                                void releaseCurrentBrand();
                            } else {
                                const claim = await tryClaimBrand(brandId);
                                if (!claim.ok) {
                                    if (softLockViewModeEnabled && claim.reason === 'locked_by_other_device') {
                                        void releaseCurrentBrand();
                                    } else {
                                        if (claim.reason === 'locked_by_other_device') {
                                            reportLockedBrandWarning();
                                        }
                                        return;
                                    }
                                }
                            }
                        } else {
                            void tryClaimBrand(brandId);
                        }
                    } else {
                        void releaseCurrentBrand();
                    }
                }

                setAccountsFocusAppId(null);
                if (activePage !== 'workspace') {
                    const brand = brands.find((b) => b.id === brandId) || null;
                    const route = brand ? `/${brand.slug}` : '/';
                    window.history.pushState({}, '', route);
                }
                setActivePage('workspace');
                setSelectedBrandId(brandId);
            })();
        },
        [
            activePage,
            accountsHasUnsavedChanges,
            reportActionError,
            text,
            brands,
            lockedBrandIdSet,
            tryClaimBrand,
            releaseCurrentBrand,
            softLockViewModeEnabled,
            reportLockedBrandWarning,
            setSelectedBrandId,
            setActivePage,
        ]
    );

    const openLightbox = (
        src: string,
        alt: string,
        options?: { layers?: TextLayer[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => {
        setLightbox({
            src,
            alt,
            layers: options?.layers,
            fullSrc: options?.fullSrc,
            overlayBaseWidth: options?.overlayBaseWidth,
            overlayBaseHeight: options?.overlayBaseHeight,
        });
    };

    const closeLightbox = () => {
        setLightbox(null);
    };

    const handleAutoGrowInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
        syncAutoGrowTextarea(event.currentTarget);
    };

    const handleNoBrandIconPromptChange = useCallback((value: string) => {
        setNoBrandIconPromptDraft(value);
    }, []);

    const handleNoBrandIconPromptSave = useCallback(
        async (value: string) => {
            if (!selectedApp || !isNoBrandMode) return;
            const nextValue = String(value || '');
            const currentValue = String(selectedApp.icon_prompt || '');
            if (nextValue === currentValue) return;
            const patched = await patchApp(selectedApp.id, { icon_prompt: nextValue });
            if (!patched) return;
            setNoBrandIconPromptDraft(String(patched.icon_prompt || nextValue));
        },
        [selectedApp, isNoBrandMode, patchApp]
    );

    const handleNoBrandIconPromptAutogen = useCallback(async () => {
        if (!session || !selectedApp || !isNoBrandMode) return;
        const clientSpec = String(connectorForm.projectBrief || '').trim();
        if (!clientSpec) {
            reportActionError(text('no_brand_icon_prompt_autogen_need_spec'));
            return;
        }

        setNoBrandIconPromptAutogenBusy(true);
        try {
            const response = await generateNoBrandIconPrompt({
                clientSpec,
                appName: String(selectedApp.name || '').trim(),
                appAlias: String(selectedApp.alias || '').trim(),
                accessTokenHint: String(session.access_token || ''),
            });

            if (response.status === 'skipped_short_spec') {
                reportActionError(text('no_brand_icon_prompt_autogen_need_spec'));
                return;
            }
            if (response.status === 'error') {
                reportActionError(String(response.error || text('upload_failed')));
                return;
            }

            const nextPrompt = String(response.text || '').trim();
            if (!nextPrompt) {
                reportActionError(text('upload_failed'));
                return;
            }

            setNoBrandIconPromptDraft(nextPrompt);
            const patched = await patchApp(selectedApp.id, { icon_prompt: nextPrompt });
            if (!patched) {
                reportActionError(text('upload_failed'));
                return;
            }
            setNoBrandIconPromptDraft(String(patched.icon_prompt || nextPrompt));
            showAliasNotice(text('no_brand_icon_prompt_autogen_applied'));
        } catch (error: any) {
            reportActionError(String(error?.message || text('upload_failed')));
        } finally {
            setNoBrandIconPromptAutogenBusy(false);
        }
    }, [
        session,
        selectedApp,
        isNoBrandMode,
        connectorForm.projectBrief,
        patchApp,
        reportActionError,
        text,
        showAliasNotice,
    ]);

    const handleMoveNoBrandAppToBrand = useCallback(() => {
        void (async () => {
            if (!session || !selectedApp || !selectedBrand || !isNoBrandMode) return;
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }

            const targetBrand = regularBrands.find((brand) => brand.id === moveTargetBrandId) || null;
            if (!targetBrand) {
                reportActionError(text('no_brand_move_select_target'));
                return;
            }

            setMoveToBrandLoading(true);
            try {
                if (WORKSPACE_COLLAB_ENABLED && WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
                    const brandBusyByOtherDevice = lockedBrandIdSet.has(targetBrand.id);
                    if (brandBusyByOtherDevice) {
                        reportLockedBrandWarning();
                        return;
                    }
                    const claim = await tryClaimBrand(targetBrand.id);
                    if (!claim.ok) {
                        if (claim.reason === 'locked_by_other_device') {
                            reportLockedBrandWarning();
                            return;
                        }
                        reportActionError(text('brand_start_editing_failed'));
                        return;
                    }
                } else if (WORKSPACE_COLLAB_ENABLED) {
                    void tryClaimBrand(targetBrand.id);
                }

                const existingAliases = apps
                    .filter((app) => app.id !== selectedApp.id)
                    .map((app) => slugify(String(app.alias || '').trim()))
                    .filter(Boolean);
                const currentAliasRaw = String(selectedApp.alias || '').trim();
                const currentAlias = slugify(currentAliasRaw);
                const aliasBase = currentAlias || slugify(String(selectedApp.name || 'app'));
                const resolvedAlias = makeUniqueAlias(aliasBase, existingAliases);

                const { data, error } = await moveAppToBrand({
                    appId: selectedApp.id,
                    toBrandId: targetBrand.id,
                    newAlias: resolvedAlias !== currentAlias ? resolvedAlias : null,
                });
                if (error) throw error;

                const movedApp = (data || {
                    ...selectedApp,
                    brand_id: targetBrand.id,
                    alias: resolvedAlias,
                }) as any;

                if (resolvedAlias !== currentAlias) {
                    const message = String(text('alias_auto_applied') || '')
                        .replace('{from}', currentAliasRaw || aliasBase)
                        .replace('{to}', String(movedApp.alias || resolvedAlias));
                    showAliasNotice(message);
                }

                await Promise.allSettled([
                    refreshApps(),
                    refreshAppScreenshots(),
                    refreshGeneratedAssets(),
                ]);

                setActivePage('workspace');
                setSelectedBrandId(targetBrand.id);
                setSelectedAppId(selectedApp.id);
                window.history.pushState({}, '', buildRoute(targetBrand, movedApp));
            } catch (error: any) {
                reportActionError(String(error?.message || text('upload_failed')));
            } finally {
                setMoveToBrandLoading(false);
            }
        })();
    }, [
        session,
        selectedApp,
        selectedBrand,
        isNoBrandMode,
        isCurrentBrandReadOnly,
        reportReadOnlyBlocked,
        showAliasNotice,
        regularBrands,
        moveTargetBrandId,
        reportActionError,
        text,
        lockedBrandIdSet,
        reportLockedBrandWarning,
        tryClaimBrand,
        apps,
        refreshApps,
        refreshAppScreenshots,
        refreshGeneratedAssets,
        setActivePage,
        setSelectedBrandId,
        setSelectedAppId,
    ]);

    const runWriteAction = useCallback(
        async (action: () => void | Promise<void>) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            await action();
        },
        [isCurrentBrandReadOnly, reportReadOnlyBlocked]
    );

    const handleStartEditing = useCallback(() => {
        if (!softLockViewModeEnabled || !selectedBrandId || isClaimingEditLock) return;
        setIsClaimingEditLock(true);
        void (async () => {
            try {
                const result = await tryClaimBrand(selectedBrandId);
                if (!result.ok) {
                    showCollabWarning(text('brand_start_editing_failed'));
                    return;
                }
                setHeartbeatBrandId(selectedBrandId);
                await refreshSnapshot().catch(() => {});
            } catch {
                showCollabWarning(text('brand_start_editing_failed'));
            } finally {
                setIsClaimingEditLock(false);
            }
        })();
    }, [
        softLockViewModeEnabled,
        selectedBrandId,
        isClaimingEditLock,
        tryClaimBrand,
        refreshSnapshot,
        showCollabWarning,
        text,
    ]);

    const isTabMotionDisabled = isAppReorderMode || isAppPillPanning || Boolean(draggingAppId);
    const isBusyForUnload =
        hasRunningJobs ||
        iconUploading ||
        iconGenerating ||
        screenshotsGenerating ||
        slotGenerating !== null ||
        enhanceSlotGenerating !== null ||
        iconSlotGenerating !== null ||
        enhanceIconSlotGenerating !== null ||
        accountsHasUnsavedChanges;
    const isBrandEditing = Boolean(
        selectedBrand &&
            !isNoBrandMode &&
            brandFormOpen &&
            editingBrandId === selectedBrand.id
    );
    const selectedBrandSummary = selectedBrand ? brandAppSummaryByBrandId[selectedBrand.id] : null;
    const hasBrandIcon = Boolean(
        !isNoBrandMode &&
            brandIconReference &&
            brandRefUrls[brandIconReference.id]
    );
    const connectorEnabled = Boolean(selectedApp);

    const step1Done = connectorEnabled && Boolean(pickedIconAssetId);
    const step2Done = connectorEnabled && String(connectorForm.projectBrief || '').trim().length > 0;
    const githubStepDone = React.useMemo(() => {
        if (!connectorEnabled) return false;
        const direct = String((selectedApp as any)?.github_repo_full_name || '').trim();
        if (direct) return true;

        const toRepoFullNameFromUrl = (url: string | null | undefined) => {
            let u = String(url || '').trim();
            if (!u) return '';
            u = u.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
            const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
            if (!m) return '';
            return `${m[1]}/${m[2]}`;
        };

        const fromRowUrl = toRepoFullNameFromUrl((selectedApp as any)?.github_repo_url);
        if (fromRowUrl) return true;
        const fromStateUrl = toRepoFullNameFromUrl(githubRepoUrl);
        if (fromStateUrl) return true;
        return false;
    }, [connectorEnabled, githubRepoUrl, selectedApp]);
    const setupCompanyName = String(
        (connectorForm.variables as any)?.company_name || selectedAppstoreAccount?.company_name || ''
    ).trim();
    const setupStepDone =
        connectorEnabled &&
        String((connectorForm.variables as any)?.bundle_id || '').trim().length > 0 &&
        setupCompanyName.length > 0 &&
        String((connectorForm.variables as any)?.home_screen_name || '').trim().length > 0;
    const step5Done = useMemo(
        () => connectorEnabled && connectorRunnerJobs.some((j) => String((j as any)?.status) === 'succeeded'),
        [connectorEnabled, connectorRunnerJobs]
    );

    const integrationReady = useMemo(() => {
        if (!connectorEnabled) return false;
        return getIntegrationReadiness({
            variables: connectorForm.variables,
            secretMetas: connectorForm.secretMetas,
        });
    }, [connectorEnabled, connectorForm.secretMetas, connectorForm.variables]);

    const latestSuccessfulIntegrationForBranch = useMemo(
        () => findLatestSuccessfulIntegrationForBranch(connectorRunnerJobs, MAIN_BRANCH),
        [connectorRunnerJobs]
    );

    const step6Done = connectorEnabled && Boolean(latestSuccessfulIntegrationForBranch);
    const step7Done = step6Done;

    const step8Done = connectorEnabled && targetSlotCount > 0 && selectedAppScreenshots.length >= targetSlotCount;
    const step9HasPrompt = useMemo(() => {
        if (!connectorEnabled) return false;
        if (isNoBrandMode) {
            return Object.values(slotPromptBySlotIndex || {}).some((value) => String(value || '').trim().length > 0);
        }
        return (brandScreenshotReferences || []).some((ref) => String((promptsByRefId as any)?.[ref.id] || '').trim().length > 0);
    }, [connectorEnabled, isNoBrandMode, slotPromptBySlotIndex, brandScreenshotReferences, promptsByRefId]);
    const step9HasAnyGenerated = connectorEnabled && (generatedScreenshotSlots.length > 0 || enhancedScreenshotSlots.length > 0);
    const step9Done = step9HasPrompt || step9HasAnyGenerated;
    const step10Done = connectorEnabled && Boolean(exportStatus?.is_completed);
    const iconStepNumber = isNoBrandMode ? 2 : 1;
    const ideaStepNumber = isNoBrandMode ? 1 : 2;

    const generationModuleProps = {
        selectedApp,
        brandIconReference,
        brandScreenshotReferences,
        selectedAppScreenshots,
        screenshotSets,
        activeScreenshotSetId,
        setActiveScreenshotSetId,
        handleAddScreenshotSet: () => runWriteAction(handleAddScreenshotSet),
        handleDeleteScreenshotSet: (setId: string) => runWriteAction(() => handleDeleteScreenshotSet(setId)),
        assetExportStatus: exportStatus,
        generatedIconSlots,
        enhancedIconSlots,
        generatedScreenshotSlots,
        enhancedScreenshotSlots,
        generatedPreviewUrls,
        generatedUrls,
        inflightScreenshotPreviewByKey,
        generationCount,
        setGenerationCount,
        generationSize,
        setGenerationSize,
        iconUploading,
        iconGenerating,
        iconSlotGenerating,
        enhanceIconSlotGenerating,
        screenshotsGenerating,
        slotGenerating,
        enhanceSlotGenerating,
        canGenerateIcon,
        canGenerateScreenshots,
        targetSlotCount,
        noBrandStyleReferenceOptions,
        getSlotMapping,
        updateSlotMapping,
        promptsByRefId,
        setPrompt,
        slotPromptBySlotIndex,
        setSlotPrompt,
        iconProviderId,
        setIconProviderId,
        iconVariationsCount,
        setIconVariationsCount,
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
        handleSaveEdit: (assetId: string) => runWriteAction(() => handleSaveEdit(assetId)),
        handleUploadCustomIconFiles: async (files: File[]) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            await handleUploadCustomIconFiles(files);
        },
        handleGenerateIcon: () => runWriteAction(handleGenerateIcon),
        handleEnhanceIconSlot: (payload: { slotIndex: number; base: { kind: 'icon' | 'icon_enhanced'; assetId: string }; enhancePrompt: string }) =>
            runWriteAction(() => handleEnhanceIconSlot(payload)),
        handleGenerateAllScreenshots: () => runWriteAction(handleGenerateAllScreenshots),
        handleGenerateSlot: (slotIndex: number) => runWriteAction(() => handleGenerateSlot(slotIndex)),
        handleEnhanceSlot: (payload: { slotIndex: number; base: { kind: 'screenshot' | 'screenshot_enhanced'; assetId: string }; enhancePrompt: string }) =>
            runWriteAction(() => handleEnhanceSlot(payload)),
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset: (asset: GeneratedAsset) =>
            runWriteAction(() => handleDeleteGeneratedAsset(asset)),
        getIconSystemPrompt,
        setIconSystemPromptOverride: (value: string) => runWriteAction(() => setIconSystemPromptOverride(value)),
        resetIconSystemPromptOverride: () => runWriteAction(resetIconSystemPromptOverride),
        getSystemPromptForSlot,
        getSystemPromptTemplateForSlot,
        setSystemPromptTemplateForSlot: (
            slotIndex: number,
            value: 'ref_like' | 'same_style_like' | 'no_ref_like' | 'empty'
        ) =>
            runWriteAction(() => setSystemPromptTemplateForSlot(slotIndex, value)),
        setSystemPromptOverride: (slotIndex: number, mode: 'generate' | 'enhance', value: string) =>
            runWriteAction(() => setSystemPromptOverride(slotIndex, mode, value)),
        resetSystemPromptOverride: (slotIndex: number, mode: 'generate' | 'enhance') =>
            runWriteAction(() => resetSystemPromptOverride(slotIndex, mode)),
        pickedIconAssetId,
        pickedScreenshotAssetIdBySlotIndex,
        handlePickIcon: (assetId: string) => runWriteAction(() => handlePickIcon(assetId)),
        handlePickScreenshot: (payload: { screenshotSetId: string; slotIndex: number; assetId: string }) =>
            runWriteAction(() => handlePickScreenshot(payload)),
        handleMarkAsCompleted: (opts?: { pruneUnpicked?: boolean }) => runWriteAction(() => handleMarkAsCompleted(opts)),
        handleBrandPromptChange,
        handleBrandPromptSave: (refId: string, value: string) =>
            runWriteAction(() => handleBrandPromptSave(refId, value)),
        isNoBrandMode,
        noBrandIconPromptValue: noBrandIconPromptDraft,
        handleNoBrandIconPromptChange,
        handleNoBrandIconPromptSave: (value: string) =>
            runWriteAction(() => handleNoBrandIconPromptSave(value)),
        handleNoBrandIconPromptAutogen: () =>
            runWriteAction(handleNoBrandIconPromptAutogen),
        noBrandIconPromptAutogenBusy: noBrandIconPromptAutogenBusy,
        handleAutoGrowInput,
        openLightbox,
        text,
        fonts: EDIT_FONTS,
        isReadOnly: isCurrentBrandReadOnly,
    };

    useEffect(() => {
        if (!isBusyForUnload) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isBusyForUnload]);

    const allQueueJobs = useMemo(() => {
        const merged = [...generationJobs, ...(connectorJobQueue.jobs || [])];
        merged.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        return merged.slice(0, 50);
    }, [generationJobs, connectorJobQueue.jobs]);

    const handleDismissQueueJob = useCallback(
        (id: string) => {
            if (id.startsWith('connector:')) {
                connectorJobQueue.dismiss(id.slice('connector:'.length));
                return;
            }
            dismissJob(id);
        },
        [connectorJobQueue, dismissJob]
    );

    const handleClearFinishedQueueJobs = useCallback(() => {
        clearFinished();
        connectorJobQueue.clearFinished();
    }, [clearFinished, connectorJobQueue]);

    const handleCancelQueueJob = useCallback(
        (id: string) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            if (id.startsWith('connector:')) {
                void connectorJobQueue.cancel(id.slice('connector:'.length));
                return;
            }
            cancelGenerationJob(id);
        },
        [isCurrentBrandReadOnly, reportReadOnlyBlocked, connectorJobQueue, cancelGenerationJob]
    );

    
    return (
        <div data-ui-lang={lang} className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Manrope']">
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-full shadow-lg md:hidden"
                >
                    <Menu size={18} />
                </button>
            )}

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                activePage={activePage}
                onSelectAccounts={() => openAccounts()}
                onSelectIdeas={() => openIdeas()}
                logoContainerRef={logoContainerRef}
                logoVariantIndex={logoVariantIndex}
                setLogoVariantIndex={setLogoVariantIndex}
                logoFontReady={logoFontReady}
                logoWord={logoWord}
                lang={lang}
                setLang={setLang}
                sessionEmail={session.user.email ?? ''}
                brands={brands}
                brandAppSummaryByBrandId={brandAppSummaryByBrandId}
                selectedBrandId={selectedBrandId}
                activeSessionCount={activeSessionCount}
                activeSessionCountries={activeSessionCountries}
                lockedBrandIdSet={sidebarLockedBrandIdSet}
                brandIconUrls={brandIconUrls}
                brandFormOpen={brandFormOpen}
                brandForm={brandForm}
                brandFormError={brandFormError}
                brandFormLoading={brandFormLoading}
                editingBrandId={editingBrandId}
                brandSlugPreview={brandSlugPreview}
                brandsLoading={brandsLoading}
                isBusy={false}
                onBlockedAction={() => reportActionError(text('generation_in_progress'))}
                reorderBrands={(sourceId, targetId) => {
                    void runWriteAction(() => reorderBrands(sourceId, targetId));
                }}
                openBrandForm={openBrandForm}
                submitBrandForm={submitBrandForm}
                setBrandForm={setBrandForm}
                closeBrandForm={closeBrandForm}
                setSelectedBrandId={selectBrandFromSidebar}
                onLockedBrandAction={reportLockedBrandWarning}
                openLightbox={openLightbox}
                handleLogout={handleLogout}
                text={text}
            />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div ref={mainScrollRef} className="flex-1 overflow-y-auto">
                    <div className="min-h-full px-6 py-8 lg:px-10">
                        <div
                            className={`mx-auto space-y-8 ${
                                activePage === 'workspace' ? 'max-w-6xl' : 'max-w-none'
                            }`}
                        >
                            {activePage === 'workspace' ? (
                            <div ref={stickyHeaderRef} className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 bg-slate-950/90 backdrop-blur border-b border-indigo-900/30 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex flex-col items-center gap-2">
                                        {isNoBrandMode ? (
                                            <div className="flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] border border-indigo-400/20 bg-slate-800/35 text-xs text-indigo-200/50">
                                                <span className="text-[10px] font-semibold tracking-[0.1em]">
                                                    {text('no_brand_short')}
                                                </span>
                                            </div>
                                        ) : isBrandEditing ? (
                                            <label
                                                htmlFor="brand-icon-upload"
                                                className={`flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] text-xs text-indigo-200/70 hover:border-indigo-400/50 ${
                                                    isCurrentBrandReadOnly ? 'cursor-not-allowed opacity-70 pointer-events-none' : 'cursor-pointer'
                                                } ${
                                                    hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/30 bg-slate-800/35'
                                                }`}
                                                title={brandIconReference ? text('replace_icon') : text('upload_icon')}
                                            >
                                                {brandIconReference && brandRefUrls[brandIconReference.id] ? (
                                                    <img
                                                        src={brandRefUrls[brandIconReference.id]}
                                                        alt={text('icon_reference')}
                                                        className="h-full w-full object-cover rounded-[18px] cursor-zoom-in"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            openLightbox(brandRefUrls[brandIconReference.id], text('icon_reference'));
                                                        }}
                                                    />
                                                ) : (
                                                    <Plus size={16} />
                                                )}
                                            </label>
                                        ) : (
                                            <div
                                                className={`flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] text-xs text-indigo-200/60 ${
                                                    hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/20 bg-slate-800/35'
                                                }`}
                                            >
                                                {brandIconReference && brandRefUrls[brandIconReference.id] ? (
                                                    <img
                                                        src={brandRefUrls[brandIconReference.id]}
                                                        alt={text('icon_reference')}
                                                        className="h-full w-full object-cover rounded-[18px] cursor-zoom-in"
                                                        onClick={() => openLightbox(brandRefUrls[brandIconReference.id], text('icon_reference'))}
                                                    />
                                                ) : (
                                                    <Plus size={16} />
                                                )}
                                            </div>
                                        )}
                                        {!isNoBrandMode && isBrandEditing && (
                                            <div className="flex items-center gap-2">
                                                <label
                                                    htmlFor="brand-icon-upload"
                                                    className={`inline-flex items-center gap-1 rounded-full border border-indigo-400/30 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-400/10 ${
                                                        isCurrentBrandReadOnly
                                                            ? 'cursor-not-allowed opacity-60 pointer-events-none'
                                                            : 'cursor-pointer'
                                                    }`}
                                                >
                                                    {brandIconUploading ? text('uploading') : brandIconReference ? text('replace_icon') : text('upload_icon')}
                                                </label>
                                                {brandIconReference && (
                                                    <ConfirmIconButton
                                                        label={text('delete')}
                                                        question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                                                        confirmLabel={text('delete')}
                                                        cancelLabel={text('cancel')}
                                                        disabled={isCurrentBrandReadOnly}
                                                        onConfirm={() => runWriteAction(() => handleDeleteBrandReference(brandIconReference))}
                                                    >
                                                        <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white">
                                                            <Trash2 size={12} />
                                                        </span>
                                                    </ConfirmIconButton>
                                                )}
                                            </div>
                                        )}
                                        {!isNoBrandMode && (
                                            <input
                                                id="brand-icon-upload"
                                                type="file"
                                                accept="image/png,image/jpeg"
                                                className="hidden"
                                                onChange={handleBrandIconUpload}
                                                disabled={!selectedBrand || !isBrandEditing || brandIconUploading || isCurrentBrandReadOnly}
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_label')}</p>
                                        <h2 className="text-3xl font-semibold text-white">
                                            {selectedBrand ? selectedBrand.name : text('no_brand_selected')}
                                        </h2>
                                        <p className="text-sm text-indigo-200/60">
                                            {selectedBrand ? `/${selectedBrand.slug}` : text('create_or_select_brand')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedBrand ? (
                                        <div className="hidden lg:flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/20 px-3 py-2 shrink-0">
                                            <div className="flex items-center justify-between gap-4 text-[11px] leading-none">
                                                <span className="inline-flex items-center gap-2 whitespace-nowrap text-indigo-200/80">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]" />
                                                    {text('active_apps')}
                                                </span>
                                                <span className="tabular-nums font-semibold text-white/90">
                                                    {selectedBrandSummary?.active ?? 0}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-[11px] leading-none">
                                                <span className="inline-flex items-center gap-2 whitespace-nowrap text-indigo-200/80">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.30)]" />
                                                    {text('ready')}
                                                </span>
                                                <span className="tabular-nums font-semibold text-white/90">
                                                    {selectedBrandSummary?.yellow ?? 0}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-[11px] leading-none">
                                                <span className="inline-flex items-center gap-2 whitespace-nowrap text-indigo-200/80">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.30)]" />
                                                    {text('banned_apps')}
                                                </span>
                                                <span className="tabular-nums font-semibold text-white/90">
                                                    {selectedBrandSummary?.red ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}
                                    {selectedBrand && !isNoBrandMode && (
                                        <>
                                            {isBrandEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => runWriteAction(() => submitBrandForm())}
                                                        disabled={brandFormLoading || isCurrentBrandReadOnly}
                                                        className={`inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10 ${
                                                            brandFormLoading ? 'opacity-70 pointer-events-none' : ''
                                                        }`}
                                                    >
                                                        <Pencil size={14} />
                                                        {brandFormLoading ? text('saving') : text('save')}
                                                    </button>
                                                    <button
                                                        onClick={() => closeBrandForm()}
                                                        disabled={brandFormLoading}
                                                        className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-indigo-200/80 hover:border-indigo-400/30 hover:text-white ${
                                                            brandFormLoading ? 'opacity-70 pointer-events-none' : ''
                                                        }`}
                                                    >
                                                        {text('cancel')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        isCurrentBrandReadOnly ? reportReadOnlyBlocked() : openBrandForm(selectedBrand)
                                                    }
                                                    disabled={isCurrentBrandReadOnly}
                                                    className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10 disabled:opacity-60"
                                                >
                                                    <Pencil size={14} />
                                                    {text('edit_brand')}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            ) : null}

                            {dataError && (
                                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-3">
                                    <AlertTriangle size={18} />
                                    <div>
                                        <p className="font-semibold">{text('data_load_error_title')}</p>
                                        <p className="text-xs text-rose-200/70">{dataError}</p>
                                        <button
                                            onClick={handleRetry}
                                            className="mt-3 rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-100"
                                        >
                                            {text('retry')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {actionError && (
                                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start gap-3">
                                    <AlertTriangle size={18} />
                                    <div>
                                        <p className="font-semibold">{text('action_error_title')}</p>
                                        <p className="text-xs text-amber-100/70">{actionError}</p>
                                    </div>
                                </div>
                            )}

                            {activePage === 'workspace' && selectedBrand && isCurrentBrandReadOnly && (
                                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={18} />
                                        <div>
                                            <p className="font-semibold">{text('action_error_title')}</p>
                                            <p className="text-xs text-amber-100/70">{text('brand_under_work_readonly')}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleStartEditing}
                                        disabled={isClaimingEditLock}
                                        className="shrink-0 inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/20 disabled:opacity-60"
                                    >
                                        {isClaimingEditLock ? text('saving') : text('brand_start_editing')}
                                    </button>
                                </div>
                            )}

                            {activePage === 'workspace' && !dataLoading && !brands.length && (
                                <div className="rounded-[32px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] p-10 text-center">
                                    <p className="text-lg font-semibold text-white">{text('create_first_brand')}</p>
                                    <p className="mt-2 text-sm text-indigo-200/70">
                                        {text('brands_hold_references')}
                                    </p>
                                    <button
                                        onClick={() => openBrandForm()}
                                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-400/20 px-5 py-2 text-sm font-semibold text-indigo-100 border border-indigo-400/40"
                                    >
                                        <Plus size={16} />
                                        {text('new_brand')}
                                    </button>
                                </div>
                            )}

                            {activePage === 'workspace' && selectedBrand && (
                                <>
                                <div className="space-y-6">
                                    {!isNoBrandMode && (
                                        <>
                                            <BrandReleaseInfoPanel
                                                selectedBrand={selectedBrand}
                                                patchBrand={async (brandId, patch) => {
                                                    if (isCurrentBrandReadOnly) {
                                                        reportReadOnlyBlocked();
                                                        return;
                                                    }
                                                    await patchBrand(brandId, patch);
                                                }}
                                                reportError={reportActionError}
                                                text={text}
                                                isReadOnly={isCurrentBrandReadOnly}
                                            />
                                            <BrandReferencesPanel
                                                key={selectedBrand.id}
                                                brandId={selectedBrand.id}
                                                brandScreenshotReferences={brandScreenshotReferences}
                                                brandRefUrls={brandRefUrls}
                                                handleReorderBrandReference={(fromIndex, toIndex) =>
                                                    runWriteAction(() => handleReorderBrandReference(fromIndex, toIndex))
                                                }
                                                handleDeleteBrandReference={(ref) =>
                                                    runWriteAction(() => handleDeleteBrandReference(ref))
                                                }
                                                handleBrandReferenceDragOver={handleBrandReferenceDragOver}
                                                handleBrandReferenceDragLeave={handleBrandReferenceDragLeave}
                                                handleBrandReferenceDrop={(event) => runWriteAction(() => handleBrandReferenceDrop(event))}
                                                handleBrandScreenshotUpload={(event) =>
                                                    runWriteAction(() => handleBrandScreenshotUpload(event))
                                                }
                                                isBrandRefDropActive={isBrandRefDropActive}
                                                brandScreenshotsUploading={brandScreenshotsUploading}
                                                maxScreenshotRefs={MAX_SCREENSHOT_REFS}
                                                openLightbox={openLightbox}
                                                text={text}
                                                isReadOnly={isCurrentBrandReadOnly}
                                            />
                                        </>
                                    )}

                                    <div className="space-y-6">
                                        <AppFolder
                                                appFolderLayout={appFolderLayout}
                                                appFolderTheme={appFolderTheme}
                                                bodyCornerRadius={bodyCornerRadius}
                                                isTabMotionDisabled={isTabMotionDisabled}
                                                appSwitching={appSwitching}
                                                isFirstApp={isFirstApp}
                                                gooeyDebug={gooeyDebug}
                                                appFolderWrapRef={appFolderWrapRef}
                                                appFolderContentRef={appFolderContentRef}
                                                appFolderEndRef={appFolderEndRef}
                                                appPickerRef={appPickerRef}
                                                appSimulatorRef={appSimulatorRef}
                                                appGenerationRef={appGenerationRef}
                                                isAssetsCollapsed={assetsCollapsed}
                                                collapsedAssets={
                                                    <DeliverablesPanel
                                                        isCompleted={Boolean(exportStatus?.is_completed)}
                                                        pickedIconAsset={pickedIconAsset}
                                                        pickedIconPreviewUrl={
                                                            pickedIconAsset
                                                                ? generatedPreviewUrls[pickedIconAsset.id] ||
                                                                  generatedUrls[pickedIconAsset.id] ||
                                                                  null
                                                                : null
                                                        }
                                                        screenshotSets={screenshotSets}
                                                        onDownloadIcon={() => {
                                                            if (!pickedIconAsset || !selectedApp) return;
                                                            handleDownloadGeneratedAsset(
                                                                pickedIconAsset,
                                                                `icon-${selectedApp.alias || selectedApp.id}.jpg`
                                                            );
                                                        }}
                                                        onDownloadSetZip={(setId) => {
                                                            handleDownloadScreenshotSetZip({ setId, preferPicks: true });
                                                        }}
                                                        onShowWorkspace={() => {
                                                            if (!assetsCollapsed) return;
                                                            toggleAssetsCollapsed();
                                                        }}
                                                        text={text}
                                                    />
                                                }
                                                picker={
                                                    <>
                                                        {!showNoAppsEmptyState && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                {selectedApp && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (isCurrentBrandReadOnly) {
                                                                                reportReadOnlyBlocked();
                                                                                return;
                                                                            }
                                                                            openAppForm(selectedApp);
                                                                        }}
                                                                        onDoubleClick={() => {
                                                                            closeAppForm();
                                                                        }}
                                                                        disabled={isCurrentBrandReadOnly}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                    >
                                                                        <Pencil size={11} />
                                                                        {text('edit')}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        if (isCurrentBrandReadOnly) {
                                                                            reportReadOnlyBlocked();
                                                                            return;
                                                                        }
                                                                        openAppForm();
                                                                    }}
                                                                    disabled={!canAddApp || isCurrentBrandReadOnly}
                                                                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                                                                        canAddApp && !isCurrentBrandReadOnly
                                                                            ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                            : 'border-white/10 text-indigo-200/40 cursor-not-allowed'
                                                                    }`}
                                                                >
                                                                    <Plus size={12} />
                                                                    {text('add_app')}
                                                                </button>
                                                            </div>
                                                        )}

                                                        {hasAnyAppsForBrand ? (
                                                            <AppPills
                                                            visibleApps={visibleApps}
                                                            selectedAppId={selectedAppId}
                                                            setSelectedAppId={setSelectedAppId}
                                                            isBusy={false}
                                                        onBlockedAction={() => reportActionError(text('generation_in_progress'))}
                                                        lockedAppId={appFormOpen && editingAppId ? editingAppId : null}
                                                        onEditLockedAction={() => reportActionError(text('finish_editing_app_first'))}
                                                        isAppReorderMode={isAppReorderMode}
                                                        draggingAppId={draggingAppId}
                                                        setDraggingAppId={setDraggingAppId}
                                                        dragOverAppId={dragOverAppId}
                                                        setDragOverAppId={setDragOverAppId}
                                                        reorderBrandApps={(sourceId, targetId) => {
                                                            void runWriteAction(() => reorderBrandApps(sourceId, targetId));
                                                        }}
                                                        appActivePillRef={appActivePillRef}
                                                        appPillScrollRef={appPillScrollRef}
                                                        appPillRowRef={appPillRowRef}
                                                        appPillPanRef={appPillPanRef}
                                                        appPillPanHandlers={appPillPanHandlers}
                                                        isAppPillPanning={isAppPillPanning}
                                                        showBannedToggle={showBannedToggle}
                                                        tabButtonWidth={tabButtonWidth}
                                                        tabButtonHeight={tabButtonHeight}
                                                        isBannedView={isBannedView}
                                                        setIsBannedView={setIsBannedView}
                                                        visibleActiveApps={visibleActiveApps}
                                                            bannedApps={bannedApps}
                                                            text={text}
                                                        />
                                                        ) : null}

                                                <AppFormCard
                                                    appFormOpen={appFormOpen}
                                                    appForm={appForm}
                                                    setAppForm={setAppForm}
                                                    appFormError={appFormError}
                                                    appFormLoading={appFormLoading}
                                                    editingAppId={editingAppId}
                                                    isEditingBanned={isEditingBanned}
                                                    selectedBrandSlug={selectedBrand?.slug}
                                                    selectedBrandName={selectedBrand?.name}
                                                    appAliasPreview={appAliasPreview}
                                                    aliasPlaceholder={newAppAliasPlaceholder}
                                                    onCancel={() => closeAppForm()}
                                                    onSubmit={(event) => {
                                                        if (isCurrentBrandReadOnly) {
                                                            event.preventDefault();
                                                            reportReadOnlyBlocked();
                                                            return;
                                                        }
                                                        submitAppForm(event);
                                                    }}
                                                    onDelete={() => runWriteAction(handleDeleteApp)}
                                                    onBan={(appId) => runWriteAction(() => handleBanApp(appId))}
                                                    onUnban={(appId) => runWriteAction(() => handleUnbanApp(appId))}
                                                    text={text}
                                                />

                                                {!selectedApp && hasAnyAppsForBrand && (
                                                    <p className="mt-2 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
                                                )}
                                            </>
                                        }
                                                simulator={
                                                    showNoAppsEmptyState ? (
                                                        <div className="rounded-[32px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] p-10 text-center">
                                                            <p className="text-lg font-semibold text-white">{text('no_apps_yet')}</p>
                                                            <p className="mt-2 text-sm text-indigo-200/70">{text('ready_for_screenshots_icons')}</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isCurrentBrandReadOnly) {
                                                                        reportReadOnlyBlocked();
                                                                        return;
                                                                    }
                                                                    openAppForm();
                                                                }}
                                                                disabled={!canAddApp || isCurrentBrandReadOnly}
                                                                className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold border ${
                                                                    canAddApp && !isCurrentBrandReadOnly
                                                                        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                        : 'border-white/10 text-indigo-200/40 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <Plus size={16} />
                                                                {text('add_app')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-0">
                                                            {!assetsCollapsed && selectedApp ? (
                                                                <>
                                                                    <AppStoreLinkRow
                                                                        selectedApp={selectedApp}
                                                                        targetCountries={isNoBrandMode ? [] : (selectedBrand?.target_countries || [])}
                                                                        onSaveCanonicalUrl={async (canonicalUrl) => {
                                                                            if (isCurrentBrandReadOnly) {
                                                                                reportReadOnlyBlocked();
                                                                                return;
                                                                            }
                                                                            const next = await patchApp(selectedApp.id, {
                                                                                appstore_url: canonicalUrl,
                                                                            });
                                                                            if (!next) {
                                                                                throw new Error(text('upload_failed'));
                                                                            }
                                                                        }}
                                                                        text={text}
                                                                        reportError={reportActionError}
                                                                        isReadOnly={isCurrentBrandReadOnly}
                                                                    />
                                                                    <div className="mt-4">
                                                                        <AppStoreReviewWebhookRow
                                                                            selectedApp={selectedApp}
                                                                            session={session}
                                                                            text={text}
                                                                            reportError={reportActionError}
                                                                            isReadOnly={isCurrentBrandReadOnly}
                                                                        />
                                                                    </div>
                                                                    <div className="my-4 h-px bg-indigo-900/30" aria-hidden="true" />
                                                                </>
                                                            ) : null}
                                                            {isNoBrandMode && (
                                                                <StepBlock step={ideaStepNumber} done={step2Done}>
                                                                    <ConnectorClientSpecPanel
                                                                        connectorForm={connectorForm}
                                                                        isEnabled={connectorEnabled && !isCurrentBrandReadOnly}
                                                                        ideas={appIdeas}
                                                                        ideaCategories={appIdeaCategories}
                                                                        ideaAssignments={appIdeaAssignments}
                                                                        selectedAppId={selectedApp?.id || null}
                                                                        onOpenIdeas={openIdeas}
                                                                        text={text}
                                                                    />
                                                                </StepBlock>
                                                            )}
                                                            {!assetsCollapsed && (
                                                                <StepBlock step={iconStepNumber} done={step1Done}>
                                                                    <IconGenerationModule {...generationModuleProps} />
                                                                </StepBlock>
                                                            )}

                                                            {!isNoBrandMode && (
                                                                <StepBlock step={ideaStepNumber} done={step2Done}>
                                                                    <ConnectorClientSpecPanel
                                                                        connectorForm={connectorForm}
                                                                        isEnabled={connectorEnabled && !isCurrentBrandReadOnly}
                                                                        ideas={appIdeas}
                                                                        ideaCategories={appIdeaCategories}
                                                                        ideaAssignments={appIdeaAssignments}
                                                                        selectedAppId={selectedApp?.id || null}
                                                                        onOpenIdeas={openIdeas}
                                                                        text={text}
                                                                    />
                                                                </StepBlock>
                                                            )}

                                                            <StepBlock step={3} done={setupStepDone}>
                                                                <ConnectorVariablesSecretsPanel
                                                                    connectorForm={connectorForm}
                                                                    isEnabled={connectorEnabled && !isCurrentBrandReadOnly}
                                                                    selectedApp={selectedApp}
                                                                    account={selectedAppstoreAccount}
                                                                    allAccounts={appstoreAccounts}
                                                                    onPickAccount={pickAccountForSelectedApp}
                                                                    onOpenAccountsForApp={() => openAccounts(selectedApp?.id || null)}
                                                                    text={text}
                                                                />
                                                            </StepBlock>

                                                            <StepBlock step={4} done={githubStepDone}>
                                                                <DevFilesPanel
                                                                    selectedApp={selectedApp}
                                                                    githubRepoUrl={githubRepoUrl}
                                                                    isCreatingRepo={isCreatingGithubRepo}
                                                                    isDeletingRepo={isDeletingGithubRepo}
                                                                    onCreateRepo={() => runWriteAction(handleCreateGithubRepo)}
                                                                    onDeleteRepo={() => runWriteAction(handleDeleteGithubRepo)}
                                                                    text={text}
                                                                    isReadOnly={isCurrentBrandReadOnly}
                                                                />
                                                            </StepBlock>

                                                            <StepBlock step={5} done={step5Done}>
                                                                <ConnectorRunnerPanel
                                                                    session={session}
                                                                    selectedApp={selectedApp}
                                                                    githubRepoUrl={githubRepoUrl}
                                                                    connectorForm={connectorForm}
                                                                    pickedIcon={Boolean(pickedIconAssetId)}
                                                                    text={text}
                                                                    reportError={reportActionError}
                                                                    isReadOnly={isCurrentBrandReadOnly}
                                                                />
                                                            </StepBlock>

                                                            <StepBlock step={6} done={step6Done}>
                                                                <IntegrationModulePanel
                                                                    session={session}
                                                                    selectedApp={selectedApp}
                                                                    githubRepoUrl={githubRepoUrl}
                                                                    connectorForm={connectorForm}
                                                                    connectorJobs={connectorRunnerJobs}
                                                                    isEnabled={connectorEnabled}
                                                                    text={text}
                                                                    refreshJobs={refreshConnectorRunnerJobs}
                                                                    reportError={reportActionError}
                                                                    isReadOnly={isCurrentBrandReadOnly}
                                                                />
                                                            </StepBlock>

                                                            <StepBlock step={7} done={step7Done} isLast>
                                                                <AutoReleaseModulePanel
                                                                    isEnabled={connectorEnabled}
                                                                    integrationReady={integrationReady}
                                                                    onNotImplemented={() => reportActionError(text('coming_soon'))}
                                                                    text={text}
                                                                />
                                                            </StepBlock>
                                                        </div>
                                                    )
                                                }
                                                generation={
                                                    showNoAppsEmptyState ? null : (
                                                        <div className="space-y-0">
                                                            <div ref={deliverablesAnchorRef} />

                                                            <StepBlock step={8} done={step8Done}>
                                                                <AppSimulatorSection
                                                                    selectedApp={selectedApp}
                                                                    selectedAppScreenshots={selectedAppScreenshots}
                                                                    appScreenshotUrls={appScreenshotUrls}
                                                                    handleReorderAppScreenshot={(fromIndex, toIndex) =>
                                                                        runWriteAction(() => handleReorderAppScreenshot(fromIndex, toIndex))
                                                                    }
                                                                    handleDeleteAppScreenshot={(shot) =>
                                                                        runWriteAction(() => handleDeleteAppScreenshot(shot))
                                                                    }
                                                                    handleScreenshotDragOver={handleScreenshotDragOver}
                                                                    handleScreenshotDragLeave={handleScreenshotDragLeave}
                                                                    handleScreenshotDrop={(event) =>
                                                                        runWriteAction(() => handleScreenshotDrop(event))
                                                                    }
                                                                    handleAppScreenshotsUpload={(event) =>
                                                                        runWriteAction(() => handleAppScreenshotsUpload(event))
                                                                    }
                                                                    isScreenshotDropActive={isScreenshotDropActive}
                                                                    appScreenshotsUploading={appScreenshotsUploading}
                                                                    canUploadAppScreenshots={canUploadAppScreenshots}
                                                                    openLightbox={openLightbox}
                                                                    text={text}
                                                                    isReadOnly={isCurrentBrandReadOnly}
                                                                />
                                                            </StepBlock>

                                                            <StepBlock step={9} done={step9Done}>
                                                                <ScreenshotPromptsModule {...generationModuleProps} />
                                                            </StepBlock>

                                                            <StepBlock step={10} done={step10Done} isLast={!isNoBrandMode}>
                                                                <GeneratedScreenshotsModule {...generationModuleProps} />
                                                            </StepBlock>

                                                            {isNoBrandMode && selectedApp && (
                                                                <StepBlock step={11} done={false} isLast>
                                                                    <section className="rounded-2xl bg-slate-900 ring-1 ring-white/5 p-4 space-y-4">
                                                                        <div>
                                                                            <p className="text-sm font-semibold text-white">
                                                                                {text('no_brand_step11_title')}
                                                                            </p>
                                                                            <p className="text-xs text-indigo-200/60">
                                                                                {text('no_brand_step11_subtitle')}
                                                                            </p>
                                                                        </div>
                                                                        {regularBrands.length > 0 ? (
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                                                <div className="min-w-0 flex-1">
                                                                                    <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">
                                                                                        {text('no_brand_move_target_label')}
                                                                                    </label>
                                                                                    <select
                                                                                        value={moveTargetBrandId}
                                                                                        onChange={(event) => setMoveTargetBrandId(event.target.value)}
                                                                                        disabled={moveToBrandLoading || isCurrentBrandReadOnly}
                                                                                        className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                    >
                                                                                        {regularBrands.map((brand) => (
                                                                                            <option key={brand.id} value={brand.id}>
                                                                                                {brand.name}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => runWriteAction(handleMoveNoBrandAppToBrand)}
                                                                                    disabled={!moveTargetBrandId || moveToBrandLoading || isCurrentBrandReadOnly}
                                                                                    className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold ${
                                                                                        moveTargetBrandId && !isCurrentBrandReadOnly
                                                                                            ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30'
                                                                                            : 'border-white/10 text-indigo-200/40'
                                                                                    }`}
                                                                                >
                                                                                    {moveToBrandLoading ? text('saving') : text('no_brand_move_button')}
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="rounded-xl border border-dashed border-indigo-500/30 bg-slate-950/30 px-3 py-3 text-xs text-indigo-200/70">
                                                                                <p>{text('no_brand_move_no_targets')}</p>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openBrandForm()}
                                                                                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25"
                                                                                >
                                                                                    <Plus size={12} />
                                                                                    {text('new_brand')}
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </section>
                                                                </StepBlock>
                                                            )}
                                                        </div>
                                                    )
                                                }
                                                endSections={null}
                                        />
                                    </div>
                                </div>
                                </>
                            )}

                            {activePage === 'accounts' ? (
                                <AccountsPage
                                    accounts={appstoreAccounts}
                                    loading={appstoreAccountsLoading}
                                    error={appstoreAccountsError}
                                    refresh={refreshAppstoreAccounts}
                                    createAccount={createAppstoreAccount}
                                    updateAccount={updateAppstoreAccount}
                                    deleteAccount={deleteAppstoreAccount}
                                    apps={apps}
                                    brands={brands}
                                    onOpenApp={openWorkspaceForApp}
                                    focusAppId={accountsFocusAppId}
                                    consumeFocus={() => setAccountsFocusAppId(null)}
                                    onUnsavedChangesChange={setAccountsHasUnsavedChanges}
                                    reportError={reportActionError}
                                    text={text}
                                />
                            ) : activePage === 'ideas' ? (
                                <IdeasPage
                                    ideas={appIdeas}
                                    categories={appIdeaCategories}
                                    ideaAssignments={appIdeaAssignments}
                                    apps={apps}
                                    loading={appIdeasLoading}
                                    error={appIdeasError}
                                    refresh={refreshAppIdeas}
                                    createIdea={createAppIdea}
                                    updateIdea={updateAppIdea}
                                    deleteIdea={deleteAppIdea}
                                    onOpenApp={openWorkspaceForApp}
                                    reportError={reportActionError}
                                    text={text}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            </main>
            {activePage === 'workspace' && selectedApp && !assetsCollapsed && (
                <div
                    ref={deliverablesRailRef}
                    className="fixed z-40 transition-opacity duration-150"
                    style={{
                        top: `${deliverablesRailStyle.top}px`,
                        left: `${deliverablesRailStyle.left}px`,
                        opacity: deliverablesRailStyle.opacity,
                        pointerEvents: deliverablesRailStyle.opacity ? 'auto' : 'none',
                    }}
                >
                    <ExportCompletionRail
                        isCompleted={Boolean(exportStatus?.is_completed)}
                        pickedIcon={Boolean(pickedIconAssetId)}
                        sets={setReadiness}
                        unpickedCount={unpickedCount}
                        isAssetsCollapsed={assetsCollapsed}
                        onToggleAssetsCollapsed={toggleAssetsCollapsed}
                        onMarkCompleted={() => runWriteAction(() => handleMarkAsCompleted({ pruneUnpicked: true }))}
                        text={text}
                    />
                </div>
            )}
            {collabWarning && (
                <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border border-amber-400/40 bg-slate-900/95 px-3 py-2 text-xs text-amber-100 shadow-lg">
                    {collabWarning}
                </div>
            )}
            {aliasNotice && (
                <div className="pointer-events-none fixed bottom-20 right-4 z-50 max-w-xs rounded-xl border border-indigo-400/35 bg-slate-900/95 px-3 py-2 text-xs text-indigo-100 shadow-lg">
                    {aliasNotice}
                </div>
            )}
            <Lightbox lightbox={lightbox} onClose={closeLightbox} closeLabel={text('close')} />
            <GenerationQueueWidget
                jobs={allQueueJobs}
                onDismissJob={handleDismissQueueJob}
                onClearFinished={handleClearFinishedQueueJobs}
                onCancelJob={handleCancelQueueJob}
            />
        </div>
    );
}

export default AppShell;
