import React from 'react';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppScreenshotSet } from '../../types/zefgen';
import type { TranslationKey } from '../../i18n';
import { ConfirmIconButton } from './ConfirmIconButton';

type Props = {
    isCompleted: boolean;
    pickedIcon: boolean;
    sets: Array<{ set: AppScreenshotSet; pickedCount: number; requiredCount: number }>;
    unpickedCount: number;
    isAssetsCollapsed: boolean;
    onToggleAssetsCollapsed: () => void;
    onMarkCompleted: () => void;
    text: (key: TranslationKey) => string;
};

export const ExportCompletionRail = ({
    isCompleted,
    pickedIcon,
    sets,
    unpickedCount,
    isAssetsCollapsed,
    onToggleAssetsCollapsed,
    onMarkCompleted,
    text,
}: Props) => {
    const canCollapse = isCompleted;
    const question =
        unpickedCount > 0
            ? `${text('confirm_delete')} Delete ${unpickedCount} unpicked images to save storage?`
            : `${text('confirm_delete')} Lock in this work?`;

    return (
        <div className="w-[220px] max-w-full">
            <div className="rounded-2xl border border-indigo-900/40 bg-slate-950/35 p-3 space-y-3 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.95)]">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-white">{text('deliverables')}</p>
                        <p className="text-[11px] text-indigo-200/60">
                            {isCompleted ? text('completed') : text('incomplete')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onToggleAssetsCollapsed}
                        disabled={!canCollapse}
                        className={`inline-flex items-center justify-center rounded-full border p-2 text-[10px] font-semibold ${
                            canCollapse
                                ? 'border-white/10 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                : 'border-white/10 text-indigo-200/30'
                        }`}
                        title={canCollapse ? (isAssetsCollapsed ? text('assets_show') : text('assets_hide')) : text('need_picks_to_complete')}
                    >
                        {isAssetsCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                        <span className="sr-only">{isAssetsCollapsed ? text('assets_show') : text('assets_hide')}</span>
                    </button>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-indigo-100/80">
                        {pickedIcon ? <CheckCircle2 size={14} className="text-emerald-300" /> : <Circle size={14} className="text-indigo-200/40" />}
                        <span>Icon picked</span>
                    </div>
                    {sets.map(({ set, pickedCount, requiredCount }) => {
                        const ok = pickedCount >= requiredCount && requiredCount > 0;
                        return (
                            <div key={set.id} className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2">
                                    {ok ? (
                                        <CheckCircle2 size={14} className="text-emerald-300" />
                                    ) : (
                                        <Circle size={14} className="text-indigo-200/40" />
                                    )}
                                    <span className="text-indigo-100/80">{set.name}</span>
                                </div>
                                <span className="text-indigo-200/50">
                                    {pickedCount}/{requiredCount}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <ConfirmIconButton
                    label={text('mark_completed')}
                    question={question}
                    confirmLabel={text('mark_completed')}
                    cancelLabel={text('cancel')}
                    disabled={isCompleted}
                    onConfirm={onMarkCompleted}
                    className="w-full"
                >
                    <span
                        className={`w-full rounded-full border px-3 py-2 text-[11px] font-semibold ${
                            isCompleted
                                ? 'border-white/10 text-indigo-200/40'
                                : 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                        }`}
                    >
                        {text('mark_completed')}
                    </span>
                </ConfirmIconButton>
            </div>
        </div>
    );
};
