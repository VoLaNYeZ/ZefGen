import { useCallback, useMemo, useRef, useState } from 'react';
import { createId } from '../utils/id';
import type { ScreenshotProviderId } from '../types/zefgen';

export type GenerationJobKind =
    | 'icon_generate'
    | 'icon_enhance'
    | 'screenshot_generate'
    | 'screenshot_enhance'
    | 'download_zip'
    | 'github_repo_create'
    | 'github_repo_delete';

export type GenerationJobStatus = 'queued' | 'running' | 'success' | 'error' | 'canceled';

export type GenerationJob = {
    id: string;
    title: string;
    kind: GenerationJobKind;
    providerId?: ScreenshotProviderId;
    status: GenerationJobStatus;
    startedAt: number;
    endedAt?: number;
    progress?: { current: number; total: number };
    message?: string;
};

const clampProgress = (progress: { current: number; total: number }) => {
    const total = Math.max(1, Math.floor(progress.total || 1));
    const current = Math.max(0, Math.min(total, Math.floor(progress.current || 0)));
    return { current, total };
};

export const useGenerationJobs = () => {
    const [jobs, setJobs] = useState<GenerationJob[]>([]);
    const jobsByIdRef = useRef<Record<string, true>>({});

    const createJob = useCallback((payload: {
        title: string;
        kind: GenerationJobKind;
        providerId?: ScreenshotProviderId;
        progressTotal?: number;
    }) => {
        const id = createId();
        const now = Date.now();
        const job: GenerationJob = {
            id,
            title: payload.title,
            kind: payload.kind,
            providerId: payload.providerId,
            status: 'running',
            startedAt: now,
            progress: payload.progressTotal ? { current: 0, total: payload.progressTotal } : undefined,
        };

        jobsByIdRef.current[id] = true;
        setJobs((prev) => [job, ...prev].slice(0, 50));
        return id;
    }, []);

    const setJobProgress = useCallback((id: string, progress: { current: number; total: number }) => {
        if (!jobsByIdRef.current[id]) return;
        const next = clampProgress(progress);
        setJobs((prev) =>
            prev.map((job) => (job.id === id ? { ...job, progress: next } : job))
        );
    }, []);

    const setJobMessage = useCallback((id: string, message: string | undefined) => {
        if (!jobsByIdRef.current[id]) return;
        setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, message } : job)));
    }, []);

    const finishJob = useCallback((id: string, payload: { status: 'success' | 'error' | 'canceled'; message?: string }) => {
        if (!jobsByIdRef.current[id]) return;
        const endedAt = Date.now();
        setJobs((prev) =>
            prev.map((job) =>
                job.id === id
                    ? { ...job, status: payload.status, message: payload.message, endedAt }
                    : job
            )
        );
    }, []);

    const dismissJob = useCallback((id: string) => {
        delete jobsByIdRef.current[id];
        setJobs((prev) => prev.filter((job) => job.id !== id));
    }, []);

    const clearFinished = useCallback(() => {
        setJobs((prev) => prev.filter((job) => job.status === 'running' || job.status === 'queued'));
    }, []);

    const hasRunningJobs = useMemo(
        () => jobs.some((job) => job.status === 'running' || job.status === 'queued'),
        [jobs]
    );

    return {
        jobs,
        hasRunningJobs,
        createJob,
        setJobProgress,
        setJobMessage,
        finishJob,
        dismissJob,
        clearFinished,
    };
};
