import React from 'react';
import { Download, Trash2, ChevronDown, ChevronRight, Upload, ImagePlus, Loader2 } from 'lucide-react';
import type {
    AppItem,
    AppScreenshot,
    AppScreenshotSet,
    AppExportStatus,
    BrandReference,
    EditState,
    GeneratedAsset,
    ScreenshotProviderId,
    TextLayer,
} from '../../types/zefgen';
import { MAX_SCREENSHOT_VERSIONS } from '../../constants/zefgen';
import { TranslationKey } from '../../i18n';
import { EditPanel } from './EditPanel';
import { TextLayersCanvasOverlay } from './TextLayersCanvasOverlay';
import { ConfirmIconButton } from './ConfirmIconButton';
import { getCanonicalOriginalScreenshotSet } from '../../utils/screenshot-sets.js';

type GeneratedSlot = {
    slotIndex: number;
    versions: GeneratedAsset[];
};

type NoBrandStyleReferenceOption = {
    assetId: string;
    label: string;
};

export const IconGenerationModule = (props: Omit<AppGenerationSectionProps, 'mode'>) => (
    <AppGenerationSection {...props} mode="icon" />
);

export const ScreenshotPromptsModule = (props: Omit<AppGenerationSectionProps, 'mode'>) => (
    <AppGenerationSection {...props} mode="prompts" />
);

export const GeneratedScreenshotsModule = (props: Omit<AppGenerationSectionProps, 'mode'>) => (
    <AppGenerationSection {...props} mode="generated" />
);

