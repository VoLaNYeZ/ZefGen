import { supabase } from '../lib/supabase';

export type ConnectorProjectKind = 'ios' | 'web' | 'other';

export type ConnectorAppConfig = {
    app_id: string;
    user_id: string;
    project_kind: ConnectorProjectKind;
    project_brief: string;
    idea_id: string | null;
    base_branch: string;
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

export type SaveConnectorAppConfigStatus = 'saved' | 'conflict';

export type SaveConnectorAppConfigResponse = {
    status: SaveConnectorAppConfigStatus;
    row: ConnectorAppConfig | null;
};

export const saveConnectorAppConfigSnapshot = async (payload: {
    appId: string;
    expectedUpdatedAt?: string | null;
    projectBrief: string;
    ideaId: string | null;
    baseBranch: string;
    variables: Record<string, any>;
    forceOverwrite?: boolean;
}) => {
    return supabase.rpc('connector_save_app_config', {
        p_app_id: payload.appId,
        p_expected_updated_at: payload.expectedUpdatedAt || null,
        p_project_brief: String(payload.projectBrief || ''),
        p_idea_id: payload.ideaId || null,
        p_base_branch: String(payload.baseBranch || 'main'),
        p_variables: payload.variables || {},
        p_force_overwrite: payload.forceOverwrite === true,
    });
};
