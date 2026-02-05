import { useEffect } from 'react';
import type { AppItem, Brand } from '../types/zefgen';
import { buildRoute, parseRoute } from '../utils/routes';

type RouteSyncParams = {
    dataLoading: boolean;
    hasParsedRoute: boolean;
    setHasParsedRoute: (value: boolean) => void;
    brands: Brand[];
    apps: AppItem[];
    orderedApps: AppItem[];
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    setSelectedBrandId: (value: string | null) => void;
    setSelectedAppId: (value: string | null) => void;
};

export const useRouteSync = (params: RouteSyncParams) => {
    const {
        dataLoading,
        hasParsedRoute,
        setHasParsedRoute,
        brands,
        apps,
        orderedApps,
        selectedBrand,
        selectedApp,
        setSelectedBrandId,
        setSelectedAppId,
    } = params;

    useEffect(() => {
        if (dataLoading || hasParsedRoute) return;
        if (!brands.length) {
            setHasParsedRoute(true);
            return;
        }

        const { brandSlug, appAlias } = parseRoute();
        let nextBrand = brandSlug
            ? brands.find((brand) => brand.slug === brandSlug) || null
            : brands[0];

        if (!nextBrand) nextBrand = brands[0];

        setSelectedBrandId(nextBrand?.id ?? null);

        if (nextBrand && appAlias) {
            const nextApp = apps.find(
                (app) => app.brand_id === nextBrand?.id && app.alias === appAlias
            );
            setSelectedAppId(nextApp?.id ?? null);
        } else {
            const firstApp = orderedApps.find((app) => app.brand_id === nextBrand?.id);
            setSelectedAppId(firstApp?.id ?? null);
        }

        setHasParsedRoute(true);
    }, [dataLoading, hasParsedRoute, brands, apps, orderedApps, setHasParsedRoute, setSelectedBrandId, setSelectedAppId]);

    useEffect(() => {
        if (dataLoading || !hasParsedRoute) return;
        if (brands.length > 0 && !selectedBrand) {
            setHasParsedRoute(false);
        }
    }, [dataLoading, hasParsedRoute, brands.length, selectedBrand, setHasParsedRoute]);

    useEffect(() => {
        if (!hasParsedRoute || dataLoading) return;

        if (!selectedBrand) {
            window.history.replaceState({}, '', '/');
            return;
        }

        const currentApp = selectedApp && selectedApp.brand_id === selectedBrand.id ? selectedApp : null;
        const nextRoute = buildRoute(selectedBrand, currentApp);

        if (window.location.pathname !== nextRoute) {
            window.history.replaceState({}, '', nextRoute);
        }
    }, [hasParsedRoute, dataLoading, selectedBrand, selectedApp]);

    useEffect(() => {
        if (!hasParsedRoute) return;

        const handlePopState = () => {
            if (dataLoading) return;
            const { brandSlug, appAlias } = parseRoute();
            const brandMatch = brands.find((brand) => brand.slug === brandSlug);
            const appMatch = brands.length && brandMatch && appAlias
                ? apps.find((app) => app.brand_id === brandMatch.id && app.alias === appAlias)
                : null;

            setSelectedBrandId(brandMatch?.id ?? null);
            setSelectedAppId(appMatch?.id ?? null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [brands, apps, dataLoading, hasParsedRoute, setSelectedBrandId, setSelectedAppId]);
};
