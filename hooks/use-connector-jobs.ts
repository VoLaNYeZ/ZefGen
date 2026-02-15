import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem } from '../types/zefgen';
import { createConnectorJob, fetchConnectorJobs, requestCancelConnectorJob } from '../data/connector-jobs';

export const useConnectorJobs = (payload: {
    session: Session | null;
    selectedApp: AppItem | null;
    githubRepoUrl?: string | null;
    pollMs?: number;
}) => {
    const { session, selectedApp, githubRepoUrl } = payload;
    const pollMs = Math.max(1200, Math.floor(payload.pollMs ?? 3000));

    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);

    const refresh = useCallback(async () => {
        if (!session || !selectedApp) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: e } = await fetchConnectorJobs({
                userId: session.user.id,
                appId: selectedApp.id,
                limit: 15,
            });
            if (e) throw e;
            setJobs(data || []);
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, [session, selectedApp]);

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;

        if (!session || !selectedApp) {
            setJobs([]);
            return;
        }

        refresh();
        timerRef.current = window.setInterval(refresh, pollMs);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [session?.user?.id, selectedApp?.id, pollMs, refresh]);

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
            baseBranch: 'main',
            input: {},
        });
        if (e) throw e;
        await refresh();
        return data;
    }, [session, selectedApp, refresh, getRepoFullName]);

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
                baseBranch: 'main',
                input: { resume: { from_job_id: srcId } },
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [session, selectedApp, refresh, getRepoFullName]
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
                baseBranch: 'main',
                input: { bug_report: String(bugReport || '').slice(0, 20000) },
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [session, selectedApp, refresh, getRepoFullName]
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
        requestCancel,
    };
};
