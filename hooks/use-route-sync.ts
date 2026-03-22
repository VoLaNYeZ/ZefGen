import { useEffect, useRef } from 'react';
import type { AppItem, Brand } from '../types/zefgen';
import type { AppPage } from '../utils/routes';
import { buildRoute, parseRoute } from '../utils/routes';
import {
    readLastAppByBrand,
    readLastWorkspaceSelection,
    resolveStartupWorkspaceSelection,
} from '../utils/workspace-selection';

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
    requestPageNavigation?: (
        page: Exclude<AppPage, 'workspace'>,
        options?: { historyMode?: 'push' | 'replace' | 'none'; fromPopState?: boolean }
    ) => void | Promise<boolean>;
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
        requestPageNavigation,
        canNavigate,
    } = params;

    const restorePopStateRef = useRef(false);

    useEffect(() => {
        if (dataLoading || hasParsedRoute) return;

        const parsed = parseRoute();
        if (parsed.page !== 'workspace') {
            if (requestPageNavigation) {
                void requestPageNavigation(parsed.page, { historyMode: 'none' });
            } else {
                setActivePage(parsed.page);
            }
            setHasParsedRoute(true);
            return;
        }

        setActivePage('workspace');

        if (!brands.length) {
            setHasParsedRoute(true);
            return;
        }

        const { brandSlug, appAlias } = parsed;
        const nextSelection = resolveStartupWorkspaceSelection({
            brandSlug,
            appAlias,
            brands,
            apps,
            orderedApps,
            lastAppByBrand: readLastAppByBrand(),
            lastWorkspaceSelection: readLastWorkspaceSelection(),
        });
        requestWorkspaceSelection(nextSelection);

        setHasParsedRoute(true);
    }, [
        dataLoading,
        hasParsedRoute,
        brands,
        apps,
        orderedApps,
        requestWorkspaceSelection,
        requestPageNavigation,
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
            if (parsed.page !== 'workspace') {
                if (requestPageNavigation) {
                    void requestPageNavigation(parsed.page, { historyMode: 'none', fromPopState: true });
                } else {
                    setActivePage(parsed.page);
                }
                return;
            }
            setActivePage(parsed.page);
            const nextSelection = resolveStartupWorkspaceSelection({
                brandSlug: parsed.brandSlug,
                appAlias: parsed.appAlias,
                brands,
                apps,
                orderedApps,
                lastAppByBrand: readLastAppByBrand(),
                lastWorkspaceSelection: readLastWorkspaceSelection(),
            });

            requestWorkspaceSelection(nextSelection);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [brands, apps, orderedApps, dataLoading, hasParsedRoute, requestWorkspaceSelection, requestPageNavigation, setActivePage, canNavigate]);
};
