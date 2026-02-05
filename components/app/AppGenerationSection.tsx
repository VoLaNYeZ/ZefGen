import React from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { AppItem, AppScreenshot, BrandReference, EditState, GeneratedAsset, TextLayer } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';
import { EditPanel } from './EditPanel';

type GeneratedSlot = {
    slotIndex: number;
    versions: GeneratedAsset[];
};

type AppGenerationSectionProps = {
    selectedApp: AppItem | null;
    brandIconReference: BrandReference | null;
    brandScreenshotReferences: BrandReference[];
    selectedAppScreenshots: AppScreenshot[];
    generatedIcon: GeneratedAsset | null;
    generatedScreenshotSlots: GeneratedSlot[];
    generatedUrls: Record<string, string>;
    generationCount: number;
    setGenerationCount: (value: number) => void;
    generationSize: '6.5' | '6.9';
    setGenerationSize: (value: '6.5' | '6.9') => void;
    iconGenerating: boolean;
    screenshotsGenerating: boolean;
    slotGenerating: number | null;
    canGenerateIcon: boolean;
    canGenerateScreenshots: boolean;
    existingSlotCount: number;
    slotsToCreate: number[];
    targetSlotCount: number;
    getSlotMapping: (slotIndex: number) => { brandRefId: string | null; simShotId: string | null };
    updateSlotMapping: (slotIndex: number, patch: { brandRefId?: string | null; simShotId?: string | null }) => void;
    promptsByRefId: Record<string, string>;
    setPrompt: (refId: string, value: string) => void;
    editAssetId: string | null;
    editDrafts: Record<string, EditState>;
    editSaving: string | null;
    beginEditAsset: (asset: GeneratedAsset) => void;
    resetEditDraft: (asset: GeneratedAsset) => void;
    updateLayer: (assetId: string, layerId: string, patch: Partial<TextLayer>) => void;
    addLayer: (assetId: string) => void;
    removeLayer: (assetId: string, layerId: string) => void;
    handleSaveEdit: (assetId: string) => void;
    handleGenerateIcon: () => void;
    handleGenerateScreenshots: () => void;
    handleGenerateScreenshotVersion: (slotIndex: number) => void;
    handleDownloadGeneratedAsset: (asset: GeneratedAsset, filename: string) => void;
    handleDownloadAllScreenshots: () => void;
    handleDeleteGeneratedAsset: (asset: GeneratedAsset) => void;
    handleBrandPromptChange: (refId: string, value: string) => void;
    handleBrandPromptSave: (refId: string, value: string) => void;
    handleAutoGrowInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
    openLightbox: (src: string, alt: string) => void;
    text: (key: TranslationKey) => string;
    fonts: string[];
};

