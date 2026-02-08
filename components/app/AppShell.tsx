import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { t, TranslationKey } from '../../i18n';
import { EDIT_FONTS, MAX_SCREENSHOT_REFS } from '../../constants/zefgen';
import { syncAutoGrowTextarea } from '../../utils/dom';
import { useRouteSync } from '../../hooks/use-route-sync';
import { useSlotMappings } from '../../hooks/use-slot-mappings';
import { useAppFolderLayout } from '../../hooks/use-app-folder-layout';
import { useAppPillPan } from '../../hooks/use-app-pill-pan';
import { useBrands } from '../../hooks/use-brands';
import { useApps } from '../../hooks/use-apps';
import { useBrandReferences } from '../../hooks/use-brand-references';
import { useAppScreenshots } from '../../hooks/use-app-screenshots';
import { useGeneratedAssets } from '../../hooks/use-generated-assets';
import { useAppScreenshotPrompts } from '../../hooks/use-app-screenshot-prompts';
import { signOut } from '../../data/auth';
import { fetchAllExportStatuses, fetchAllScreenshotSetCounts } from '../../data/app-indicators';
import { Sidebar } from './Sidebar';
import { BrandReleaseInfoPanel } from './BrandReleaseInfoPanel';
import { BrandReferencesPanel } from './BrandReferencesPanel';
import { AppFolder } from './AppFolder';
import { AppPills } from './AppPills';
import { AppFormCard } from './AppFormCard';
import { AppSimulatorSection } from './AppSimulatorSection';
import { AppGenerationSection } from './AppGenerationSection';
import { Lightbox } from './Lightbox';
import { GenerationQueueWidget } from './GenerationQueueWidget';
import { ConfirmIconButton } from './ConfirmIconButton';
import { DeliverablesPanel } from './DeliverablesPanel';
import { ExportCompletionRail } from './ExportCompletionRail';
import { DevFilesPanel } from './DevFilesPanel';
import type { TextLayer } from '../../types/zefgen';

