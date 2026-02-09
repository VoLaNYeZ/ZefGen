import { supabase } from '../lib/supabase';

export type ConnectorJobMessageRole = 'runner' | 'user' | 'system';
export type ConnectorJobMessageKind = 'log' | 'question' | 'answer';

export type ConnectorJobMessage = {
    id: string;
    job_id: string;
    user_id: string;
    role: ConnectorJobMessageRole;
    kind: ConnectorJobMessageKind;
    in_reply_to: string | null;
    content: string;
    options: any | null;
    created_at: string;
};

export const fetchConnectorJobMessages = async (payload: { userId: string; jobId: string }) =>
    supabase
        .from('connector_job_messages')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('job_id', payload.jobId)
        .order('created_at', { ascending: true });

export const createConnectorJobAnswer = async (payload: {
    userId: string;
    jobId: string;
    inReplyTo: string;
    content: string;
}) =>
    supabase
        .from('connector_job_messages')
        .insert({
            user_id: payload.userId,
            job_id: payload.jobId,
            role: 'user',
            kind: 'answer',
            in_reply_to: payload.inReplyTo,
            content: payload.content,
        })
        .select('*')
        .single();

