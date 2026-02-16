import { supabase } from '../lib/supabase';
import type { AppstoreAccount } from '../types/zefgen';

const SELECT =
    'id, user_id, app_id, usability, was_used_before, email, password, email_password, number, geo, company_name, proxy, notes, updated_at, created_at';

export const fetchAppstoreAccounts = async (userId: string) =>
    supabase
        .from('appstore_accounts')
        .select(SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

export const fetchAppstoreAccount = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('appstore_accounts')
        .select(SELECT)
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .maybeSingle();

export const createAppstoreAccount = async (payload: {
    userId: string;
    row: Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('appstore_accounts')
        .insert({
            user_id: payload.userId,
            updated_at: nowIso,
            ...payload.row,
        })
        .select(SELECT)
        .single();
};

export const updateAppstoreAccount = async (payload: {
    userId: string;
    id: string;
    patch: Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('appstore_accounts')
        .update({ ...payload.patch, updated_at: nowIso })
        .eq('user_id', payload.userId)
        .eq('id', payload.id)
        .select(SELECT)
        .single();
};

export const deleteAppstoreAccount = async (payload: { userId: string; id: string }) =>
    supabase
        .from('appstore_accounts')
        .delete()
        .eq('user_id', payload.userId)
        .eq('id', payload.id);
