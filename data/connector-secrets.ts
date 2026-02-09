import { supabase } from '../lib/supabase';

export type ConnectorSecretMeta = {
    id: string;
    app_id: string;
    user_id: string;
    key: string;
    updated_at: string | null;
    created_at: string | null;
};

const SECRET_META_SELECT = 'id, app_id, user_id, key, updated_at, created_at';

export const fetchConnectorSecretMetas = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('connector_app_secrets')
        .select(SECRET_META_SELECT)
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .order('key', { ascending: true });

export const upsertConnectorSecret = async (payload: {
    userId: string;
    appId: string;
    key: string;
    value: string;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('connector_app_secrets')
        .upsert(
            {
                app_id: payload.appId,
                user_id: payload.userId,
                key: payload.key,
                value: payload.value,
                updated_at: nowIso,
            },
            { onConflict: 'app_id,key' }
        )
        // Critical: do not request `value` back (DB revokes SELECT on that column).
        .select(SECRET_META_SELECT)
        .single();
};

export const deleteConnectorSecret = async (payload: { userId: string; appId: string; key: string }) =>
    supabase
        .from('connector_app_secrets')
        .delete()
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .eq('key', payload.key);

