import type { ComponentProps, RefObject } from 'react';
import { Plus } from 'lucide-react';
import { EDIT_FONTS } from '../constants/zefgen';
import type { Brand } from '../types/zefgen';
import { AppSimulatorSection } from '../components/app/AppSimulatorSection';
import {
    GeneratedScreenshotsModule,
    IconGenerationModule,
    ScreenshotPromptsModule,
} from '../components/app/AppGenerationSection';
import { StepBlock } from '../components/app/StepBlock';

type GenerationModuleProps = ComponentProps<typeof IconGenerationModule>;
type SimulatorProps = ComponentProps<typeof AppSimulatorSection>;

export type UseWorkspaceGenerationViewModelParams = {
    activeScreenshotSetId: GenerationModuleProps['activeScreenshotSetId'];
    addLayer: GenerationModuleProps['addLayer'];
    appScreenshotUrls: SimulatorProps['appScreenshotUrls'];
    appScreenshotsUploading: SimulatorProps['appScreenshotsUploading'];
    assetExportStatus: GenerationModuleProps['assetExportStatus'];
    beginEditAsset: GenerationModuleProps['beginEditAsset'];
    beginSlotHeadlineDrag: GenerationModuleProps['beginSlotHeadlineDrag'];
    beginSlotHeadlineTextEdit: GenerationModuleProps['beginSlotHeadlineTextEdit'];
    brandIconReference: GenerationModuleProps['brandIconReference'];
    brandScreenshotReferences: GenerationModuleProps['brandScreenshotReferences'];
    canGenerateIcon: GenerationModuleProps['canGenerateIcon'];
    canGenerateScreenshots: GenerationModuleProps['canGenerateScreenshots'];
    canUploadAppScreenshots: SimulatorProps['canUploadAppScreenshots'];
    deliverablesAnchorRef: RefObject<HTMLDivElement | null>;
    editAssetId: GenerationModuleProps['editAssetId'];
    editDrafts: GenerationModuleProps['editDrafts'];
    editSaving: GenerationModuleProps['editSaving'];
    enhanceIconSlotGenerating: GenerationModuleProps['enhanceIconSlotGenerating'];
    enhanceSlotGenerating: GenerationModuleProps['enhanceSlotGenerating'];
    enhancedIconSlots: GenerationModuleProps['enhancedIconSlots'];
    enhancedScreenshotSlots: GenerationModuleProps['enhancedScreenshotSlots'];
    generatedIconSlots: GenerationModuleProps['generatedIconSlots'];
    generatedPreviewUrls: GenerationModuleProps['generatedPreviewUrls'];
    generatedScreenshotSlots: GenerationModuleProps['generatedScreenshotSlots'];
    generatedUrls: GenerationModuleProps['generatedUrls'];
    generationCount: GenerationModuleProps['generationCount'];
    generationSize: GenerationModuleProps['generationSize'];
    getIconSystemPrompt: GenerationModuleProps['getIconSystemPrompt'];
    getSlotMapping: GenerationModuleProps['getSlotMapping'];
    getSystemPromptForSlot: GenerationModuleProps['getSystemPromptForSlot'];
    getSystemPromptTemplateForSlot: GenerationModuleProps['getSystemPromptTemplateForSlot'];
    handleAddScreenshotSet: GenerationModuleProps['handleAddScreenshotSet'];
    handleAppScreenshotsUpload: SimulatorProps['handleAppScreenshotsUpload'];
    handleAutoGrowInput: GenerationModuleProps['handleAutoGrowInput'];
    handleBrandPromptChange: GenerationModuleProps['handleBrandPromptChange'];
    handleBrandPromptSave: GenerationModuleProps['handleBrandPromptSave'];
    handleDeleteAppScreenshot: SimulatorProps['handleDeleteAppScreenshot'];
    handleDeleteGeneratedAsset: GenerationModuleProps['handleDeleteGeneratedAsset'];
    handleDeleteScreenshotSet: GenerationModuleProps['handleDeleteScreenshotSet'];
    handleDownloadAllScreenshots: GenerationModuleProps['handleDownloadAllScreenshots'];
    handleDownloadGeneratedAsset: GenerationModuleProps['handleDownloadGeneratedAsset'];
    handleEnhanceIconSlot: GenerationModuleProps['handleEnhanceIconSlot'];
    handleEnhanceSlot: GenerationModuleProps['handleEnhanceSlot'];
    handleGenerateAllScreenshots: GenerationModuleProps['handleGenerateAllScreenshots'];
    handleGenerateIcon: GenerationModuleProps['handleGenerateIcon'];
    handleGenerateSlot: GenerationModuleProps['handleGenerateSlot'];
    handleMarkAsCompleted: GenerationModuleProps['handleMarkAsCompleted'];
    handleMoveNoBrandAppToBrand: () => void | Promise<void>;
    handleNoBrandIconPromptAutogen: GenerationModuleProps['handleNoBrandIconPromptAutogen'];
    handleNoBrandIconPromptChange: GenerationModuleProps['handleNoBrandIconPromptChange'];
    handleNoBrandIconPromptSave: GenerationModuleProps['handleNoBrandIconPromptSave'];
    handlePickIcon: GenerationModuleProps['handlePickIcon'];
    handlePickScreenshot: GenerationModuleProps['handlePickScreenshot'];
    handleReorderAppScreenshot: SimulatorProps['handleReorderAppScreenshot'];
    handleSaveEdit: GenerationModuleProps['handleSaveEdit'];
    handleScreenshotDragLeave: SimulatorProps['handleScreenshotDragLeave'];
    handleScreenshotDragOver: SimulatorProps['handleScreenshotDragOver'];
    handleScreenshotDrop: SimulatorProps['handleScreenshotDrop'];
    handleUploadCustomIconFiles: GenerationModuleProps['handleUploadCustomIconFiles'];
    iconGenerating: GenerationModuleProps['iconGenerating'];
    iconProviderId: GenerationModuleProps['iconProviderId'];
    iconSlotGenerating: GenerationModuleProps['iconSlotGenerating'];
    iconUploading: GenerationModuleProps['iconUploading'];
    iconVariationsCount: GenerationModuleProps['iconVariationsCount'];
    inflightScreenshotPreviewByKey: GenerationModuleProps['inflightScreenshotPreviewByKey'];
    isCurrentBrandReadOnly: boolean;
    isNoBrandMode: boolean;
    isScreenshotDropActive: SimulatorProps['isScreenshotDropActive'];
    moveTargetBrandId: string;
    moveToBrandLoading: boolean;
    noBrandIconPromptAutogenBusy: GenerationModuleProps['noBrandIconPromptAutogenBusy'];
    noBrandIconPromptValue: GenerationModuleProps['noBrandIconPromptValue'];
    noBrandStyleReferenceOptions: GenerationModuleProps['noBrandStyleReferenceOptions'];
    onCreateBrand: () => void;
    openLightbox: GenerationModuleProps['openLightbox'];
    pickedIconAssetId: GenerationModuleProps['pickedIconAssetId'];
    pickedScreenshotAssetIdBySlotIndex: GenerationModuleProps['pickedScreenshotAssetIdBySlotIndex'];
    promptsByRefId: GenerationModuleProps['promptsByRefId'];
    regularBrands: Brand[];
    removeLayer: GenerationModuleProps['removeLayer'];
    reportReadOnlyBlocked: () => void;
    resetEditDraft: GenerationModuleProps['resetEditDraft'];
    resetIconSystemPromptOverride: GenerationModuleProps['resetIconSystemPromptOverride'];
    resetSystemPromptOverride: GenerationModuleProps['resetSystemPromptOverride'];
    redoSlotHeadline: GenerationModuleProps['redoSlotHeadline'];
    runWriteAction: (action: () => void | Promise<void>) => Promise<void>;
    screenshotProviderId: GenerationModuleProps['screenshotProviderId'];
    screenshotSets: GenerationModuleProps['screenshotSets'];
    screenshotsGenerating: GenerationModuleProps['screenshotsGenerating'];
    selectedApp: GenerationModuleProps['selectedApp'];
    selectedAppScreenshots: GenerationModuleProps['selectedAppScreenshots'];
    setActiveScreenshotSetId: GenerationModuleProps['setActiveScreenshotSetId'];
    setGenerationCount: GenerationModuleProps['setGenerationCount'];
    setGenerationSize: GenerationModuleProps['setGenerationSize'];
    setIconProviderId: GenerationModuleProps['setIconProviderId'];
    setIconSystemPromptOverride: GenerationModuleProps['setIconSystemPromptOverride'];
    setIconVariationsCount: GenerationModuleProps['setIconVariationsCount'];
    setMoveTargetBrandId: (value: string) => void;
    setPrompt: GenerationModuleProps['setPrompt'];
    setScreenshotProviderId: GenerationModuleProps['setScreenshotProviderId'];
    setSlotHeadline: GenerationModuleProps['setSlotHeadline'];
    setSlotHeadlinePosition: GenerationModuleProps['setSlotHeadlinePosition'];
    setSlotPrompt: GenerationModuleProps['setSlotPrompt'];
    setSystemPromptOverride: GenerationModuleProps['setSystemPromptOverride'];
    setSystemPromptTemplateForSlot: GenerationModuleProps['setSystemPromptTemplateForSlot'];
    showNoAppsEmptyState: boolean;
    slotGenerating: GenerationModuleProps['slotGenerating'];
    slotHeadlineBySlotIndex: GenerationModuleProps['slotHeadlineBySlotIndex'];
    slotHeadlinePosBySlotIndex: GenerationModuleProps['slotHeadlinePosBySlotIndex'];
    slotPromptBySlotIndex: GenerationModuleProps['slotPromptBySlotIndex'];
    step8Done: boolean;
    step9Done: boolean;
    step10Done: boolean;
    targetSlotCount: GenerationModuleProps['targetSlotCount'];
    text: GenerationModuleProps['text'];
    undoSlotHeadline: GenerationModuleProps['undoSlotHeadline'];
    updateLayer: GenerationModuleProps['updateLayer'];
    updateSlotMapping: GenerationModuleProps['updateSlotMapping'];
};

