import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { WORKSPACE_COLLAB_POLL_MS, WORKSPACE_COLLAB_TTL_SECONDS } from '../constants/zefgen';
import type { AppPage } from '../utils/routes';
import { createId } from '../utils/id';
import type { BrandLockResult, WorkspaceSessionSnapshot } from '../types/zefgen';

const DEVICE_ID_KEY = 'zefgen.deviceId';

type WorkspaceAction = 'heartbeat' | 'claim_brand' | 'release_brand' | 'snapshot';

type WorkspaceRequestBody = {
    action: WorkspaceAction;
    clientSessionId: string;
    clientDeviceId: string;
    ttlSeconds?: number;
    brandId?: string | null;
};

type Params = {
    session: Session | null;
    activePage: AppPage;
    selectedBrandId: string | null;
    heartbeatBrandId?: string | null;
    enabled?: boolean;
    pollMs?: number;
    ttlSeconds?: number;
    onSoftWarning?: () => void;
};

const normalizeCountry = (value: unknown) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (raw === 'unknown') return 'unknown';
    return /^[a-z]{2}$/.test(raw) ? raw : 'unknown';
};

const normalizeSnapshot = (payload: any): WorkspaceSessionSnapshot => {
    const countries = Array.isArray(payload?.active_session_countries)
        ? payload.active_session_countries.map((value: any) => normalizeCountry(value))
        : [];
    const brandIds = Array.isArray(payload?.locked_brand_ids_by_other_devices)
        ? payload.locked_brand_ids_by_other_devices
              .map((value: any) => String(value || '').trim())
              .filter((value: string) => Boolean(value))
        : [];
    return {
        active_session_count: Math.max(0, Number(payload?.active_session_count || 0) || 0),
        active_session_countries: countries,
        locked_brand_ids_by_other_devices: brandIds,
    };
};

const normalizeLockResult = (payload: any): BrandLockResult => ({
    ok: Boolean(payload?.ok),
    reason: payload?.reason == null ? null : String(payload.reason),
});

