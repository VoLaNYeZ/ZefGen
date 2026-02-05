import React from 'react';
import { GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import type { BrandReference } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';

type BrandReferencesPanelProps = {
    brandScreenshotReferences: BrandReference[];
    brandRefUrls: Record<string, string>;
    dragOverBrandRefId: string | null;
    draggingBrandRefId: string | null;
    setDraggingBrandRefId: (value: string | null) => void;
    setDragOverBrandRefId: (value: string | null) => void;
    handleReorderBrandReference: (fromIndex: number, toIndex: number) => void;
    handleDeleteBrandReference: (ref: BrandReference) => void;
    handleBrandReferenceDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandReferenceDragLeave: () => void;
    handleBrandReferenceDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandScreenshotUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isBrandRefDropActive: boolean;
    brandScreenshotsUploading: boolean;
    maxScreenshotRefs: number;
    openLightbox: (src: string, alt: string) => void;
    text: (key: TranslationKey) => string;
};

export const BrandReferencesPanel = ({
    brandScreenshotReferences,
    brandRefUrls,
    dragOverBrandRefId,
    draggingBrandRefId,
    setDraggingBrandRefId,
    setDragOverBrandRefId,
    handleReorderBrandReference,
    handleDeleteBrandReference,
    handleBrandReferenceDragOver,
    handleBrandReferenceDragLeave,
    handleBrandReferenceDrop,
    handleBrandScreenshotUpload,
    isBrandRefDropActive,
    brandScreenshotsUploading,
    maxScreenshotRefs,
    openLightbox,
    text,
}: BrandReferencesPanelProps) => {
    return (
        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_26px_70px_-60px_rgba(15,23,42,0.9)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_references')}</p>
                    <h3 className="text-xl font-semibold text-white">{text('reference_library')}</h3>
                </div>
                <div className="text-[11px] text-indigo-200/60">
                    {brandScreenshotReferences.length}/{maxScreenshotRefs}
                </div>
            </div>

            <div className="mt-4">
                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_references')}</p>
                        <span className="text-[10px] text-indigo-200/60">
                            {brandScreenshotReferences.length}/{maxScreenshotRefs}
                        </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                            {brandScreenshotReferences.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-indigo-900/40 p-4 text-xs text-indigo-200/60">
                                    {text('no_screenshot_refs')}
                                </div>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-6">
                                    {brandScreenshotReferences.map((ref, index) => {
                                        const isDragTarget = dragOverBrandRefId === ref.id && draggingBrandRefId !== ref.id;
                                        return (
                                            <div
                                                key={ref.id}
                                                draggable
                                                onDragStart={(event) => {
                                                    event.dataTransfer.effectAllowed = 'move';
                                                    event.dataTransfer.setData('text/plain', ref.id);
                                                    setDraggingBrandRefId(ref.id);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggingBrandRefId(null);
                                                    setDragOverBrandRefId(null);
                                                }}
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    setDragOverBrandRefId(ref.id);
                                                }}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    const draggedId = event.dataTransfer.getData('text/plain');
                                                    const fromIndex = brandScreenshotReferences.findIndex((item) => item.id === draggedId);
                                                    const toIndex = brandScreenshotReferences.findIndex((item) => item.id === ref.id);
                                                    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                                                        handleReorderBrandReference(fromIndex, toIndex);
                                                    }
                                                    setDraggingBrandRefId(null);
                                                    setDragOverBrandRefId(null);
                                                }}
                                                className={`mx-auto w-full max-w-[110px] rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-1.5 space-y-1.5 cursor-grab active:cursor-grabbing ${
                                                    isDragTarget ? 'ring-indigo-400/60 bg-indigo-500/10' : ''
                                                }`}
                                            >
                                                <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                                                    {brandRefUrls[ref.id] ? (
                                                        <img
                                                            src={brandRefUrls[ref.id]}
                                                            alt={text('screenshot_references')}
                                                            className="h-full w-full object-cover cursor-zoom-in"
                                                            loading="lazy"
                                                            decoding="async"
                                                            onClick={() => openLightbox(brandRefUrls[ref.id], text('screenshot_references'))}
                                                        />
                                                    ) : (
                                                        <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">{text('loading')}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-indigo-200/50">
                                                    <div className="inline-flex items-center gap-1">
                                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                                                            {index + 1}
                                                        </span>
                                                        <GripVertical size={12} />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBrandReference(ref)}
                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        aria-label={text('delete')}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div>
                            <div
                                onDragOver={handleBrandReferenceDragOver}
                                onDragLeave={handleBrandReferenceDragLeave}
                                onDrop={handleBrandReferenceDrop}
                                className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition ${
                                    isBrandRefDropActive
                                        ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                        : 'border-indigo-900/50 bg-slate-900/30 text-indigo-200/70'
                                } ${brandScreenshotReferences.length >= maxScreenshotRefs ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                                <ImagePlus size={22} />
                                <div className="text-xs font-semibold">{text('drop_references_title')}</div>
                                <div className="text-[10px] text-indigo-200/60">{text('reference_limit_short')}</div>
                                <label
                                    htmlFor="brand-screenshot-upload"
                                    className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30 cursor-pointer"
                                >
                                    {brandScreenshotsUploading ? text('uploading') : text('upload_references')}
                                </label>
                                <input
                                    id="brand-screenshot-upload"
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    multiple
                                    className="hidden"
                                    onChange={handleBrandScreenshotUpload}
                                    disabled={brandScreenshotReferences.length >= maxScreenshotRefs || brandScreenshotsUploading}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
