import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { TranslationKey } from '../i18n';

const NOTICE_TIMEOUT_MS = 6000;

type Params = {
    text: (key: TranslationKey) => string;
};

export function useAppShellNotices({ text }: Params) {
    const [actionError, setActionError] = useState<string | null>(null);
    const [collabWarning, setCollabWarning] = useState<string | null>(null);
    const [aliasNotice, setAliasNotice] = useState<string | null>(null);

    const actionErrorTimerRef = useRef<number | null>(null);
    const collabWarningTimerRef = useRef<number | null>(null);
    const aliasNoticeTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (actionErrorTimerRef.current) window.clearTimeout(actionErrorTimerRef.current);
            if (collabWarningTimerRef.current) window.clearTimeout(collabWarningTimerRef.current);
            if (aliasNoticeTimerRef.current) window.clearTimeout(aliasNoticeTimerRef.current);
        };
    }, []);

    const scheduleTimedNotice = useCallback(
        (
            value: string,
            setValue: Dispatch<SetStateAction<string | null>>,
            timerRef: MutableRefObject<number | null>
        ) => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            setValue(value);
            timerRef.current = window.setTimeout(() => {
                setValue((prev) => (prev === value ? null : prev));
                timerRef.current = null;
            }, NOTICE_TIMEOUT_MS);
        },
        []
    );

    const reportActionError = useCallback(
        (message: string) => {
            scheduleTimedNotice(message, setActionError, actionErrorTimerRef);
        },
        [scheduleTimedNotice]
    );

    const showCollabWarning = useCallback(
        (message: string) => {
            scheduleTimedNotice(message, setCollabWarning, collabWarningTimerRef);
        },
        [scheduleTimedNotice]
    );

    const showAliasNotice = useCallback(
        (message: string) => {
            scheduleTimedNotice(message, setAliasNotice, aliasNoticeTimerRef);
        },
        [scheduleTimedNotice]
    );

    const reportCollabWarning = useCallback(() => {
        showCollabWarning(text('collab_sync_offline'));
    }, [showCollabWarning, text]);

    const reportLockedBrandWarning = useCallback(() => {
        showCollabWarning(text('brand_under_work_readonly'));
    }, [showCollabWarning, text]);

    const reportReadOnlyBlocked = useCallback(() => {
        showCollabWarning(text('brand_readonly_write_blocked'));
    }, [showCollabWarning, text]);

    return {
        actionError,
        aliasNotice,
        collabWarning,
        reportActionError,
        reportCollabWarning,
        reportLockedBrandWarning,
        reportReadOnlyBlocked,
        showAliasNotice,
        showCollabWarning,
    };
}
