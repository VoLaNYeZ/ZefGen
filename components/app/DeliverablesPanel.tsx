import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { AppScreenshotSet, GeneratedAsset } from '../../types/zefgen';
import type { TranslationKey } from '../../i18n';

type Props = {
    isCompleted: boolean;
    pickedIconAsset: GeneratedAsset | null;
    pickedIconPreviewUrl?: string | null;
    screenshotSets: AppScreenshotSet[];
    simulatorScreenshotCount?: number;
    onDownloadIcon: () => void;
    onDownloadSimulatorScreenshotsZip?: () => void;
    onDownloadSetZip: (setId: string) => void;
    onShowWorkspace?: () => void;
    text: (key: TranslationKey) => string;
};

export const DeliverablesPanel = ({
    isCompleted,
    pickedIconAsset,
    pickedIconPreviewUrl,
    screenshotSets,
    simulatorScreenshotCount,
    onDownloadIcon,
    onDownloadSimulatorScreenshotsZip,
    onDownloadSetZip,
    onShowWorkspace,
    text,
}: Props) => {
    return (
        <div className="w-[340px] max-w-full rounded-2xl border border-indigo-900/40 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">{text('deliverables')}</p>
                    <p className="text-[11px] text-indigo-200/60">
                        {isCompleted ? text('completed') : text('incomplete')}
                    </p>
                </div>
                <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        isCompleted
                            ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-50'
                            : 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                    }`}
                >
                    {isCompleted ? text('completed') : text('incomplete')}
                </span>
            </div>

            <div className="space-y-2">
                <button
                    type="button"
                    disabled={!isCompleted || !pickedIconAsset}
                    onClick={onDownloadIcon}
                    className={`ui-btn-fit ui-btn-fit-ellipsis relative w-full rounded-full border px-3 py-2 text-[11px] font-semibold flex items-center justify-center ${
                        isCompleted && pickedIconAsset
                            ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                            : 'border-white/10 text-indigo-200/40'
                    }`}
                >
                    {pickedIconPreviewUrl ? (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
                            <img
                                src={pickedIconPreviewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                            />
                        </span>
                    ) : null}
                    <span className="text-center">{text('download')} icon</span>
                </button>

                {typeof simulatorScreenshotCount === 'number' ? (
                    <button
                        type="button"
                        data-testid="deliverables-download-simulator-zip"
                        disabled={!isCompleted || simulatorScreenshotCount < 1}
                        onClick={() => onDownloadSimulatorScreenshotsZip?.()}
                        className={`ui-btn-fit ui-btn-fit-ellipsis w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                            isCompleted && simulatorScreenshotCount > 0
                                ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                : 'border-white/10 text-indigo-200/40'
                        }`}
                    >
                        {text('download_simulator_screenshots_zip')}
                    </button>
                ) : null}

                {(screenshotSets || []).map((set) => (
                    <button
                        key={set.id}
                        type="button"
                        disabled={!isCompleted}
                        onClick={() => onDownloadSetZip(set.id)}
                        className={`ui-btn-fit ui-btn-fit-ellipsis w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                            isCompleted
                                ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                : 'border-white/10 text-indigo-200/40'
                        }`}
                    >
                        {text('download_set_zip')}: {set.name}
                    </button>
                ))}
            </div>

            {!isCompleted && (
                <p className="text-[11px] text-indigo-200/50">
                    {text('need_picks_to_complete')}
                </p>
            )}

            {onShowWorkspace && (
                <button
                    type="button"
                    onClick={onShowWorkspace}
                    className="ui-btn-fit ui-btn-fit-ellipsis w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                >
                    <ChevronDown size={14} />
                    {text('assets_show')}
                </button>
            )}
        </div>
    );
};
