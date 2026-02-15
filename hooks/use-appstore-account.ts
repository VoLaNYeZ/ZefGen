import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppstoreAccount } from '../types/zefgen';
import { fetchAppstoreAccount } from '../data/appstore-accounts';

export const useAppstoreAccount = (payload: {
    session: Session | null;
    appId: string | null;
    onDataError?: (message: string) => void;
}) => {
    const { session, appId, onDataError } = payload;

    const [account, setAccount] = useState<AppstoreAccount | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!session || !appId) {
            setAccount(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        const { data, error } = await fetchAppstoreAccount({ userId: session.user.id, appId });
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
            setAccount(null);
        } else {
            setAccount(data || null);
        }
        setLoading(false);
    }, [session, appId, onDataError]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { account, loading, error, refresh };
};

