import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createConnectorJobAnswer, fetchConnectorJobMessages } from '../data/connector-messages';

export const useConnectorJobMessages = (payload: {
    session: Session | null;
    jobId: string | null;
    pollMs?: number;
    live?: boolean;
}) => {
    const { session, jobId } = payload;
    const pollMs = Math.max(1200, Math.floor(payload.pollMs ?? 2500));
    const live = payload.live ?? true;

    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const messagesSignatureRef = useRef('');
    const scopeKeyRef = useRef('');

    const runRefresh = useCallback(async (background = false) => {
        if (!session || !jobId) return;
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            const { data, error: e } = await fetchConnectorJobMessages({
                userId: session.user.id,
                jobId,
            });
            if (e) throw e;
            const nextMessages = data || [];
            const nextSignature = nextMessages
                .map((message) => `${String(message?.id || '')}:${String(message?.created_at || '')}`)
                .join('|');
            if (messagesSignatureRef.current !== nextSignature) {
                messagesSignatureRef.current = nextSignature;
                setMessages(nextMessages);
            }
            if (background) setError(null);
        } catch (e: any) {
            setError(String(e?.message || e));
        } finally {
            if (!background) setLoading(false);
        }
    }, [session, jobId]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;

        const scopeKey = session?.user?.id && jobId ? `${session.user.id}:${jobId}` : '';
        if (!session || !jobId) {
            setMessages([]);
            setLoading(false);
            setError(null);
            messagesSignatureRef.current = '';
            scopeKeyRef.current = '';
            return;
        }

        if (scopeKeyRef.current !== scopeKey) {
            scopeKeyRef.current = scopeKey;
            setMessages([]);
            messagesSignatureRef.current = '';
        }

        void runRefresh(false);
        if (!live) return;

        timerRef.current = window.setInterval(() => void runRefresh(true), pollMs);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [session?.user?.id, jobId, live, pollMs, runRefresh]);

    const messageList = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

    const questions = useMemo(
        () => messageList.filter((m) => m.kind === 'question'),
        [messageList]
    );

    const answers = useMemo(
        () => messageList.filter((m) => m.kind === 'answer'),
        [messageList]
    );

    const unansweredQuestions = useMemo(() => {
        const answered = new Set(answers.map((a) => a.in_reply_to).filter(Boolean));
        return questions.filter((q) => !answered.has(q.id));
    }, [questions, answers]);

    const answerQuestion = useCallback(
        async (questionId: string, content: string) => {
            if (!session || !jobId) throw new Error('No session/job.');
            const { data, error: e } = await createConnectorJobAnswer({
                userId: session.user.id,
                jobId,
                inReplyTo: questionId,
                content: String(content || '').slice(0, 20000),
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [session, jobId, refresh]
    );

    return {
        messages,
        unansweredQuestions,
        loading,
        error,
        refresh,
        answerQuestion,
    };
};
