import { useCallback, useEffect, useMemo } from 'react';
import type { GenerationJob } from './use-generation-jobs';

type Params = {
    accountsHasUnsavedChanges: boolean;
    cancelGenerationJob: (id: string) => void;
    clearFinishedGenerationJobs: () => void;
    connectorJobs: GenerationJob[];
    dismissConnectorJob: (id: string) => void;
    dismissGenerationJob: (id: string) => void;
    clearFinishedConnectorJobs: () => void;
    cancelConnectorJob: (id: string) => Promise<void>;
    enhanceIconSlotGenerating: number | null;
    enhanceSlotGenerating: number | null;
    generationJobs: GenerationJob[];
    hasRunningJobs: boolean;
    iconGenerating: boolean;
    iconSlotGenerating: number | null;
    iconUploading: boolean;
    ideasHasUnsavedChanges: boolean;
    isCurrentBrandReadOnly: boolean;
    reportReadOnlyBlocked: () => void;
    screenshotsGenerating: boolean;
    slotGenerating: number | null;
};

export function useWorkspaceBusyGuards({
    accountsHasUnsavedChanges,
    cancelConnectorJob,
    cancelGenerationJob,
    clearFinishedConnectorJobs,
    clearFinishedGenerationJobs,
    connectorJobs,
    dismissConnectorJob,
    dismissGenerationJob,
    enhanceIconSlotGenerating,
    enhanceSlotGenerating,
    generationJobs,
    hasRunningJobs,
    iconGenerating,
    iconSlotGenerating,
    iconUploading,
    ideasHasUnsavedChanges,
    isCurrentBrandReadOnly,
    reportReadOnlyBlocked,
    screenshotsGenerating,
    slotGenerating,
}: Params) {
    const isBusyForUnload =
        hasRunningJobs ||
        iconUploading ||
        iconGenerating ||
        screenshotsGenerating ||
        slotGenerating !== null ||
        enhanceSlotGenerating !== null ||
        iconSlotGenerating !== null ||
        enhanceIconSlotGenerating !== null ||
        accountsHasUnsavedChanges ||
        ideasHasUnsavedChanges;

    useEffect(() => {
        if (!isBusyForUnload) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isBusyForUnload]);

    const allQueueJobs = useMemo(() => {
        const merged = [...generationJobs, ...connectorJobs];
        merged.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        return merged.slice(0, 50);
    }, [connectorJobs, generationJobs]);

    const handleDismissQueueJob = useCallback(
        (id: string) => {
            if (id.startsWith('connector:')) {
                dismissConnectorJob(id.slice('connector:'.length));
                return;
            }
            dismissGenerationJob(id);
        },
        [dismissConnectorJob, dismissGenerationJob]
    );

    const handleClearFinishedQueueJobs = useCallback(() => {
        clearFinishedGenerationJobs();
        clearFinishedConnectorJobs();
    }, [clearFinishedConnectorJobs, clearFinishedGenerationJobs]);

    const handleCancelQueueJob = useCallback(
        (id: string) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            if (id.startsWith('connector:')) {
                void cancelConnectorJob(id.slice('connector:'.length));
                return;
            }
            cancelGenerationJob(id);
        },
        [cancelConnectorJob, cancelGenerationJob, isCurrentBrandReadOnly, reportReadOnlyBlocked]
    );

    return {
        allQueueJobs,
        handleCancelQueueJob,
        handleClearFinishedQueueJobs,
        handleDismissQueueJob,
    };
}
