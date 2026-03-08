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
    routeBrand: Brand | null;
    routeApp: AppItem | null;
    requestWorkspaceSelection: (payload: { brandId: string | null; appId: string | null }) => void;
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
        routeBrand,
        routeApp,
        requestWorkspaceSelection,
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

        if (nextBrand && appAlias) {
            const targetAlias = normalizeAlias(appAlias);
            const nextApp = apps.find(
                (app) => app.brand_id === nextBrand?.id && normalizeAlias(app.alias) === targetAlias
            );
            requestWorkspaceSelection({
                brandId: nextBrand?.id ?? null,
                appId: nextApp?.id ?? null,
            });
        } else {
            const firstApp = orderedApps.find((app) => app.brand_id === nextBrand?.id);
            requestWorkspaceSelection({
                brandId: nextBrand?.id ?? null,
                appId: firstApp?.id ?? null,
            });
        }

        setHasParsedRoute(true);
    }, [
        dataLoading,
        hasParsedRoute,
        brands,
        apps,
        orderedApps,
        requestWorkspaceSelection,
        setHasParsedRoute,
        setActivePage,
    ]);

    useEffect(() => {
        if (dataLoading || !hasParsedRoute) return;
        if (activePage !== 'workspace') return;
        if (brands.length > 0 && !routeBrand) {
            setHasParsedRoute(false);
        }
    }, [dataLoading, hasParsedRoute, activePage, brands.length, routeBrand, setHasParsedRoute]);

    useEffect(() => {
        if (!hasParsedRoute || dataLoading) return;
        if (activePage !== 'workspace') return;

        if (!routeBrand) {
            window.history.replaceState({}, '', '/');
            return;
        }

        const currentApp = routeApp && routeApp.brand_id === routeBrand.id ? routeApp : null;
        const nextRoute = buildRoute(routeBrand, currentApp);

        if (window.location.pathname !== nextRoute) {
            window.history.replaceState({}, '', nextRoute);
        }
    }, [hasParsedRoute, dataLoading, activePage, routeBrand, routeApp]);

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

            requestWorkspaceSelection({
                brandId: brandMatch?.id ?? null,
                appId: appMatch?.id ?? null,
            });
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [brands, apps, dataLoading, hasParsedRoute, requestWorkspaceSelection, setActivePage, canNavigate]);
};
