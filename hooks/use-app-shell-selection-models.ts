import { useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { AppItem, Brand } from '../types/zefgen';
import type { AppWorkspaceSnapshot } from '../types/workspace-snapshot';
import { isNoBrand } from '../utils/no-brand';

type Params = {
    apps: AppItem[];
    brands: Brand[];
    requestedBrand: Brand | null;
    routeAppId: string | null;
    selectedBrand: Brand | null;
    selectedAppId: string | null;
    workspaceSnapshotsRef: MutableRefObject<Record<string, AppWorkspaceSnapshot>>;
};

export function useAppShellSelectionModels({
    apps,
    brands,
    requestedBrand,
    routeAppId,
    selectedBrand,
    selectedAppId,
    workspaceSnapshotsRef,
}: Params) {
    const isNoBrandMode = isNoBrand(selectedBrand);
    const selectedApp = useMemo(
        () => apps.find((app) => app.id === selectedAppId) || null,
        [apps, selectedAppId]
    );
    const requestedApp = useMemo(() => {
        const candidate = apps.find((app) => app.id === routeAppId) || null;
        if (!candidate) return null;
        if (requestedBrand && candidate.brand_id !== requestedBrand.id) return null;
        return candidate;
    }, [apps, requestedBrand, routeAppId]);
    const regularBrands = useMemo(
        () => brands.filter((brand) => !isNoBrand(brand)),
        [brands]
    );
    const selectedAppSnapshot = selectedAppId ? workspaceSnapshotsRef.current[selectedAppId] ?? null : null;

    return {
        isNoBrandMode,
        regularBrands,
        requestedApp,
        selectedApp,
        selectedAppSnapshot,
    };
}
