import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export const useAuthSession = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const loadSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!mounted) return;
                setSession(session);
            } catch {
                if (!mounted) return;
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadSession();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setSession(session);
        });
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return { session, loading };
};
