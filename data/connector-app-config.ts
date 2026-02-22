import { supabase } from '../lib/supabase';

export type ConnectorProjectKind = 'ios' | 'web' | 'other';

export type ConnectorAppConfig = {
    app_id: string;
    user_id: string;
    project_kind: ConnectorProjectKind;
    project_brief: string;
    idea_id: string | null;
    variables: Record<string, any>;
    verify_command: string | null;
    updated_at?: string;
    created_at?: string;
};

export const fetchConnectorAppConfig = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('connector_app_configs')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .maybeSingle();

export const upsertConnectorAppConfig = async (payload: {
    userId: string;
    appId: string;
    patch: Partial<Omit<ConnectorAppConfig, 'app_id' | 'user_id'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('connector_app_configs')
        .upsert(
            {
                app_id: payload.appId,
                user_id: payload.userId,
                updated_at: nowIso,
                ...payload.patch,
            },
            { onConflict: 'app_id' }
        )
        .select()
        .single();
};
