import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchConnectorJobArtifactsByJob } from '../data/connector-job-artifacts';
import { useSignedUrlCache } from './use-signed-url-cache';

export const useConnectorJobArtifacts = (payload: {
    session: Session | null;
    jobId: string | null;
    pollMs?: number;
}) => {
    const { session, jobId } = payload;
    const pollMs = Math.max(1500, Math.floor(payload.pollMs ?? 5000));
    const { getSignedUrl } = useSignedUrlCache({ userId: session?.user.id ?? null });

    const [artifacts, setArtifacts] = useState<any[]>([]);
    const [artifactUrlsById, setArtifactUrlsById] = useState<Record<string, string>>({});
    const [artifactJsonById, setArtifactJsonById] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const artifactsSignatureRef = useRef('');

    const runRefresh = useCallback(async (background = false) => {
        if (!session || !jobId) {
            setArtifacts([]);
            setArtifactUrlsById({});
            setArtifactJsonById({});
            setLoading(false);
            setError(null);
            artifactsSignatureRef.current = '';
            return;
        }
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            const { data, error: fetchError } = await fetchConnectorJobArtifactsByJob({
                jobId,
                limit: 200,
            });
            if (fetchError) throw fetchError;
            const nextArtifacts = data || [];
            const nextSignature = nextArtifacts
                .map((artifact) => `${String(artifact?.id || '')}:${String(artifact?.created_at || '')}`)
                .join('|');
            if (artifactsSignatureRef.current !== nextSignature) {
                artifactsSignatureRef.current = nextSignature;
                setArtifacts(nextArtifacts);
            }
            if (background) setError(null);
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            if (!background) setLoading(false);
        }
    }, [jobId, session]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    useEffect(() => {
        if (!session || !jobId) {
            setArtifacts([]);
            setArtifactUrlsById({});
            setArtifactJsonById({});
            setLoading(false);
            setError(null);
            artifactsSignatureRef.current = '';
            return;
        }
        setArtifacts([]);
        setArtifactUrlsById({});
        setArtifactJsonById({});
        setError(null);
        artifactsSignatureRef.current = '';
        void runRefresh(false);
        const timer = window.setInterval(() => void runRefresh(true), pollMs);
        return () => window.clearInterval(timer);
    }, [jobId, pollMs, runRefresh, session]);

    useEffect(() => {
        let canceled = false;
        const loadUrls = async () => {
            const nextUrls: Record<string, string> = {};
            for (const artifact of artifacts) {
                const id = String(artifact?.id || '').trim();
                const bucket = String(artifact?.bucket || '').trim();
                const objectPath = String(artifact?.object_path || '').trim();
                if (!id || !bucket || !objectPath) continue;
                try {
                    nextUrls[id] = await getSignedUrl(bucket, objectPath);
                } catch {
                    // Ignore missing artifact URLs in the UI.
                }
            }
            if (!canceled) setArtifactUrlsById(nextUrls);
        };
        void loadUrls();
        return () => {
            canceled = true;
        };
    }, [artifacts, getSignedUrl]);

    useEffect(() => {
        let canceled = false;
        const loadJson = async () => {
            const nextJson: Record<string, any> = {};
            for (const artifact of artifacts) {
                const id = String(artifact?.id || '').trim();
                const kind = String(artifact?.kind || '').trim();
                const url = artifactUrlsById[id];
                if (!id || !url) continue;
                if (kind !== 'qa_report' && kind !== 'screenshot_manifest') continue;
                try {
                    const response = await fetch(url);
                    if (!response.ok) continue;
                    nextJson[id] = await response.json();
                } catch {
                    // Ignore parse/display errors and keep the download link available.
                }
            }
            if (!canceled) setArtifactJsonById(nextJson);
        };
        void loadJson();
        return () => {
            canceled = true;
        };
    }, [artifactUrlsById, artifacts]);

    const artifactUrlCount = useMemo(() => Object.keys(artifactUrlsById).length, [artifactUrlsById]);

    return {
        artifacts,
        artifactUrlsById,
        artifactJsonById,
        artifactUrlCount,
        loading,
        error,
        refresh,
    };
};
