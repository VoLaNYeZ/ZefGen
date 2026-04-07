import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppIdea, AppIdeaCategory, IdeaAppAssignment } from '../types/zefgen';
import {
    createAppIdea,
    deleteAppIdea,
    fetchAppIdeas,
    fetchIdeaAssignments,
    fetchIdeaCategories,
    type UpdateAppIdeaResponse,
    updateAppIdea,
} from '../data/app-ideas';

type AppIdeasRefreshOptions = {
    background?: boolean;
};

const normalizeRefreshOptions = (options?: AppIdeasRefreshOptions) => ({
    background: options?.background === true,
});

const mergeRefreshOptions = (
    current: ReturnType<typeof normalizeRefreshOptions> | null,
    next?: AppIdeasRefreshOptions | ReturnType<typeof normalizeRefreshOptions> | null
) => {
    const normalizedNext = normalizeRefreshOptions(next ?? undefined);
    if (!current) {
        return normalizedNext;
    }
    return {
        // Foreground refreshes win over background refreshes.
        background: current.background && normalizedNext.background,
    };
};

export const useAppIdeas = (payload: {
    session: Session | null;
    onDataError?: (message: string) => void;
}) => {
    const { session, onDataError } = payload;

    const [categories, setCategories] = useState<AppIdeaCategory[]>([]);
    const [ideas, setIdeas] = useState<AppIdea[]>([]);
    const [ideaAssignments, setIdeaAssignments] = useState<IdeaAppAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sessionRef = useRef<Session | null>(session);
    const onDataErrorRef = useRef<typeof onDataError>(onDataError);
    const lastUserIdRef = useRef<string | null>(null);
    const refreshInFlightRef = useRef<Promise<void> | null>(null);
    const refreshPendingOptionsRef = useRef<ReturnType<typeof normalizeRefreshOptions> | null>(null);
    const ideaMutationVersionRef = useRef(0);

    sessionRef.current = session;
    onDataErrorRef.current = onDataError;

    const runRefresh = useCallback(async (options?: AppIdeasRefreshOptions) => {
        const normalizedOptions = normalizeRefreshOptions(options);
        const currentSession = sessionRef.current;
        if (!currentSession) {
            setIdeas([]);
            setCategories([]);
            setIdeaAssignments([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }

        const userId = currentSession.user.id;
        const mutationVersionAtStart = ideaMutationVersionRef.current;

        if (!normalizedOptions.background) {
            setLoading(true);
            setError(null);
        }

        try {
            const [categoriesResp, ideasResp, assignmentsResp] = await Promise.all([
                fetchIdeaCategories(),
                fetchAppIdeas(userId),
                fetchIdeaAssignments(userId),
            ]);

            if (sessionRef.current?.user.id !== userId) {
                return;
            }

            if (categoriesResp.error) {
                throw categoriesResp.error;
            }

            if (ideasResp.error) {
                throw ideasResp.error;
            }

            if (assignmentsResp.error) {
                throw assignmentsResp.error;
            }

            if (ideaMutationVersionRef.current !== mutationVersionAtStart) {
                refreshPendingOptionsRef.current = mergeRefreshOptions(refreshPendingOptionsRef.current, normalizedOptions);
                return;
            }

            setCategories(categoriesResp.data || []);
            setIdeas(ideasResp.data || []);
            setIdeaAssignments(assignmentsResp.data || []);
            lastUserIdRef.current = userId;
            setError(null);
        } catch (refreshError: any) {
            if (sessionRef.current?.user.id !== userId) {
                return;
            }
            const message = String(refreshError?.message || refreshError);
            setError(message);
            onDataErrorRef.current?.(message);
        } finally {
            if (!normalizedOptions.background && sessionRef.current?.user.id === userId) {
                setLoading(false);
            }
        }
    }, []);

    const refresh = useCallback((options?: AppIdeasRefreshOptions) => {
        const normalizedOptions = normalizeRefreshOptions(options);
        if (refreshInFlightRef.current) {
            refreshPendingOptionsRef.current = mergeRefreshOptions(refreshPendingOptionsRef.current, normalizedOptions);
            return refreshInFlightRef.current;
        }

        let request: Promise<void>;
        request = (async () => {
            let nextOptions: ReturnType<typeof normalizeRefreshOptions> | null = normalizedOptions;
            while (nextOptions) {
                await runRefresh(nextOptions);
                nextOptions = refreshPendingOptionsRef.current;
                refreshPendingOptionsRef.current = null;
            }
        })().finally(() => {
            if (refreshInFlightRef.current === request) {
                refreshInFlightRef.current = null;
            }
        });

        refreshInFlightRef.current = request;
        return request;
    }, [runRefresh]);

    useEffect(() => {
        if (!session) {
            setIdeas([]);
            setCategories([]);
            setIdeaAssignments([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id) return;
        refresh();
    }, [session, refresh]);

    const createIdea = useCallback(
        async (args: {
            row: Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;
        }) => {
            const currentSession = sessionRef.current;
            if (!currentSession) throw new Error('Not authenticated.');
            const { data, error } = await createAppIdea({
                userId: currentSession.user.id,
                row: args.row,
            });
            if (error) throw error;
            const nextIdea = ((data as unknown) || null) as AppIdea | null;
            if (nextIdea) {
                ideaMutationVersionRef.current += 1;
                setIdeas((prev) => {
                    const exists = prev.some((idea) => idea.id === nextIdea.id);
                    if (exists) return prev.map((idea) => (idea.id === nextIdea.id ? nextIdea : idea));
                    return [nextIdea, ...prev];
                });
            }
            return nextIdea;
        },
        []
    );

    const updateIdea = useCallback(
        async (args: {
            id: string;
            patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>>;
            expectedUpdatedAt?: string | null;
        }) => {
            const currentSession = sessionRef.current;
            if (!currentSession) throw new Error('Not authenticated.');
            const { data, error } = await updateAppIdea({
                userId: currentSession.user.id,
                id: args.id,
                patch: args.patch,
                expectedUpdatedAt: args.expectedUpdatedAt || null,
            });
            if (error) throw error;

            const result = ((data as unknown) || null) as UpdateAppIdeaResponse | null;
            if (!result) {
                throw new Error('Missing response from updateAppIdea.');
            }

            if (result.status === 'saved' && result.row) {
                ideaMutationVersionRef.current += 1;
                setIdeas((prev) => prev.map((idea) => (idea.id === result.row!.id ? result.row! : idea)));
            }
            return result;
        },
        []
    );

    const deleteIdea = useCallback(
        async (args: { id: string }) => {
            const currentSession = sessionRef.current;
            if (!currentSession) throw new Error('Not authenticated.');
            const { error } = await deleteAppIdea({ userId: currentSession.user.id, id: args.id });
            if (error) throw error;
            ideaMutationVersionRef.current += 1;
            setIdeas((prev) => prev.filter((idea) => idea.id !== args.id));
            setIdeaAssignments((prev) => prev.filter((row) => row.idea_id !== args.id));
        },
        []
    );

    return {
        categories,
        ideas,
        ideaAssignments,
        loading,
        error,
        refresh,
        createIdea,
        updateIdea,
        deleteIdea,
        setIdeas,
    };
};