export const AppGenerationSection = ({
    selectedApp,
    brandIconReference,
    brandScreenshotReferences,
    selectedAppScreenshots,
    generatedIcon,
    generatedScreenshotSlots,
    generatedUrls,
    generationCount,
    setGenerationCount,
    generationSize,
    setGenerationSize,
    iconGenerating,
    screenshotsGenerating,
    slotGenerating,
    canGenerateIcon,
    canGenerateScreenshots,
    existingSlotCount,
    slotsToCreate,
    targetSlotCount,
    getSlotMapping,
    updateSlotMapping,
    promptsByRefId,
    setPrompt,
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
    handleBrandPromptChange,
    handleBrandPromptSave,
    handleAutoGrowInput,
    openLightbox,
    text,
    fonts,
}: AppGenerationSectionProps) => {
    const formatSlotIndex = (value: number) => String(value).padStart(2, '0');

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generation')}</p>
                    <p className="text-sm text-indigo-200/60">{text('generation_subtitle')}</p>
                </div>
                <div className="text-[11px] text-indigo-200/60">{text('versions_limit_note')}</div>
            </div>

            <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">{text('generate_icon')}</p>
                            <p className="text-xs text-indigo-200/60">{text('generate_icon_subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleGenerateIcon}
                            disabled={!canGenerateIcon || iconGenerating}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                canGenerateIcon
                                    ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                    : 'border-white/10 text-indigo-200/40'
                            }`}
                        >
                            {iconGenerating
                                ? text('generating')
                                : generatedIcon
                                    ? text('regenerate_icon')
                                    : text('generate_icon')}
                        </button>
                    </div>
                    <div className="max-w-[240px] space-y-3">
                        <div className="rounded-xl bg-slate-900/35 border border-indigo-400/20 p-2.5">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generated_icon')}</p>
                                {generatedIcon && (
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadGeneratedAsset(
                                            generatedIcon,
                                            `${selectedApp?.alias ?? 'app'}-icon-1024.jpg`
                                        )}
                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                        aria-label={text('download')}
                                    >
                                        <Download size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 mx-auto flex w-full items-center justify-center text-center aspect-square rounded-xl bg-slate-800/35 ring-1 ring-indigo-400/25">
                                {generatedIcon && generatedUrls[generatedIcon.id] ? (
                                    <img
                                        src={generatedUrls[generatedIcon.id]}
                                        alt={text('generated_icon')}
                                        className="max-h-[90%] max-w-[90%] object-contain cursor-zoom-in"
                                        onClick={() => openLightbox(generatedUrls[generatedIcon.id], text('generated_icon'))}
                                    />
                                ) : (
                                    <span className="text-xs text-indigo-200/60">{text('no_generated_icon')}</span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('icon_prompt_label')}</label>
                            <textarea
                                value={brandIconReference?.prompt ?? ''}
                                onChange={(event) => brandIconReference && handleBrandPromptChange(brandIconReference.id, event.target.value)}
                                onInput={handleAutoGrowInput}
                                onBlur={(event) => brandIconReference && handleBrandPromptSave(brandIconReference.id, event.target.value)}
                                placeholder={brandIconReference ? text('prompt_placeholder') : text('upload_icon_to_add_prompt')}
                                rows={3}
                                disabled={!brandIconReference}
                                className="auto-grow w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">{text('generate_screenshots')}</p>
                            <p className="text-xs text-indigo-200/60">{text('generate_screenshots_subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleGenerateScreenshots}
                            disabled={!canGenerateScreenshots || screenshotsGenerating}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                canGenerateScreenshots
                                    ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                    : 'border-white/10 text-indigo-200/40'
                            }`}
                        >
                            {screenshotsGenerating
                                ? text('generating')
                                : existingSlotCount
                                    ? text('add_slots')
                                    : text('create_slots')}
                        </button>
                    </div>

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
                                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
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

                    <div className="rounded-xl border border-indigo-900/40 bg-slate-900/30 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('slot_sources')}</p>
                            <span className="text-[10px] text-indigo-200/50">{text('slot_sources_hint')}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {Array.from({ length: targetSlotCount }, (_, idx) => idx + 1).map((slotIndex) => {
                                const mapping = getSlotMapping(slotIndex);
                                return (
                                    <div key={slotIndex} className="rounded-xl border border-indigo-500/20 bg-slate-950/40 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-white">{text('slot')} {slotIndex}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-indigo-200/60">{text('brand_reference_label')}</label>
                                            <select
                                                value={mapping.brandRefId ?? ''}
                                                onChange={(event) => updateSlotMapping(slotIndex, { brandRefId: event.target.value || null })}
                                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            >
                                                <option value="">{text('no_screenshot_refs')}</option>
                                                {brandScreenshotReferences.map((ref, refIndex) => (
                                                    <option key={ref.id} value={ref.id}>
                                                        {text('reference_short')} {refIndex + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-indigo-200/60">{text('simulator_shot_label')}</label>
                                            <select
                                                value={mapping.simShotId ?? ''}
                                                onChange={(event) => updateSlotMapping(slotIndex, { simShotId: event.target.value || null })}
                                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            >
                                                <option value="">{text('no_screenshots_yet')}</option>
                                                {selectedAppScreenshots.map((shot, shotIndex) => (
                                                    <option key={shot.id} value={shot.id}>
                                                        {text('simulator_short')} {shotIndex + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-indigo-200/60">
                            {slotsToCreate.length ? (
                                <span>{text('slots_to_create')}: {slotsToCreate.length}</span>
                            ) : (
                                <span>{text('all_slots_ready')}</span>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-indigo-200/40">{text('generation_notice')}</p>
                </div>

                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_prompt_label')}</p>
                        <span className="text-[10px] text-indigo-200/60">{text('screenshot_prompt_empty')}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {brandScreenshotReferences.map((ref, index) => (
                            <div key={ref.id} className="rounded-xl border border-indigo-500/20 bg-slate-950/40 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-indigo-200/60">{text('reference_short')} {index + 1}</span>
                                </div>
                                <textarea
                                    value={selectedApp ? promptsByRefId[ref.id] ?? '' : ''}
                                    onChange={(event) => selectedApp && setPrompt(ref.id, event.target.value)}
                                    onInput={handleAutoGrowInput}
                                    placeholder={text('prompt_placeholder')}
                                    rows={2}
                                    disabled={!selectedApp}
                                    className="auto-grow w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generated_screenshots')}</p>
                            <p className="text-sm text-indigo-200/60">{text('generated_screenshots_subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadAllScreenshots}
                            disabled={!generatedScreenshotSlots.length}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                generatedScreenshotSlots.length
                                    ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                    : 'border-white/10 text-indigo-200/40'
                            }`}
                        >
                            {text('download_all')}
                        </button>
                    </div>

                    {!generatedScreenshotSlots.length ? (
                        <p className="mt-4 text-sm text-indigo-200/60">{text('no_generated_screenshots')}</p>
                    ) : (
                        <div className="space-y-4">
                            {generatedScreenshotSlots.map((slot) => (
                                <div key={slot.slotIndex} className="rounded-2xl border border-indigo-900/40 bg-slate-950/30 p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{text('slot')} {slot.slotIndex}</p>
                                            <p className="text-xs text-indigo-200/60">{text('versions_limit_note')}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleGenerateScreenshotVersion(slot.slotIndex)}
                                            disabled={slotGenerating === slot.slotIndex}
                                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                                slotGenerating === slot.slotIndex
                                                    ? 'border-white/10 text-indigo-200/40'
                                                    : 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                            }`}
                                        >
                                            {slotGenerating === slot.slotIndex ? text('generating') : text('new_version')}
                                        </button>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {slot.versions.map((asset) => (
                                            <div key={asset.id} className="rounded-2xl border border-indigo-500/20 bg-slate-950/40 p-3 space-y-2">
                                                <div className="relative overflow-hidden rounded-xl border border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                                                    {generatedUrls[asset.id] ? (
                                                        <img
                                                            src={generatedUrls[asset.id]}
                                                            alt={`${text('slot')} ${slot.slotIndex}`}
                                                            className="h-full w-full object-cover cursor-zoom-in"
                                                            onClick={() => openLightbox(generatedUrls[asset.id], `${text('slot')} ${slot.slotIndex}`)}
                                                        />
                                                    ) : (
                                                        <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">{text('loading')}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-indigo-200/70">
                                                    <span>{text('version')} {asset.version_index ?? 1}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => beginEditAsset(asset)}
                                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        >
                                                            {text('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadGeneratedAsset(
                                                                asset,
                                                                `${formatSlotIndex(slot.slotIndex)}-v${asset.version_index ?? 1}.jpg`
                                                            )}
                                                            className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                            aria-label={text('download')}
                                                        >
                                                            <Download size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteGeneratedAsset(asset)}
                                                            className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                            aria-label={text('delete')}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {editAssetId === asset.id && editDrafts[asset.id] && (
                                                    <EditPanel
                                                        asset={asset}
                                                        layers={editDrafts[asset.id].layers}
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
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
