import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem } from '../types/zefgen';
import type { ConnectorExecutionPanelSnapshot } from '../types/connector-execution-snapshot';
import type { ConnectorJobStatus, DownstreamCaptureMode } from '../data/connector-jobs.ts';
import {
    assertRunnerSupportedCaptureMode,
    type ConnectorJob,
    createConnectorJob,
    DEFAULT_RUNNER_CAPTURE_MODE,
    fetchConnectorJobs,
    requestCancelConnectorJob,
} from '../data/connector-jobs.ts';

const normalizeDownstreamSource = (value: string) => String(value || '').trim();
const isActiveConnectorJobStatus = (status: ConnectorJobStatus | string | null | undefined) =>
    status === 'queued' || status === 'running' || status === 'waiting_for_user';
const EMPTY_CONNECTOR_JOBS: ConnectorJob[] = [];
const getJobsSignature = (jobs: ConnectorJob[]) =>
    jobs.map((job) => `${String(job?.id || '')}:${String(job?.updated_at || job?.created_at || '')}`).join('|');

export const buildVisualQaConnectorJobInput = (payload: {
    sourceJobId?: string | null;
    sourceRef: string;
    sourceKind?: 'job' | 'github_main_sync';
}) => {
    const sourceJobId = normalizeDownstreamSource(String(payload.sourceJobId || ''));
    const sourceRef = normalizeDownstreamSource(payload.sourceRef);
    const sourceKind = payload.sourceKind === 'github_main_sync' ? 'github_main_sync' : 'job';
    if (!sourceRef) throw new Error('Missing source ref for QA.');
    if (sourceKind === 'job' && !sourceJobId) throw new Error('Missing source job id for QA.');

    return {
        source_job_id: sourceJobId || null,
        source_ref: sourceRef,
        source_kind: sourceKind,
        capture_mode: DEFAULT_RUNNER_CAPTURE_MODE,
    };
};

export const buildScreenshotsConnectorJobInput = (payload: {
    sourceJobId: string;
    sourceRef: string;
    captureMode: DownstreamCaptureMode | string;
}) => {
    const sourceJobId = normalizeDownstreamSource(payload.sourceJobId);
    const sourceRef = normalizeDownstreamSource(payload.sourceRef);
    if (!sourceJobId || !sourceRef) {
        throw new Error('Missing source job id or source ref for screenshots.');
    }

    return {
        source_job_id: sourceJobId,
        source_ref: sourceRef,
        capture_mode: assertRunnerSupportedCaptureMode(payload.captureMode),
    };
};

export type ConnectorJobsController = {
    jobs: ConnectorJob[];
    latestJob: ConnectorJob | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createGenerateJob: () => Promise<ConnectorJob | null>;
    createContinueJob: (fromJobId: string) => Promise<ConnectorJob | null>;
    createFixJob: (bugReport: string) => Promise<ConnectorJob | null>;
    createIntegrationJob: () => Promise<ConnectorJob | null>;
    createQaJob: (payload: {
        sourceJobId?: string | null;
        sourceRef: string;
        sourceKind?: 'job' | 'github_main_sync';
    }) => Promise<ConnectorJob | null>;
    createScreenshotsJob: (payload: { sourceJobId: string; sourceRef: string; captureMode: DownstreamCaptureMode }) => Promise<ConnectorJob | null>;
    requestCancel: (jobId: string) => Promise<ConnectorJob | null>;
};

