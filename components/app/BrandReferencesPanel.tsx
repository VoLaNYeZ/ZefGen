import React from 'react';
import { ChevronDown, GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import type { BrandReference } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';
import { SortableGrid, useSortableTile } from './dnd/sortable-grid';
import { ConfirmIconButton } from './ConfirmIconButton';

type BrandReferencesPanelProps = {
    brandId: string;
    brandScreenshotReferences: BrandReference[];
    brandRefUrls: Record<string, string>;
    handleReorderBrandReference: (fromIndex: number, toIndex: number) => void;
    handleDeleteBrandReference: (ref: BrandReference) => void;
    handleBrandReferenceDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandReferenceDragLeave: () => void;
    handleBrandReferenceDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandScreenshotUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isBrandRefDropActive: boolean;
    brandScreenshotsUploading: boolean;
    maxScreenshotRefs: number;
    openLightbox: (
        src: string,
        alt: string,
        options?: { layers?: any[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => void;
    text: (key: TranslationKey) => string;
};

export const BrandReferencesPanel = ({
    brandId,
    brandScreenshotReferences,
    brandRefUrls,
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
    const libraryStorageKey = React.useMemo(() => `zefgen.brandReferenceLibraryCollapsed.${brandId}`, [brandId]);
    const [libraryCollapsedPref, setLibraryCollapsedPref] = React.useState<'0' | '1' | null>(() => {
        try {
            const raw = window.localStorage.getItem(libraryStorageKey);
            return raw === '1' || raw === '0' ? raw : null;
        } catch {
            return null;
        }
    });

    // Default behavior:
    // - if user has an explicit pref: use it
    // - else: auto-collapse when refs exist
    const libraryCollapsed =
        libraryCollapsedPref === '1'
            ? true
            : libraryCollapsedPref === '0'
              ? false
              : brandScreenshotReferences.length > 0;
    const isAutoCollapsed = libraryCollapsed && libraryCollapsedPref === null;

    const [renderLibraryBody, setRenderLibraryBody] = React.useState(() => !libraryCollapsed);

    // Keep body mounted for a smooth close only when the user explicitly collapsed it.
    React.useEffect(() => {
        if (!libraryCollapsed) {
            setRenderLibraryBody(true);
            return;
        }

        // If we're auto-collapsing (no pref), unmount immediately to avoid eager <img> loads.
        if (libraryCollapsedPref === null) {
            setRenderLibraryBody(false);
            return;
        }

        const timer = window.setTimeout(() => setRenderLibraryBody(false), 220);
        return () => window.clearTimeout(timer);
    }, [libraryCollapsed, libraryCollapsedPref]);

    const toggleLibraryCollapsed = () => {
        const nextCollapsed = !libraryCollapsed;
        // Ensure body is present before expanding so the open animation reveals real content.
        if (!nextCollapsed) setRenderLibraryBody(true);
        setLibraryCollapsedPref(nextCollapsed ? '1' : '0');
        try {
            window.localStorage.setItem(libraryStorageKey, nextCollapsed ? '1' : '0');
        } catch {
            // ignore
        }
    };

    const refById = React.useMemo(() => {
        const map = new Map<string, BrandReference>();
        brandScreenshotReferences.forEach((ref) => map.set(ref.id, ref));
        return map;
    }, [brandScreenshotReferences]);

    const orderedIds = React.useMemo(
        () => brandScreenshotReferences.map((ref) => ref.id),
        [brandScreenshotReferences]
    );

    return (
        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_26px_70px_-60px_rgba(15,23,42,0.9)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    {!libraryCollapsed && (
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_references')}</p>
                    )}
                    <h3 className="text-xl font-semibold text-white">{text('reference_library')}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {!libraryCollapsed && (
                        <div className="text-[11px] text-indigo-200/60">
                            {brandScreenshotReferences.length}/{maxScreenshotRefs}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={toggleLibraryCollapsed}
                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                        aria-label={libraryCollapsed ? text('show_references') : text('hide_references')}
                        title={libraryCollapsed ? text('show_references') : text('hide_references')}
                    >
                        <ChevronDown size={14} className={`transition ${libraryCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                </div>
            </div>

            <div
                className={`overflow-hidden transition-[max-height,opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[max-height,opacity,transform] ${
                    libraryCollapsed ? 'max-h-0 opacity-0 -translate-y-1 pointer-events-none' : 'max-h-[1400px] opacity-100 translate-y-0'
                }`}
            >
                {renderLibraryBody && !isAutoCollapsed ? (
                    <div className="mt-4">
                        <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_references')}</p>
                                    <span className="text-[10px] text-indigo-200/60">
                                        {brandScreenshotReferences.length}/{maxScreenshotRefs}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="brand-screenshot-upload"
                                        className={`inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/35 hover:bg-indigo-500/25 cursor-pointer ${
                                            brandScreenshotReferences.length >= maxScreenshotRefs || brandScreenshotsUploading
                                                ? 'opacity-60 pointer-events-none'
                                                : ''
                                        }`}
                                    >
                                        {brandScreenshotsUploading ? text('uploading') : text('upload_references')}
                                    </label>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <div>
                                {brandScreenshotReferences.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-indigo-900/40 p-4 text-xs text-indigo-200/60">
                                        {text('no_screenshot_refs')}
                                    </div>
                                ) : (
                                    <SortableGrid
                                        ids={orderedIds}
                                        onCommitMove={({ fromIndex, toIndex }) => handleReorderBrandReference(fromIndex, toIndex)}
                                        renderOverlay={(activeId) => {
                                            const ref = refById.get(activeId);
                                            if (!ref) return null;
                                            const url = brandRefUrls[ref.id];
                                            return (
                                                <div className="w-[110px] rounded-2xl bg-slate-900/65 ring-2 ring-indigo-400/40 p-1.5 space-y-1.5 shadow-[0_20px_60px_-30px_rgba(99,102,241,0.55)] pointer-events-none">
                                                    <div className="relative overflow-hidden rounded-xl border border-indigo-400/30 bg-slate-900/40 aspect-[9/19]">
                                                        {url ? (
                                                            <img
                                                                src={url}
                                                                alt={text('screenshot_references')}
                                                                className="h-full w-full object-cover"
                                                                draggable={false}
                                                            />
                                                        ) : (
                                                            <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/70">
                                                                {text('loading')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    >
                                        {(previewIds) => (
                                            <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-6">
                                                {previewIds.map((id, index) => {
                                                    const ref = refById.get(id);
                                                    if (!ref) return null;
                                                    return (
                                                        <SortableBrandRefTile
                                                            key={ref.id}
                                                            id={ref.id}
                                                            index={index}
                                                            refItem={ref}
                                                            url={brandRefUrls[ref.id]}
                                                            onDelete={handleDeleteBrandReference}
                                                            openLightbox={openLightbox}
                                                            text={text}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </SortableGrid>
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
                ) : null}
            </div>
        </section>
    );
};

function SortableBrandRefTile({
    id,
    index,
    refItem,
    url,
    onDelete,
    openLightbox,
    text,
}: {
    id: string;
    index: number;
    refItem: BrandReference;
    url: string | undefined;
    onDelete: (ref: BrandReference) => void;
    openLightbox: (
        src: string,
        alt: string,
        options?: { layers?: any[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => void;
    text: (key: TranslationKey) => string;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, style } = useSortableTile(id);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="mx-auto w-full max-w-[110px] rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-1.5 space-y-1.5"
        >
            <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                {url ? (
                    <img
                        src={url}
                        alt={text('screenshot_references')}
                        className="h-full w-full object-cover cursor-zoom-in select-none"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onClick={() => openLightbox(url, text('screenshot_references'))}
                    />
                ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">
                        {text('loading')}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-indigo-200/50">
                <div className="inline-flex items-center gap-1">
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                        {index + 1}
                    </span>
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        className="touch-none appearance-none bg-transparent border-0 inline-flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md p-0.5 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                        aria-label={text('drag_to_reorder')}
                    >
                        <GripVertical size={12} />
                    </button>
                </div>
                <ConfirmIconButton
                    label={text('delete')}
                    question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                    confirmLabel={text('delete')}
                    cancelLabel={text('cancel')}
                    onConfirm={() => onDelete(refItem)}
                >
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white">
                        <Trash2 size={12} />
                    </span>
                </ConfirmIconButton>
            </div>
        </div>
    );
}
