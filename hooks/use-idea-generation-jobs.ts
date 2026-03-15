import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ConnectorJob } from '../data/connector-jobs';
import { createConnectorJob, fetchConnectorJobsForUser, requestCancelConnectorJob } from '../data/connector-jobs';

export const useIdeaGenerationJobs = (payload: {
    session: Session | null;
    brandId: string | null;
    pollMs?: number;
    onDataError?: (message: string) => void;
}) => {
    const { session, brandId, onDataError } = payload;
    const pollMs = Math.max(1200, Math.floor(payload.pollMs ?? 3000));

    const [jobs, setJobs] = useState<ConnectorJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const signatureRef = useRef('');

    const runRefresh = useCallback(
        async (background = false) => {
            if (!session || !brandId) {
                if (!background) {
                    setJobs([]);
                    setLoading(false);
                    setError(null);
                }
                signatureRef.current = '';
                return;
            }

            if (!background) {
                setLoading(true);
                setError(null);
            }

            try {
                const { data, error: fetchError } = await fetchConnectorJobsForUser({
                    userId: session.user.id,
                    kind: 'idea_generation',
                    brandId,
                    limit: 15,
                });
                if (fetchError) throw fetchError;

                const nextJobs = (data || []) as ConnectorJob[];
                const nextSignature = nextJobs
                    .map((job) => `${String(job.id || '')}:${String(job.updated_at || job.created_at || '')}`)
                    .join('|');

                if (nextSignature !== signatureRef.current) {
                    signatureRef.current = nextSignature;
                    setJobs(nextJobs);
                }

                if (background) {
                    setError(null);
                }
            } catch (refreshError: any) {
                const message = String(refreshError?.message || refreshError);
                setError(message);
                onDataError?.(message);
            } finally {
                if (!background) {
                    setLoading(false);
                }
            }
        },
        [brandId, onDataError, session]
    );

    useEffect(() => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (!session || !brandId) {
            setJobs([]);
            setLoading(false);
            setError(null);
            signatureRef.current = '';
            return;
        }

        void runRefresh(false);
        timerRef.current = window.setInterval(() => void runRefresh(true), pollMs);

        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [brandId, pollMs, runRefresh, session?.user?.id]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    const latestJob = useMemo(() => jobs[0] ?? null, [jobs]);

    const createJob = useCallback(
        async (input: Record<string, any>) => {
            if (!session || !brandId) {
                throw new Error('Select a brand scope before queueing idea generation.');
            }

            setCreating(true);
            setError(null);

            try {
                const { data, error: createError } = await createConnectorJob({
                    userId: session.user.id,
                    brandId,
                    kind: 'idea_generation',
                    repoFullName: '',
                    baseBranch: 'main',
                    input,
                });
                if (createError) throw createError;
                await refresh();
                return data;
            } catch (createJobError: any) {
                const message = String(createJobError?.message || createJobError);
                setError(message);
                onDataError?.(message);
                throw createJobError;
            } finally {
                setCreating(false);
            }
        },
        [brandId, onDataError, refresh, session]
    );

    const cancelJob = useCallback(
        async (jobId: string) => {
            if (!session) return null;
            const { data, error: cancelError } = await requestCancelConnectorJob({
                userId: session.user.id,
                jobId,
            });
            if (cancelError) {
                const message = String(cancelError?.message || cancelError);
                setError(message);
                onDataError?.(message);
                throw cancelError;
            }
            await refresh();
            return data;
        },
        [onDataError, refresh, session]
    );

    return {
        jobs,
        latestJob,
        loading,
        creating,
        error,
        refresh,
        createJob,
        cancelJob,
    };
};
