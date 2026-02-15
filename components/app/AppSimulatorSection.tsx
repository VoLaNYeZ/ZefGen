import React from 'react';
import { GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import type { AppItem, AppScreenshot } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';
import { SortableGrid, useSortableTile } from './dnd/sortable-grid';
import { ConfirmIconButton } from './ConfirmIconButton';

type AppSimulatorSectionProps = {
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    appScreenshotUrls: Record<string, string>;
    handleReorderAppScreenshot: (fromIndex: number, toIndex: number) => void;
    handleDeleteAppScreenshot: (shot: AppScreenshot) => void;
    handleScreenshotDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    handleScreenshotDragLeave: () => void;
    handleScreenshotDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    handleAppScreenshotsUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isScreenshotDropActive: boolean;
    appScreenshotsUploading: boolean;
    canUploadAppScreenshots: boolean;
    openLightbox: (
        src: string,
        alt: string,
        options?: { layers?: any[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => void;
    text: (key: TranslationKey) => string;
};

export const AppSimulatorSection = ({
    selectedApp,
    selectedAppScreenshots,
    appScreenshotUrls,
    handleReorderAppScreenshot,
    handleDeleteAppScreenshot,
    handleScreenshotDragOver,
    handleScreenshotDragLeave,
    handleScreenshotDrop,
    handleAppScreenshotsUpload,
    isScreenshotDropActive,
    appScreenshotsUploading,
    canUploadAppScreenshots,
    openLightbox,
    text,
}: AppSimulatorSectionProps) => {
    const shotById = React.useMemo(() => {
        const map = new Map<string, AppScreenshot>();
        selectedAppScreenshots.forEach((shot) => map.set(shot.id, shot));
        return map;
    }, [selectedAppScreenshots]);

    const orderedIds = React.useMemo(() => selectedAppScreenshots.map((shot) => shot.id), [selectedAppScreenshots]);

    return (
        <div className="rounded-2xl bg-slate-900 ring-1 ring-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('simulator_screenshots')}</p>
                    <p className="text-xs text-indigo-200/60">{text('simulator_screenshots_subtitle')}</p>
                </div>
                <span className="text-[11px] text-indigo-200/60">{text('drag_to_reorder')}</span>
            </div>

            {!selectedApp ? (
                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                        {selectedAppScreenshots.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-indigo-900/40 p-4 text-sm text-indigo-200/60">
                                {text('no_screenshots_yet')}
                            </div>
                        ) : (
                            <SortableGrid
                                ids={orderedIds}
                                onCommitMove={({ fromIndex, toIndex }) => handleReorderAppScreenshot(fromIndex, toIndex)}
                                renderOverlay={(activeId) => {
                                    const shot = shotById.get(activeId);
                                    if (!shot) return null;
                                    const url = appScreenshotUrls[shot.id];
                                    return (
                                        <div className="w-[110px] rounded-2xl bg-slate-900/65 ring-2 ring-indigo-400/40 p-1.5 space-y-1.5 shadow-[0_20px_60px_-30px_rgba(99,102,241,0.55)] pointer-events-none">
                                            <div className="relative overflow-hidden rounded-xl border border-indigo-400/30 bg-slate-900/40 aspect-[9/19]">
                                                {url ? (
                                                    <img
                                                        src={url}
                                                        alt={text('screenshot')}
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
                                    <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                        {previewIds.map((id, index) => {
                                            const shot = shotById.get(id);
                                            if (!shot) return null;
                                            return (
                                                <SortableSimulatorShotTile
                                                    key={shot.id}
                                                    id={shot.id}
                                                    index={index}
                                                    shot={shot}
                                                    url={appScreenshotUrls[shot.id]}
                                                    onDelete={handleDeleteAppScreenshot}
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
                            onDragOver={handleScreenshotDragOver}
                            onDragLeave={handleScreenshotDragLeave}
                            onDrop={handleScreenshotDrop}
                            className={`flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 text-center transition ${
                                isScreenshotDropActive
                                    ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                    : 'border-indigo-900/50 bg-slate-900/30 text-indigo-200/70'
                            } ${!canUploadAppScreenshots ? 'opacity-60 pointer-events-none' : ''}`}
                        >
                            <ImagePlus size={24} />
                            <div className="text-sm font-semibold">{text('drop_screenshots_title')}</div>
                            <label
                                htmlFor="app-screenshots-upload"
                                className="ui-btn-fit inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30 cursor-pointer"
                            >
                                {appScreenshotsUploading ? text('uploading') : text('upload_screenshots')}
                            </label>
                            <input
                                id="app-screenshots-upload"
                                type="file"
                                accept="image/png,image/jpeg"
                                multiple
                                className="hidden"
                                onChange={handleAppScreenshotsUpload}
                                disabled={!canUploadAppScreenshots || appScreenshotsUploading}
                            />
                        </div>
                    </div>
                </div>
            )}
            <p className="mt-3 text-[11px] text-indigo-200/60">{text('upload_rules_note')}</p>
        </div>
    );
};

function SortableSimulatorShotTile({
    id,
    index,
    shot,
    url,
    onDelete,
    openLightbox,
    text,
}: {
    id: string;
    index: number;
    shot: AppScreenshot;
    url: string | undefined;
    onDelete: (shot: AppScreenshot) => void;
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
                        alt={`${text('screenshot')} ${index + 1}`}
                        className="h-full w-full object-cover cursor-zoom-in select-none"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onClick={() => openLightbox(url, `${text('screenshot')} ${index + 1}`)}
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
                    onConfirm={() => onDelete(shot)}
                >
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-1 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white">
                        <Trash2 size={10} />
                    </span>
                </ConfirmIconButton>
            </div>
        </div>
    );
}
