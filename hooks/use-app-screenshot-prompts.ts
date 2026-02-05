import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem, AppScreenshotPrompt, Brand } from '../types/zefgen';
import {
    deleteAppScreenshotPrompts,
    fetchAppScreenshotPrompts,
    upsertAppScreenshotPrompts,
} from '../data/app-screenshot-prompts';

const PROMPT_DEBOUNCE_MS = 1500;
const PROMPT_FLUSH_MS = 30000;

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    reportError?: (message: string) => void;
};

export const useAppScreenshotPrompts = ({
    session,
    selectedBrand,
    selectedApp,
    reportError,
}: Params) => {
    const [promptsByRefId, setPromptsByRefId] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirtyRef = useRef<Set<string>>(new Set());
    const promptsRef = useRef<Record<string, string>>({});
    const debounceRef = useRef<number | null>(null);
    const migrationDoneRef = useRef(false);
    const sessionRef = useRef<Session | null>(session);
    const brandRef = useRef<Brand | null>(selectedBrand);
    const appRef = useRef<AppItem | null>(selectedApp);

    useEffect(() => {
        promptsRef.current = promptsByRefId;
    }, [promptsByRefId]);

    useEffect(() => {
        sessionRef.current = session;
        brandRef.current = selectedBrand;
        appRef.current = selectedApp;
    }, [session, selectedBrand, selectedApp]);

    const flushDirty = useCallback(
        async (override?: { userId: string; brandId: string; appId: string }) => {
            const userId = override?.userId ?? sessionRef.current?.user.id;
            const brandId = override?.brandId ?? brandRef.current?.id;
            const appId = override?.appId ?? appRef.current?.id;
            if (!userId || !brandId || !appId) return;
            if (!dirtyRef.current.size) return;

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
            } catch (err: any) {
                const message = err?.message || 'Failed to save prompts.';
                setError(message);
                reportError?.(message);
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

    useEffect(() => {
        let isMounted = true;
        const userId = session?.user.id;
        const brandId = selectedBrand?.id;
        const appId = selectedApp?.id;

        if (!userId || !brandId || !appId) {
            setPromptsByRefId({});
            dirtyRef.current = new Set();
            setLoading(false);
            setError(null);
            return;
        }

        dirtyRef.current = new Set();
        setLoading(true);
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
                setPromptsByRefId(nextPrompts);
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
        scheduleFlush();
    };

    return {
        promptsByRefId,
        setPrompt,
        loading,
        error,
    };
};
