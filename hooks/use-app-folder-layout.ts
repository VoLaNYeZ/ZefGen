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
    selectedBrandId: string | null;
    selectedAppId: string | null;
    appsLength: number;
    visibleApps: AppItem[];
    isBannedView: boolean;
    showBannedToggle: boolean;
};

export const useAppFolderLayout = ({
    selectedBrandId,
    selectedAppId,
    appsLength,
    visibleApps,
    isBannedView,
    showBannedToggle,
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
        const wrap = appFolderWrapRef.current;
        const picker = appPickerRef.current;
        if (!wrap || !picker) return;

        const minTabWidth = 120;

        const update = () => {
            const wrapRect = wrap.getBoundingClientRect();
            const pickerRect = picker.getBoundingClientRect();
            const endEl = appFolderEndRef.current ?? appFolderContentRef.current ?? appGenerationRef.current ?? appSimulatorRef.current ?? picker;
            const endRect = endEl.getBoundingClientRect();
            const rowRect = appPillRowRef.current?.getBoundingClientRect() ?? pickerRect;
            const activeIndex = visibleApps.findIndex((app) => app.id === selectedAppId);
            const bodyInset = 6;
            const bodyGap = 0;
            const bodyTail = 30;
            const verticalLift = 20;
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
            const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
            if (activePill) {
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
                const fallbackBodyTop = Math.max(bodyTop, minBodyTop);
                bodyTop = fallbackBodyTop;
                const overlapPx = clamp(tabHeight * 0.1, 6, 14);
                tabTop = bodyTop - (tabHeight - overlapPx);
            }

            const minTabLeft = -tabWidth;
            const maxTabLeft = Math.max(0, wrapRect.width - tabWidth);
            tabLeft = clamp(tabLeft, minTabLeft, maxTabLeft);

            bodyTop = Math.max(0, bodyTop - verticalLift);
            tabTop -= verticalLift;

            if (showBannedToggle) {
                const rightClip = Math.max(0, tabWidth + 12);
                const splitY = tabTop + tabHeight - 2;
                clipPath = `polygon(0 -400px, calc(100% - ${rightClip}px) -400px, calc(100% - ${rightClip}px) ${splitY}px, 100% ${splitY}px, 100% 4000px, 0 4000px)`;
            }

            if (appFolderContentRef.current) {
                const contentRect = appFolderContentRef.current.getBoundingClientRect();
                const contentBottom = contentRect.bottom - wrapRect.top;
                bodyHeight = Math.max(bodyHeight, Math.max(0, contentBottom - bodyTop) + bodyTail);
            }

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
        observer.observe(wrap);
        observer.observe(picker);
        if (appSimulatorRef.current) observer.observe(appSimulatorRef.current);
        if (appGenerationRef.current) observer.observe(appGenerationRef.current);
        if (appFolderContentRef.current) {
            observer.observe(appFolderContentRef.current);
        }
        if (appFolderEndRef.current) {
            observer.observe(appFolderEndRef.current);
        }
        if (appPillRowRef.current) {
            observer.observe(appPillRowRef.current);
        }
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
    }, [selectedBrandId, selectedAppId, appsLength, visibleApps, isBannedView, showBannedToggle]);

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
