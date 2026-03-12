import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { TranslationKey } from '../i18n';
import type { AppPage } from '../utils/routes';

type ExportStatusLike = {
    is_completed?: boolean | null;
} | null;

type Params = {
    activePage: AppPage;
    appFolderWrapRef: MutableRefObject<HTMLDivElement | null>;
    appGenerationRef: MutableRefObject<HTMLDivElement | null>;
    exportStatus: ExportStatusLike;
    hasSelectedApp: boolean;
    mainScrollRef: MutableRefObject<HTMLDivElement | null>;
    reportActionError: (message: string) => void;
    selectedAppId: string | null;
    stickyHeaderRef: MutableRefObject<HTMLDivElement | null>;
    text: (key: TranslationKey) => string;
};

export function useWorkspaceAssetsLayout({
    activePage,
    appFolderWrapRef,
    appGenerationRef,
    exportStatus,
    hasSelectedApp,
    mainScrollRef,
    reportActionError,
    selectedAppId,
    stickyHeaderRef,
    text,
}: Params) {
    const [assetsCollapsed, setAssetsCollapsed] = useState(false);
    const deliverablesRailRef = useRef<HTMLDivElement>(null);
    const deliverablesAnchorRef = useRef<HTMLDivElement>(null);
    const [deliverablesRailStyle, setDeliverablesRailStyle] = useState<{ top: number; left: number; opacity: number }>(
        {
            top: 96,
            left: 16,
            opacity: 0,
        }
    );
    const seenExportCompletedByAppRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!selectedAppId) {
            setAssetsCollapsed(false);
            return;
        }
        // Default to the expanded workspace while app-specific export status is loading.
        setAssetsCollapsed(false);
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        if (!exportStatus) return;
        const key = `zefgen.assetsCollapsed.${selectedAppId}`;
        if (!exportStatus.is_completed) {
            setAssetsCollapsed(false);
            window.localStorage.setItem(key, '0');
            return;
        }
        const raw = window.localStorage.getItem(key);
        setAssetsCollapsed(raw === '1');
    }, [exportStatus, selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        const isCompleted = Boolean(exportStatus?.is_completed);
        const wasCompleted = Boolean(seenExportCompletedByAppRef.current[selectedAppId]);

        if (isCompleted && !wasCompleted) {
            setAssetsCollapsed(true);
            window.localStorage.setItem(`zefgen.assetsCollapsed.${selectedAppId}`, '1');
        }

        seenExportCompletedByAppRef.current[selectedAppId] = isCompleted;
    }, [exportStatus?.is_completed, selectedAppId]);

    const toggleAssetsCollapsed = useCallback(() => {
        if (!selectedAppId) return;
        if (!exportStatus?.is_completed) {
            reportActionError(text('need_picks_to_complete'));
            return;
        }
        setAssetsCollapsed((prev) => {
            const next = !prev;
            const key = `zefgen.assetsCollapsed.${selectedAppId}`;
            window.localStorage.setItem(key, next ? '1' : '0');
            return next;
        });
    }, [exportStatus?.is_completed, reportActionError, selectedAppId, text]);

    useEffect(() => {
        if (activePage !== 'workspace') {
            setDeliverablesRailStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }
        if (!hasSelectedApp || assetsCollapsed) {
            setDeliverablesRailStyle((prev) => ({ ...prev, opacity: 0 }));
            return;
        }

        let raf = 0;
        let attached = false;
        let scrollEl: HTMLDivElement | null = null;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = window.requestAnimationFrame(() => {
                const gen = appGenerationRef.current;
                const wrap = appFolderWrapRef.current;
                const rail = deliverablesRailRef.current;
                const anchor = deliverablesAnchorRef.current;
                if (!gen || !wrap || !rail || !anchor) return;

                const genRect = gen.getBoundingClientRect();
                const anchorRect = anchor.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();
                const railRect = rail.getBoundingClientRect();

                const headerBottom = stickyHeaderRef.current?.getBoundingClientRect().bottom ?? 96;
                const topOffset = Math.max(96, Math.round(headerBottom + 12));

                const railH = railRect.height || rail.offsetHeight || 0;
                const railW = railRect.width || rail.offsetWidth || 0;
                if (!railH || !railW) return;

                const minTop = anchorRect.top;
                const maxTop = genRect.bottom - railH;
                let top = topOffset;
                if (maxTop < minTop) {
                    top = minTop;
                } else {
                    top = Math.min(Math.max(topOffset, minTop), maxTop);
                }

                const gutter = 14;
                let left = wrapRect.right + gutter;
                left = Math.min(left, window.innerWidth - railW - 16);
                left = Math.max(16, left);

                const inView = genRect.bottom > topOffset + 40 && anchorRect.top < window.innerHeight - 80;
                setDeliverablesRailStyle({ top, left, opacity: inView ? 1 : 0 });
            });
        };

        const ro = new ResizeObserver(schedule);
        const attachObservers = () => {
            if (attached) return true;
            const wrap = appFolderWrapRef.current;
            const generation = appGenerationRef.current;
            const anchor = deliverablesAnchorRef.current;
            if (!wrap || !generation || !anchor || !wrap.isConnected || !generation.isConnected || !anchor.isConnected) {
                return false;
            }

            ro.observe(wrap);
            ro.observe(generation);
            ro.observe(anchor);
            if (stickyHeaderRef.current) ro.observe(stickyHeaderRef.current);
            scrollEl = mainScrollRef.current;
            scrollEl?.addEventListener('scroll', schedule, { passive: true });
            window.addEventListener('resize', schedule);
            attached = true;
            return true;
        };

        const ensurePositioning = () => {
            if (attachObservers()) {
                schedule();
                return;
            }
            raf = window.requestAnimationFrame(ensurePositioning);
        };

        ensurePositioning();

        return () => {
            cancelAnimationFrame(raf);
            scrollEl?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            ro.disconnect();
        };
    }, [
        activePage,
        appFolderWrapRef,
        appGenerationRef,
        assetsCollapsed,
        hasSelectedApp,
        mainScrollRef,
        stickyHeaderRef,
    ]);

    return {
        assetsCollapsed,
        deliverablesAnchorRef,
        deliverablesRailRef,
        deliverablesRailStyle,
        toggleAssetsCollapsed,
    };
}
