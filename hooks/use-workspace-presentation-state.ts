import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TextLayer } from '../types/zefgen';

type LightboxState = {
    src: string;
    alt: string;
    layers?: TextLayer[];
    fullSrc?: string;
    overlayBaseWidth?: number;
    overlayBaseHeight?: number;
} | null;

type Params = {
    appFormOpen: boolean;
    bannedAppsLength: number;
    editingAppId: string | null;
    isBannedView: boolean;
    selectedAppId: string | null;
    hasSelectedBrand: boolean;
    visibleActiveAppsLength: number;
    visibleAppIds: string[];
};

export function useWorkspacePresentationState({
    appFormOpen,
    bannedAppsLength,
    editingAppId,
    isBannedView,
    selectedAppId,
    hasSelectedBrand,
    visibleActiveAppsLength,
    visibleAppIds,
}: Params) {
    const [appSwitching, setAppSwitching] = useState(false);
    const [lightbox, setLightbox] = useState<LightboxState>(null);

    useEffect(() => {
        if (!selectedAppId) return;
        setAppSwitching(true);
        const timer = window.setTimeout(() => setAppSwitching(false), 320);
        return () => window.clearTimeout(timer);
    }, [selectedAppId]);

    const activeAppIndex = useMemo(
        () => visibleAppIds.findIndex((appId) => appId === selectedAppId),
        [selectedAppId, visibleAppIds]
    );

    const hasAnyAppsForBrand = visibleActiveAppsLength + bannedAppsLength > 0;
    const showNoAppsEmptyState = hasSelectedBrand && !hasAnyAppsForBrand;
    const hasApps = visibleAppIds.length > 0;
    const isSingleApp = hasApps && visibleAppIds.length === 1;
    const isFirstApp = hasApps && activeAppIndex === 0;
    const bodyCornerRadius = `${isFirstApp || isSingleApp ? 0 : 26}px 26px 26px 26px`;
    const appFolderTheme = isBannedView ? 'rgb(127, 29, 29)' : 'rgb(30, 41, 59)';
    const isAppReorderMode = Boolean(appFormOpen && editingAppId);

    const openLightbox = useCallback(
        (
            src: string,
            alt: string,
            options?: { layers?: TextLayer[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
        ) => {
            setLightbox({
                src,
                alt,
                layers: options?.layers,
                fullSrc: options?.fullSrc,
                overlayBaseWidth: options?.overlayBaseWidth,
                overlayBaseHeight: options?.overlayBaseHeight,
            });
        },
        []
    );

    const closeLightbox = useCallback(() => {
        setLightbox(null);
    }, []);

    return {
        appFolderTheme,
        appSwitching,
        bodyCornerRadius,
        closeLightbox,
        hasAnyAppsForBrand,
        isAppReorderMode,
        isFirstApp,
        lightbox,
        openLightbox,
        showNoAppsEmptyState,
    };
}
