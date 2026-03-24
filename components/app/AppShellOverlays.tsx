import React from 'react';
import type { TranslationKey } from '../../i18n';
import { ExportCompletionRail } from './ExportCompletionRail';
import { Lightbox } from './Lightbox';
import { GenerationQueueWidget } from './GenerationQueueWidget';

type AppShellOverlaysProps = {
    aliasNotice: string | null;
    assetsCollapsed: boolean;
    closeLabel: string;
    collabWarning: string | null;
    deliverablesRailRef: React.RefObject<HTMLDivElement | null>;
    deliverablesRailStyle: {
        top: number;
        left: number;
        opacity: number;
    };
    isDeliverablesCompleted: boolean;
    lightbox: React.ComponentProps<typeof Lightbox>['lightbox'];
    onCancelJob?: React.ComponentProps<typeof GenerationQueueWidget>['onCancelJob'];
    onClearFinished: React.ComponentProps<typeof GenerationQueueWidget>['onClearFinished'];
    onCloseLightbox: () => void;
    onDismissJob: React.ComponentProps<typeof GenerationQueueWidget>['onDismissJob'];
    onMarkCompleted: () => void;
    onToggleAssetsCollapsed: () => void;
    pickedIcon: boolean;
    queueJobs: React.ComponentProps<typeof GenerationQueueWidget>['jobs'];
    setReadiness: React.ComponentProps<typeof ExportCompletionRail>['sets'];
    showDeliverablesRail: boolean;
    text: (key: TranslationKey) => string;
    unpickedCount: number;
};

export function AppShellOverlays({
    aliasNotice,
    assetsCollapsed,
    closeLabel,
    collabWarning,
    deliverablesRailRef,
    deliverablesRailStyle,
    isDeliverablesCompleted,
    lightbox,
    onCancelJob,
    onClearFinished,
    onCloseLightbox,
    onDismissJob,
    onMarkCompleted,
    onToggleAssetsCollapsed,
    pickedIcon,
    queueJobs,
    setReadiness,
    showDeliverablesRail,
    text,
    unpickedCount,
}: AppShellOverlaysProps) {
    return (
        <>
            {showDeliverablesRail ? (
                <div
                    ref={deliverablesRailRef}
                    data-testid="workspace-deliverables-rail"
                    className="fixed z-40 transition-opacity duration-150"
                    style={{
                        top: `${deliverablesRailStyle.top}px`,
                        left: `${deliverablesRailStyle.left}px`,
                        opacity: deliverablesRailStyle.opacity,
                        pointerEvents: deliverablesRailStyle.opacity ? 'auto' : 'none',
                    }}
                >
                    <ExportCompletionRail
                        isCompleted={isDeliverablesCompleted}
                        pickedIcon={pickedIcon}
                        sets={setReadiness}
                        unpickedCount={unpickedCount}
                        isAssetsCollapsed={assetsCollapsed}
                        onToggleAssetsCollapsed={onToggleAssetsCollapsed}
                        onMarkCompleted={onMarkCompleted}
                        text={text}
                    />
                </div>
            ) : null}
            {collabWarning ? (
                <div className="pointer-events-none fixed right-4 top-24 z-[70] max-w-xs rounded-xl border border-amber-400/40 bg-slate-900/95 px-3 py-2 text-xs text-amber-100 shadow-lg">
                    {collabWarning}
                </div>
            ) : null}
            {aliasNotice ? (
                <div className="pointer-events-none fixed bottom-20 right-4 z-50 max-w-xs rounded-xl border border-indigo-400/35 bg-slate-900/95 px-3 py-2 text-xs text-indigo-100 shadow-lg">
                    {aliasNotice}
                </div>
            ) : null}
            <Lightbox lightbox={lightbox} onClose={onCloseLightbox} closeLabel={closeLabel} />
            <GenerationQueueWidget
                jobs={queueJobs}
                onDismissJob={onDismissJob}
                onClearFinished={onClearFinished}
                onCancelJob={onCancelJob}
            />
        </>
    );
}
