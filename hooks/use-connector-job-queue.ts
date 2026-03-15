import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem, Brand } from '../types/zefgen';
import type { ConnectorJob, ConnectorJobStatus } from '../data/connector-jobs';
import { fetchConnectorJobsForUser, requestCancelConnectorJob } from '../data/connector-jobs';
import type { GenerationJob, GenerationJobStatus } from './use-generation-jobs';
import { isNoBrand } from '../utils/no-brand';

const clampPollMs = (ms: number) => Math.max(1200, Math.floor(ms));

const toTs = (value: any) => {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
};

const isTerminal = (status: ConnectorJobStatus) =>
    status === 'succeeded' || status === 'failed' || status === 'canceled';

const mapStatus = (status: ConnectorJobStatus): { status: GenerationJobStatus; message?: string } => {
    if (status === 'queued') return { status: 'queued', message: 'Queued' };
    if (status === 'running') return { status: 'running', message: 'Running' };
    if (status === 'waiting_for_user') return { status: 'running', message: 'Waiting for your input' };
    if (status === 'succeeded') return { status: 'success', message: 'Done' };
    if (status === 'failed') return { status: 'error', message: 'Failed' };
    if (status === 'canceled') return { status: 'canceled', message: 'Canceled' };
    return { status: 'running', message: String(status || '') || undefined };
};

const mapKind = (
    kind: string | null | undefined
):
    | 'connector_generate'
    | 'connector_fix'
    | 'connector_integration'
    | 'connector_qa'
    | 'connector_screenshots'
    | 'connector_idea_generation' => {
    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'fix') return 'connector_fix';
    if (normalized === 'integration') return 'connector_integration';
    if (normalized === 'visual_qa') return 'connector_qa';
    if (normalized === 'screenshots') return 'connector_screenshots';
    if (normalized === 'idea_generation') return 'connector_idea_generation';
    return 'connector_generate';
};

