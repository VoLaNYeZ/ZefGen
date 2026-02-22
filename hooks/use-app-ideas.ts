import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppIdea, AppIdeaCategory } from '../types/zefgen';
import {
    createAppIdea,
    deleteAppIdea,
    fetchAppIdeas,
    fetchIdeaCategories,
    updateAppIdea,
} from '../data/app-ideas';

export const useAppIdeas = (payload: {
    session: Session | null;
    onDataError?: (message: string) => void;
}) => {
    const { session, onDataError } = payload;

    const [categories, setCategories] = useState<AppIdeaCategory[]>([]);
    const [ideas, setIdeas] = useState<AppIdea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const refresh = useCallback(async () => {
        if (!session) {
            setIdeas([]);
            setCategories([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }

        setLoading(true);
        setError(null);

        const [categoriesResp, ideasResp] = await Promise.all([
            fetchIdeaCategories(),
            fetchAppIdeas(session.user.id),
        ]);

        if (categoriesResp.error) {
            setError(categoriesResp.error.message);
            onDataError?.(categoriesResp.error.message);
            setLoading(false);
            return;
        }

        if (ideasResp.error) {
            setError(ideasResp.error.message);
            onDataError?.(ideasResp.error.message);
            setLoading(false);
            return;
        }

        setCategories(categoriesResp.data || []);
        setIdeas(ideasResp.data || []);
        lastUserIdRef.current = session.user.id;
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setIdeas([]);
            setCategories([]);
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
            if (!session) throw new Error('Not authenticated.');
            const { data, error } = await createAppIdea({
                userId: session.user.id,
                row: args.row,
            });
            if (error) throw error;
            if (data) {
                setIdeas((prev) => {
                    const exists = prev.some((idea) => idea.id === data.id);
                    if (exists) return prev.map((idea) => (idea.id === data.id ? data : idea));
                    return [...prev, data];
                });
            }
            return data;
        },
        [session]
    );

    const updateIdea = useCallback(
        async (args: {
            id: string;
            patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>>;
        }) => {
            if (!session) throw new Error('Not authenticated.');
            const { data, error } = await updateAppIdea({
                userId: session.user.id,
                id: args.id,
                patch: args.patch,
            });
            if (error) throw error;
            if (data) setIdeas((prev) => prev.map((idea) => (idea.id === data.id ? data : idea)));
            return data;
        },
        [session]
    );

    const deleteIdea = useCallback(
        async (args: { id: string }) => {
            if (!session) throw new Error('Not authenticated.');
            const { error } = await deleteAppIdea({ userId: session.user.id, id: args.id });
            if (error) throw error;
            setIdeas((prev) => prev.filter((idea) => idea.id !== args.id));
        },
        [session]
    );

    return {
        categories,
        ideas,
        loading,
        error,
        refresh,
        createIdea,
        updateIdea,
        deleteIdea,
        setIdeas,
    };
};
