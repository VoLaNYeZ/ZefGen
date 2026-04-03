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

export type ConnectorJobArtifactIdentity = Pick<ConnectorJobArtifact, 'id' | 'job_id' | 'app_id'>;

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

export const fetchConnectorJobArtifactsByIds = async (payload: {
    artifactIds: string[];
}) => {
    const normalizedIds = [...new Set(payload.artifactIds.map((value) => String(value || '').trim()).filter(Boolean))];
    if (!normalizedIds.length) {
        return { data: [] as ConnectorJobArtifactIdentity[], error: null };
    }

    return supabase
        .from('connector_job_artifacts')
        .select('id, job_id, app_id')
        .in('id', normalizedIds);
};

export const fetchConnectorArtifactSignedUrl = async (payload: {
    token: string;
    artifactId: string;
    appId?: string | null;
    jobId?: string | null;
    expiresIn?: number;
}) => {
    const response = await fetch('/api/connector-artifact-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.token}`,
        },
        body: JSON.stringify({
            artifactId: payload.artifactId,
            appId: payload.appId,
            jobId: payload.jobId,
            expiresIn: payload.expiresIn,
        }),
    });

    let parsed: any = null;
    try {
        parsed = await response.json();
    } catch {
        parsed = null;
    }

    if (!response.ok) {
        throw new Error(String(parsed?.message || 'Failed to create artifact signed URL.'));
    }

    const signedUrl = String(parsed?.signedUrl || '').trim();
    if (!signedUrl) {
        throw new Error('Artifact signed URL missing in response.');
    }

    return signedUrl;
};
