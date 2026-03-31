import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ConnectorExecutionPanelSnapshot } from '../types/connector-execution-snapshot';
import {
    fetchConnectorJobArtifactsByJob,
    type ConnectorJobArtifact,
} from '../data/connector-job-artifacts';
import { useSignedUrlCache } from './use-signed-url-cache';

const EMPTY_CONNECTOR_ARTIFACTS: ConnectorJobArtifact[] = [];
const EMPTY_STRING_RECORD: Record<string, string> = {};
const EMPTY_JSON_RECORD: Record<string, any> = {};
const inFlightArtifactFetches = new Map<string, Promise<ConnectorJobArtifact[]>>();
const getArtifactsSignature = (artifacts: ConnectorJobArtifact[]) =>
    artifacts.map((artifact) => `${String(artifact?.id || '')}:${String(artifact?.created_at || '')}`).join('|');
const getRecordSignature = (record: Record<string, any>) =>
    Object.keys(record)
        .sort()
        .map((key) => `${key}:${JSON.stringify(record[key])}`)
        .join('|');

export const useConnectorJobArtifacts = (payload: {
    session: Session | null;
    jobId: string | null;
    pollMs?: number;
    live?: boolean;
    hydrationSnapshot?: ConnectorExecutionPanelSnapshot | null;
}) => {
    const { session, jobId } = payload;
    const pollMs = Math.max(1500, Math.floor(payload.pollMs ?? 5000));
    const live = payload.live ?? true;
    const sessionUserId = String(session?.user?.id || '').trim();
    const normalizedJobId = String(jobId || '').trim() || null;
    const scopeKey = sessionUserId && normalizedJobId ? `${sessionUserId}:${normalizedJobId}` : '';
    const matchingHydrationSnapshot =
        payload.hydrationSnapshot &&
        String(payload.hydrationSnapshot.selectedJobArtifactJobId || '').trim() === String(normalizedJobId || '')
            ? payload.hydrationSnapshot
            : null;
    const hydrationArtifacts = Array.isArray(matchingHydrationSnapshot?.selectedJobArtifacts)
        ? (matchingHydrationSnapshot.selectedJobArtifacts as ConnectorJobArtifact[])
        : EMPTY_CONNECTOR_ARTIFACTS;
    const hydrationArtifactsSignature = getArtifactsSignature(hydrationArtifacts);
    const hydrationArtifactUrlsById = matchingHydrationSnapshot?.artifactUrlsById || EMPTY_STRING_RECORD;
    const hydrationArtifactJsonById = matchingHydrationSnapshot?.artifactJsonById || EMPTY_JSON_RECORD;
    const hydrationArtifactUrlsSignature = getRecordSignature(hydrationArtifactUrlsById);
    const hydrationArtifactJsonSignature = getRecordSignature(hydrationArtifactJsonById);
    const hasMatchingHydrationSnapshot = Boolean(matchingHydrationSnapshot);
    const { getSignedUrl } = useSignedUrlCache({ userId: sessionUserId || null });

    const [artifacts, setArtifacts] = useState<ConnectorJobArtifact[]>([]);
    const [artifactUrlsById, setArtifactUrlsById] = useState<Record<string, string>>({});
    const [artifactJsonById, setArtifactJsonById] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const artifactsSignatureRef = useRef('');
    const artifactUrlSignatureRef = useRef('');
    const artifactJsonSignatureRef = useRef('');
    const scopeKeyRef = useRef('');
    const requestScopeKeyRef = useRef('');
    const hydrationStateRef = useRef('');

    useEffect(() => {
        requestScopeKeyRef.current = scopeKey;

        if (!scopeKey) {
            if (scopeKeyRef.current !== '') {
                setArtifacts((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_ARTIFACTS));
                setArtifactUrlsById((current) =>
                    Object.keys(current).length === 0 ? current : EMPTY_STRING_RECORD
                );
                setArtifactJsonById((current) => (Object.keys(current).length === 0 ? current : EMPTY_JSON_RECORD));
            }
            setLoading((current) => (current ? false : current));
            setError((current) => (current === null ? current : null));
            artifactsSignatureRef.current = '';
            artifactUrlSignatureRef.current = '';
            artifactJsonSignatureRef.current = '';
            scopeKeyRef.current = '';
            hydrationStateRef.current = '';
            return;
        }

        const nextHydrationState = hasMatchingHydrationSnapshot
            ? `${scopeKey}:hydrated:${hydrationArtifactsSignature}:${hydrationArtifactUrlsSignature}:${hydrationArtifactJsonSignature}`
            : `${scopeKey}:cold`;
        if (scopeKeyRef.current === scopeKey && hydrationStateRef.current === nextHydrationState) return;

        scopeKeyRef.current = scopeKey;
        hydrationStateRef.current = nextHydrationState;
        setError((current) => (current === null ? current : null));
        if (hasMatchingHydrationSnapshot) {
            artifactsSignatureRef.current = hydrationArtifactsSignature;
            artifactUrlSignatureRef.current = hydrationArtifactUrlsSignature;
            artifactJsonSignatureRef.current = hydrationArtifactJsonSignature;
            setArtifacts((current) =>
                getArtifactsSignature(current) === hydrationArtifactsSignature ? current : hydrationArtifacts
            );
            setArtifactUrlsById((current) =>
                getRecordSignature(current) === hydrationArtifactUrlsSignature ? current : hydrationArtifactUrlsById
            );
            setArtifactJsonById((current) =>
                getRecordSignature(current) === hydrationArtifactJsonSignature ? current : hydrationArtifactJsonById
            );
            setLoading((current) => (current ? false : current));
            return;
        }

        artifactsSignatureRef.current = '';
        artifactUrlSignatureRef.current = '';
        artifactJsonSignatureRef.current = '';
        setArtifacts((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_ARTIFACTS));
        setArtifactUrlsById((current) => (Object.keys(current).length === 0 ? current : EMPTY_STRING_RECORD));
        setArtifactJsonById((current) => (Object.keys(current).length === 0 ? current : EMPTY_JSON_RECORD));
        setLoading((current) => (current ? current : true));
    }, [
        hasMatchingHydrationSnapshot,
        hydrationArtifactJsonSignature,
        hydrationArtifactUrlsSignature,
        hydrationArtifactsSignature,
        scopeKey,
    ]);

    const runRefresh = useCallback(async (background = false) => {
        if (!sessionUserId || !normalizedJobId) {
            setArtifacts([]);
            setArtifactUrlsById({});
            setArtifactJsonById({});
            setLoading(false);
            setError(null);
            artifactsSignatureRef.current = '';
            artifactUrlSignatureRef.current = '';
            artifactJsonSignatureRef.current = '';
            return;
        }
        const requestScopeKey = requestScopeKeyRef.current;
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            let fetchPromise = inFlightArtifactFetches.get(scopeKey);
            if (!fetchPromise) {
                fetchPromise = (async () => {
                    const { data, error: fetchError } = await fetchConnectorJobArtifactsByJob({
                        jobId: normalizedJobId,
                        limit: 200,
                    });
                    if (fetchError) throw fetchError;
                    return (data || []) as ConnectorJobArtifact[];
                })();
                inFlightArtifactFetches.set(scopeKey, fetchPromise);
            }
            const nextArtifacts = await fetchPromise;
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            const nextSignature = getArtifactsSignature(nextArtifacts);
            if (artifactsSignatureRef.current !== nextSignature) {
                artifactsSignatureRef.current = nextSignature;
                setArtifacts(nextArtifacts);
            }
            if (background) setError(null);
        } catch (e: any) {
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            setError(String(e?.message || e));
        } finally {
            if (inFlightArtifactFetches.get(scopeKey)) {
                inFlightArtifactFetches.delete(scopeKey);
            }
            if (!background && requestScopeKeyRef.current === requestScopeKey) setLoading(false);
        }
    }, [normalizedJobId, scopeKey, sessionUserId]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    useEffect(() => {
        if (!scopeKey) return;

        if (!hasMatchingHydrationSnapshot) {
            void runRefresh(false);
        } else if (live) {
            void runRefresh(true);
        }
        if (!live) return;

        const timer = window.setInterval(() => void runRefresh(true), pollMs);
        return () => window.clearInterval(timer);
    }, [hasMatchingHydrationSnapshot, live, pollMs, runRefresh, scopeKey]);

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
            if (canceled) return;
            const nextSignature = getRecordSignature(nextUrls);
            if (artifactUrlSignatureRef.current === nextSignature) return;
            artifactUrlSignatureRef.current = nextSignature;
            setArtifactUrlsById(nextUrls);
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
            if (canceled) return;
            const nextSignature = getRecordSignature(nextJson);
            if (artifactJsonSignatureRef.current === nextSignature) return;
            artifactJsonSignatureRef.current = nextSignature;
            setArtifactJsonById(nextJson);
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
