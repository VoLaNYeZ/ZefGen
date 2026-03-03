import { useLayoutEffect, useRef, useState } from 'react';
import type { AppItem } from '../types/zefgen';

export type AppFolderLayout = {
    bodyTop: number;
    bodyHeight: number;
    tabLeft: number;
    tabWidth: number;
    tabTop: number;
    tabHeight: number;
    clipPath: string;
};

type Params = {
    enabled: boolean;
    selectedBrandId: string | null;
    selectedAppId: string | null;
    appsLength: number;
    visibleApps: AppItem[];
    isBannedView: boolean;
    showBannedToggle: boolean;
    isAppFormOpen: boolean;
};

export const useAppFolderLayout = ({
    enabled,
    selectedBrandId,
    selectedAppId,
    appsLength,
    visibleApps,
    isBannedView,
    showBannedToggle,
    isAppFormOpen,
}: Params) => {
    const appFolderWrapRef = useRef<HTMLDivElement>(null);
    const appPickerRef = useRef<HTMLElement>(null);
    const appSimulatorRef = useRef<HTMLElement>(null);
    const appGenerationRef = useRef<HTMLElement>(null);
    const appFolderContentRef = useRef<HTMLDivElement>(null);
    const appFolderEndRef = useRef<HTMLDivElement>(null);
    const appActivePillRef = useRef<HTMLButtonElement | null>(null);
    const appPillScrollRef = useRef<HTMLDivElement>(null);
    const appPillRowRef = useRef<HTMLDivElement>(null);
    const [appFolderLayout, setAppFolderLayout] = useState<AppFolderLayout>({
        bodyTop: 0,
        bodyHeight: 0,
        tabLeft: 0,
        tabWidth: 0,
        tabTop: 0,
        tabHeight: 36,
        clipPath: 'none',
    });

    useLayoutEffect(() => {
        if (!enabled) return;

        const minTabWidth = 120;

        const update = () => {
            const wrap = appFolderWrapRef.current;
            const picker = appPickerRef.current;
            if (!wrap || !picker) return;
            if (!wrap.isConnected || !picker.isConnected) return;

            const wrapRect = wrap.getBoundingClientRect();
            const pickerRect = picker.getBoundingClientRect();
            const endEl = appFolderEndRef.current ?? appFolderContentRef.current ?? appGenerationRef.current ?? appSimulatorRef.current ?? picker;
            const endRect = endEl.getBoundingClientRect();
            const rowRect = appPillRowRef.current?.getBoundingClientRect() ?? pickerRect;
            const activeIndex = visibleApps.findIndex((app) => app.id === selectedAppId);
            const bodyInset = 6;
            const bodyGap = 0;
            const bodyTail = 60;
            const minBodyTop = rowRect.bottom - wrapRect.top + bodyGap;
            let bodyTop = rowRect.top - wrapRect.top + bodyInset;
            const bodyBottom = endRect.bottom - wrapRect.top;
            let bodyHeight = Math.max(0, bodyBottom - bodyTop + bodyTail);
            let clipPath = 'none';

            let tabLeft = rowRect.left - wrapRect.left + 12;
            let tabWidth = minTabWidth;
            let tabTop = bodyTop - 18;
            let tabHeight = 36;
            const activePill = selectedAppId ? appActivePillRef.current : null;
            // Slightly "lift" the gooey folder when a pill is active, but keep empty brands stable.
            // When there are no apps, lifting can cause the tab to overlap the reference modules above.
            const verticalLift = activePill && !isAppFormOpen ? 20 : 0;
            const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
            if (activePill && !isAppFormOpen) {
                const pillRect = activePill.getBoundingClientRect();
                tabWidth = pillRect.width;
                tabHeight = Math.max(rowRect.height - 14, 36);
                tabLeft = pillRect.left - wrapRect.left;
                if (activeIndex === 0) {
                    tabLeft = Math.min(0, tabLeft);
                }
                tabTop = rowRect.bottom - wrapRect.top - tabHeight;
                bodyTop = minBodyTop;
                bodyHeight = Math.max(0, bodyBottom - bodyTop + bodyTail);
            } else {
                // Keep the gooey folder below the entire picker zone when the app form is open.
                const pickerBottomTop = pickerRect.bottom - wrapRect.top;
                const fallbackBodyTop = Math.max(bodyTop, minBodyTop, pickerBottomTop);
                bodyTop = fallbackBodyTop + (isAppFormOpen ? 8 : 0);
                const tabPeek = isAppFormOpen ? 0 : 6;
                tabTop = bodyTop - tabPeek;
            }

            const minTabLeft = -tabWidth;
            const maxTabLeft = Math.max(0, wrapRect.width - tabWidth);
            tabLeft = clamp(tabLeft, minTabLeft, maxTabLeft);

            bodyTop = Math.max(0, bodyTop - verticalLift);
            tabTop -= verticalLift;
            tabTop = Math.max(0, tabTop);

            if (showBannedToggle) {
                const rightClip = Math.max(0, tabWidth + 12);
                const splitY = tabTop + tabHeight - 2;
                // Avoid hard-coded clip bottoms; long pages (many generated screenshots) can exceed 4000px.
                // Keep an extra buffer so the gooey background can extend beyond the content without clipping.
                const bottomClip = Math.ceil(wrapRect.height + 2000);
                clipPath = `polygon(0 -400px, calc(100% - ${rightClip}px) -400px, calc(100% - ${rightClip}px) ${splitY}px, 100% ${splitY}px, 100% ${bottomClip}px, 0 ${bottomClip}px)`;
            }

            if (appFolderContentRef.current) {
                const contentEl = appFolderContentRef.current;
                const contentRect = contentEl.getBoundingClientRect();
                const contentHeight = Math.max(contentRect.height, contentEl.scrollHeight || 0);
                const contentBottom = contentRect.top - wrapRect.top + contentHeight;
                bodyHeight = Math.max(bodyHeight, Math.max(0, contentBottom - bodyTop) + bodyTail);
            }

            // Final guard: ensure the folder body always covers the full content height.
            // This prevents the "background cuts through the last module" issue when new sections are added.
            const wrapHeight = Math.max(wrapRect.height, wrap.scrollHeight || 0);
            bodyHeight = Math.max(bodyHeight, Math.max(0, wrapHeight - bodyTop) + bodyTail);

            setAppFolderLayout({
                bodyTop,
                bodyHeight,
                tabLeft,
                tabWidth,
                tabTop,
                tabHeight,
                clipPath,
            });
        };

        update();
        const observer = new ResizeObserver(update);
        if (appFolderWrapRef.current) observer.observe(appFolderWrapRef.current);
        if (appPickerRef.current) observer.observe(appPickerRef.current);
        if (appSimulatorRef.current) observer.observe(appSimulatorRef.current);
        if (appGenerationRef.current) observer.observe(appGenerationRef.current);
        if (appFolderContentRef.current) observer.observe(appFolderContentRef.current);
        if (appFolderEndRef.current) observer.observe(appFolderEndRef.current);
        if (appPillRowRef.current) observer.observe(appPillRowRef.current);
        const scrollEl = appPillScrollRef.current;
        if (scrollEl) {
            scrollEl.addEventListener('scroll', update, { passive: true });
        }
        window.addEventListener('resize', update);

        return () => {
            observer.disconnect();
            if (scrollEl) scrollEl.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [enabled, selectedBrandId, selectedAppId, appsLength, visibleApps, isBannedView, showBannedToggle, isAppFormOpen]);

    const tabButtonWidth = appFolderLayout.tabWidth > 0 ? appFolderLayout.tabWidth : 120;
    const tabButtonHeight = appFolderLayout.tabHeight > 0 ? appFolderLayout.tabHeight : undefined;
    const bannedSlotWidth = showBannedToggle ? tabButtonWidth + 12 : 0;

    return {
        appFolderLayout,
        appFolderWrapRef,
        appPickerRef,
        appSimulatorRef,
        appGenerationRef,
        appFolderContentRef,
        appFolderEndRef,
        appActivePillRef,
        appPillScrollRef,
        appPillRowRef,
        tabButtonWidth,
        tabButtonHeight,
        bannedSlotWidth,
    };
};
