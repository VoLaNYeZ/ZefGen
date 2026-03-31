import type { ConnectorJob } from '../data/connector-jobs';
import type { ConnectorJobArtifact } from '../data/connector-job-artifacts';
import type { ConnectorJobMessage } from '../data/connector-messages';

export type ConnectorExecutionPanelSnapshot = {
    appId: string;
    jobs: ConnectorJob[];
    selectedJobId: string | null;
    latestJobId: string | null;
    latestJobMessages: ConnectorJobMessage[];
    selectedJobArtifactJobId: string | null;
    selectedJobArtifacts: ConnectorJobArtifact[];
    artifactUrlsById: Record<string, string>;
    artifactJsonById: Record<string, any>;
};

const getJobsSignature = (jobs: ConnectorJob[]) =>
    jobs.map((job) => `${String(job?.id || '')}:${String(job?.updated_at || job?.created_at || '')}`).join('|');

const getMessagesSignature = (messages: ConnectorJobMessage[]) =>
    messages.map((message) => `${String(message?.id || '')}:${String(message?.created_at || '')}`).join('|');

const getArtifactsSignature = (artifacts: ConnectorJobArtifact[]) =>
    artifacts.map((artifact) => `${String(artifact?.id || '')}:${String(artifact?.created_at || '')}`).join('|');

const getRecordSignature = (record: Record<string, any>) =>
    Object.keys(record || {})
        .sort()
        .map((key) => `${key}:${JSON.stringify(record[key])}`)
        .join('|');

export const buildConnectorExecutionPanelSnapshot = (payload: {
    appId: string;
    jobs: ConnectorJob[];
    selectedJobId: string | null;
    latestJobId: string | null;
    latestJobMessages: ConnectorJobMessage[];
    selectedJobArtifactJobId: string | null;
    selectedJobArtifacts: ConnectorJobArtifact[];
    artifactUrlsById: Record<string, string>;
    artifactJsonById: Record<string, any>;
}): ConnectorExecutionPanelSnapshot | null => {
    const appId = String(payload.appId || '').trim();
    if (!appId) return null;

    return {
        appId,
        jobs: Array.isArray(payload.jobs) ? [...payload.jobs] : [],
        selectedJobId: String(payload.selectedJobId || '').trim() || null,
        latestJobId: String(payload.latestJobId || '').trim() || null,
        latestJobMessages: Array.isArray(payload.latestJobMessages) ? [...payload.latestJobMessages] : [],
        selectedJobArtifactJobId: String(payload.selectedJobArtifactJobId || '').trim() || null,
        selectedJobArtifacts: Array.isArray(payload.selectedJobArtifacts) ? [...payload.selectedJobArtifacts] : [],
        artifactUrlsById: { ...(payload.artifactUrlsById || {}) },
        artifactJsonById: { ...(payload.artifactJsonById || {}) },
    };
};

export const getConnectorExecutionPanelSnapshotSignature = (snapshot: ConnectorExecutionPanelSnapshot | null) =>
    snapshot
        ? [
              String(snapshot.appId || '').trim(),
              getJobsSignature(Array.isArray(snapshot.jobs) ? snapshot.jobs : []),
              String(snapshot.selectedJobId || '').trim(),
              String(snapshot.latestJobId || '').trim(),
              getMessagesSignature(Array.isArray(snapshot.latestJobMessages) ? snapshot.latestJobMessages : []),
              String(snapshot.selectedJobArtifactJobId || '').trim(),
              getArtifactsSignature(Array.isArray(snapshot.selectedJobArtifacts) ? snapshot.selectedJobArtifacts : []),
              getRecordSignature(snapshot.artifactUrlsById || {}),
              getRecordSignature(snapshot.artifactJsonById || {}),
          ].join('||')
        : '';
