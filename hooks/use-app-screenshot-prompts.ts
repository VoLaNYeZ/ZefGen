import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem, AppScreenshotPrompt, Brand } from '../types/zefgen';
import {
    deleteAppScreenshotPrompts,
    fetchAppScreenshotPrompts,
    upsertAppScreenshotPrompts,
} from '../data/app-screenshot-prompts';

const PROMPT_DEBOUNCE_MS = 1500;
const PROMPT_FLUSH_MS = 30000;

export type AppScreenshotPromptsSnapshot = {
    appId: string;
    brandId: string;
    promptsByRefId: Record<string, string>;
};

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    hydrationSnapshot?: AppScreenshotPromptsSnapshot | null;
    reportError?: (message: string) => void;
};

export const useAppScreenshotPrompts = ({
    session,
    selectedBrand,
    selectedApp,
    hydrationSnapshot,
    reportError,
}: Params) => {
    const [promptsByRefId, setPromptsByRefId] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const dirtyRef = useRef<Set<string>>(new Set());
    const promptsRef = useRef<Record<string, string>>({});
    const debounceRef = useRef<number | null>(null);
    const migrationDoneRef = useRef(false);
    const sessionRef = useRef<Session | null>(session);
    const brandRef = useRef<Brand | null>(selectedBrand);
    const appRef = useRef<AppItem | null>(selectedApp);
    const hydrationSnapshotRef = useRef<AppScreenshotPromptsSnapshot | null>(hydrationSnapshot ?? null);

    useEffect(() => {
        promptsRef.current = promptsByRefId;
    }, [promptsByRefId]);

    useEffect(() => {
        sessionRef.current = session;
        brandRef.current = selectedBrand;
        appRef.current = selectedApp;
    }, [session, selectedBrand, selectedApp]);

    useEffect(() => {
        hydrationSnapshotRef.current = hydrationSnapshot ?? null;
    }, [hydrationSnapshot]);

    const flushDirty = useCallback(
        async (override?: { userId: string; brandId: string; appId: string }) => {
            const userId = override?.userId ?? sessionRef.current?.user.id;
            const brandId = override?.brandId ?? brandRef.current?.id;
            const appId = override?.appId ?? appRef.current?.id;
            if (!userId || !brandId || !appId) return true;
            if (!dirtyRef.current.size) return true;

            const dirtyIds = Array.from(dirtyRef.current.values()) as string[];
            const rows: Array<{ refId: string; value: string }> = dirtyIds.map((refId) => ({
                refId,
                value: promptsRef.current[refId] ?? '',
            }));
            const toUpsert: Array<Omit<AppScreenshotPrompt, 'id' | 'updated_at'>> = rows
                .filter((row) => row.value.trim().length > 0)
                .map((row) => ({
                    user_id: userId,
                    brand_id: brandId,
                    app_id: appId,
                    brand_reference_id: row.refId,
                    prompt: row.value,
                }));
            const toDelete: string[] = rows
                .filter((row) => row.value.trim().length === 0)
                .map((row) => row.refId);

            try {
                if (toUpsert.length) {
                    const { error } = await upsertAppScreenshotPrompts({ rows: toUpsert });
                    if (error) throw error;
                }
                if (toDelete.length) {
                    const { error } = await deleteAppScreenshotPrompts({
                        userId,
                        appId,
                        refIds: toDelete,
                    });
                    if (error) throw error;
                }
                dirtyRef.current = new Set();
                setIsDirty(false);
                return true;
            } catch (err: any) {
                const message = err?.message || 'Failed to save prompts.';
                setError(message);
                reportError?.(message);
                return false;
            }
        },
        [reportError]
    );

    const scheduleFlush = useCallback(() => {
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
            flushDirty();
        }, PROMPT_DEBOUNCE_MS);
    }, [flushDirty]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            flushDirty();
        }, PROMPT_FLUSH_MS);
        return () => window.clearInterval(intervalId);
    }, [flushDirty]);

    const applySnapshot = useCallback((snapshot: AppScreenshotPromptsSnapshot | null | undefined) => {
        const appId = String(selectedApp?.id || '').trim();
        const brandId = String(selectedBrand?.id || '').trim();
        if (!appId || !brandId) return;
        const safeSnapshot =
            snapshot &&
            String(snapshot.appId || '').trim() === appId &&
            String(snapshot.brandId || '').trim() === brandId
                ? snapshot
                : {
                      appId,
                      brandId,
                      promptsByRefId: {},
                  };
        const nextPrompts = { ...(safeSnapshot.promptsByRefId || {}) };
        setPromptsByRefId(nextPrompts);
        promptsRef.current = nextPrompts;
        dirtyRef.current = new Set();
        setIsDirty(false);
        setLoading(false);
    }, [selectedApp?.id, selectedBrand?.id]);

    useLayoutEffect(() => {
        if (!selectedBrand?.id || !selectedApp?.id) return;
        const matchingHydrationSnapshot =
            hydrationSnapshotRef.current &&
            String(hydrationSnapshotRef.current.appId || '') === String(selectedApp?.id || '') &&
            String(hydrationSnapshotRef.current.brandId || '') === String(selectedBrand?.id || '')
                ? hydrationSnapshotRef.current
                : null;
        if (!matchingHydrationSnapshot) return;
        applySnapshot(matchingHydrationSnapshot);
    }, [applySnapshot, selectedApp?.id, selectedBrand?.id]);

    useEffect(() => {
        let isMounted = true;
        const userId = session?.user.id;
        const brandId = selectedBrand?.id;
        const appId = selectedApp?.id;
        const hasHydrationSnapshot =
            Boolean(hydrationSnapshotRef.current) &&
            String(hydrationSnapshotRef.current?.appId || '') === String(appId || '') &&
            String(hydrationSnapshotRef.current?.brandId || '') === String(brandId || '');

        if (!userId || !brandId || !appId) {
            setPromptsByRefId({});
            dirtyRef.current = new Set();
            setIsDirty(false);
            setLoading(false);
            setError(null);
            return;
        }

        dirtyRef.current = new Set();
        setIsDirty(false);
        setLoading(!hasHydrationSnapshot);
        setError(null);

        const load = async () => {
            const { data, error } = await fetchAppScreenshotPrompts({
                userId,
                brandId,
                appId,
            });
            if (!isMounted) return;
            if (error) {
                setError(error.message);
                reportError?.(error.message);
            } else {
                const nextPrompts: Record<string, string> = {};
                (data || []).forEach((row) => {
                    nextPrompts[row.brand_reference_id] = row.prompt ?? '';
                });
                if (dirtyRef.current.size > 0) {
                    setPromptsByRefId((prev) => {
                        const merged = { ...nextPrompts };
                        dirtyRef.current.forEach((refId) => {
                            if (Object.prototype.hasOwnProperty.call(prev, refId)) {
                                merged[refId] = prev[refId] ?? '';
                            }
                        });
                        promptsRef.current = merged;
                        return merged;
                    });
                } else {
                    promptsRef.current = nextPrompts;
                    setPromptsByRefId(nextPrompts);
                }
            }
            setLoading(false);

            if (!migrationDoneRef.current) {
                try {
                    const stored = window.localStorage.getItem('zefgen.appScreenshotPrompts');
                    if (stored) {
                        const parsed = JSON.parse(stored) as Record<string, Record<string, string>>;
                        const appPrompts = parsed?.[appId];
                        if (appPrompts && typeof appPrompts === 'object') {
                            const rows = Object.entries(appPrompts)
                                .filter(([, value]) => typeof value === 'string')
                                .map(([refId, value]) => ({
                                    user_id: userId,
                                    brand_id: brandId,
                                    app_id: appId,
                                    brand_reference_id: refId,
                                    prompt: String(value),
                                }));
                            if (rows.length) {
                                await upsertAppScreenshotPrompts({ rows });
                                setPromptsByRefId((prev) => ({ ...prev, ...appPrompts }));
                            }
                        }
                        window.localStorage.removeItem('zefgen.appScreenshotPrompts');
                    }
                } catch {
                    // Ignore migration errors.
                } finally {
                    migrationDoneRef.current = true;
                }
            }
        };

        load();

        return () => {
            isMounted = false;
            flushDirty({ userId, brandId, appId });
        };
    }, [session, selectedBrand, selectedApp, reportError, flushDirty]);

    const setPrompt = (refId: string, value: string) => {
        setPromptsByRefId((prev) => ({
            ...prev,
            [refId]: value,
        }));
        dirtyRef.current.add(refId);
        setIsDirty(true);
        scheduleFlush();
    };

    const flushPending = useCallback(async () => {
        return await flushDirty();
    }, [flushDirty]);

    const buildSnapshot = useCallback((): AppScreenshotPromptsSnapshot | null => {
        const appId = String(selectedApp?.id || '').trim();
        const brandId = String(selectedBrand?.id || '').trim();
        if (!appId || !brandId) return null;
        return {
            appId,
            brandId,
            promptsByRefId: { ...promptsRef.current },
        };
    }, [selectedApp?.id, selectedBrand?.id]);

    return {
        promptsByRefId,
        isDirty,
        setPrompt,
        flushPending,
        buildSnapshot,
    };
};
