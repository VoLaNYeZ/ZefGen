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
import { Sidebar } from './Sidebar';
import { BrandReferencesPanel } from './BrandReferencesPanel';
import { AppFolder } from './AppFolder';
import { AppPills } from './AppPills';
import { AppFormCard } from './AppFormCard';
import { AppSimulatorSection } from './AppSimulatorSection';
import { AppGenerationSection } from './AppGenerationSection';
import { Lightbox } from './Lightbox';

type AppShellProps = {
    session: Session;
};
export function AppShell({ session }: AppShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lang, setLang] = useState<'en' | 'ru'>('en');
    const text = useCallback((key: TranslationKey) => t(lang, key), [lang]);

    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [dataError, setDataError] = useState<string | null>(null);
    const [hasParsedRoute, setHasParsedRoute] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [logoVariantIndex, setLogoVariantIndex] = useState(() => Math.floor(Math.random() * 6));
    const logoWord = 'ZEFGEN';
    const logoContainerRef = useRef<HTMLDivElement>(null);
    const [logoFontReady, setLogoFontReady] = useState(false);
    const [gooeyDebug, _setGooeyDebug] = useState(false);
    const [appSwitching, setAppSwitching] = useState(false);
    const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
    const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

    const reportActionError = useCallback((message: string) => {
        setActionError(message);
        setTimeout(() => {
            setActionError((prev) => (prev === message ? null : prev));
        }, 6000);
    }, []);

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
        draggingBrandRefId,
        dragOverBrandRefId,
        setDraggingBrandRefId,
        setDragOverBrandRefId,
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
        draggingShotId,
        dragOverShotId,
        setDraggingShotId,
        setDragOverShotId,
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
        generatedUrls,
        loading: generatedAssetsLoading,
        refresh: refreshGeneratedAssets,
        generatedIcon,
        generatedScreenshotSlots,
        iconGenerating,
        screenshotsGenerating,
        slotGenerating,
        generationCount,
        setGenerationCount,
        generationSize,
        setGenerationSize,
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
        handleGenerateScreenshots,
        handleGenerateScreenshotVersion,
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset,
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
        brandRefUrls,
        getSlotMapping,
        text,
        reportError: reportActionError,
        onDataError: setDataError,
    });

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

    const openLightbox = (src: string, alt: string) => {
        setLightbox({ src, alt });
    };

    const closeLightbox = () => {
        setLightbox(null);
    };

    const handleAutoGrowInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
        syncAutoGrowTextarea(event.currentTarget);
    };

    const isTabMotionDisabled = isAppReorderMode || isAppPillPanning || Boolean(draggingAppId);
    const isBrandEditing = Boolean(selectedBrand && brandFormOpen && editingBrandId === selectedBrand.id);
    const hasBrandIcon = Boolean(brandIconReference && brandRefUrls[brandIconReference.id]);

    
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
                selectedBrandId={selectedBrandId}
                brandIconUrls={brandIconUrls}
                brandFormOpen={brandFormOpen}
                brandForm={brandForm}
                brandFormError={brandFormError}
                brandFormLoading={brandFormLoading}
                editingBrandId={editingBrandId}
                brandSlugPreview={brandSlugPreview}
                dataLoading={dataLoading}
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
                <div className="flex-1 overflow-y-auto">
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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBrandReference(brandIconReference)}
                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        aria-label={text('delete')}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
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
                                    <BrandReferencesPanel
                                        brandScreenshotReferences={brandScreenshotReferences}
                                        brandRefUrls={brandRefUrls}
                                        dragOverBrandRefId={dragOverBrandRefId}
                                        draggingBrandRefId={draggingBrandRefId}
                                        setDraggingBrandRefId={setDraggingBrandRefId}
                                        setDragOverBrandRefId={setDragOverBrandRefId}
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
                                                dragOverShotId={dragOverShotId}
                                                draggingShotId={draggingShotId}
                                                setDraggingShotId={setDraggingShotId}
                                                setDragOverShotId={setDragOverShotId}
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
                                                generatedIcon={generatedIcon}
                                                generatedScreenshotSlots={generatedScreenshotSlots}
                                                generatedUrls={generatedUrls}
                                                generationCount={generationCount}
                                                setGenerationCount={setGenerationCount}
                                                generationSize={generationSize}
                                                setGenerationSize={setGenerationSize}
                                                iconGenerating={iconGenerating}
                                                screenshotsGenerating={screenshotsGenerating}
                                                slotGenerating={slotGenerating}
                                                canGenerateIcon={canGenerateIcon}
                                                canGenerateScreenshots={canGenerateScreenshots}
                                                existingSlotCount={existingSlotCount}
                                                slotsToCreate={slotsToCreate}
                                                targetSlotCount={targetSlotCount}
                                                getSlotMapping={getSlotMapping}
                                                updateSlotMapping={updateSlotMapping}
                                                promptsByRefId={promptsByRefId}
                                                setPrompt={setPrompt}
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
                                                handleGenerateScreenshots={handleGenerateScreenshots}
                                                handleGenerateScreenshotVersion={handleGenerateScreenshotVersion}
                                                handleDownloadGeneratedAsset={handleDownloadGeneratedAsset}
                                                handleDownloadAllScreenshots={handleDownloadAllScreenshots}
                                                handleDeleteGeneratedAsset={handleDeleteGeneratedAsset}
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

                                                <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6 mx-6">
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('dev_files_placeholder')}</p>
                                                    <p className="mt-3 text-sm text-indigo-200/60">{text('dev_files_subtitle')}</p>
                                                </section>
                                            </>
                                        }
                                    />
                                </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Lightbox lightbox={lightbox} onClose={closeLightbox} closeLabel={text('close')} />
        </div>
    );
}

export default AppShell;