export function useWorkspaceGenerationViewModel({
    activeScreenshotSetId,
    addLayer,
    appScreenshotUrls,
    appScreenshotsUploading,
    assetExportStatus,
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
    moveTargetBrandId,
    moveToBrandLoading,
    noBrandIconPromptAutogenBusy,
    noBrandIconPromptValue,
    noBrandStyleReferenceOptions,
    onCreateBrand,
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
}: UseWorkspaceGenerationViewModelParams) {
    const generationModuleProps: GenerationModuleProps = {
        selectedApp,
        brandIconReference,
        brandScreenshotReferences,
        selectedAppScreenshots,
        screenshotSets,
        activeScreenshotSetId,
        setActiveScreenshotSetId,
        handleAddScreenshotSet: () => runWriteAction(handleAddScreenshotSet),
        handleDeleteScreenshotSet: (setId) => runWriteAction(() => handleDeleteScreenshotSet(setId)),
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
        handleSaveEdit: (assetId) => runWriteAction(() => handleSaveEdit(assetId)),
        handleUploadCustomIconFiles: async (files) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            await handleUploadCustomIconFiles(files);
        },
        handleGenerateIcon: () => runWriteAction(handleGenerateIcon),
        handleEnhanceIconSlot: (payload) => runWriteAction(() => handleEnhanceIconSlot(payload)),
        handleGenerateAllScreenshots: () => runWriteAction(handleGenerateAllScreenshots),
        handleGenerateSlot: (slotIndex) => runWriteAction(() => handleGenerateSlot(slotIndex)),
        handleEnhanceSlot: (payload) => runWriteAction(() => handleEnhanceSlot(payload)),
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset: (asset) => runWriteAction(() => handleDeleteGeneratedAsset(asset)),
        getIconSystemPrompt,
        setIconSystemPromptOverride: (value) => runWriteAction(() => setIconSystemPromptOverride(value)),
        resetIconSystemPromptOverride: () => runWriteAction(resetIconSystemPromptOverride),
        getSystemPromptForSlot,
        getSystemPromptTemplateForSlot,
        setSystemPromptTemplateForSlot: (slotIndex, value) =>
            runWriteAction(() => setSystemPromptTemplateForSlot(slotIndex, value)),
        setSystemPromptOverride: (slotIndex, mode, value) =>
            runWriteAction(() => setSystemPromptOverride(slotIndex, mode, value)),
        resetSystemPromptOverride: (slotIndex, mode) =>
            runWriteAction(() => resetSystemPromptOverride(slotIndex, mode)),
        pickedIconAssetId,
        pickedScreenshotAssetIdBySlotIndex,
        handlePickIcon: (assetId) => runWriteAction(() => handlePickIcon(assetId)),
        handlePickScreenshot: (payload) => runWriteAction(() => handlePickScreenshot(payload)),
        handleMarkAsCompleted: (opts) => runWriteAction(() => handleMarkAsCompleted(opts)),
        handleBrandPromptChange,
        handleBrandPromptSave: (refId, value) => runWriteAction(() => handleBrandPromptSave(refId, value)),
        isNoBrandMode,
        noBrandIconPromptValue,
        handleNoBrandIconPromptChange,
        handleNoBrandIconPromptSave: (value) => runWriteAction(() => handleNoBrandIconPromptSave?.(value)),
        handleNoBrandIconPromptAutogen: () => runWriteAction(() => handleNoBrandIconPromptAutogen?.()),
        noBrandIconPromptAutogenBusy,
        handleAutoGrowInput,
        openLightbox,
        text,
        fonts: EDIT_FONTS,
        isReadOnly: isCurrentBrandReadOnly,
    };

    const generationSections = showNoAppsEmptyState
        ? { generation: null, endSections: null }
        : {
              generation: (
                  <div className="space-y-0">
                      <div ref={deliverablesAnchorRef} />

                      <StepBlock step={8} done={step8Done}>
                          <div data-testid="workspace-panel-simulator">
                              <AppSimulatorSection
                                  selectedApp={selectedApp}
                                  selectedAppScreenshots={selectedAppScreenshots}
                                  appScreenshotUrls={appScreenshotUrls}
                                  handleReorderAppScreenshot={(fromIndex, toIndex) => {
                                      void runWriteAction(() => handleReorderAppScreenshot(fromIndex, toIndex));
                                  }}
                                  handleDeleteAppScreenshot={(shot) => {
                                      void runWriteAction(() => handleDeleteAppScreenshot(shot));
                                  }}
                                  handleScreenshotDragOver={handleScreenshotDragOver}
                                  handleScreenshotDragLeave={handleScreenshotDragLeave}
                                  handleScreenshotDrop={(event) => {
                                      void runWriteAction(() => handleScreenshotDrop(event));
                                  }}
                                  handleAppScreenshotsUpload={(event) => {
                                      void runWriteAction(() => handleAppScreenshotsUpload(event));
                                  }}
                                  isScreenshotDropActive={isScreenshotDropActive}
                                  appScreenshotsUploading={appScreenshotsUploading}
                                  canUploadAppScreenshots={canUploadAppScreenshots}
                                  openLightbox={openLightbox}
                                  text={text}
                                  isReadOnly={isCurrentBrandReadOnly}
                              />
                          </div>
                      </StepBlock>

                      <StepBlock step={9} done={step9Done}>
                          <div data-testid="workspace-panel-screenshot-prompts">
                              <ScreenshotPromptsModule {...generationModuleProps} />
                          </div>
                      </StepBlock>

                      <StepBlock step={10} done={step10Done} isLast={!isNoBrandMode}>
                          <div data-testid="workspace-panel-generated-screenshots">
                              <GeneratedScreenshotsModule {...generationModuleProps} />
                          </div>
                      </StepBlock>
                  </div>
              ),
              endSections:
                  isNoBrandMode && Boolean(selectedApp) ? (
                      <StepBlock step={11} done={false} isLast>
                          <section
                              data-testid="workspace-panel-no-brand-move"
                              className="space-y-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-white/5"
                          >
                              <div>
                                  <p className="text-sm font-semibold text-white">{text('no_brand_step11_title')}</p>
                                  <p className="text-xs text-indigo-200/60">{text('no_brand_step11_subtitle')}</p>
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
                                          onClick={() => {
                                              void runWriteAction(handleMoveNoBrandAppToBrand);
                                          }}
                                          disabled={
                                              !moveTargetBrandId || moveToBrandLoading || isCurrentBrandReadOnly
                                          }
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
                                          onClick={onCreateBrand}
                                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25"
                                      >
                                          <Plus size={12} />
                                          {text('new_brand')}
                                      </button>
                                  </div>
                              )}
                          </section>
                      </StepBlock>
                  ) : null,
          };

    return {
        generationModuleProps,
        generationSections,
    };
}
