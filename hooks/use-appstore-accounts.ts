import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppstoreAccount } from '../types/zefgen';
import {
    createAppstoreAccount,
    deleteAppstoreAccount,
    fetchAppstoreAccounts,
    updateAppstoreAccount,
} from '../data/appstore-accounts';

export const useAppstoreAccounts = (payload: {
    session: Session | null;
    onDataError?: (message: string) => void;
}) => {
    const { session, onDataError } = payload;

    const [accounts, setAccounts] = useState<AppstoreAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const refresh = useCallback(async () => {
        if (!session) {
            setAccounts([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }

        setLoading(true);
        setError(null);
        const { data, error } = await fetchAppstoreAccounts(session.user.id);
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
        } else {
            setAccounts(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setAccounts([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && accounts.length) return;
        refresh();
    }, [session, accounts.length, refresh]);

    const createAccount = useCallback(
        async (args: {
            appId: string;
            row: Partial<Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at' | 'updated_at'>>;
        }) => {
            if (!session) throw new Error('Not authenticated.');
            const { data, error } = await createAppstoreAccount({
                userId: session.user.id,
                appId: args.appId,
                row: args.row,
            });
            if (error) throw error;
            if (data) {
                setAccounts((prev) => {
                    const exists = prev.some((a) => a.app_id === data.app_id);
                    if (exists) return prev.map((a) => (a.app_id === data.app_id ? data : a));
                    return [...prev, data];
                });
            }
            return data;
        },
        [session]
    );

    const updateAccount = useCallback(
        async (args: {
            appId: string;
            patch: Partial<Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at'>>;
        }) => {
            if (!session) throw new Error('Not authenticated.');
            const { data, error } = await updateAppstoreAccount({
                userId: session.user.id,
                appId: args.appId,
                patch: args.patch,
            });
            if (error) throw error;
            if (data) setAccounts((prev) => prev.map((a) => (a.app_id === data.app_id ? data : a)));
            return data;
        },
        [session]
    );

    const deleteAccount = useCallback(
        async (args: { appId: string }) => {
            if (!session) throw new Error('Not authenticated.');
            const { error } = await deleteAppstoreAccount({ userId: session.user.id, appId: args.appId });
            if (error) throw error;
            setAccounts((prev) => prev.filter((a) => a.app_id !== args.appId));
        },
        [session]
    );

    return {
        accounts,
        loading,
        error,
        refresh,
        createAccount,
        updateAccount,
        deleteAccount,
        setAccounts,
    };
};