type AppGenerationSectionProps = {
    selectedApp: AppItem | null;
    brandIconReference: BrandReference | null;
    brandScreenshotReferences: BrandReference[];
    selectedAppScreenshots: AppScreenshot[];
    screenshotSets: AppScreenshotSet[];
    activeScreenshotSetId: string | null;
    setActiveScreenshotSetId: (id: string | null) => void;
    handleAddScreenshotSet: () => void;
    handleDeleteScreenshotSet: (setId: string) => void;
    assetExportStatus: AppExportStatus | null;
    generatedIconSlots: GeneratedSlot[];
    enhancedIconSlots: GeneratedSlot[];
    generatedScreenshotSlots: GeneratedSlot[];
    enhancedScreenshotSlots: GeneratedSlot[];
    generatedPreviewUrls: Record<string, string>;
    generatedUrls: Record<string, string>;
    inflightScreenshotPreviewByKey: Record<string, string>;
    generationCount: number;
    setGenerationCount: (value: number) => void;
    generationSize: '6.5' | '6.9';
    setGenerationSize: (value: '6.5' | '6.9') => void;
    iconUploading: boolean;
    iconGenerating: boolean;
    iconSlotGenerating: number | null;
    enhanceIconSlotGenerating: number | null;
    screenshotsGenerating: boolean;
    slotGenerating: number | null;
    enhanceSlotGenerating: number | null;
    canGenerateIcon: boolean;
    canGenerateScreenshots: boolean;
    canAddBrandSlot?: boolean;
    targetSlotCount: number;
    noBrandStyleReferenceOptions: NoBrandStyleReferenceOption[];
    getSlotMapping: (slotIndex: number) => {
        slotMode: 'simulator' | 'brand';
        brandRefSource: 'screenshot_ref' | 'picked_export_icon' | null;
        brandRefId: string | null;
        simShotId: string | null;
        styleRefAssetId: string | null;
    };
    updateSlotMapping: (
        slotIndex: number,
        patch: {
            slotMode?: 'simulator' | 'brand';
            brandRefSource?: 'screenshot_ref' | 'picked_export_icon' | null;
            brandRefId?: string | null;
            simShotId?: string | null;
            styleRefAssetId?: string | null;
        }
    ) => void;
    promptsByRefId: Record<string, string>;
    setPrompt: (refId: string, value: string) => void;
    slotPromptBySlotIndex: Record<number, string>;
    setSlotPrompt: (slotIndex: number, value: string) => void;
    iconProviderId: ScreenshotProviderId;
    setIconProviderId: (value: ScreenshotProviderId) => void;
    iconVariationsCount: number;
    setIconVariationsCount: (value: number) => void;
    screenshotProviderId: ScreenshotProviderId;
    setScreenshotProviderId: (value: ScreenshotProviderId) => void;
    slotHeadlineBySlotIndex: Record<number, string>;
    slotHeadlinePosBySlotIndex: Record<number, { x: number; y: number }>;
    setSlotHeadline: (slotIndex: number, value: string, opts?: { pushHistory?: boolean }) => void;
    setSlotHeadlinePosition: (slotIndex: number, pos: { x: number; y: number }, opts?: { pushHistory?: boolean }) => void;
    beginSlotHeadlineDrag: (slotIndex: number) => void;
    beginSlotHeadlineTextEdit: (slotIndex: number) => void;
    undoSlotHeadline: (slotIndex: number) => void;
    redoSlotHeadline: (slotIndex: number) => void;
    editAssetId: string | null;
    editDrafts: Record<string, EditState>;
    editSaving: string | null;
    beginEditAsset: (asset: GeneratedAsset) => void;
    resetEditDraft: (asset: GeneratedAsset) => void;
    updateLayer: (assetId: string, layerId: string, patch: Partial<TextLayer>) => void;
    addLayer: (assetId: string) => void;
    removeLayer: (assetId: string, layerId: string) => void;
    handleSaveEdit: (assetId: string) => void;
    handleUploadCustomIconFiles: (files: File[]) => Promise<void>;
    handleGenerateIcon: () => void;
    handleEnhanceIconSlot: (payload: { slotIndex: number; base: { kind: 'icon' | 'icon_enhanced'; assetId: string }; enhancePrompt: string }) => void;
    handleAddBrandSlot?: () => void;
    handleGenerateAllScreenshots: () => void;
    handleGenerateSlot: (slotIndex: number) => void;
    handleEnhanceSlot: (payload: { slotIndex: number; base: { kind: 'screenshot' | 'screenshot_enhanced'; assetId: string }; enhancePrompt: string }) => void;
    handleDownloadGeneratedAsset: (asset: GeneratedAsset, filename: string) => void;
    handleDownloadAllScreenshots: () => void;
    handleDeleteGeneratedAsset: (asset: GeneratedAsset) => void;
    getIconSystemPrompt: () => { defaultPrompt: string; effectivePrompt: string; isOverridden: boolean };
    setIconSystemPromptOverride: (value: string) => void;
    resetIconSystemPromptOverride: () => void;
    getSystemPromptForSlot: (
        slotIndex: number,
        mode: 'generate' | 'enhance'
    ) => { defaultPrompt: string; effectivePrompt: string; isOverridden: boolean };
    getSystemPromptTemplateForSlot: (slotIndex: number) => 'ref_like' | 'same_style_like' | 'no_ref_like' | 'icon_palette_like' | 'empty';
    setSystemPromptTemplateForSlot: (
        slotIndex: number,
        value: 'ref_like' | 'same_style_like' | 'no_ref_like' | 'icon_palette_like' | 'empty'
    ) => void;
    setSystemPromptOverride: (slotIndex: number, mode: 'generate' | 'enhance', value: string) => void;
    resetSystemPromptOverride: (slotIndex: number, mode: 'generate' | 'enhance') => void;
    pickedIconAssetId: string | null;
    pickedScreenshotAssetIdBySlotIndex: Record<number, string | null>;
    handlePickIcon: (assetId: string) => void;
    handlePickScreenshot: (payload: { screenshotSetId: string; slotIndex: number; assetId: string }) => void;
    handleMarkAsCompleted: (opts?: { pruneUnpicked?: boolean }) => void;
    handleBrandPromptChange: (refId: string, value: string) => void;
    handleBrandPromptSave: (refId: string, value: string) => void;
    isNoBrandMode?: boolean;
    noBrandIconPromptValue?: string;
    handleNoBrandIconPromptChange?: (value: string) => void;
    handleNoBrandIconPromptSave?: (value: string) => void;
    handleNoBrandIconPromptAutogen?: () => void;
    noBrandIconPromptAutogenBusy?: boolean;
    canScreenshotPromptAutogen?: boolean;
    handleScreenshotPromptAutogen?: () => void;
    screenshotPromptAutogenBusy?: boolean;
    slotGenerateBlockedReasonBySlotIndex: Record<number, string | null>;
    generateAllBlockedReason: string | null;
    handleAutoGrowInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
    openLightbox: (
        src: string,
        alt: string,
        options?: { layers?: TextLayer[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => void;
    text: (key: TranslationKey) => string;
    fonts: string[];
    isReadOnly?: boolean;
    mode?: 'all' | 'icon' | 'prompts' | 'generated';
};

export const AppGenerationSection = ({
    mode = 'all',
    selectedApp,
    brandIconReference,
    brandScreenshotReferences,
    selectedAppScreenshots,
    screenshotSets,
    activeScreenshotSetId,
    setActiveScreenshotSetId,
    handleAddScreenshotSet,
    handleDeleteScreenshotSet,
    assetExportStatus,
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
    canAddBrandSlot = false,
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
    handleSaveEdit,
    handleUploadCustomIconFiles,
    handleGenerateIcon,
    handleEnhanceIconSlot,
    handleAddBrandSlot,
    handleGenerateAllScreenshots,
    handleGenerateSlot,
    handleEnhanceSlot,
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
    pickedIconAssetId,
    pickedScreenshotAssetIdBySlotIndex,
    handlePickIcon,
    handlePickScreenshot,
    handleMarkAsCompleted,
    handleBrandPromptChange,
    handleBrandPromptSave,
    isNoBrandMode = false,
    noBrandIconPromptValue = '',
    handleNoBrandIconPromptChange,
    handleNoBrandIconPromptSave,
    handleNoBrandIconPromptAutogen,
    noBrandIconPromptAutogenBusy = false,
    canScreenshotPromptAutogen = false,
    handleScreenshotPromptAutogen,
    screenshotPromptAutogenBusy = false,
    slotGenerateBlockedReasonBySlotIndex,
    generateAllBlockedReason,
    handleAutoGrowInput,
    openLightbox,
    text,
    fonts,
    isReadOnly = false,
}: AppGenerationSectionProps) => {
    const formatSlotIndex = (value: number) => String(value).padStart(2, '0');
    const [slotPrimaryTabByIndex, setSlotPrimaryTabByIndex] = React.useState<Record<string, 'generated' | 'enhanced'>>({});
    const [slotSelectedAssetIdByKey, setSlotSelectedAssetIdByKey] = React.useState<Record<string, string>>({});
    const [enhancePromptBySlotIndex, setEnhancePromptBySlotIndex] = React.useState<Record<number, string>>({});
    const [iconPrimaryTabBySlotIndex, setIconPrimaryTabBySlotIndex] = React.useState<Record<number, 'generated' | 'enhanced'>>({});
    const [iconSelectedAssetIdByKey, setIconSelectedAssetIdByKey] = React.useState<Record<string, string>>({});
    const [iconEnhancePromptBySlotIndex, setIconEnhancePromptBySlotIndex] = React.useState<Record<number, string>>({});
    const [iconSystemPromptOpen, setIconSystemPromptOpen] = React.useState(false);
    const [systemPromptOpenBySlotIndex, setSystemPromptOpenBySlotIndex] = React.useState<Record<number, boolean>>({});
    const [brokenPreviewByAssetId, setBrokenPreviewByAssetId] = React.useState<Record<string, boolean>>({});
    const [isIconDropActive, setIsIconDropActive] = React.useState(false);
    const iconUploadInputRef = React.useRef<HTMLInputElement | null>(null);
    const iconSystemPromptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const systemPromptTextareaRefBySlotIndex = React.useRef<Record<number, HTMLTextAreaElement | null>>({});
    const dragRef = React.useRef<{
        slotIndex: number;
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startX: number;
        startY: number;
        containerRect: DOMRect;
    } | null>(null);
    const markPreviewBroken = React.useCallback((assetId: string) => {
        setBrokenPreviewByAssetId((prev) => (prev[assetId] ? prev : { ...prev, [assetId]: true }));
    }, []);

    const syncUnlimitedTextarea = React.useCallback((el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.overflowY = 'hidden';
        el.style.resize = 'none';
        el.style.height = `${Math.max(0, el.scrollHeight)}px`;
    }, []);

    const onIconUploadInputChange = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files: File[] = event.target.files ? Array.from(event.target.files) : [];
            event.target.value = '';
            if (!files.length) return;
            await handleUploadCustomIconFiles(files);
        },
        [handleUploadCustomIconFiles]
    );
    const canUploadCustomIcons = Boolean(selectedApp) && !iconUploading && !iconGenerating && !isReadOnly;
    const onIconDrop = React.useCallback(
        async (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsIconDropActive(false);
            if (!canUploadCustomIcons) return;
            const files: File[] = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
            if (!files.length) return;
            await handleUploadCustomIconFiles(files);
        },
        [canUploadCustomIcons, handleUploadCustomIconFiles]
    );
    const onIconDragOver = React.useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            if (!canUploadCustomIcons) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsIconDropActive(true);
        },
        [canUploadCustomIcons]
    );
    const onIconDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        setIsIconDropActive(false);
    }, []);

    React.useEffect(() => {
        // When the system prompt expands, resize to show full contents immediately.
        for (const [slotKey, isOpen] of Object.entries(systemPromptOpenBySlotIndex)) {
            if (!isOpen) continue;
            const slotIndex = Number(slotKey);
            const el = systemPromptTextareaRefBySlotIndex.current[slotIndex] ?? null;
            if (el) syncUnlimitedTextarea(el);
        }
    }, [systemPromptOpenBySlotIndex, syncUnlimitedTextarea]);

    React.useEffect(() => {
        if (!iconSystemPromptOpen) return;
        if (iconSystemPromptTextareaRef.current) {
            syncUnlimitedTextarea(iconSystemPromptTextareaRef.current);
        }
    }, [iconSystemPromptOpen, syncUnlimitedTextarea]);

    const showHeader = mode === 'all';
    const showIcon = mode === 'all' || mode === 'icon';
    const showPrompts = mode === 'all' || mode === 'prompts';
    const showGenerated = mode === 'all' || mode === 'generated';
    const iconPromptValue = isNoBrandMode ? noBrandIconPromptValue : (brandIconReference?.prompt ?? '');
    const canEditIconPrompt = !isReadOnly && (isNoBrandMode ? Boolean(selectedApp) : Boolean(brandIconReference));
    const iconPromptPlaceholder = isNoBrandMode
        ? text('no_brand_icon_prompt_placeholder')
        : (brandIconReference ? text('prompt_placeholder') : text('upload_icon_to_add_prompt'));

    return (
        <>
            {showHeader && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="ui-btn-fit-ellipsis text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('generation')}
                        </p>
                        <p className="ui-btn-fit-ellipsis text-sm text-indigo-200/60">{text('generation_subtitle')}</p>
                    </div>
                </div>
            )}

            <div className={`${showHeader ? 'mt-5 ' : ''}space-y-4`}>
                {showIcon && (
                <div className="rounded-2xl bg-slate-900 ring-1 ring-white/5 p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="ui-btn-fit-ellipsis text-sm font-semibold text-white">{text('generate_icon')}</p>
                            <p className="ui-btn-fit-ellipsis text-xs text-indigo-200/60">{text('generate_icon_subtitle')}</p>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="space-y-4">
                            <div className="max-w-[520px] space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">
                                        {text('icon_prompt_label')}
                                    </label>
                                    {isNoBrandMode ? (
                                        <button
                                            type="button"
                                            onClick={handleNoBrandIconPromptAutogen}
                                            disabled={isReadOnly || !selectedApp || noBrandIconPromptAutogenBusy}
                                            className={`ui-btn-fit ui-btn-fit-dense inline-flex min-w-[170px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                                !isReadOnly && selectedApp && !noBrandIconPromptAutogenBusy
                                                    ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                                                    : 'border-white/10 text-indigo-200/40'
                                            }`}
                                        >
                                            {noBrandIconPromptAutogenBusy ? (
                                                <>
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>{text('no_brand_icon_prompt_autogen_loading')}</span>
                                                </>
                                            ) : (
                                                text('no_brand_icon_prompt_autogen')
                                            )}
                                        </button>
                                    ) : null}
                                </div>
                                {isNoBrandMode ? (
                                    <div className="h-4">
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] text-cyan-100/80 transition-opacity ${
                                                noBrandIconPromptAutogenBusy ? 'opacity-100' : 'opacity-0'
                                            }`}
                                        >
                                            <Loader2 size={10} className="animate-spin" />
                                            <span>{text('no_brand_icon_prompt_autogen_loading')}</span>
                                        </span>
                                    </div>
                                ) : null}
                                <div className="relative">
                                    <textarea
                                        value={iconPromptValue}
                                        onChange={(event) => {
                                            if (isNoBrandMode) {
                                                handleNoBrandIconPromptChange?.(event.target.value);
                                                return;
                                            }
                                            if (brandIconReference) {
                                                handleBrandPromptChange(brandIconReference.id, event.target.value);
                                            }
                                        }}
                                        onInput={handleAutoGrowInput}
                                        onBlur={(event) => {
                                            if (isNoBrandMode) {
                                                handleNoBrandIconPromptSave?.(event.target.value);
                                                return;
                                            }
                                            if (brandIconReference) {
                                                handleBrandPromptSave(brandIconReference.id, event.target.value);
                                            }
                                        }}
                                        placeholder={iconPromptPlaceholder}
                                        rows={3}
                                        disabled={!canEditIconPrompt}
                                        className="auto-grow w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                    />
                                    {isNoBrandMode && noBrandIconPromptAutogenBusy ? (
                                        <div className="pointer-events-none absolute inset-0 rounded-xl border border-cyan-300/25 bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent animate-pulse" />
                                    ) : null}
                                </div>

                                {(() => {
                                    const sys = getIconSystemPrompt();
                                    return (
                                        <div className="rounded-lg border border-indigo-500/15 bg-slate-950/40">
                                            <button
                                                type="button"
                                                onClick={() => setIconSystemPromptOpen((prev) => !prev)}
                                                className="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-semibold tracking-[0.12em] text-indigo-200/50">
                                                        {text('system_prompt_label')}
                                                    </span>
                                                    {sys.isOverridden && (
                                                        <span
                                                            className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-300/80"
                                                            title="Customized"
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-indigo-200/50">
                                                    {iconSystemPromptOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                            </button>

                                            {iconSystemPromptOpen && (
                                                <div className="border-t border-indigo-500/10 p-2 space-y-1.5">
                                                    <div className="flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={resetIconSystemPromptOverride}
                                                            disabled={isReadOnly || !selectedApp || !sys.isOverridden}
                                                            className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                selectedApp && sys.isOverridden
                                                                    ? 'border-indigo-400/30 text-indigo-100 hover:bg-indigo-500/10'
                                                                    : 'border-white/10 text-indigo-200/30'
                                                            }`}
                                                        >
                                                            {text('reset_to_default')}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={sys.effectivePrompt}
                                                        onChange={(event) => setIconSystemPromptOverride(event.target.value)}
                                                        onInput={(event) => syncUnlimitedTextarea(event.currentTarget)}
                                                        rows={1}
                                                        ref={(el) => {
                                                            iconSystemPromptTextareaRef.current = el;
                                                            if (el) syncUnlimitedTextarea(el);
                                                        }}
                                                        disabled={isReadOnly || !selectedApp}
                                                        className="w-full rounded-md border border-indigo-500/15 bg-slate-950/60 px-2 py-1 text-[10px] leading-snug text-indigo-50/90 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('provider')}</span>
                                        <select
                                            value={iconProviderId}
                                            onChange={(event) => setIconProviderId(event.target.value as ScreenshotProviderId)}
                                            className="ui-btn-fit rounded-full border border-indigo-500/20 bg-slate-950/60 px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            disabled={isReadOnly || !selectedApp || iconGenerating}
                                        >
                                            <option value="replicate:nano-banana-2">{text('provider_replicate_nano_banana_2')}</option>
                                            <option value="replicate:nano-banana-pro">{text('provider_replicate_nano_banana_pro')}</option>
                                            <option value="replicate:seedream-4">{text('provider_replicate_seedream_4')}</option>
                                            <option value="openai:gpt-image-1.5">{text('provider_openai_gpt_image_15')}</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('icon_variations')}</span>
                                        <select
                                            value={iconVariationsCount}
                                            onChange={(event) => setIconVariationsCount(Number(event.target.value))}
                                            className="ui-btn-fit rounded-full border border-indigo-500/20 bg-slate-950/60 px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            disabled={isReadOnly || !selectedApp || iconGenerating}
                                        >
                                            {[1, 2, 3].map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleGenerateIcon}
                                        disabled={isReadOnly || !canGenerateIcon || iconGenerating || iconUploading}
                                        className={`ui-btn-fit inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                            canGenerateIcon
                                                ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                : 'border-white/10 text-indigo-200/40'
                                        }`}
                                    >
                                        {iconGenerating ? text('generating') : text('generate_icon')}
                                    </button>
                                </div>
                            </div>

                    {(() => {
                        const iconSlotIndices = Array.from(
                            new Set([
                                ...generatedIconSlots.map((s) => s.slotIndex),
                                ...enhancedIconSlots.map((s) => s.slotIndex),
                            ])
                        ).sort((a, b) => b - a);

                        const pickLatest = (versions: GeneratedAsset[]) => {
                            if (!versions.length) return null;
                            return versions.reduce((prev, current) => {
                                const prevIndex = prev.version_index ?? 1;
                                const currentIndex = current.version_index ?? 1;
                                if (currentIndex !== prevIndex) return currentIndex > prevIndex ? current : prev;
                                const prevTime = new Date(prev.created_at || 0).getTime();
                                const currentTime = new Date(current.created_at || 0).getTime();
                                if (currentTime !== prevTime) return currentTime > prevTime ? current : prev;
                                return String(current.id) > String(prev.id) ? current : prev;
                            }, versions[0]);
                        };

                            const renderSlot = (slotIndex: number) => {
                            const genVersions = generatedIconSlots.find((s) => s.slotIndex === slotIndex)?.versions ?? [];
                            const enhVersions = enhancedIconSlots.find((s) => s.slotIndex === slotIndex)?.versions ?? [];

                            const defaultTab: 'generated' | 'enhanced' =
                                genVersions.length ? 'generated' : enhVersions.length ? 'enhanced' : 'generated';
                            const primaryTab = iconPrimaryTabBySlotIndex[slotIndex] ?? defaultTab;
                            const activeVersions = primaryTab === 'generated' ? genVersions : enhVersions;

                            const selectForTab = (tab: 'generated' | 'enhanced') => {
                                const versions = tab === 'generated' ? genVersions : enhVersions;
                                if (!versions.length) return null;
                                const key = `icon:${slotIndex}:${tab}`;
                                const wantedId = iconSelectedAssetIdByKey[key];
                                const found = wantedId ? versions.find((a) => a.id === wantedId) ?? null : null;
                                return found ?? pickLatest(versions);
                            };

                            const selectedGenerated = selectForTab('generated');
                            const selectedEnhanced = selectForTab('enhanced');
                            const selectedAsset = primaryTab === 'generated' ? selectedGenerated : selectedEnhanced;

                            const sorted = [...activeVersions].sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1));
                            const versionIndices = sorted.map((a) => a.version_index ?? 1);
                            const lastSix = versionIndices.slice(-6).reverse();
                            const activeByVersionIndex = new Map(activeVersions.map((a) => [a.version_index ?? 1, a]));
                            const enhancePrompt = iconEnhancePromptBySlotIndex[slotIndex] ?? '';
                            const baseForEnhance = selectedEnhanced ?? selectedGenerated;
                            const canEnhance = Boolean(selectedApp && baseForEnhance);
                            const isPicked = Boolean(selectedAsset && pickedIconAssetId === selectedAsset.id);

                            return (
                                <div
                                    key={slotIndex}
                                    className="min-w-0 w-full rounded-2xl border border-indigo-900/40 bg-slate-950/30 p-3 space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="ui-btn-fit-ellipsis text-sm font-semibold text-white">
                                                {slotIndex === 0 ? `Icon Legacy` : `Icon ${slotIndex}`}
                                            </p>
                                            <p className="ui-btn-fit-ellipsis text-[11px] text-indigo-200/50">
                                                {primaryTab === 'generated'
                                                    ? `${text('tab_generated')} ${genVersions.length}`
                                                    : `${text('tab_enhanced')} ${enhVersions.length}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setIconPrimaryTabBySlotIndex((prev) => ({ ...prev, [slotIndex]: 'generated' }))}
                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                                    primaryTab === 'generated'
                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                }`}
                                            >
                                                {text('tab_generated')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIconPrimaryTabBySlotIndex((prev) => ({ ...prev, [slotIndex]: 'enhanced' }))}
                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                                    primaryTab === 'enhanced'
                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                }`}
                                            >
                                                {text('tab_enhanced')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1">
                                        {lastSix.map((v) => {
                                            const asset = activeByVersionIndex.get(v) ?? null;
                                            const isSelected = Boolean(asset && selectedAsset?.id === asset.id);
                                            const key = `icon:${slotIndex}:${primaryTab}`;
                                            return (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    disabled={!asset}
                                                    onClick={() => asset && setIconSelectedAssetIdByKey((prev) => ({ ...prev, [key]: asset.id }))}
                                                    className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                                        !asset
                                                            ? 'border-white/10 text-indigo-200/30'
                                                            : isSelected
                                                                ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                                : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                    }`}
                                                >
                                                    v{v}
                                                </button>
                                            );
                                        })}
                                        {versionIndices.length > 6 && (
                                            <select
                                                value={selectedAsset?.version_index ?? ''}
                                                onChange={(event) => {
                                                    const v = Number(event.target.value);
                                                    const asset = activeByVersionIndex.get(v);
                                                    const key = `icon:${slotIndex}:${primaryTab}`;
                                                    if (asset) setIconSelectedAssetIdByKey((prev) => ({ ...prev, [key]: asset.id }));
                                                }}
                                                className="ui-btn-fit ui-btn-fit-dense ml-auto rounded-full border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                disabled={!activeVersions.length}
                                                aria-label={text('version')}
                                            >
                                                {[...versionIndices].reverse().map((v) => (
                                                    <option key={v} value={v}>
                                                        v{v}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div className="relative overflow-hidden rounded-xl border border-indigo-900/40 bg-slate-900/30 aspect-square">
                                        {selectedAsset && (generatedPreviewUrls[selectedAsset.id] || generatedUrls[selectedAsset.id]) ? (
                                            <img
                                                src={
                                                    generatedPreviewUrls[selectedAsset.id] && !brokenPreviewByAssetId[selectedAsset.id]
                                                        ? generatedPreviewUrls[selectedAsset.id]
                                                        : generatedUrls[selectedAsset.id]
                                                }
                                                alt={`Icon ${slotIndex}`}
                                                className="h-full w-full object-contain cursor-zoom-in"
                                                loading="lazy"
                                                decoding="async"
                                                fetchPriority="low"
                                                onError={() =>
                                                    selectedAsset &&
                                                    generatedPreviewUrls[selectedAsset.id] &&
                                                    markPreviewBroken(selectedAsset.id)
                                                }
                                                onClick={() => {
                                                    const fullSrc = generatedUrls[selectedAsset.id];
                                                    const previewSrc =
                                                        !brokenPreviewByAssetId[selectedAsset.id] && generatedPreviewUrls[selectedAsset.id]
                                                            ? generatedPreviewUrls[selectedAsset.id]
                                                            : fullSrc;
                                                    openLightbox(previewSrc, `Icon ${slotIndex}`, {
                                                        fullSrc: previewSrc && fullSrc && previewSrc !== fullSrc ? fullSrc : undefined,
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">
                                                {activeVersions.length ? text('loading') : text('no_generated_icon')}
                                            </span>
                                        )}
                                    </div>

                                    {primaryTab === 'enhanced' && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('enhance_prompt_label')}</label>
                                            <textarea
                                                value={enhancePrompt}
                                                onChange={(event) => setIconEnhancePromptBySlotIndex((prev) => ({ ...prev, [slotIndex]: event.target.value }))}
                                                onInput={handleAutoGrowInput}
                                                rows={2}
                                                className="auto-grow w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            />
                                            <p className="text-[10px] text-indigo-200/55">{text('icon_enhance_chain_hint')}</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!baseForEnhance) return;
                                                    handleEnhanceIconSlot({
                                                        slotIndex,
                                                        base: { kind: baseForEnhance.kind as any, assetId: baseForEnhance.id },
                                                        enhancePrompt,
                                                    });
                                                }}
                                                disabled={!canEnhance || enhanceIconSlotGenerating === slotIndex}
                                                className={`ui-btn-fit w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                                                    !canEnhance
                                                        ? 'border-white/10 text-indigo-200/40'
                                                        : 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                }`}
                                            >
                                                {enhanceIconSlotGenerating === slotIndex ? text('generating') : text('enhance_icon')}
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={!selectedAsset}
                                            onClick={() => selectedAsset && handlePickIcon(selectedAsset.id)}
                                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                !selectedAsset
                                                    ? 'border-white/10 text-indigo-200/40'
                                                    : isPicked
                                                        ? 'bg-emerald-500/15 border-emerald-300/40 text-emerald-50'
                                                        : 'border-white/10 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                            }`}
                                        >
                                            {isPicked ? text('picked') : text('pick_for_export')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!selectedAsset}
                                            onClick={() => selectedAsset && handleDownloadGeneratedAsset(
                                                selectedAsset,
                                                `icon-${slotIndex}-${primaryTab}-v${selectedAsset.version_index ?? 1}.jpg`
                                            )}
                                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                selectedAsset
                                                    ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                                    : 'border-white/10 text-indigo-200/40'
                                            }`}
                                        >
                                            {text('download')}
                                        </button>
                                        <ConfirmIconButton
                                            label={text('delete')}
                                            question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                                            confirmLabel={text('delete')}
                                            cancelLabel={text('cancel')}
                                            disabled={!selectedAsset}
                                            onConfirm={() => selectedAsset && handleDeleteGeneratedAsset(selectedAsset)}
                                            className="ml-auto"
                                        >
                                            <span
                                                className={`inline-flex items-center justify-center rounded-full border p-2 text-indigo-200/70 hover:text-white ${
                                                    selectedAsset ? 'border-white/10 hover:border-rose-400/40' : 'border-white/10 opacity-40'
                                                }`}
                                            >
                                                <Trash2 size={12} />
                                            </span>
                                        </ConfirmIconButton>
                                    </div>

                                    {primaryTab === 'generated' && (
                                        <button
                                            type="button"
                                            onClick={() => setIconPrimaryTabBySlotIndex((prev) => ({ ...prev, [slotIndex]: 'enhanced' }))}
                                            className="ui-btn-fit w-full rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                        >
                                            {text('enhance_icon')}
                                        </button>
                                    )}
                                </div>
    );
};

                        return iconSlotIndices.length ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {iconSlotIndices.map((slotIndex) => renderSlot(slotIndex))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-indigo-200/60">
                                {text('no_generated_icons')}
                            </div>
                        );
                    })()}
                        </div>
                        <div>
                            <div
                                onDragOver={onIconDragOver}
                                onDragLeave={onIconDragLeave}
                                onDrop={(event) => void onIconDrop(event)}
                                className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition ${
                                    isIconDropActive
                                        ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                        : 'border-indigo-900/50 bg-slate-900/30 text-indigo-200/70'
                                } ${!canUploadCustomIcons ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                                <ImagePlus size={22} />
                                <div className="text-xs font-semibold">{text('drop_icons_title')}</div>
                                <div className="text-[10px] text-indigo-200/60">{text('icon_upload_limit_short')}</div>
                                <label
                                    htmlFor="icon-custom-upload"
                                    className="ui-btn-fit inline-flex cursor-pointer items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/30"
                                >
                                    <Upload size={14} />
                                    {iconUploading ? text('uploading') : text('upload_icon')}
                                </label>
                                <input
                                    id="icon-custom-upload"
                                    ref={iconUploadInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    multiple
                                    className="hidden"
                                    onChange={(event) => void onIconUploadInputChange(event)}
                                    disabled={!canUploadCustomIcons}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {showPrompts && (
	                <div className="rounded-2xl bg-slate-900 ring-1 ring-white/5 p-4 space-y-4">
	                    <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div className="min-w-0">
	                            <p className="ui-btn-fit-ellipsis text-sm font-semibold text-white">{text('screenshot_prompt_label')}</p>
	                            <p className="ui-btn-fit-ellipsis text-xs text-indigo-200/60">{text('screenshot_prompt_hint')}</p>
	                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/60">
                                    {text('screenshot_set')}
                                </span>
                                <select
                                    data-testid="screenshot-set-select"
                                    value={activeScreenshotSetId ?? ''}
                                    onChange={(event) => setActiveScreenshotSetId(event.target.value || null)}
                                    className="min-w-[240px] rounded-xl border border-indigo-500/20 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                    disabled={isReadOnly || !selectedApp}
                                >
                                    {(screenshotSets || []).map((set) => (
                                        <option key={set.id} value={set.id}>
                                            {set.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    data-testid="screenshot-add-set-button"
                                    onClick={handleAddScreenshotSet}
                                    disabled={isReadOnly || !selectedApp}
                                    className={`ui-btn-fit rounded-xl border px-3 py-2 text-xs font-semibold ${
                                        selectedApp
                                            ? 'border-white/10 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                            : 'border-white/10 text-indigo-200/40'
                                    }`}
                                >
                                    {text('add_set')}
                                </button>

                                {(() => {
                                    const activeSet = (screenshotSets || []).find((s) => s.id === activeScreenshotSetId) ?? null;
                                    const canonicalOriginalSet = getCanonicalOriginalScreenshotSet(
                                        screenshotSets,
                                        text('set_original')
                                    );
                                    const isOriginal = !activeSet
                                        ? true
                                        : Boolean(
                                              canonicalOriginalSet &&
                                                  String(canonicalOriginalSet.id) === String(activeSet.id)
                                          );
                                    const canDelete = Boolean(selectedApp && activeSet && !isOriginal);
                                    const canDeleteWithMode = canDelete && !isReadOnly;
                                    if (!activeSet || isOriginal) return null;
                                    return (
                                        <ConfirmIconButton
                                            label={text('delete')}
                                            question={`${text('confirm_delete')} Delete set "${activeSet.name}" and all its screenshots?`}
                                            confirmLabel={text('delete')}
                                            cancelLabel={text('cancel')}
                                            disabled={!canDeleteWithMode}
                                            onConfirm={() => canDeleteWithMode && handleDeleteScreenshotSet(activeSet.id)}
                                        >
                                            <span
                                                className={`inline-flex items-center justify-center rounded-full border p-2 text-indigo-200/70 ${
                                                    canDeleteWithMode
                                                        ? 'border-white/10 hover:border-rose-400/40 hover:text-white'
                                                        : 'border-white/10 text-indigo-200/30'
                                                }`}
                                                title={text('delete')}
                                            >
                                                <Trash2 size={14} />
                                            </span>
                                        </ConfirmIconButton>
                                    );
                                })()}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('provider')}</span>
                                <select
                                    data-testid="screenshot-provider-select"
                                    value={screenshotProviderId}
                                    onChange={(event) => setScreenshotProviderId(event.target.value as ScreenshotProviderId)}
                                    className="ui-btn-fit rounded-full border border-indigo-500/20 bg-slate-950/60 px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                    disabled={isReadOnly || !selectedApp || screenshotsGenerating}
                                >
                                    <option value="replicate:nano-banana-2">{text('provider_replicate_nano_banana_2')}</option>
                                    <option value="replicate:nano-banana-pro">{text('provider_replicate_nano_banana_pro')}</option>
                                    <option value="replicate:seedream-4">{text('provider_replicate_seedream_4')}</option>
                                    <option value="openai:gpt-image-1.5">{text('provider_openai_gpt_image_15')}</option>
                                </select>
                            </div>
                            <button
                                type="button"
                                data-testid="screenshot-generate-all-button"
                                onClick={handleGenerateAllScreenshots}
                                disabled={isReadOnly || !canGenerateScreenshots || screenshotsGenerating}
                                title={generateAllBlockedReason || undefined}
                                className={`ui-btn-fit inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                    canGenerateScreenshots
                                        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                        : 'border-white/10 text-indigo-200/40'
                                }`}
                            >
                                {screenshotsGenerating ? text('generating') : text('generate_all')}
                            </button>
                        </div>
                    </div>
                    {generateAllBlockedReason ? (
                        <p data-testid="screenshot-generate-all-reason" className="text-[11px] text-amber-100/80">
                            {generateAllBlockedReason}
                        </p>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_count')}</label>
                            <select
                                value={generationCount}
                                onChange={(event) => setGenerationCount(Number(event.target.value))}
                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            >
                                {[3, 4, 5, 6].map((count) => (
                                    <option key={count} value={count}>
                                        {count}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_size')}</label>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {(['6.5', '6.9'] as const).map((sizeKey) => (
                                    <button
                                        key={sizeKey}
                                        type="button"
                                        onClick={() => setGenerationSize(sizeKey)}
                                        className={`ui-btn-fit rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                            generationSize === sizeKey
                                                ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                        }`}
                                    >
                                        {sizeKey === '6.5' ? text('size_65') : text('size_69')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    {isNoBrandMode ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-300/25 bg-cyan-950/20 px-2.5 py-2">
                            <p className="flex-1 text-[10px] text-cyan-100/80">
                                {text('no_brand_screenshot_mode_hint')}
                            </p>
                            <button
                                type="button"
                                data-testid="screenshot-prompt-autogen-button"
                                onClick={handleScreenshotPromptAutogen}
                                disabled={isReadOnly || !selectedApp || !canScreenshotPromptAutogen || screenshotPromptAutogenBusy}
                                className={`ui-btn-fit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold border ${
                                    !isReadOnly && selectedApp && canScreenshotPromptAutogen && !screenshotPromptAutogenBusy
                                        ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                                        : 'border-white/10 text-indigo-200/40'
                                }`}
                            >
                                {screenshotPromptAutogenBusy ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>{text('screenshot_prompt_autogen_loading')}</span>
                                    </>
                                ) : (
                                    text('screenshot_prompt_autogen')
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                data-testid="screenshot-add-brand-slot-button"
                                onClick={() => handleAddBrandSlot?.()}
                                disabled={isReadOnly || !handleAddBrandSlot || !canAddBrandSlot}
                                className={`ui-btn-fit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold border ${
                                    !isReadOnly && handleAddBrandSlot && canAddBrandSlot
                                        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                                        : 'border-white/10 text-indigo-200/40'
                                }`}
                            >
                                {text('add_brand_slot')}
                            </button>
                            <button
                                type="button"
                                data-testid="screenshot-prompt-autogen-button"
                                onClick={handleScreenshotPromptAutogen}
                                disabled={isReadOnly || !selectedApp || !canScreenshotPromptAutogen || screenshotPromptAutogenBusy}
                                className={`ui-btn-fit inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold border ${
                                    !isReadOnly && selectedApp && canScreenshotPromptAutogen && !screenshotPromptAutogenBusy
                                        ? 'border-indigo-300/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20'
                                        : 'border-white/10 text-indigo-200/40'
                                }`}
                            >
                                {screenshotPromptAutogenBusy ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>{text('screenshot_prompt_autogen_loading')}</span>
                                    </>
                                ) : (
                                    text('screenshot_prompt_autogen')
                                )}
                            </button>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: targetSlotCount }, (_, idx) => idx + 1).map((slotIndex) => {
                            const mapping = getSlotMapping(slotIndex);
                            const isBrandSlot = !isNoBrandMode && mapping.slotMode === 'brand';
                            const versions = generatedScreenshotSlots.find((slot) => slot.slotIndex === slotIndex)?.versions ?? [];
                            const atLimit = versions.length >= MAX_SCREENSHOT_VERSIONS;
                            const hasStyleReference = Boolean(mapping.styleRefAssetId);
                            const canUsePickedExportIcon = !isNoBrandMode && Boolean(pickedIconAssetId);
                            const hasPickedExportIconSelected =
                                !isNoBrandMode &&
                                mapping.brandRefSource === 'picked_export_icon' &&
                                canUsePickedExportIcon;
                            const promptRefId =
                                !isNoBrandMode && mapping.brandRefSource === 'screenshot_ref' ? mapping.brandRefId : null;
                            const hasBrandReferenceSelection = Boolean(hasPickedExportIconSelected || promptRefId);
                            const brandReferenceValue = hasPickedExportIconSelected
                                ? 'picked_export_icon'
                                : promptRefId
                                    ? `screenshot:${promptRefId}`
                                    : '';
                            const blockedReason = slotGenerateBlockedReasonBySlotIndex[slotIndex];
                            const template = getSystemPromptTemplateForSlot(slotIndex);
                            const compatibleTemplate =
                                hasStyleReference
                                    ? 'same_style_like'
                                    : hasPickedExportIconSelected
                                        ? 'icon_palette_like'
                                        : promptRefId
                                            ? 'ref_like'
                                            : 'no_ref_like';
                            const showReferencePrompt = !isNoBrandMode && Boolean(promptRefId);
                            const slotPromptValue = selectedApp ? slotPromptBySlotIndex[slotIndex] ?? '' : '';
                            const referencePromptValue =
                                selectedApp && promptRefId ? promptsByRefId[promptRefId] ?? '' : '';

                            return (
                                <div key={slotIndex} className="rounded-xl border border-indigo-500/20 bg-slate-950/40 p-2.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[11px] font-semibold text-white">{text('slot')} {slotIndex}</p>
                                            {isBrandSlot ? (
                                                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/80">
                                                    {text('brand_slot_badge')}
                                                </span>
                                            ) : null}
                                        </div>
                                        <span className="text-[10px] text-indigo-200/50">
                                            {versions.length}/{MAX_SCREENSHOT_VERSIONS}
                                        </span>
                                    </div>

                                    <div className={`grid gap-2 ${isNoBrandMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        {!isNoBrandMode && (
                                            <div className="min-w-0">
                                                <label className="text-[9px] leading-none text-indigo-200/50">{text('brand_reference_label')}</label>
                                                <select
                                                    data-testid={`screenshot-slot-brand-${slotIndex}`}
                                                    value={brandReferenceValue}
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value;
                                                        if (!nextValue) {
                                                            updateSlotMapping(slotIndex, {
                                                                brandRefSource: null,
                                                                brandRefId: null,
                                                            });
                                                            return;
                                                        }
                                                        if (nextValue === 'picked_export_icon') {
                                                            updateSlotMapping(slotIndex, {
                                                                brandRefSource: 'picked_export_icon',
                                                                brandRefId: null,
                                                            });
                                                            return;
                                                        }
                                                        if (nextValue.startsWith('screenshot:')) {
                                                            updateSlotMapping(slotIndex, {
                                                                brandRefSource: 'screenshot_ref',
                                                                brandRefId: nextValue.slice('screenshot:'.length) || null,
                                                            });
                                                        }
                                                    }}
                                                    disabled={isReadOnly || hasStyleReference}
                                                    className="mt-0.5 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-0.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                >
                                                    <option value="">{text('no_reference')}</option>
                                                    {brandScreenshotReferences.map((ref, refIndex) => (
                                                        <option key={ref.id} value={`screenshot:${ref.id}`}>
                                                            {text('reference_short')} {refIndex + 1}
                                                        </option>
                                                    ))}
                                                    {canUsePickedExportIcon ? (
                                                        <option value="picked_export_icon">
                                                            {text('picked_export_icon_reference')}
                                                        </option>
                                                    ) : null}
                                                </select>
                                            </div>
                                        )}
                                        {isBrandSlot ? (
                                            <div className="min-w-0 rounded-lg border border-emerald-400/15 bg-emerald-500/5 px-2 py-1.5">
                                                <p className="text-[9px] leading-none text-emerald-200/60">{text('brand_slot_source_label')}</p>
                                                <p className="mt-1 text-[10px] text-emerald-100/80">{text('brand_slot_no_sim_required')}</p>
                                            </div>
                                        ) : (
                                            <div className="min-w-0">
                                                <label className="text-[9px] leading-none text-indigo-200/50">
                                                    {isNoBrandMode ? text('no_brand_reference_free_label') : text('simulator_shot_label')}
                                                </label>
                                                <select
                                                    data-testid={`screenshot-slot-sim-${slotIndex}`}
                                                    value={mapping.simShotId ?? ''}
                                                    onChange={(event) => updateSlotMapping(slotIndex, { simShotId: event.target.value || null })}
                                                    className="mt-0.5 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-0.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                >
                                                    <option value="">{text('no_screenshots_yet')}</option>
                                                    {selectedAppScreenshots.map((shot, shotIndex) => (
                                                        <option key={shot.id} value={shot.id}>
                                                            {text('simulator_short')} {shotIndex + 1} ·{' '}
                                                            {shot.source_kind === 'runner' || shot.artifact_id
                                                                ? text('simulator_screenshot_source_runner')
                                                                : text('simulator_screenshot_source_manual')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <label className="text-[9px] leading-none text-indigo-200/50">
                                                {text('no_brand_style_reference_label')}
                                            </label>
                                            <select
                                                data-testid={`screenshot-slot-style-${slotIndex}`}
                                                value={mapping.styleRefAssetId ?? ''}
                                                onChange={(event) =>
                                                    updateSlotMapping(slotIndex, {
                                                        styleRefAssetId: event.target.value || null,
                                                    })
                                                }
                                                disabled={isReadOnly || hasBrandReferenceSelection}
                                                className="mt-0.5 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-0.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                            >
                                                <option value="">{text('no_brand_style_reference_none')}</option>
                                                {noBrandStyleReferenceOptions.map((option) => (
                                                    <option key={option.assetId} value={option.assetId}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {!isNoBrandMode && canUsePickedExportIcon ? (
                                        <p className="rounded-lg border border-emerald-400/15 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-100/80">
                                            {isBrandSlot ? text('brand_slot_icon_hint') : text('screenshot_slot_1_icon_hint')}
                                        </p>
                                    ) : null}

                                    <div className="space-y-1">
                                        <label className="text-[9px] leading-none text-indigo-200/50">
                                            {text('screenshot_slot_prompt_label')}
                                        </label>
                                        <textarea
                                            value={slotPromptValue}
                                            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                if (!selectedApp) return;
                                                setSlotPrompt(slotIndex, event.target.value);
                                            }}
                                            onInput={handleAutoGrowInput}
                                            data-testid={`screenshot-slot-prompt-${slotIndex}`}
                                            data-auto-grow-base="96"
                                            data-auto-grow-multiplier="8"
                                            placeholder={
                                                isNoBrandMode
                                                    ? text('no_brand_screenshot_prompt_placeholder')
                                                    : text('screenshot_slot_prompt_placeholder')
                                            }
                                            rows={4}
                                            disabled={isReadOnly || !selectedApp}
                                            className="auto-grow min-h-[96px] w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                        />
                                    </div>

                                    {showReferencePrompt ? (
                                        <div className="space-y-1">
                                            <label className="text-[9px] leading-none text-indigo-200/50">
                                                {text('screenshot_reference_prompt_label')}
                                            </label>
                                            <textarea
                                                value={referencePromptValue}
                                                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                    if (!selectedApp || !promptRefId) return;
                                                    setPrompt(promptRefId, event.target.value);
                                                }}
                                                onInput={handleAutoGrowInput}
                                                data-testid={`screenshot-slot-reference-prompt-${slotIndex}`}
                                                data-auto-grow-base="56"
                                                data-auto-grow-multiplier="6"
                                                placeholder={text('prompt_placeholder')}
                                                rows={2}
                                                disabled={isReadOnly || !selectedApp || !promptRefId}
                                                className="auto-grow min-h-[56px] w-full rounded-lg border border-indigo-500/15 bg-slate-950/50 px-2 py-1.5 text-[10px] text-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                            />
                                        </div>
                                    ) : null}

                                    {(() => {
                                        const sys = getSystemPromptForSlot(slotIndex, 'generate');
                                        const sysTemplate = getSystemPromptTemplateForSlot(slotIndex);
                                        const isOpen = Boolean(systemPromptOpenBySlotIndex[slotIndex]);
                                        return (
                                            <div className="rounded-lg border border-indigo-500/15 bg-slate-950/40">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSystemPromptOpenBySlotIndex((prev) => ({
                                                            ...prev,
                                                            [slotIndex]: !Boolean(prev[slotIndex]),
                                                        }))
                                                    }
                                                    className="w-full px-2 py-1.5 flex items-center justify-between gap-2 text-left"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-semibold tracking-[0.12em] text-indigo-200/50">
                                                            {text('system_prompt_label')}
                                                        </span>
                                                        {sys.isOverridden && (
                                                            <span
                                                                className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-300/80"
                                                                title="Customized"
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-indigo-200/50">
                                                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </span>
                                                </button>

                                                {isOpen && (
                                                    <div className="border-t border-indigo-500/10 p-2 space-y-1.5">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSystemPromptTemplateForSlot(slotIndex, compatibleTemplate)}
                                                                disabled={isReadOnly || !selectedApp || !activeScreenshotSetId}
                                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                    sysTemplate === compatibleTemplate
                                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                                }`}
                                                            >
                                                                {text(
                                                                    compatibleTemplate === 'ref_like'
                                                                        ? 'system_prompt_ref_like'
                                                                        : compatibleTemplate === 'same_style_like'
                                                                            ? 'system_prompt_samestyle_like'
                                                                            : compatibleTemplate === 'icon_palette_like'
                                                                                ? 'system_prompt_icon_palette_like'
                                                                                : 'system_prompt_noref_like'
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSystemPromptTemplateForSlot(slotIndex, 'empty')}
                                                                disabled={isReadOnly || !selectedApp || !activeScreenshotSetId}
                                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                    sysTemplate === 'empty'
                                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                                }`}
                                                            >
                                                                {text('system_prompt_empty')}
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => resetSystemPromptOverride(slotIndex, 'generate')}
                                                                disabled={
                                                                    isReadOnly ||
                                                                    !selectedApp ||
                                                                    !activeScreenshotSetId ||
                                                                    !sys.isOverridden
                                                                }
                                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                    selectedApp && activeScreenshotSetId && sys.isOverridden
                                                                        ? 'border-indigo-400/30 text-indigo-100 hover:bg-indigo-500/10'
                                                                        : 'border-white/10 text-indigo-200/30'
                                                                }`}
                                                            >
                                                                {text('reset_to_default')}
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            value={sys.effectivePrompt}
                                                            onChange={(event) =>
                                                                setSystemPromptOverride(slotIndex, 'generate', event.target.value)
                                                            }
                                                            onInput={(event) => syncUnlimitedTextarea(event.currentTarget)}
                                                            rows={1}
                                                            ref={(el) => {
                                                                systemPromptTextareaRefBySlotIndex.current[slotIndex] = el;
                                                                if (el) syncUnlimitedTextarea(el);
                                                            }}
                                                            disabled={isReadOnly || !selectedApp || !activeScreenshotSetId}
                                                            className="w-full rounded-md border border-indigo-500/15 bg-slate-950/60 px-2 py-1 text-[10px] leading-snug text-indigo-50/90 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <button
                                        type="button"
                                        data-testid={`screenshot-slot-generate-${slotIndex}`}
                                        onClick={() => handleGenerateSlot(slotIndex)}
                                        disabled={
                                            isReadOnly ||
                                            Boolean(blockedReason) ||
                                            screenshotsGenerating ||
                                            slotGenerating === slotIndex ||
                                            atLimit
                                        }
                                        title={blockedReason || undefined}
                                        className={`ui-btn-fit w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                                            blockedReason || atLimit
                                                ? 'border-white/10 text-indigo-200/40'
                                                : 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                        }`}
                                    >
                                        {slotGenerating === slotIndex ? text('generating') : text('generate_screen')}
                                    </button>
                                    {blockedReason ? (
                                        <p data-testid={`screenshot-slot-blocked-${slotIndex}`} className="text-[10px] text-amber-100/80">
                                            {blockedReason}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
	                    </div>
	                </div>
                )}

                {showGenerated && (
	                <div className="rounded-2xl bg-slate-900 ring-1 ring-white/5 p-4 space-y-4">
	                    <div className="flex items-center justify-between gap-3">
	                        <div className="min-w-0">
	                            <p className="ui-btn-fit-ellipsis text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generated_screenshots')}</p>
	                            <p className="ui-btn-fit-ellipsis text-sm text-indigo-200/60">{text('generated_screenshots_subtitle')}</p>
	                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadAllScreenshots}
                            disabled={!generatedScreenshotSlots.length}
                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                generatedScreenshotSlots.length
                                    ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                    : 'border-white/10 text-indigo-200/40'
                            }`}
                        >
                            {text('download_all')}
                        </button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                        {Array.from({ length: targetSlotCount }, (_, idx) => idx + 1).map((slotIndex) => {
                            const genVersions =
                                generatedScreenshotSlots.find((slot) => slot.slotIndex === slotIndex)?.versions ?? [];
                            const enhVersions =
                                enhancedScreenshotSlots.find((slot) => slot.slotIndex === slotIndex)?.versions ?? [];
                            const viewerScopeKey = `${activeScreenshotSetId ?? 'none'}:${slotIndex}`;
                            const pickedAssetId = pickedScreenshotAssetIdBySlotIndex[slotIndex];
                            const pickedGenerated = pickedAssetId
                                ? genVersions.find((asset) => asset.id === pickedAssetId) ?? null
                                : null;
                            const pickedEnhanced = pickedAssetId
                                ? enhVersions.find((asset) => asset.id === pickedAssetId) ?? null
                                : null;

                            const defaultTab: 'generated' | 'enhanced' =
                                pickedEnhanced
                                    ? 'enhanced'
                                    : pickedGenerated
                                        ? 'generated'
                                        : genVersions.length
                                            ? 'generated'
                                            : enhVersions.length
                                                ? 'enhanced'
                                                : 'generated';
                            const primaryTab = slotPrimaryTabByIndex[viewerScopeKey] ?? defaultTab;

                            const pickLatest = (versions: GeneratedAsset[]) => {
                                if (!versions.length) return null;
                                return versions.reduce((prev, current) => {
                                    const prevIndex = prev.version_index ?? 1;
                                    const currentIndex = current.version_index ?? 1;
                                    if (currentIndex !== prevIndex) return currentIndex > prevIndex ? current : prev;
                                    const prevTime = new Date(prev.created_at || 0).getTime();
                                    const currentTime = new Date(current.created_at || 0).getTime();
                                    if (currentTime !== prevTime) return currentTime > prevTime ? current : prev;
                                    return String(current.id) > String(prev.id) ? current : prev;
                                }, versions[0]);
                            };

                            const selectForTab = (tab: 'generated' | 'enhanced') => {
                                const versions = tab === 'generated' ? genVersions : enhVersions;
                                if (!versions.length) return null;
                                const key = `${viewerScopeKey}:${tab}`;
                                const wantedId = slotSelectedAssetIdByKey[key];
                                const found = wantedId ? versions.find((a) => a.id === wantedId) ?? null : null;
                                const picked = pickedAssetId ? versions.find((asset) => asset.id === pickedAssetId) ?? null : null;
                                return found ?? picked ?? pickLatest(versions);
                            };

                            const selectedGenerated = selectForTab('generated');
                            const selectedEnhanced = selectForTab('enhanced');
                            const selectedAsset = primaryTab === 'generated' ? selectedGenerated : selectedEnhanced;
                            const activeVersions = primaryTab === 'generated' ? genVersions : enhVersions;
                            const orderedActiveVersions = [...activeVersions].sort((a, b) => {
                                const versionDiff = (a.version_index ?? 1) - (b.version_index ?? 1);
                                if (versionDiff !== 0) return versionDiff;
                                const timeDiff =
                                    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                                if (timeDiff !== 0) return timeDiff;
                                return String(a.id).localeCompare(String(b.id));
                            });
                            const labelByAssetId = (() => {
                                const labels = new Map<string, string>();
                                const duplicateCounter = new Map<number, number>();
                                for (const asset of orderedActiveVersions) {
                                    const version = asset.version_index ?? 1;
                                    const seen = (duplicateCounter.get(version) ?? 0) + 1;
                                    duplicateCounter.set(version, seen);
                                    const suffix = seen > 1 ? String.fromCharCode(96 + Math.min(seen, 26)) : '';
                                    labels.set(asset.id, `v${version}${suffix}`);
                                }
                                return labels;
                            })();

                            const headlineText = slotHeadlineBySlotIndex[slotIndex] ?? '';
                            const headlinePos = slotHeadlinePosBySlotIndex[slotIndex] ?? { x: 50, y: 12 };
                            const enhancePrompt = enhancePromptBySlotIndex[slotIndex] ?? '';

                            const baseForEnhance = selectedEnhanced ?? selectedGenerated;
                            const enhancedAtLimit = enhVersions.length >= MAX_SCREENSHOT_VERSIONS;
                            const canEnhance = Boolean(selectedApp && baseForEnhance && !enhancedAtLimit);
                            const isPicked = Boolean(selectedAsset && pickedScreenshotAssetIdBySlotIndex[slotIndex] === selectedAsset.id);

                            return (
                                <div
                                    key={slotIndex}
                                    className="snap-start shrink-0 w-[240px] sm:w-[260px] rounded-2xl border border-indigo-900/40 bg-slate-950/30 p-3 space-y-3 outline-none focus:ring-2 focus:ring-indigo-400/30"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        const isMac = navigator.platform.toLowerCase().includes('mac');
                                        const mod = isMac ? event.metaKey : event.ctrlKey;
                                        if (!mod) return;
                                        const key = event.key.toLowerCase();
                                        if (key === 'z' && event.shiftKey) {
                                            event.preventDefault();
                                            redoSlotHeadline(slotIndex);
                                        } else if (key === 'z') {
                                            event.preventDefault();
                                            undoSlotHeadline(slotIndex);
                                        } else if (key === 'y') {
                                            event.preventDefault();
                                            redoSlotHeadline(slotIndex);
                                        }
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="ui-btn-fit-ellipsis text-sm font-semibold text-white">{text('slot')} {slotIndex}</p>
                                            <p className="ui-btn-fit-ellipsis text-[11px] text-indigo-200/50">
                                                {primaryTab === 'generated'
                                                    ? `${text('tab_generated')} ${genVersions.length}/${MAX_SCREENSHOT_VERSIONS}`
                                                    : `${text('tab_enhanced')} ${enhVersions.length}/${MAX_SCREENSHOT_VERSIONS}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setSlotPrimaryTabByIndex((prev) => ({ ...prev, [viewerScopeKey]: 'generated' }))}
                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                                    primaryTab === 'generated'
                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                }`}
                                            >
                                                {text('tab_generated')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSlotPrimaryTabByIndex((prev) => ({ ...prev, [viewerScopeKey]: 'enhanced' }))}
                                                className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                                    primaryTab === 'enhanced'
                                                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                        : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                }`}
                                            >
                                                {text('tab_enhanced')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {orderedActiveVersions.map((asset) => {
                                            const isSelected = selectedAsset?.id === asset.id;
                                            const key = `${viewerScopeKey}:${primaryTab}`;
                                            return (
                                                <button
                                                    key={asset.id}
                                                    type="button"
                                                    onClick={() => setSlotSelectedAssetIdByKey((prev) => ({ ...prev, [key]: asset.id }))}
                                                    className={`ui-btn-fit ui-btn-fit-dense rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                                        isSelected
                                                            ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                            : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                    }`}
                                                >
                                                    {labelByAssetId.get(asset.id) ?? `v${asset.version_index ?? 1}`}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {(() => {
                                        const fallbackSize = generationSize === '6.9' ? { w: 1320, h: 2868 } : { w: 1242, h: 2688 };
                                        const aspectW = selectedAsset?.width ?? fallbackSize.w;
                                        const aspectH = selectedAsset?.height ?? fallbackSize.h;
                                        const inflightKey = `${activeScreenshotSetId ?? 'none'}:${slotIndex}:${primaryTab}`;
                                        const inflightUrl = inflightScreenshotPreviewByKey[inflightKey] ?? '';
                                        const showInflight = Boolean(
                                            inflightUrl &&
                                                ((slotGenerating === slotIndex && primaryTab === 'generated') ||
                                                    (enhanceSlotGenerating === slotIndex && primaryTab === 'enhanced'))
                                        );
                                        const fullSrc = selectedAsset ? generatedUrls[selectedAsset.id] : '';
                                        const previewSrc = selectedAsset ? generatedPreviewUrls[selectedAsset.id] : '';
                                        const canUsePreview = Boolean(selectedAsset && previewSrc && !brokenPreviewByAssetId[selectedAsset.id]);
                                        const src = canUsePreview ? previewSrc : fullSrc;

                                        return (
                                            <div
                                                className="relative overflow-hidden rounded-xl border border-indigo-900/40 bg-slate-900/30"
                                                style={{ aspectRatio: `${aspectW} / ${aspectH}` }}
                                                data-screenshot-preview="true"
                                            >
                                                {showInflight ? (
                                                    <>
                                                        <img
                                                            src={inflightUrl}
                                                            alt={`${text('slot')} ${slotIndex}`}
                                                            className="h-full w-full object-contain cursor-zoom-in"
                                                            loading="eager"
                                                            decoding="async"
                                                            fetchPriority="high"
                                                            onClick={() => openLightbox(inflightUrl, `${text('slot')} ${slotIndex}`)}
                                                        />
                                                        <div className="absolute top-2 left-2 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-100/80">
                                                            {text('saving')}
                                                        </div>
                                                    </>
                                                ) : selectedAsset && (src || fullSrc) ? (
                                                    <img
                                                        key={`${selectedAsset.id}:${src || fullSrc}`}
                                                        data-testid={`screenshot-preview-image-${slotIndex}`}
                                                        src={src || fullSrc}
                                                        alt={`${text('slot')} ${slotIndex}`}
                                                        className="h-full w-full object-contain cursor-zoom-in"
                                                        loading="eager"
                                                        decoding="async"
                                                        fetchPriority="high"
                                                        onError={() => selectedAsset && previewSrc && markPreviewBroken(selectedAsset.id)}
                                                        onClick={(event) => {
                                                    const resolvedFullSrc = generatedUrls[selectedAsset.id];
                                                    const resolvedPreviewSrc =
                                                        !brokenPreviewByAssetId[selectedAsset.id] && generatedPreviewUrls[selectedAsset.id]
                                                            ? generatedPreviewUrls[selectedAsset.id]
                                                            : resolvedFullSrc;
                                                    const container = (event.currentTarget as HTMLElement).closest(
                                                        '[data-screenshot-preview]'
                                                    ) as HTMLElement | null;
                                                    const thumb = event.currentTarget as HTMLImageElement;
                                                    // Use the thumbnail's rendered size as the "base" so zoom previews scale text proportionally.
                                                    const baseWidth = thumb?.clientWidth || container?.clientWidth || undefined;
                                                    const baseHeight = thumb?.clientHeight || container?.clientHeight || undefined;
                                                    const rawLayers =
                                                        editDrafts[selectedAsset.id]?.layers ??
                                                        ((selectedAsset.edit_state as any)?.layers ?? []);
                                                    const layers = Array.isArray(rawLayers) ? rawLayers : [];

                                                    const headlineBase = layers[0] ?? {
                                                        id: 'headline',
                                                        text: headlineText,
                                                        font: 'Manrope',
                                                        size: 40,
                                                        color: '#ffffff',
                                                        x: headlinePos.x,
                                                        y: headlinePos.y,
                                                        rotation: 0,
                                                        align: 'center',
                                                        weight: 700,
                                                        shadow: { enabled: true, color: '#000000', blur: 14, offsetX: 0, offsetY: 8 },
                                                        outline: { enabled: false, color: '#000000', width: 3 },
                                                    };

                                                    const headlineLayer = {
                                                        ...headlineBase,
                                                        text: headlineText,
                                                        x: headlinePos.x,
                                                        y: headlinePos.y,
                                                    };

                                                    const hasHeadline = String(headlineText ?? '').replace(/\s/g, '').length > 0;
                                                    const overlayLayers = hasHeadline
                                                        ? [headlineLayer, ...layers.slice(1)]
                                                        : layers.slice(1);

                                                    openLightbox(
                                                        resolvedPreviewSrc,
                                                        `${text('slot')} ${slotIndex}`,
                                                        {
                                                            layers: overlayLayers,
                                                            fullSrc:
                                                                resolvedPreviewSrc &&
                                                                resolvedFullSrc &&
                                                                resolvedPreviewSrc !== resolvedFullSrc
                                                                    ? resolvedFullSrc
                                                                    : undefined,
                                                            overlayBaseWidth: baseWidth,
                                                            overlayBaseHeight: baseHeight,
                                                        }
                                                    );
                                                }}
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">
                                                        {activeVersions.length ? text('loading') : text('no_generated_screenshots')}
                                                    </span>
                                                )}

                                        {/* Live layer preview (so size/rotation/etc show immediately). */}
                                        {selectedAsset && (
                                            <div className="absolute inset-0 z-10 pointer-events-none">
                                                {(() => {
                                                    const rawLayers =
                                                        editDrafts[selectedAsset.id]?.layers ??
                                                        ((selectedAsset.edit_state as any)?.layers ?? []);
                                                    const layers = Array.isArray(rawLayers) ? rawLayers : [];

                                                    const headlineBase = layers[0] ?? {
                                                        id: 'headline',
                                                        text: headlineText,
                                                        font: 'Manrope',
                                                        size: 40,
                                                        color: '#ffffff',
                                                        x: headlinePos.x,
                                                        y: headlinePos.y,
                                                        rotation: 0,
                                                        align: 'center',
                                                        weight: 700,
                                                        shadow: { enabled: true, color: '#000000', blur: 14, offsetX: 0, offsetY: 8 },
                                                        outline: { enabled: false, color: '#000000', width: 3 },
                                                    };

                                                    const headlineLayer = {
                                                        ...headlineBase,
                                                        text: headlineText,
                                                        x: headlinePos.x,
                                                        y: headlinePos.y,
                                                    };

                                                    const hasHeadline = String(headlineText ?? '').replace(/\s/g, '').length > 0;
                                                    const previewLayers = hasHeadline
                                                        ? [headlineLayer, ...layers.slice(1)]
                                                        : layers.slice(1);

                                                    const translateForAlign = (align: any) => {
                                                        if (align === 'left') return 'translate(0, -50%)';
                                                        if (align === 'right') return 'translate(-100%, -50%)';
                                                        return 'translate(-50%, -50%)';
                                                    };

                                                    const headline = previewLayers[0] as any | undefined;
                                                    const headlineTextValue = String(headline?.text ?? '');
                                                    const hasHeadlineText = headlineTextValue.replace(/\\s/g, '').length > 0;

                                                    const x = typeof headline?.x === 'number' ? headline.x : 50;
                                                    const y = typeof headline?.y === 'number' ? headline.y : 12;
                                                    const rotation = typeof headline?.rotation === 'number' ? headline.rotation : 0;
                                                    const align = headline?.align ?? 'center';
                                                    const fontSize = Math.max(8, Number(headline?.size) || 40);
                                                    const weight = Math.max(100, Math.min(900, Number(headline?.weight) || 700));
                                                    const family = headline?.font || 'sans-serif';
                                                    const color = headline?.color || '#ffffff';

                                                    const sharedStyle: React.CSSProperties = {
                                                        position: 'absolute',
                                                        left: `${x}%`,
                                                        top: `${y}%`,
                                                        transform: `${translateForAlign(align)} rotate(${rotation}deg)`,
                                                        display: 'inline-block',
                                                        width: 'max-content',
                                                        minWidth: 'max-content',
                                                        maxWidth: 'none',
                                                        fontFamily: family,
                                                        fontSize: `${fontSize}px`,
                                                        fontWeight: weight as any,
                                                        color,
                                                        textAlign: align as any,
                                                        whiteSpace: 'pre',
                                                        overflowWrap: 'normal',
                                                        wordBreak: 'keep-all',
                                                        hyphens: 'none',
                                                        ...( { textWrap: 'nowrap', maxInlineSize: 'none' } as any ),
                                                        writingMode: 'horizontal-tb',
                                                        textOrientation: 'mixed',
                                                        lineHeight: 1.12,
                                                        textShadow: (() => {
                                                            const sh = headline?.shadow;
                                                            if (!sh?.enabled) return 'none';
                                                            const colorValue = sh.color || 'rgba(0,0,0,0.55)';
                                                            const blurValue = Math.max(0, Number(sh.blur) || 0);
                                                            const ox = Number(sh.offsetX) || 0;
                                                            const oy = Number(sh.offsetY) || 0;
                                                            return `${ox}px ${oy}px ${blurValue}px ${colorValue}`;
                                                        })(),
                                                        WebkitTextStrokeWidth: (() => {
                                                            const ol = headline?.outline;
                                                            if (!ol?.enabled) return '0px';
                                                            const w = Math.max(0, Number(ol.width) || 0);
                                                            return `${w}px`;
                                                        })(),
                                                        WebkitTextStrokeColor: (() => {
                                                            const ol = headline?.outline;
                                                            if (!ol?.enabled) return 'transparent';
                                                            return ol.color || '#000000';
                                                        })(),
                                                    };

                                                    return (
                                                        <>
                                                            <TextLayersCanvasOverlay layers={(previewLayers.slice(1) as any) || []} />
                                                            {hasHeadlineText && (
                                                                <div
                                                                    className="pointer-events-auto touch-none"
                                                                    style={{
                                                                        ...sharedStyle,
                                                                        padding: '10px 12px',
                                                                        borderRadius: '14px',
                                                                        border: '2px dotted rgba(199,210,254,0.55)',
                                                                    }}
                                                                    onPointerDown={(event) => {
                                                                        if (!event.isPrimary) return;
                                                                        const container = (event.currentTarget.closest('[data-screenshot-preview]') as HTMLElement) ?? null;
                                                                        if (!container) return;
                                                                        const rect = container.getBoundingClientRect();
                                                                        beginSlotHeadlineDrag(slotIndex);
                                                                        (event.currentTarget.closest('[tabindex=\"0\"]') as HTMLElement | null)?.focus?.();
                                                                        dragRef.current = {
                                                                            slotIndex,
                                                                            pointerId: event.pointerId,
                                                                            startClientX: event.clientX,
                                                                            startClientY: event.clientY,
                                                                            startX: headlinePos.x,
                                                                            startY: headlinePos.y,
                                                                            containerRect: rect,
                                                                        };
                                                                        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                    }}
                                                                    onPointerMove={(event) => {
                                                                        const drag = dragRef.current;
                                                                        if (!drag || drag.slotIndex !== slotIndex || drag.pointerId !== event.pointerId) return;
                                                                        const dx = event.clientX - drag.startClientX;
                                                                        const dy = event.clientY - drag.startClientY;
                                                                        const nextX = drag.startX + (dx / Math.max(1, drag.containerRect.width)) * 100;
                                                                        const nextY = drag.startY + (dy / Math.max(1, drag.containerRect.height)) * 100;
                                                                        const clamp = (v: number) => Math.max(0, Math.min(100, v));
                                                                        let nx = clamp(nextX);
                                                                        let ny = clamp(nextY);

                                                                        if (Math.abs(nx - 50) <= 2) nx = 50;
                                                                        if (ny <= 25 && Math.abs(ny - 12) <= 2) ny = 12;

                                                                        setSlotHeadlinePosition(slotIndex, { x: nx, y: ny }, { pushHistory: false });
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                    }}
                                                                    onPointerUp={(event) => {
                                                                        const drag = dragRef.current;
                                                                        if (drag && drag.slotIndex === slotIndex && drag.pointerId === event.pointerId) {
                                                                            dragRef.current = null;
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                        }
                                                                    }}
                                                                    onPointerCancel={(event) => {
                                                                        const drag = dragRef.current;
                                                                        if (drag && drag.slotIndex === slotIndex && drag.pointerId === event.pointerId) {
                                                                            dragRef.current = null;
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                        }
                                                                    }}
                                                                >
                                                                    {headlineTextValue}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                            </div>
                                        );
                                    })()}

                                    <div className="space-y-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('header_text_label')}</label>
                                            <span className="text-[10px] text-indigo-200/40">{text('header_text_hint')}</span>
                                        </div>
                                        <textarea
                                            value={headlineText}
                                            onFocus={() => beginSlotHeadlineTextEdit(slotIndex)}
                                            onChange={(event) => setSlotHeadline(slotIndex, event.target.value, { pushHistory: false })}
                                            onInput={handleAutoGrowInput}
                                            rows={2}
                                            className="auto-grow w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            data-testid={`screenshot-pick-${slotIndex}`}
                                            disabled={!selectedAsset || !activeScreenshotSetId}
                                            onClick={() =>
                                                selectedAsset &&
                                                activeScreenshotSetId &&
                                                handlePickScreenshot({
                                                    screenshotSetId: activeScreenshotSetId,
                                                    slotIndex,
                                                    assetId: selectedAsset.id,
                                                })
                                            }
                                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                !selectedAsset || !activeScreenshotSetId
                                                    ? 'border-white/10 text-indigo-200/40'
                                                    : isPicked
                                                        ? 'bg-emerald-500/15 border-emerald-300/40 text-emerald-50'
                                                        : 'border-white/10 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                            }`}
                                        >
                                            {isPicked ? text('picked') : text('pick_for_export')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!selectedAsset}
                                            onClick={() => selectedAsset && handleDownloadGeneratedAsset(
                                                selectedAsset,
                                                `${formatSlotIndex(slotIndex)}-${primaryTab === 'enhanced' ? 'enh' : 'gen'}-v${selectedAsset.version_index ?? 1}.jpg`
                                            )}
                                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                selectedAsset
                                                    ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                                    : 'border-white/10 text-indigo-200/40'
                                            }`}
                                        >
                                            {text('download_final')}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={!selectedAsset}
                                            onClick={() => selectedAsset && beginEditAsset(selectedAsset)}
                                            className={`ui-btn-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                selectedAsset
                                                    ? 'border-white/10 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                                    : 'border-white/10 text-indigo-200/40'
                                            }`}
                                        >
                                            {text('edit_layers')}
                                        </button>

                                        <ConfirmIconButton
                                            label={text('delete')}
                                            question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                                            confirmLabel={text('delete')}
                                            cancelLabel={text('cancel')}
                                            disabled={!selectedAsset}
                                            onConfirm={() => selectedAsset && handleDeleteGeneratedAsset(selectedAsset)}
                                        >
                                            <span
                                                className={`inline-flex items-center justify-center rounded-full border p-2 text-indigo-200/70 ${
                                                    selectedAsset
                                                        ? 'border-white/10 hover:border-indigo-400/40 hover:text-white'
                                                        : 'border-white/10 text-indigo-200/40'
                                                }`}
                                            >
                                                <Trash2 size={14} />
                                            </span>
                                        </ConfirmIconButton>
                                    </div>

                                    {selectedAsset && editAssetId === selectedAsset.id && editDrafts[selectedAsset.id] && (
                                        <EditPanel
                                            asset={selectedAsset}
                                            layers={editDrafts[selectedAsset.id].layers}
                                            fonts={fonts}
                                            editSaving={editSaving}
                                            updateLayer={updateLayer}
                                            addLayer={addLayer}
                                            removeLayer={removeLayer}
                                            handleSaveEdit={handleSaveEdit}
                                            resetEditDraft={resetEditDraft}
                                            text={text}
                                        />
                                    )}

                                    {primaryTab === 'enhanced' && (
                                        <div className="rounded-xl border border-indigo-500/15 bg-slate-950/40 p-2.5 space-y-2">
                                            <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('enhance_prompt_label')}</label>
                                            <textarea
                                                value={enhancePrompt}
                                                onChange={(event) =>
                                                    setEnhancePromptBySlotIndex((prev) => ({ ...prev, [slotIndex]: event.target.value }))
                                                }
                                                onInput={handleAutoGrowInput}
                                                rows={2}
                                                placeholder={text('prompt_placeholder')}
                                                className="auto-grow w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            />
                                            <button
                                                type="button"
                                                disabled={!canEnhance || enhanceSlotGenerating === slotIndex}
                                                onClick={() =>
                                                    baseForEnhance &&
                                                    handleEnhanceSlot({
                                                        slotIndex,
                                                        base: { kind: baseForEnhance.kind as any, assetId: baseForEnhance.id },
                                                        enhancePrompt,
                                                    })
                                                }
                                                className={`ui-btn-fit w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                                                    canEnhance
                                                        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                        : 'border-white/10 text-indigo-200/40'
                                                }`}
                                            >
                                                {enhanceSlotGenerating === slotIndex ? text('generating') : text('enhance_screenshot')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
	                    </div>
	                </div>
                )}
	            </div>
	        </>
	    );
};
