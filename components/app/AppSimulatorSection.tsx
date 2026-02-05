import React from 'react';
import { GripVertical, ImagePlus, Trash2 } from 'lucide-react';
import type { AppItem, AppScreenshot } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';

type AppSimulatorSectionProps = {
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    appScreenshotUrls: Record<string, string>;
    dragOverShotId: string | null;
    draggingShotId: string | null;
    setDraggingShotId: (value: string | null) => void;
    setDragOverShotId: (value: string | null) => void;
    handleReorderAppScreenshot: (fromIndex: number, toIndex: number) => void;
    handleDeleteAppScreenshot: (shot: AppScreenshot) => void;
    handleScreenshotDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    handleScreenshotDragLeave: () => void;
    handleScreenshotDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    handleAppScreenshotsUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isScreenshotDropActive: boolean;
    appScreenshotsUploading: boolean;
    canUploadAppScreenshots: boolean;
    openLightbox: (src: string, alt: string) => void;
    text: (key: TranslationKey) => string;
};

export const AppSimulatorSection = ({
    selectedApp,
    selectedAppScreenshots,
    appScreenshotUrls,
    dragOverShotId,
    draggingShotId,
    setDraggingShotId,
    setDragOverShotId,
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
    return (
        <>
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
                            <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {selectedAppScreenshots.map((shot, index) => {
                                    const isDragTarget = dragOverShotId === shot.id && draggingShotId !== shot.id;
                                    return (
                                        <div
                                            key={shot.id}
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('text/plain', shot.id);
                                                setDraggingShotId(shot.id);
                                            }}
                                            onDragEnd={() => {
                                                setDraggingShotId(null);
                                                setDragOverShotId(null);
                                            }}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                setDragOverShotId(shot.id);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const draggedId = event.dataTransfer.getData('text/plain');
                                                const fromIndex = selectedAppScreenshots.findIndex((item) => item.id === draggedId);
                                                const toIndex = selectedAppScreenshots.findIndex((item) => item.id === shot.id);
                                                if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                                                    handleReorderAppScreenshot(fromIndex, toIndex);
                                                }
                                                setDraggingShotId(null);
                                                setDragOverShotId(null);
                                            }}
                                            className={`mx-auto w-full max-w-[110px] rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-1.5 space-y-1.5 cursor-grab active:cursor-grabbing ${
                                                isDragTarget ? 'ring-indigo-400/60 bg-indigo-500/10' : ''
                                            }`}
                                        >
                                            <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                                                {appScreenshotUrls[shot.id] ? (
                                                    <img
                                                        src={appScreenshotUrls[shot.id]}
                                                        alt={`${text('screenshot')} ${index + 1}`}
                                                        className="h-full w-full object-cover cursor-zoom-in"
                                                        loading="lazy"
                                                        decoding="async"
                                                        onClick={() => openLightbox(appScreenshotUrls[shot.id], `${text('screenshot')} ${index + 1}`)}
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
                                                    onClick={() => handleDeleteAppScreenshot(shot)}
                                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-1 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                    aria-label={text('delete')}
                                                >
                                                    <Trash2 size={10} />
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
                                className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30 cursor-pointer"
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
        </>
    );
};
