import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem } from '../types/zefgen';
import type { DownstreamCaptureMode } from '../data/connector-jobs.ts';
import {
    assertRunnerSupportedCaptureMode,
    createConnectorJob,
    DEFAULT_RUNNER_CAPTURE_MODE,
    fetchConnectorJobs,
    requestCancelConnectorJob,
} from '../data/connector-jobs.ts';

const normalizeDownstreamSource = (value: string) => String(value || '').trim();

export const buildVisualQaConnectorJobInput = (payload: { sourceJobId: string; sourceRef: string }) => {
    const sourceJobId = normalizeDownstreamSource(payload.sourceJobId);
    const sourceRef = normalizeDownstreamSource(payload.sourceRef);
    if (!sourceJobId || !sourceRef) throw new Error('Missing source job id or source ref for QA.');

    return {
        source_job_id: sourceJobId,
        source_ref: sourceRef,
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

export const useConnectorJobs = (payload: {
    session: Session | null;
    selectedApp: AppItem | null;
    githubRepoUrl?: string | null;
    baseBranch?: string | null;
    pollMs?: number;
}) => {
    const { session, selectedApp, githubRepoUrl } = payload;
    const pollMs = Math.max(1200, Math.floor(payload.pollMs ?? 3000));
    const baseBranch = String(payload.baseBranch || '').trim() || 'main';

    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const jobsSignatureRef = useRef('');

    const runRefresh = useCallback(async (background = false) => {
        if (!session || !selectedApp) return;
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            const { data, error: e } = await fetchConnectorJobs({
                userId: session.user.id,
                appId: selectedApp.id,
                limit: 15,
            });
            if (e) throw e;
            const nextJobs = data || [];
            const nextSignature = nextJobs
                .map((job) => `${String(job?.id || '')}:${String(job?.updated_at || job?.created_at || '')}`)
                .join('|');
            if (jobsSignatureRef.current !== nextSignature) {
                jobsSignatureRef.current = nextSignature;
                setJobs(nextJobs);
            }
            if (background) setError(null);
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            if (!background) setLoading(false);
        }
    }, [session, selectedApp]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;

        setJobs([]);
        setError(null);
        jobsSignatureRef.current = '';

        if (!session || !selectedApp) {
            setLoading(false);
            return;
        }

        void runRefresh(false);
        timerRef.current = window.setInterval(() => void runRefresh(true), pollMs);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [session?.user?.id, selectedApp?.id, pollMs, runRefresh]);

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
        const direct = String((selectedApp as any)?.github_repo_full_name || '').trim();
        if (direct) return direct;
        const fromRowUrl = toRepoFullNameFromUrl((selectedApp as any)?.github_repo_url);
        if (fromRowUrl) return fromRowUrl;
        const fromStateUrl = toRepoFullNameFromUrl(githubRepoUrl);
        if (fromStateUrl) return fromStateUrl;
        return '';
    }, [selectedApp, githubRepoUrl, toRepoFullNameFromUrl]);

    const createGenerateJob = useCallback(async () => {
        if (!session || !selectedApp) throw new Error('No session/app selected.');
        const repoFullName = getRepoFullName();
        if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

        const { data, error: e } = await createConnectorJob({
            userId: session.user.id,
            appId: selectedApp.id,
            kind: 'generate',
            repoFullName,
            baseBranch,
            input: {},
        });
        if (e) throw e;
        await refresh();
        return data;
    }, [baseBranch, session, selectedApp, refresh, getRepoFullName]);

    const createContinueJob = useCallback(
        async (fromJobId: string) => {
            if (!session || !selectedApp) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const srcId = String(fromJobId || '').trim();
            if (!srcId) throw new Error('Missing fromJobId for continue.');

            const { data, error: e } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'generate',
                repoFullName,
                baseBranch,
                input: { resume: { from_job_id: srcId } },
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [baseBranch, session, selectedApp, refresh, getRepoFullName]
    );

    const createFixJob = useCallback(
        async (bugReport: string) => {
            if (!session || !selectedApp) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'fix',
                repoFullName,
                baseBranch,
                input: { bug_report: String(bugReport || '').slice(0, 20000) },
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [baseBranch, session, selectedApp, refresh, getRepoFullName]
    );

    const createIntegrationJob = useCallback(async () => {
        if (!session || !selectedApp) throw new Error('No session/app selected.');
        const repoFullName = getRepoFullName();
        if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

        const { data, error: e } = await createConnectorJob({
            userId: session.user.id,
            appId: selectedApp.id,
            kind: 'integration',
            repoFullName,
            baseBranch,
            input: {},
        });
        if (e) throw e;
        await refresh();
        return data;
    }, [baseBranch, getRepoFullName, refresh, selectedApp, session]);

    const createQaJob = useCallback(
        async (payload: { sourceJobId: string; sourceRef: string }) => {
            if (!session || !selectedApp) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'visual_qa',
                repoFullName,
                baseBranch,
                input: buildVisualQaConnectorJobInput(payload),
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [baseBranch, getRepoFullName, refresh, selectedApp, session]
    );

    const createScreenshotsJob = useCallback(
        async (payload: { sourceJobId: string; sourceRef: string; captureMode: DownstreamCaptureMode }) => {
            if (!session || !selectedApp) throw new Error('No session/app selected.');
            const repoFullName = getRepoFullName();
            if (!repoFullName) throw new Error('Create a GitHub repo first (missing github_repo_full_name).');

            const { data, error: e } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'screenshots',
                repoFullName,
                baseBranch,
                input: buildScreenshotsConnectorJobInput(payload),
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [baseBranch, getRepoFullName, refresh, selectedApp, session]
    );

    const requestCancel = useCallback(
        async (jobId: string) => {
            if (!session) throw new Error('No session.');
            const { data, error: e } = await requestCancelConnectorJob({ userId: session.user.id, jobId });
            if (e) throw e;
            await refresh();
            return data;
        },
        [session, refresh]
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