const readOrCreateDeviceId = () => {
    let deviceId = '';
    try {
        deviceId = String(window.localStorage.getItem(DEVICE_ID_KEY) || '').trim();
        if (!deviceId) {
            deviceId = createId();
            window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
    } catch {
        deviceId = createId();
    }
    return deviceId;
};

export const useWorkspaceCollaboration = ({
    session,
    activePage,
    selectedBrandId,
    heartbeatBrandId,
    enabled = true,
    pollMs = WORKSPACE_COLLAB_POLL_MS,
    ttlSeconds = WORKSPACE_COLLAB_TTL_SECONDS,
    onSoftWarning,
}: Params) => {
    const initialClientIds = useMemo(() => {
        if (typeof window === 'undefined') {
            return { deviceId: '', sessionId: '' };
        }
        return { deviceId: readOrCreateDeviceId(), sessionId: createId() };
    }, []);
    const [clientDeviceId, setClientDeviceId] = useState(initialClientIds.deviceId);
    const [clientSessionId, setClientSessionId] = useState(initialClientIds.sessionId);
    const [activeSessionCount, setActiveSessionCount] = useState(1);
    const [activeSessionCountries, setActiveSessionCountries] = useState<string[]>([]);
    const [lockedBrandIds, setLockedBrandIds] = useState<string[]>([]);
    const [lockConflictBrandId, setLockConflictBrandId] = useState<string | null>(null);

    const pollTimerRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);
    const warnedCollabOutageRef = useRef(false);

    const lockedBrandIdSet = useMemo(() => new Set(lockedBrandIds), [lockedBrandIds]);
    const isEnabled = Boolean(enabled && session && clientDeviceId && clientSessionId);

    const regenerateClientSessionId = useCallback(() => {
        const nextSessionId = createId();
        setClientSessionId(nextSessionId);
        return nextSessionId;
    }, []);

    const clearPollTimer = useCallback(() => {
        if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const postAction = useCallback(
        async (body: WorkspaceRequestBody, opts?: { keepalive?: boolean }) => {
            if (!session?.access_token) {
                throw new Error('Missing session token');
            }

            const response = await fetch('/api/workspace-sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
                keepalive: Boolean(opts?.keepalive),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = String(payload?.error || payload?.message || 'Workspace collaboration request failed');
                throw new Error(message);
            }
            return payload;
        },
        [session?.access_token]
    );

    const getHeartbeatBrandId = useCallback(() => {
        if (activePage !== 'workspace') return null;
        if (heartbeatBrandId !== undefined) return heartbeatBrandId || null;
        return selectedBrandId || null;
    }, [activePage, heartbeatBrandId, selectedBrandId]);

    const refreshSnapshot = useCallback(
        async (overrides?: { sessionId?: string; deviceId?: string }) => {
            if (!isEnabled) return;
            const effectiveSessionId = overrides?.sessionId || clientSessionId;
            const effectiveDeviceId = overrides?.deviceId || clientDeviceId;
            const payload = await postAction({
                action: 'snapshot',
                clientSessionId: effectiveSessionId,
                clientDeviceId: effectiveDeviceId,
            });
            const normalized = normalizeSnapshot(payload);
            setActiveSessionCount(Math.max(1, normalized.active_session_count));
            setActiveSessionCountries(normalized.active_session_countries);
            setLockedBrandIds(normalized.locked_brand_ids_by_other_devices);
        },
        [isEnabled, postAction, clientSessionId, clientDeviceId]
    );

    const sendHeartbeat = useCallback(async () => {
        if (!isEnabled) return { ok: false, reason: 'disabled' } as BrandLockResult;
        const brandId = getHeartbeatBrandId();
        const runHeartbeat = async (sessionId: string) => {
            const payload = await postAction({
                action: 'heartbeat',
                clientSessionId: sessionId,
                clientDeviceId,
                brandId,
                ttlSeconds,
            });
            return normalizeLockResult(payload);
        };

        let effectiveSessionId = clientSessionId;
        let result = await runHeartbeat(effectiveSessionId);
        if (result.reason === 'session_id_collision') {
            effectiveSessionId = regenerateClientSessionId();
            result = await runHeartbeat(effectiveSessionId);
            await refreshSnapshot({ sessionId: effectiveSessionId, deviceId: clientDeviceId }).catch(() => {});
        }
        return result;
    }, [
        isEnabled,
        getHeartbeatBrandId,
        postAction,
        clientSessionId,
        clientDeviceId,
        ttlSeconds,
        regenerateClientSessionId,
        refreshSnapshot,
    ]);

    const tryClaimBrand = useCallback(
        async (brandId: string): Promise<BrandLockResult> => {
            if (!isEnabled) {
                return { ok: false, reason: 'disabled' };
            }
            const normalizedBrandId = String(brandId || '').trim();
            if (!normalizedBrandId) {
                return { ok: false, reason: 'brand_required' };
            }
            try {
                const runClaim = async (sessionId: string) => {
                    const payload = await postAction({
                        action: 'claim_brand',
                        clientSessionId: sessionId,
                        clientDeviceId,
                        brandId: normalizedBrandId,
                        ttlSeconds,
                    });
                    return normalizeLockResult(payload);
                };

                let effectiveSessionId = clientSessionId;
                let result = await runClaim(effectiveSessionId);
                if (result.reason === 'session_id_collision') {
                    effectiveSessionId = regenerateClientSessionId();
                    result = await runClaim(effectiveSessionId);
                    await refreshSnapshot({ sessionId: effectiveSessionId, deviceId: clientDeviceId }).catch(() => {});
                }

                if (result.ok) {
                    setLockConflictBrandId(null);
                } else if (result.reason === 'locked_by_other_device') {
                    setLockConflictBrandId(normalizedBrandId);
                }
                void refreshSnapshot({ sessionId: effectiveSessionId, deviceId: clientDeviceId }).catch(() => {});
                return result;
            } catch {
                return { ok: false, reason: 'unavailable' };
            }
        },
        [
            isEnabled,
            postAction,
            clientSessionId,
            clientDeviceId,
            ttlSeconds,
            refreshSnapshot,
            regenerateClientSessionId,
        ]
    );

    const releaseCurrentBrand = useCallback(async () => {
        if (!isEnabled) return;
        const brandId = getHeartbeatBrandId();
        await postAction({
            action: 'release_brand',
            clientSessionId,
            clientDeviceId,
            brandId,
        }).catch(() => {});
        setLockConflictBrandId(null);
    }, [isEnabled, getHeartbeatBrandId, postAction, clientSessionId, clientDeviceId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!clientDeviceId) {
            setClientDeviceId(readOrCreateDeviceId());
        }
        if (!clientSessionId) {
            setClientSessionId(createId());
        }
    }, [clientDeviceId, clientSessionId]);

    useEffect(() => {
        if (!isEnabled) {
            clearPollTimer();
            inFlightRef.current = false;
            setActiveSessionCount(0);
            setActiveSessionCountries([]);
            setLockedBrandIds([]);
            setLockConflictBrandId(null);
            warnedCollabOutageRef.current = false;
            return;
        }

        setActiveSessionCount((prev) => (prev < 1 ? 1 : prev));

        const run = async () => {
            if (inFlightRef.current) return;
            inFlightRef.current = true;
            try {
                const heartbeat = await sendHeartbeat();
                const heartbeatBrandId = getHeartbeatBrandId();
                if (!heartbeat.ok && heartbeat.reason === 'locked_by_other_device' && heartbeatBrandId) {
                    setLockConflictBrandId(heartbeatBrandId);
                } else if (heartbeat.ok) {
                    setLockConflictBrandId((prev) => (prev === heartbeatBrandId ? null : prev));
                }

                await refreshSnapshot();
                warnedCollabOutageRef.current = false;
            } catch {
                // Keep last known state on transient failures.
                if (!warnedCollabOutageRef.current) {
                    warnedCollabOutageRef.current = true;
                    onSoftWarning?.();
                }
            } finally {
                inFlightRef.current = false;
            }
        };

        run();
        const runNow = () => {
            void run();
        };
        const runWhenVisible = () => {
            if (document.visibilityState === 'visible') {
                void run();
            }
        };
        clearPollTimer();
        pollTimerRef.current = window.setInterval(run, Math.max(3000, Math.floor(pollMs)));
        window.addEventListener('focus', runNow);
        window.addEventListener('online', runNow);
        document.addEventListener('visibilitychange', runWhenVisible);
        return () => {
            clearPollTimer();
            window.removeEventListener('focus', runNow);
            window.removeEventListener('online', runNow);
            document.removeEventListener('visibilitychange', runWhenVisible);
        };
    }, [
        isEnabled,
        pollMs,
        sendHeartbeat,
        refreshSnapshot,
        getHeartbeatBrandId,
        onSoftWarning,
        clearPollTimer,
    ]);

    useEffect(() => {
        if (!isEnabled) return;

        const sendKeepaliveRelease = () => {
            const brandId = getHeartbeatBrandId();
            void postAction(
                {
                    action: 'release_brand',
                    clientSessionId,
                    clientDeviceId,
                    brandId,
                },
                { keepalive: true }
            ).catch(() => {});
        };

        window.addEventListener('pagehide', sendKeepaliveRelease);
        window.addEventListener('beforeunload', sendKeepaliveRelease);
        return () => {
            window.removeEventListener('pagehide', sendKeepaliveRelease);
            window.removeEventListener('beforeunload', sendKeepaliveRelease);
        };
    }, [isEnabled, getHeartbeatBrandId, postAction, clientSessionId, clientDeviceId]);

    return {
        clientDeviceId,
        clientSessionId,
        activeSessionCount,
        activeSessionCountries,
        lockedBrandIdSet,
        lockConflictBrandId,
        tryClaimBrand,
        releaseCurrentBrand,
        refreshSnapshot,
    };
};