export const useConnectorJobQueue = (payload: {
    session: Session | null;
    apps: AppItem[];
    brands: Brand[];
    pollMs?: number;
}) => {
    const { session, apps, brands } = payload;
    const pollMs = clampPollMs(payload.pollMs ?? 2500);

    const storageKey = useMemo(() => {
        const uid = String(session?.user?.id || '').trim();
        return uid ? `zefgen.connectorJobQueue.v1.${uid}` : null;
    }, [session?.user?.id]);

    const dismissedByIdRef = useRef<Record<string, true>>({});
    const dismissedAtByIdRef = useRef<Record<string, number>>({});
    const hideFinishedBeforeMsRef = useRef<number>(0);
    const [cacheById, setCacheById] = useState<Record<string, ConnectorJob>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const appLabelById = useMemo(() => {
        const map = new Map<string, string>();
        for (const app of apps) {
            const alias = String(app.alias || '').trim();
            const name = String(app.name || '').trim();
            map.set(app.id, alias ? alias.toUpperCase() : name ? name : app.id.slice(0, 6));
        }
        return map;
    }, [apps]);
    const brandLabelById = useMemo(() => {
        const map = new Map<string, string>();
        for (const brand of brands) {
            map.set(brand.id, isNoBrand(brand) ? 'No Brand' : String(brand.name || '').trim() || brand.id.slice(0, 6));
        }
        return map;
    }, [brands]);

    // Persist "dismissed" and "clear finished" across refresh so the queue feels product-grade.
    useEffect(() => {
        if (!storageKey) return;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const dismissed = parsed?.dismissed_by_id;
            const hideBefore = Number(parsed?.hide_finished_before_ms || 0);

            if (dismissed && typeof dismissed === 'object') {
                const atById: Record<string, number> = {};
                const byId: Record<string, true> = {};
                for (const [id, ts] of Object.entries(dismissed)) {
                    const key = String(id || '').trim();
                    const n = Number(ts);
                    if (!key) continue;
                    if (!Number.isFinite(n) || n <= 0) continue;
                    atById[key] = n;
                    byId[key] = true;
                }
                dismissedAtByIdRef.current = atById;
                dismissedByIdRef.current = byId;
            }

            if (Number.isFinite(hideBefore) && hideBefore > 0) {
                hideFinishedBeforeMsRef.current = hideBefore;
            }
        } catch {
            // ignore
        }
    }, [storageKey]);

    const persistHiddenState = useCallback(() => {
        if (!storageKey) return;
        try {
            // Cap dismissed list to most recent 250 entries to avoid unbounded localStorage growth.
            const entries = Object.entries(dismissedAtByIdRef.current || {}).filter(
                ([id, ts]) => Boolean(String(id || '').trim()) && Number.isFinite(Number(ts)) && Number(ts) > 0
            );
            entries.sort((a, b) => Number(b[1]) - Number(a[1]));
            const trimmed = entries.slice(0, 250);
            const dismissedById: Record<string, number> = {};
            for (const [id, ts] of trimmed) dismissedById[id] = Number(ts);

            window.localStorage.setItem(
                storageKey,
                JSON.stringify({
                    dismissed_by_id: dismissedById,
                    hide_finished_before_ms: hideFinishedBeforeMsRef.current || 0,
                })
            );
        } catch {
            // ignore
        }
    }, [storageKey]);

    const shouldHideRow = useCallback((row: ConnectorJob) => {
        if (!row?.id) return true;
        if (dismissedByIdRef.current[row.id]) return true;

        const hideBefore = hideFinishedBeforeMsRef.current || 0;
        if (hideBefore > 0 && isTerminal(row.status)) {
            const ended = toTs(row.ended_at || row.updated_at || row.created_at);
            if (ended && ended <= hideBefore) return true;
        }

        return false;
    }, []);

    const refresh = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: e } = await fetchConnectorJobsForUser({
                userId: session.user.id,
                limit: 25,
            });
            if (e) throw e;

            const rows = (data || []) as ConnectorJob[];
            setCacheById((prev) => {
                let next = prev;
                for (const row of rows) {
                    if (!row?.id) continue;
                    if (shouldHideRow(row)) continue;
                    // Shallow merge keeps our object stable if nothing changed.
                    const existing = prev[row.id];
                    if (existing && existing.updated_at === row.updated_at && existing.status === row.status) continue;
                    if (next === prev) next = { ...prev };
                    next[row.id] = row;
                }

                // Cap to 50 newest-by-updated_at to avoid unbounded growth.
                const ids = Object.keys(next);
                if (ids.length <= 50) return next;
                const sorted = ids
                    .map((id) => ({ id, ts: toTs(next[id]?.updated_at || next[id]?.created_at) }))
                    .sort((a, b) => b.ts - a.ts)
                    .slice(0, 50)
                    .map((v) => v.id);
                const keep = new Set(sorted);
                const trimmed: Record<string, ConnectorJob> = {};
                for (const id of sorted) trimmed[id] = next[id];
                // Mark trimmed ids as dismissed for this session so they don't pop back in.
                for (const id of ids) {
                    if (!keep.has(id)) {
                        dismissedByIdRef.current[id] = true;
                        dismissedAtByIdRef.current[id] = Date.now();
                    }
                }
                persistHiddenState();
                return trimmed;
            });
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            setLoading(false);
        }
    }, [session, persistHiddenState, shouldHideRow]);

    useEffect(() => {
        if (!session) {
            setCacheById({});
            setLoading(false);
            setError(null);
            dismissedByIdRef.current = {};
            dismissedAtByIdRef.current = {};
            hideFinishedBeforeMsRef.current = 0;
            return;
        }
        refresh();
        const t = window.setInterval(refresh, pollMs);
        return () => window.clearInterval(t);
    }, [session?.user?.id, pollMs, refresh]);

    const jobs: GenerationJob[] = useMemo(() => {
        const rows = Object.values(cacheById) as ConnectorJob[];
        const mapped = rows
            .filter((row) => row?.id && !shouldHideRow(row))
            .map((row) => {
                const appLabel = row.app_id ? appLabelById.get(row.app_id) ?? '' : '';
                const brandLabel = row.brand_id ? brandLabelById.get(row.brand_id) ?? '' : '';
                const kind = mapKind(row.kind);
                const statusMapped = mapStatus(row.status);
                const startedAt = toTs(row.started_at || row.created_at);
                const endedAt = row.ended_at ? toTs(row.ended_at) : undefined;

                const cancelRequested = Boolean(row.cancel_requested_at) && !isTerminal(row.status);
                const message = cancelRequested ? 'Cancel requested' : statusMapped.message;

                const title =
                    kind === 'connector_idea_generation'
                        ? `Runner: Idea Generator${brandLabel ? ` · ${brandLabel}` : ''}`
                        : appLabel
                          ? `Runner: ${appLabel} ${String(row.kind || 'generate')}`
                          : `Runner: ${String(row.kind || 'job')}`;

                return {
                    id: `connector:${row.id}`,
                    title,
                    kind,
                    status: statusMapped.status,
                    startedAt,
                    endedAt,
                    message,
                } satisfies GenerationJob;
            });

        mapped.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        return mapped.slice(0, 50);
    }, [appLabelById, brandLabelById, cacheById, shouldHideRow]);

    const hasRunningJobs = useMemo(
        () => jobs.some((j) => j.status === 'running' || j.status === 'queued'),
        [jobs]
    );

    const cancel = useCallback(
        async (jobId: string) => {
            if (!session) return;
            const id = String(jobId || '').trim();
            if (!id) return;
            try {
                await requestCancelConnectorJob({ userId: session.user.id, jobId: id });
                // Optimistic message update so it feels immediate.
                setCacheById((prev) => {
                    const existing = prev[id];
                    if (!existing) return prev;
                    return {
                        ...prev,
                        [id]: { ...existing, cancel_requested_at: new Date().toISOString() },
                    };
                });
            } catch {
                // Best-effort; polling will reconcile.
            }
        },
        [session]
    );

    const dismiss = useCallback((jobId: string) => {
        const id = String(jobId || '').trim();
        if (!id) return;
        dismissedByIdRef.current[id] = true;
        dismissedAtByIdRef.current[id] = Date.now();
        setCacheById((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
        persistHiddenState();
    }, [persistHiddenState]);

    const clearFinished = useCallback(() => {
        hideFinishedBeforeMsRef.current = Date.now();
        setCacheById((prev) => {
            const next: Record<string, ConnectorJob> = {};
            for (const [id, row] of Object.entries(prev) as Array<[string, ConnectorJob]>) {
                if (!row) continue;
                if (isTerminal(row.status)) {
                    dismissedByIdRef.current[id] = true;
                    dismissedAtByIdRef.current[id] = Date.now();
                    continue;
                }
                next[id] = row;
            }
            return next;
        });
        persistHiddenState();
    }, [persistHiddenState]);

    return {
        jobs,
        hasRunningJobs,
        loading,
        error,
        refresh,
        cancel,
        dismiss,
        clearFinished,
    };
};