type AppShellProps = {
    session: Session;
};
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
    const text = useCallback((key: TranslationKey) => t(lang, key), [lang]);

    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [assetsCollapsed, setAssetsCollapsed] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);
    const [hasParsedRoute, setHasParsedRoute] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [logoVariantIndex, setLogoVariantIndex] = useState(() => Math.floor(Math.random() * 6));
    const logoWord = 'ZEFGEN';
    const logoContainerRef = useRef<HTMLDivElement>(null);
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const deliverablesRailRef = useRef<HTMLDivElement>(null);
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

    const reportActionError = useCallback((message: string) => {
        setActionError(message);
        setTimeout(() => {
            setActionError((prev) => (prev === message ? null : prev));
        }, 6000);
    }, []);

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
        patchBrand,
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
        isEditingBanned,
        isBannedView,
        setIsBannedView,
        openAppForm,
        submitAppForm,
        handleDeleteApp,
        handleBanApp,
        handleUnbanApp,
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
    });

    const selectedApp = useMemo(
        () => apps.find((app) => app.id === selectedAppId) || null,
        [apps, selectedAppId]
    );

    const brandAppSummaryByBrandId = useMemo(() => {
        const byBrand: Record<
            string,
            { total: number; green: number; yellow: number; red: number }
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
        const stored = slotMappings[slotIndex] || {};
        return {
            brandRefId: stored.brandRefId ?? brandScreenshotReferences[slotIndex - 1]?.id ?? null,
            simShotId: stored.simShotId ?? selectedAppScreenshots[slotIndex - 1]?.id ?? null,
        };
    };
    const updateSlotMapping = (
        slotIndex: number,
        patch: { brandRefId?: string | null; simShotId?: string | null }
    ) => {
        setSlotMappings((prev) => ({
            ...prev,
            [slotIndex]: { ...prev[slotIndex], ...patch },
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
        githubRepoUrl,
        handleCreateGithubRepo,
        handleDeleteGithubRepo,
        loading: generatedAssetsLoading,
        refresh: refreshGeneratedAssets,
        generatedIconSlots,
        enhancedIconSlots,
        generatedScreenshotSlots,
        enhancedScreenshotSlots,
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
        handleGenerateIcon,
        handleEnhanceIconSlot,
        handleGenerateSlot,
        handleEnhanceSlot,
        handleGenerateAllScreenshots,
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset,
        getSystemPromptForSlot,
        setSystemPromptOverride,
        resetSystemPromptOverride,
        targetSlotCount,
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

    // Note: we intentionally do NOT "live sync" these per-selected app anymore because it caused
    // visible count jitter in the sidebar. We'll replace this whole indicator pipeline later.

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
    const hasApps = visibleApps.length > 0;
    const isSingleApp = hasApps && visibleApps.length === 1;
    const isFirstApp = hasApps && activeAppIndex === 0;
    const bodyCornerRadius = `${isFirstApp || isSingleApp ? 0 : 26}px 26px 26px 26px`;
    const appFolderTheme = isBannedView ? 'rgba(127, 29, 29, 0.55)' : 'rgba(30, 41, 59, 0.55)';
    const isAppReorderMode = appFormOpen;

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
        selectedBrandId,
        selectedAppId,
        appsLength: apps.length,
        visibleApps,
        isBannedView,
        showBannedToggle,
    });

    useEffect(() => {
        if (!selectedApp || assetsCollapsed) {
            setDeliverablesRailStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }

        let raf = 0;
        const topOffset = 96; // Keep below the sticky header.
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = window.requestAnimationFrame(() => {
                const gen = appGenerationRef.current;
                const wrap = appFolderWrapRef.current;
                const rail = deliverablesRailRef.current;
                if (!gen || !wrap || !rail) return;

                const genRect = gen.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();
                const railRect = rail.getBoundingClientRect();

                const railH = railRect.height || rail.offsetHeight || 0;
                const railW = railRect.width || rail.offsetWidth || 0;
                if (!railH || !railW) return;

                const minTop = genRect.top;
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

                const inView = genRect.bottom > topOffset + 40 && genRect.top < window.innerHeight - 40;
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

        return () => {
            cancelAnimationFrame(raf);
            scrollEl?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            ro.disconnect();
        };
    }, [selectedApp?.id, assetsCollapsed]);

    const { isPanning: isAppPillPanning, panRef: appPillPanRef, handlers: appPillPanHandlers } = useAppPillPan({
        isReorderMode: isAppReorderMode,
        scrollRef: appPillScrollRef,
    });

    useRouteSync({
        dataLoading,
        hasParsedRoute,
        setHasParsedRoute,
        brands,
        apps,
        orderedApps,
        selectedBrand,
        selectedApp,
        setSelectedBrandId,
        setSelectedAppId,
    });

    const handleRetry = () => {
        setDataError(null);
        refreshBrands();
        refreshApps();
        refreshBrandReferences();
        refreshAppScreenshots();
        refreshGeneratedAssets();
    };

    useEffect(() => {
        const elements = document.querySelectorAll<HTMLTextAreaElement>('.auto-grow');
        elements.forEach((element) => syncAutoGrowTextarea(element));
    }, [brandIconReference?.prompt, brandScreenshotReferences, promptsByRefId]);

    const handleLogout = async () => {
        await signOut();
    };

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

    const isTabMotionDisabled = isAppReorderMode || isAppPillPanning || Boolean(draggingAppId);
    const isBusy =
        hasRunningJobs ||
        iconGenerating ||
        screenshotsGenerating ||
        slotGenerating !== null ||
        enhanceSlotGenerating !== null ||
        iconSlotGenerating !== null ||
        enhanceIconSlotGenerating !== null;
    const isBrandEditing = Boolean(selectedBrand && brandFormOpen && editingBrandId === selectedBrand.id);
    const hasBrandIcon = Boolean(brandIconReference && brandRefUrls[brandIconReference.id]);

    useEffect(() => {
        if (!isBusy) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isBusy]);

    
    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Manrope']">
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
                    brandIconUrls={brandIconUrls}
                    brandFormOpen={brandFormOpen}
                    brandForm={brandForm}
                    brandFormError={brandFormError}
                brandFormLoading={brandFormLoading}
                editingBrandId={editingBrandId}
                brandSlugPreview={brandSlugPreview}
                dataLoading={dataLoading}
                isBusy={isBusy}
                onBlockedAction={() => reportActionError(text('generation_in_progress'))}
                openBrandForm={openBrandForm}
                submitBrandForm={submitBrandForm}
                setBrandForm={setBrandForm}
                setBrandFormOpen={setBrandFormOpen}
                setSelectedBrandId={setSelectedBrandId}
                openLightbox={openLightbox}
                handleLogout={handleLogout}
                text={text}
            />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div ref={mainScrollRef} className="flex-1 overflow-y-auto">
                    <div className="min-h-full px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-6xl space-y-8">
                            <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 bg-slate-950/90 backdrop-blur border-b border-indigo-900/30 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex flex-col items-center gap-2">
                                        {isBrandEditing ? (
                                            <label
                                                htmlFor="brand-icon-upload"
                                                className={`flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] text-xs text-indigo-200/70 hover:border-indigo-400/50 cursor-pointer ${
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
                                        {isBrandEditing && (
                                            <div className="flex items-center gap-2">
                                                <label
                                                    htmlFor="brand-icon-upload"
                                                    className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-400/10 cursor-pointer"
                                                >
                                                    {brandIconUploading ? text('uploading') : brandIconReference ? text('replace_icon') : text('upload_icon')}
                                                </label>
                                                {brandIconReference && (
                                                    <ConfirmIconButton
                                                        label={text('delete')}
                                                        question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                                                        confirmLabel={text('delete')}
                                                        cancelLabel={text('cancel')}
                                                        onConfirm={() => handleDeleteBrandReference(brandIconReference)}
                                                    >
                                                        <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white">
                                                            <Trash2 size={12} />
                                                        </span>
                                                    </ConfirmIconButton>
                                                )}
                                            </div>
                                        )}
                                        <input
                                            id="brand-icon-upload"
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            className="hidden"
                                            onChange={handleBrandIconUpload}
                                            disabled={!selectedBrand || !isBrandEditing || brandIconUploading}
                                        />
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
                                    {selectedBrand && (
                                        <button
                                            onClick={() => openBrandForm(selectedBrand)}
                                            className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10"
                                        >
                                            <Pencil size={14} />
                                            {text('edit_brand')}
                                        </button>
                                    )}
                                </div>
                            </div>

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

                            {!dataLoading && !brands.length && (
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

                            {selectedBrand && (
                                <>
                                <div className="space-y-6">
                                    <BrandReleaseInfoPanel
                                        selectedBrand={selectedBrand}
                                        patchBrand={patchBrand}
                                        reportError={reportActionError}
                                        text={text}
                                    />
                                    <BrandReferencesPanel
                                        brandId={selectedBrand.id}
                                        brandScreenshotReferences={brandScreenshotReferences}
                                        brandRefUrls={brandRefUrls}
                                        handleReorderBrandReference={handleReorderBrandReference}
                                        handleDeleteBrandReference={handleDeleteBrandReference}
                                        handleBrandReferenceDragOver={handleBrandReferenceDragOver}
                                        handleBrandReferenceDragLeave={handleBrandReferenceDragLeave}
                                        handleBrandReferenceDrop={handleBrandReferenceDrop}
                                        handleBrandScreenshotUpload={handleBrandScreenshotUpload}
                                        isBrandRefDropActive={isBrandRefDropActive}
                                        brandScreenshotsUploading={brandScreenshotsUploading}
                                        maxScreenshotRefs={MAX_SCREENSHOT_REFS}
                                        openLightbox={openLightbox}
                                        text={text}
                                    />

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
                                                <div className="flex items-center justify-end gap-2">
                                                    {selectedApp && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAppForm(selectedApp)}
                                                            onDoubleClick={() => {
                                                                setAppFormOpen(false);
                                                                setEditingAppId(null);
                                                                setAppFormError(null);
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        >
                                                            <Pencil size={11} />
                                                            {text('edit')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openAppForm()}
                                                        disabled={!canAddApp}
                                                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                                                            canAddApp
                                                                ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                : 'border-white/10 text-indigo-200/40 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <Plus size={12} />
                                                        {text('add_app')}
                                                    </button>
                                                </div>

                                                {!visibleApps.length && !showBannedToggle ? (
                                                    <p className="mt-2 text-sm text-indigo-200/60">{text('no_apps_yet')}</p>
                                                ) : (
                                                    <AppPills
                                                        visibleApps={visibleApps}
                                                        selectedAppId={selectedAppId}
                                                        setSelectedAppId={setSelectedAppId}
                                                        isBusy={isBusy}
                                                        onBlockedAction={() => reportActionError(text('generation_in_progress'))}
                                                        isAppReorderMode={isAppReorderMode}
                                                        draggingAppId={draggingAppId}
                                                        setDraggingAppId={setDraggingAppId}
                                                        dragOverAppId={dragOverAppId}
                                                        setDragOverAppId={setDragOverAppId}
                                                        reorderBrandApps={reorderBrandApps}
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
                                                )}

                                                <AppFormCard
                                                    appFormOpen={appFormOpen}
                                                    appForm={appForm}
                                                    setAppForm={setAppForm}
                                                    appFormError={appFormError}
                                                    appFormLoading={appFormLoading}
                                                    editingAppId={editingAppId}
                                                    isEditingBanned={isEditingBanned}
                                                    selectedBrandSlug={selectedBrand?.slug}
                                                    appAliasPreview={appAliasPreview}
                                                    onSubmit={submitAppForm}
                                                    onCancel={() => setAppFormOpen(false)}
                                                    onDelete={handleDeleteApp}
                                                    onBan={handleBanApp}
                                                    onUnban={handleUnbanApp}
                                                    text={text}
                                                />

                                                {!selectedApp && (
                                                    <p className="mt-2 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
                                                )}
                                            </>
                                        }
                                                simulator={
                                                    <AppSimulatorSection
                                                        selectedApp={selectedApp}
                                                        selectedAppScreenshots={selectedAppScreenshots}
                                                        appScreenshotUrls={appScreenshotUrls}
                                                        handleReorderAppScreenshot={handleReorderAppScreenshot}
                                                        handleDeleteAppScreenshot={handleDeleteAppScreenshot}
                                                        handleScreenshotDragOver={handleScreenshotDragOver}
                                                        handleScreenshotDragLeave={handleScreenshotDragLeave}
                                                        handleScreenshotDrop={handleScreenshotDrop}
                                                        handleAppScreenshotsUpload={handleAppScreenshotsUpload}
                                                        isScreenshotDropActive={isScreenshotDropActive}
                                                        appScreenshotsUploading={appScreenshotsUploading}
                                                        canUploadAppScreenshots={canUploadAppScreenshots}
                                                        openLightbox={openLightbox}
                                                        text={text}
                                                    />
                                                }
                                                generation={
                                                    <AppGenerationSection
                                                        selectedApp={selectedApp}
                                                        brandIconReference={brandIconReference}
                                                        brandScreenshotReferences={brandScreenshotReferences}
                                                        selectedAppScreenshots={selectedAppScreenshots}
                                                        screenshotSets={screenshotSets}
                                                        activeScreenshotSetId={activeScreenshotSetId}
                                                        setActiveScreenshotSetId={setActiveScreenshotSetId}
                                                        handleAddScreenshotSet={handleAddScreenshotSet}
                                                        handleDeleteScreenshotSet={handleDeleteScreenshotSet}
                                                        assetExportStatus={exportStatus}
                                                        generatedIconSlots={generatedIconSlots}
                                                        enhancedIconSlots={enhancedIconSlots}
                                                        generatedScreenshotSlots={generatedScreenshotSlots}
                                                        enhancedScreenshotSlots={enhancedScreenshotSlots}
                                                        generatedPreviewUrls={generatedPreviewUrls}
                                                        generatedUrls={generatedUrls}
                                                        inflightScreenshotPreviewByKey={inflightScreenshotPreviewByKey}
                                                        generationCount={generationCount}
                                                        setGenerationCount={setGenerationCount}
                                                        generationSize={generationSize}
                                                        setGenerationSize={setGenerationSize}
                                                        iconGenerating={iconGenerating}
                                                        iconSlotGenerating={iconSlotGenerating}
                                                        enhanceIconSlotGenerating={enhanceIconSlotGenerating}
                                                        screenshotsGenerating={screenshotsGenerating}
                                                        slotGenerating={slotGenerating}
                                                        enhanceSlotGenerating={enhanceSlotGenerating}
                                                        canGenerateIcon={canGenerateIcon}
                                                        canGenerateScreenshots={canGenerateScreenshots}
                                                        targetSlotCount={targetSlotCount}
                                                        getSlotMapping={getSlotMapping}
                                                        updateSlotMapping={updateSlotMapping}
                                                        promptsByRefId={promptsByRefId}
                                                        setPrompt={setPrompt}
                                                        iconProviderId={iconProviderId}
                                                        setIconProviderId={setIconProviderId}
                                                        iconVariationsCount={iconVariationsCount}
                                                        setIconVariationsCount={setIconVariationsCount}
                                                        screenshotProviderId={screenshotProviderId}
                                                        setScreenshotProviderId={setScreenshotProviderId}
                                                        slotHeadlineBySlotIndex={slotHeadlineBySlotIndex}
                                                        slotHeadlinePosBySlotIndex={slotHeadlinePosBySlotIndex}
                                                        setSlotHeadline={setSlotHeadline}
                                                        setSlotHeadlinePosition={setSlotHeadlinePosition}
                                                        beginSlotHeadlineDrag={beginSlotHeadlineDrag}
                                                        beginSlotHeadlineTextEdit={beginSlotHeadlineTextEdit}
                                                        undoSlotHeadline={undoSlotHeadline}
                                                        redoSlotHeadline={redoSlotHeadline}
                                                        editAssetId={editAssetId}
                                                        editDrafts={editDrafts}
                                                        editSaving={editSaving}
                                                        beginEditAsset={beginEditAsset}
                                                        resetEditDraft={resetEditDraft}
                                                        updateLayer={updateLayer}
                                                        addLayer={addLayer}
                                                        removeLayer={removeLayer}
                                                        handleSaveEdit={handleSaveEdit}
                                                        handleGenerateIcon={handleGenerateIcon}
                                                        handleEnhanceIconSlot={handleEnhanceIconSlot}
                                                        handleGenerateAllScreenshots={handleGenerateAllScreenshots}
                                                        handleGenerateSlot={handleGenerateSlot}
                                                        handleEnhanceSlot={handleEnhanceSlot}
                                                        handleDownloadGeneratedAsset={handleDownloadGeneratedAsset}
                                                        handleDownloadAllScreenshots={handleDownloadAllScreenshots}
                                                        handleDeleteGeneratedAsset={handleDeleteGeneratedAsset}
                                                        getSystemPromptForSlot={getSystemPromptForSlot}
                                                        setSystemPromptOverride={setSystemPromptOverride}
                                                        resetSystemPromptOverride={resetSystemPromptOverride}
                                                        pickedIconAssetId={pickedIconAssetId}
                                                        pickedScreenshotAssetIdBySlotIndex={pickedScreenshotAssetIdBySlotIndex}
                                                        handlePickIcon={handlePickIcon}
                                                        handlePickScreenshot={handlePickScreenshot}
                                                        handleMarkAsCompleted={handleMarkAsCompleted}
                                                        handleBrandPromptChange={handleBrandPromptChange}
                                                        handleBrandPromptSave={handleBrandPromptSave}
                                                        handleAutoGrowInput={handleAutoGrowInput}
                                                        openLightbox={openLightbox}
                                                        text={text}
                                                        fonts={EDIT_FONTS}
                                                    />
                                                }
                                                endSections={
                                                    <>
                                                <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6 mx-6">
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('app_data_placeholder')}</p>
                                                    <div className="mt-3 space-y-2 text-xs text-indigo-200/70">
                                                        {[
                                                            'AppId',
                                                            'BundleID',
                                                            'Company Name',
                                                            'id_purchases',
                                                            'Apphud API URL',
                                                            'Privacy Policy',
                                                            'Term of Use',
                                                            'Support Form',
                                                            'Domain',
                                                            'Appstore Description',
                                                        ].map((item) => (
                                                            <div key={item} className="flex items-center justify-between border-b border-indigo-900/30 pb-2">
                                                                <span>{item}</span>
                                                                <span className="text-indigo-200/40">{text('placeholder')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>

                                                <DevFilesPanel
                                                    selectedApp={selectedApp}
                                                    githubRepoUrl={githubRepoUrl}
                                                    isCreatingRepo={isCreatingGithubRepo}
                                                    isDeletingRepo={isDeletingGithubRepo}
                                                    onCreateRepo={handleCreateGithubRepo}
                                                    onDeleteRepo={handleDeleteGithubRepo}
                                                    text={text}
                                                />
                                                    </>
                                                }
                                        />
                                    </div>
                                </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {selectedApp && !assetsCollapsed && (
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
                        onMarkCompleted={() => handleMarkAsCompleted({ pruneUnpicked: true })}
                        text={text}
                    />
                </div>
            )}
            <Lightbox lightbox={lightbox} onClose={closeLightbox} closeLabel={text('close')} />
            <GenerationQueueWidget
                jobs={generationJobs}
                onDismissJob={dismissJob}
                onClearFinished={clearFinished}
                onCancelJob={cancelGenerationJob}
            />
        </div>
    );
}

export default AppShell;