export const useConnectorJobs = (payload: {
    session: Session | null;
    selectedApp: AppItem | null;
    githubRepoUrl?: string | null;
    baseBranch?: string | null;
    pollMs?: number;
    idlePollMs?: number | null;
    hydrationSnapshot?: ConnectorExecutionPanelSnapshot | null;
}): ConnectorJobsController => {
    const { session, selectedApp, githubRepoUrl } = payload;
    const activePollMs = Math.max(1200, Math.floor(payload.pollMs ?? 3000));
    const idlePollMs =
        payload.idlePollMs == null ? null : Math.max(activePollMs, Math.floor(payload.idlePollMs));
    const baseBranch = String(payload.baseBranch || '').trim() || 'main';
    const sessionUserId = String(session?.user?.id || '').trim();
    const selectedAppId = String(selectedApp?.id || '').trim();
    const selectedAppRepoFullName = String((selectedApp as any)?.github_repo_full_name || '').trim();
    const selectedAppRepoUrl = String((selectedApp as any)?.github_repo_url || '').trim();
    const scopeKey = sessionUserId && selectedAppId ? `${sessionUserId}:${selectedAppId}` : '';
    const matchingHydrationSnapshot =
        payload.hydrationSnapshot && String(payload.hydrationSnapshot.appId || '').trim() === selectedAppId
            ? payload.hydrationSnapshot
            : null;
    const hydrationJobs = Array.isArray(matchingHydrationSnapshot?.jobs)
        ? (matchingHydrationSnapshot?.jobs as ConnectorJob[])
        : EMPTY_CONNECTOR_JOBS;
    const hydrationJobsSignature = getJobsSignature(hydrationJobs);
    const hasMatchingHydrationSnapshot = Boolean(matchingHydrationSnapshot);

    const [jobs, setJobs] = useState<ConnectorJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const jobsSignatureRef = useRef('');
    const scopeKeyRef = useRef('');
    const requestScopeKeyRef = useRef('');
    const hydrationStateRef = useRef('');

    useLayoutEffect(() => {
        requestScopeKeyRef.current = scopeKey;

        if (!scopeKey) {
            if (scopeKeyRef.current !== '') {
                setJobs((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_JOBS));
            }
            setLoading((current) => (current ? false : current));
            setError((current) => (current === null ? current : null));
            jobsSignatureRef.current = '';
            scopeKeyRef.current = '';
            hydrationStateRef.current = '';
            return;
        }

        const nextHydrationState = hasMatchingHydrationSnapshot
            ? `${scopeKey}:hydrated:${hydrationJobsSignature}`
            : `${scopeKey}:cold`;
        if (scopeKeyRef.current === scopeKey && hydrationStateRef.current === nextHydrationState) return;

        scopeKeyRef.current = scopeKey;
        hydrationStateRef.current = nextHydrationState;
        setError((current) => (current === null ? current : null));
        if (hasMatchingHydrationSnapshot) {
            jobsSignatureRef.current = hydrationJobsSignature;
            setJobs((current) => (getJobsSignature(current) === hydrationJobsSignature ? current : hydrationJobs));
            setLoading((current) => (current ? false : current));
            return;
        }

        jobsSignatureRef.current = '';
        setJobs((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_JOBS));
        setLoading((current) => (current ? current : true));
    }, [hasMatchingHydrationSnapshot, hydrationJobsSignature, scopeKey]);

    const runRefresh = useCallback(async (background = false) => {
        if (!sessionUserId || !selectedAppId) return;
        const requestScopeKey = requestScopeKeyRef.current;
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            const { data, error: e } = await fetchConnectorJobs({
                userId: sessionUserId,
                appId: selectedAppId,
                limit: 15,
            });
            if (e) throw e;
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            const nextJobs = (data || []) as ConnectorJob[];
            const nextSignature = getJobsSignature(nextJobs);
            if (jobsSignatureRef.current !== nextSignature) {
                jobsSignatureRef.current = nextSignature;
                setJobs(nextJobs);
            }
            if (background) setError(null);
        } catch (e: any) {
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            setError(String(e?.message || e));
        } finally {
            if (!background && requestScopeKeyRef.current === requestScopeKey) setLoading(false);
        }
    }, [selectedAppId, sessionUserId]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    const hasActiveJob = useMemo(
        () => jobs.some((job) => isActiveConnectorJobStatus(job?.status)),
        [jobs]
    );
    const effectivePollMs = hasActiveJob ? activePollMs : idlePollMs;

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;

        if (!scopeKey) return;

        const hasCachedSnapshot = hasMatchingHydrationSnapshot;
        if (!hasCachedSnapshot) {
            void runRefresh(false);
        } else if (hasActiveJob) {
            void runRefresh(true);
        }

        if (typeof effectivePollMs === 'number' && effectivePollMs > 0) {
            timerRef.current = window.setInterval(() => void runRefresh(true), effectivePollMs);
        }
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [effectivePollMs, hasActiveJob, hasMatchingHydrationSnapshot, runRefresh, scopeKey]);

    const latestJob = useMemo(() => jobs[0] ?? null, [jobs]);

    const toRepoFullNameFromUrl = useCallback((url: string | null | undefined) => {
        let u = String(url || '').trim();
        if (!u) return '';
        u = u.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
        const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
        if (!m) return '';
        return `${m[1]}/${m[2]}`;
    }, []);

    const getRepoFullName = useCallback(() => {
        const direct = selectedAppRepoFullName;
        if (direct) return direct;
        const fromRowUrl = toRepoFullNameFromUrl(selectedAppRepoUrl);
        if (fromRowUrl) return fromRowUrl;
        const fromStateUrl = toRepoFullNameFromUrl(githubRepoUrl);
        if (fromStateUrl) return fromStateUrl;
        return '';
    }, [githubRepoUrl, selectedAppRepoFullName, selectedAppRepoUrl, toRepoFullNameFromUrl]);

    const createGenerateJob = useCallback(async () => {
        if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
        const repoFullName = getRepoFullName();
        if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

        const { data, error: e } = await createConnectorJob({
            userId: sessionUserId,
            appId: selectedAppId,
            kind: 'generate',
            repoFullName,
            baseBranch,
            input: {},
        });
        if (e) throw e;
        await refresh();
        return (data as ConnectorJob | null) ?? null;
    }, [baseBranch, sessionUserId, selectedAppId, refresh, getRepoFullName]);

    const createContinueJob = useCallback(
        async (fromJobId: string) => {
            if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const srcId = String(fromJobId || '').trim();
            if (!srcId) throw new Error('Missing fromJobId for continue.');

            const { data, error: e } = await createConnectorJob({
                userId: sessionUserId,
                appId: selectedAppId,
                kind: 'generate',
                repoFullName,
                baseBranch,
                input: { resume: { from_job_id: srcId } },
            });
            if (e) throw e;
            await refresh();
            return (data as ConnectorJob | null) ?? null;
        },
        [baseBranch, sessionUserId, selectedAppId, refresh, getRepoFullName]
    );

    const createFixJob = useCallback(
        async (bugReport: string) => {
            if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: sessionUserId,
                appId: selectedAppId,
                kind: 'fix',
                repoFullName,
                baseBranch,
                input: { bug_report: String(bugReport || '').slice(0, 20000) },
            });
            if (e) throw e;
            await refresh();
            return (data as ConnectorJob | null) ?? null;
        },
        [baseBranch, sessionUserId, selectedAppId, refresh, getRepoFullName]
    );

    const createIntegrationJob = useCallback(async () => {
        if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
        const repoFullName = getRepoFullName();
        if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

        const { data, error: e } = await createConnectorJob({
            userId: sessionUserId,
            appId: selectedAppId,
            kind: 'integration',
            repoFullName,
            baseBranch,
            input: {},
        });
        if (e) throw e;
        await refresh();
        return (data as ConnectorJob | null) ?? null;
    }, [baseBranch, getRepoFullName, refresh, selectedAppId, sessionUserId]);

    const createQaJob = useCallback(
        async (payload: { sourceJobId?: string | null; sourceRef: string; sourceKind?: 'job' | 'github_main_sync' }) => {
            if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: sessionUserId,
                appId: selectedAppId,
                kind: 'visual_qa',
                repoFullName,
                baseBranch,
                input: buildVisualQaConnectorJobInput(payload),
            });
            if (e) throw e;
            await refresh();
            return (data as ConnectorJob | null) ?? null;
        },
        [baseBranch, getRepoFullName, refresh, selectedAppId, sessionUserId]
    );

    const createScreenshotsJob = useCallback(
        async (payload: { sourceJobId: string; sourceRef: string; captureMode: DownstreamCaptureMode }) => {
            if (!sessionUserId || !selectedAppId) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: sessionUserId,
                appId: selectedAppId,
                kind: 'screenshots',
                repoFullName,
                baseBranch,
                input: buildScreenshotsConnectorJobInput(payload),
            });
            if (e) throw e;
            await refresh();
            return (data as ConnectorJob | null) ?? null;
        },
        [baseBranch, getRepoFullName, refresh, selectedAppId, sessionUserId]
    );

    const requestCancel = useCallback(
        async (jobId: string) => {
            if (!sessionUserId) throw new Error('No session.');
            const cancelRequestedAt = new Date().toISOString();
            let previousJob: ConnectorJob | null = null;
            setJobs((prev) =>
                prev.map((job) => {
                    if (String(job?.id || '') !== String(jobId)) return job;
                    previousJob = job;
                    return {
                        ...job,
                        cancel_requested_at: cancelRequestedAt,
                    };
                })
            );
            try {
                const { data, error: e } = await requestCancelConnectorJob({ userId: sessionUserId, jobId });
                if (e) throw e;
                await refresh();
                return (data as ConnectorJob | null) ?? null;
            } catch (error) {
                if (previousJob) {
                    setJobs((prev) =>
                        prev.map((job) => (String(job?.id || '') === String(jobId) ? previousJob : job))
                    );
                }
                throw error;
            }
        },
        [sessionUserId, refresh]
    );

    return {
        jobs,
        latestJob,
        loading,
        error,
        refresh,
        createGenerateJob,
        createContinueJob,
        createFixJob,
        createIntegrationJob,
        createQaJob,
        createScreenshotsJob,
        requestCancel,
    };
};
