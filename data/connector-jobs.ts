import { supabase } from '../lib/supabase';

export type ConnectorJobKind = 'generate' | 'fix';
export type ConnectorJobStatus =
    | 'queued'
    | 'running'
    | 'waiting_for_user'
    | 'succeeded'
    | 'failed'
    | 'canceled';

export type ConnectorJob = {
    id: string;
    user_id: string;
    app_id: string;
    kind: ConnectorJobKind;
    status: ConnectorJobStatus;
    requested_by: string | null;
    input: any;
    repo_full_name: string;
    base_branch: string;
    work_branch: string | null;
    pr_url: string | null;
    pr_number: number | null;
    verify_status: 'pass' | 'fail' | 'skipped' | null;
    verify_tail: string | null;
    summary: string | null;
    claimed_by: string | null;
    claimed_at: string | null;
    started_at: string | null;
    heartbeat_at: string | null;
    ended_at: string | null;
    cancel_requested_at: string | null;
    error: string | null;
    updated_at: string;
    created_at: string;
};

export const fetchConnectorJobs = async (payload: { userId: string; appId: string; limit?: number }) =>
    supabase
        .from('connector_jobs')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .order('created_at', { ascending: false })
        .limit(payload.limit ?? 15);

export const createConnectorJob = async (payload: {
    userId: string;
    appId: string;
    kind: ConnectorJobKind;
    repoFullName: string;
    baseBranch?: string;
    input?: any;
}) => {
    const row = {
        user_id: payload.userId,
        app_id: payload.appId,
        kind: payload.kind,
        repo_full_name: payload.repoFullName,
        base_branch: payload.baseBranch ?? 'main',
        input: payload.input ?? {},
    };

    return supabase
        .from('connector_jobs')
        .insert(row)
        .select('*')
        .single();
};

export const requestCancelConnectorJob = async (payload: { userId: string; jobId: string }) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('connector_jobs')
        .update({ cancel_requested_at: nowIso })
        .eq('id', payload.jobId)
        .eq('user_id', payload.userId)
        .select('*')
        .single();
};

