import { useEffect, useRef } from 'react';
import type { AppItem, Brand } from '../types/zefgen';
import type { AppPage } from '../utils/routes';
import { buildRoute, parseRoute } from '../utils/routes';

const normalizeAlias = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

type RouteSyncParams = {
    dataLoading: boolean;
    hasParsedRoute: boolean;
    setHasParsedRoute: (value: boolean) => void;
    activePage: AppPage;
    setActivePage: (value: AppPage) => void;
    brands: Brand[];
    apps: AppItem[];
    orderedApps: AppItem[];
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    setSelectedBrandId: (value: string | null) => void;
    setSelectedAppId: (value: string | null) => void;
    canNavigate?: (next: ReturnType<typeof parseRoute>) => boolean;
};

export const useRouteSync = (params: RouteSyncParams) => {
    const {
        dataLoading,
        hasParsedRoute,
        setHasParsedRoute,
        activePage,
        setActivePage,
        brands,
        apps,
        orderedApps,
        selectedBrand,
        selectedApp,
        setSelectedBrandId,
        setSelectedAppId,
        canNavigate,
    } = params;

    const restorePopStateRef = useRef(false);

    useEffect(() => {
        if (dataLoading || hasParsedRoute) return;

        const parsed = parseRoute();
        if (parsed.page !== 'workspace') {
            setActivePage(parsed.page);
            setHasParsedRoute(true);
            return;
        }

        setActivePage('workspace');

        if (!brands.length) {
            setHasParsedRoute(true);
            return;
        }

        const { brandSlug, appAlias } = parsed;
        let nextBrand = brandSlug
            ? brands.find((brand) => brand.slug === brandSlug) || null
            : brands[0];

        if (!nextBrand) nextBrand = brands[0];

        setSelectedBrandId(nextBrand?.id ?? null);

        if (nextBrand && appAlias) {
            const targetAlias = normalizeAlias(appAlias);
            const nextApp = apps.find(
                (app) => app.brand_id === nextBrand?.id && normalizeAlias(app.alias) === targetAlias
            );
            setSelectedAppId(nextApp?.id ?? null);
        } else {
            const firstApp = orderedApps.find((app) => app.brand_id === nextBrand?.id);
            setSelectedAppId(firstApp?.id ?? null);
        }

        setHasParsedRoute(true);
    }, [
        dataLoading,
        hasParsedRoute,
        brands,
        apps,
        orderedApps,
        setHasParsedRoute,
        setSelectedBrandId,
        setSelectedAppId,
        setActivePage,
    ]);

    useEffect(() => {
        if (dataLoading || !hasParsedRoute) return;
        if (activePage !== 'workspace') return;
        if (brands.length > 0 && !selectedBrand) {
            setHasParsedRoute(false);
        }
    }, [dataLoading, hasParsedRoute, activePage, brands.length, selectedBrand, setHasParsedRoute]);

    useEffect(() => {
        if (!hasParsedRoute || dataLoading) return;
        if (activePage !== 'workspace') return;

        if (!selectedBrand) {
            window.history.replaceState({}, '', '/');
            return;
        }

        const currentApp = selectedApp && selectedApp.brand_id === selectedBrand.id ? selectedApp : null;
        const nextRoute = buildRoute(selectedBrand, currentApp);

        if (window.location.pathname !== nextRoute) {
            window.history.replaceState({}, '', nextRoute);
        }
    }, [hasParsedRoute, dataLoading, activePage, selectedBrand, selectedApp]);

    useEffect(() => {
        if (!hasParsedRoute) return;

        const handlePopState = () => {
            if (restorePopStateRef.current) {
                restorePopStateRef.current = false;
                return;
            }
            if (dataLoading) return;
            const parsed = parseRoute();
            if (canNavigate && !canNavigate(parsed)) {
                restorePopStateRef.current = true;
                // Most blocked navigations are "back" out of /accounts. Attempt to restore by going forward.
                window.history.go(1);
                return;
            }
            setActivePage(parsed.page);
            if (parsed.page !== 'workspace') return;
            const { brandSlug, appAlias } = parsed;
            const brandMatch = brands.find((brand) => brand.slug === brandSlug);
            const targetAlias = normalizeAlias(appAlias);
            const appMatch = brands.length && brandMatch && appAlias
                ? apps.find((app) => app.brand_id === brandMatch.id && normalizeAlias(app.alias) === targetAlias)
                : null;

            setSelectedBrandId(brandMatch?.id ?? null);
            setSelectedAppId(appMatch?.id ?? null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [brands, apps, dataLoading, hasParsedRoute, setSelectedBrandId, setSelectedAppId, setActivePage, canNavigate]);
};
