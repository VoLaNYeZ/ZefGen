import { supabase } from '../lib/supabase';

export type ConnectorJobArtifactKind =
    | 'qa_report'
    | 'qa_evidence'
    | 'screenshot_manifest'
    | 'screenshot_image';

export type ConnectorJobArtifact = {
    id: string;
    job_id: string;
    app_id: string;
    kind: ConnectorJobArtifactKind;
    bucket: string;
    object_path: string;
    metadata: Record<string, any>;
    created_at: string;
};

export const fetchConnectorJobArtifactsByJob = async (payload: {
    jobId: string;
    limit?: number;
}) =>
    supabase
        .from('connector_job_artifacts')
        .select('*')
        .eq('job_id', payload.jobId)
        .order('created_at', { ascending: true })
        .limit(payload.limit ?? 200);

export const fetchConnectorJobArtifactsByApp = async (payload: {
    appId: string;
    limit?: number;
}) =>
    supabase
        .from('connector_job_artifacts')
        .select('*')
        .eq('app_id', payload.appId)
        .order('created_at', { ascending: false })
        .limit(payload.limit ?? 200);
