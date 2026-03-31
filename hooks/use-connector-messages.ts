import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ConnectorExecutionPanelSnapshot } from '../types/connector-execution-snapshot';
import {
    createConnectorJobAnswer,
    fetchConnectorJobMessages,
    type ConnectorJobMessage,
} from '../data/connector-messages';

const EMPTY_CONNECTOR_MESSAGES: ConnectorJobMessage[] = [];
const inFlightMessageFetches = new Map<string, Promise<ConnectorJobMessage[]>>();
const getMessagesSignature = (messages: ConnectorJobMessage[]) =>
    messages.map((message) => `${String(message?.id || '')}:${String(message?.created_at || '')}`).join('|');

export const useConnectorJobMessages = (payload: {
    session: Session | null;
    jobId: string | null;
    pollMs?: number;
    live?: boolean;
    hydrationSnapshot?: ConnectorExecutionPanelSnapshot | null;
}) => {
    const { session, jobId } = payload;
    const pollMs = Math.max(1200, Math.floor(payload.pollMs ?? 2500));
    const live = payload.live ?? true;
    const sessionUserId = String(session?.user?.id || '').trim();
    const normalizedJobId = String(jobId || '').trim() || null;
    const scopeKey = sessionUserId && normalizedJobId ? `${sessionUserId}:${normalizedJobId}` : '';
    const matchingHydrationSnapshot =
        payload.hydrationSnapshot &&
        String(payload.hydrationSnapshot.latestJobId || '').trim() === String(normalizedJobId || '')
            ? payload.hydrationSnapshot
            : null;
    const hydrationMessages = Array.isArray(matchingHydrationSnapshot?.latestJobMessages)
        ? (matchingHydrationSnapshot.latestJobMessages as ConnectorJobMessage[])
        : EMPTY_CONNECTOR_MESSAGES;
    const hydrationMessagesSignature = getMessagesSignature(hydrationMessages);
    const hasMatchingHydrationSnapshot = Boolean(matchingHydrationSnapshot);

    const [messages, setMessages] = useState<ConnectorJobMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);
    const messagesSignatureRef = useRef('');
    const scopeKeyRef = useRef('');
    const requestScopeKeyRef = useRef('');
    const hydrationStateRef = useRef('');

    useEffect(() => {
        requestScopeKeyRef.current = scopeKey;

        if (!scopeKey) {
            if (scopeKeyRef.current !== '') {
                setMessages((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_MESSAGES));
            }
            setLoading((current) => (current ? false : current));
            setError((current) => (current === null ? current : null));
            messagesSignatureRef.current = '';
            scopeKeyRef.current = '';
            hydrationStateRef.current = '';
            return;
        }

        const nextHydrationState = hasMatchingHydrationSnapshot
            ? `${scopeKey}:hydrated:${hydrationMessagesSignature}`
            : `${scopeKey}:cold`;
        if (scopeKeyRef.current === scopeKey && hydrationStateRef.current === nextHydrationState) return;

        scopeKeyRef.current = scopeKey;
        hydrationStateRef.current = nextHydrationState;
        setError((current) => (current === null ? current : null));
        if (hasMatchingHydrationSnapshot) {
            messagesSignatureRef.current = hydrationMessagesSignature;
            setMessages((current) =>
                getMessagesSignature(current) === hydrationMessagesSignature ? current : hydrationMessages
            );
            setLoading((current) => (current ? false : current));
            return;
        }

        messagesSignatureRef.current = '';
        setMessages((current) => (current.length === 0 ? current : EMPTY_CONNECTOR_MESSAGES));
        setLoading((current) => (current ? current : true));
    }, [hasMatchingHydrationSnapshot, hydrationMessagesSignature, scopeKey]);

    const runRefresh = useCallback(async (background = false) => {
        if (!sessionUserId || !normalizedJobId) return;
        const requestScopeKey = requestScopeKeyRef.current;
        if (!background) {
            setLoading(true);
            setError(null);
        }
        try {
            let fetchPromise = inFlightMessageFetches.get(scopeKey);
            if (!fetchPromise) {
                fetchPromise = (async () => {
                    const { data, error: e } = await fetchConnectorJobMessages({
                        userId: sessionUserId,
                        jobId: normalizedJobId,
                    });
                    if (e) throw e;
                    return (data || []) as ConnectorJobMessage[];
                })();
                inFlightMessageFetches.set(scopeKey, fetchPromise);
            }
            const nextMessages = await fetchPromise;
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            const nextSignature = getMessagesSignature(nextMessages);
            if (messagesSignatureRef.current !== nextSignature) {
                messagesSignatureRef.current = nextSignature;
                setMessages(nextMessages);
            }
            if (background) setError(null);
        } catch (e: any) {
            if (requestScopeKeyRef.current !== requestScopeKey) return;
            setError(String(e?.message || e));
        } finally {
            if (inFlightMessageFetches.get(scopeKey)) {
                inFlightMessageFetches.delete(scopeKey);
            }
            if (!background && requestScopeKeyRef.current === requestScopeKey) setLoading(false);
        }
    }, [normalizedJobId, scopeKey, sessionUserId]);

    const refresh = useCallback(async () => {
        await runRefresh(false);
    }, [runRefresh]);

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;

        if (!scopeKey) return;

        if (!hasMatchingHydrationSnapshot) {
            void runRefresh(false);
        } else if (live) {
            void runRefresh(true);
        }
        if (!live) return;

        timerRef.current = window.setInterval(() => void runRefresh(true), pollMs);
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [hasMatchingHydrationSnapshot, live, pollMs, runRefresh, scopeKey]);

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
            if (!sessionUserId || !normalizedJobId) throw new Error('No session/job.');
            const { data, error: e } = await createConnectorJobAnswer({
                userId: sessionUserId,
                jobId: normalizedJobId,
                inReplyTo: questionId,
                content: String(content || '').slice(0, 20000),
            });
            if (e) throw e;
            await refresh();
            return data;
        },
        [normalizedJobId, refresh, sessionUserId]
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
