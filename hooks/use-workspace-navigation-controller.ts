import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction, type TransitionStartFunction } from 'react';
import type { TranslationKey } from '../i18n';
import type { AppItem, Brand } from '../types/zefgen';
import type { WorkspacePreparationResult } from '../types/workspace-switch';
import { buildAccountsRoute, buildIdeasRoute, buildRoute, type AppPage } from '../utils/routes';
import { getPreferredActiveAppForBrand, readLastAppByBrand, writeLastWorkspaceSelection } from '../utils/workspace-selection';

type WorkspaceSelection = {
    brandId: string | null;
    appId: string | null;
};

type WorkspaceSwitchState = {
    label: string;
};

type WorkspaceSnapshotLike = {
    brandId: string;
};

type UseWorkspaceNavigationControllerParams = {
    activePage: AppPage;
    accountsFocusAppId: string | null;
    accountsHasUnsavedChanges: boolean;
    apps: AppItem[];
    orderedApps: AppItem[];
    brands: Brand[];
    connectorHasStaleConflict: boolean;
    hydrateWorkspaceSnapshot: (brand: Brand | null, app: AppItem | null) => Promise<unknown>;
    prepareWorkspaceForSwitch: (
        nextSelection: WorkspaceSelection,
        options?: { normalizeVisibleWorkspaceState?: boolean }
    ) => Promise<WorkspacePreparationResult>;
    prepareWorkspaceLockForSelection: (targetBrandId: string | null) => Promise<WorkspacePreparationResult>;
    reportActionError: (message: string) => void;
    requestedAppId: string | null;
    requestedBrandId: string | null;
    routeAppId: string | null;
    routeBrandId: string | null;
    selectedApp: AppItem | null;
    selectedAppId: string | null;
    selectedBrand: Brand | null;
    selectedBrandId: string | null;
    setAccountsFocusAppId: Dispatch<SetStateAction<string | null>>;
    setActivePage: Dispatch<SetStateAction<AppPage>>;
    setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
    setRequestedAppId: Dispatch<SetStateAction<string | null>>;
    setRequestedBrandId: Dispatch<SetStateAction<string | null>>;
    setSelectedAppId: Dispatch<SetStateAction<string | null>>;
    setSelectedBrandId: Dispatch<SetStateAction<string | null>>;
    setWorkspaceSwitchState: Dispatch<SetStateAction<WorkspaceSwitchState | null>>;
    startWorkspaceCommitTransition: TransitionStartFunction;
    text: (key: TranslationKey) => string;
    workspaceSnapshotsRef: MutableRefObject<Record<string, WorkspaceSnapshotLike>>;
    workspaceSwitchPending: boolean;
    workspaceSwitchSeqRef: MutableRefObject<number>;
};

export function useWorkspaceNavigationController({
    activePage,
    accountsFocusAppId,
    accountsHasUnsavedChanges,
    apps,
    orderedApps,
    brands,
    connectorHasStaleConflict,
    hydrateWorkspaceSnapshot,
    prepareWorkspaceForSwitch,
    prepareWorkspaceLockForSelection,
    reportActionError,
    requestedAppId,
    requestedBrandId,
    routeAppId,
    routeBrandId,
    selectedApp,
    selectedAppId,
    selectedBrand,
    selectedBrandId,
    setAccountsFocusAppId,
    setActivePage,
    setIsSidebarOpen,
    setRequestedAppId,
    setRequestedBrandId,
    setSelectedAppId,
    setSelectedBrandId,
    setWorkspaceSwitchState,
    startWorkspaceCommitTransition,
    text,
    workspaceSnapshotsRef,
    workspaceSwitchPending,
    workspaceSwitchSeqRef,
}: UseWorkspaceNavigationControllerParams) {
    const buildPageRoute = useCallback((page: AppPage, brand: Brand | null, app: AppItem | null) => {
        if (page === 'accounts') return buildAccountsRoute();
        if (page === 'ideas') return buildIdeasRoute();
        return buildRoute(brand, app);
    }, []);

    const restoreRequestedNavigationToDisplayed = useCallback(
        (page: AppPage, nextAccountsFocusAppId: string | null = null) => {
            setRequestedBrandId(selectedBrandId);
            setRequestedAppId(selectedAppId);
            setAccountsFocusAppId(page === 'accounts' ? nextAccountsFocusAppId : null);
            setActivePage(page);
            const route = buildPageRoute(page, selectedBrand, selectedApp);
            if (window.location.pathname !== route) {
                window.history.replaceState({}, '', route);
            }
        },
        [
            buildPageRoute,
            selectedApp,
            selectedAppId,
            selectedBrand,
            selectedBrandId,
            setAccountsFocusAppId,
            setActivePage,
            setRequestedAppId,
            setRequestedBrandId,
        ]
    );

    const resolveWorkspaceSelection = useCallback(
        (payload: WorkspaceSelection) => {
            const nextBrand = payload.brandId ? brands.find((brand) => brand.id === payload.brandId) || null : null;
            if (!nextBrand) {
                return {
                    brand: null as Brand | null,
                    app: null as AppItem | null,
                    brandId: null,
                    appId: null,
                };
            }

            const knownApp = payload.appId
                ? apps.find((app) => app.id === payload.appId) ||
                  (selectedApp?.id === payload.appId ? selectedApp : null)
                : null;
            const explicitApp =
                knownApp && (knownApp.brand_id === nextBrand.id || knownApp.id === selectedApp?.id)
                    ? ({ ...knownApp, brand_id: nextBrand.id } as AppItem)
                    : null;
            const fallbackApp = getPreferredActiveAppForBrand({
                apps,
                brandId: nextBrand.id,
                lastAppByBrand: readLastAppByBrand(),
                orderedApps,
            });
            const nextApp = explicitApp || fallbackApp;

            return {
                brand: nextBrand,
                app: nextApp,
                brandId: nextBrand.id,
                appId: nextApp?.id ?? null,
            };
        },
        [apps, brands, orderedApps, selectedApp]
    );

    const persistResolvedWorkspaceSelection = useCallback(
        (resolved: { brand: Brand | null; app: AppItem | null }) => {
            if (!resolved.brand || !resolved.app) return;
            if (resolved.brand.is_inactive || resolved.app.is_banned) return;
            writeLastWorkspaceSelection({
                brandId: resolved.brand.id,
                appId: resolved.app.id,
            });
        },
        []
    );

    const requestWorkspaceSelection = useCallback(
        async (
            payload: WorkspaceSelection & {
                historyMode?: 'push' | 'replace' | 'none';
                closeSidebar?: boolean;
                skipCollaborationLockPreparation?: boolean;
            }
        ) => {
            const previousPage = activePage;
            const previousAccountsFocusAppId = accountsFocusAppId;
            const shouldEnterWorkspace = previousPage !== 'workspace';
            const resolved = resolveWorkspaceSelection(payload);
            const sameDisplayed = resolved.brandId === selectedBrandId && resolved.appId === selectedAppId;
            const sameRequested = resolved.brandId === routeBrandId && resolved.appId === routeAppId;

            setRequestedBrandId(resolved.brandId);
            setRequestedAppId(resolved.appId);

            const targetRoute = buildRoute(resolved.brand, resolved.app);
            if (payload.historyMode === 'push' && window.location.pathname !== targetRoute) {
                window.history.pushState({}, '', targetRoute);
            } else if (payload.historyMode === 'replace' && window.location.pathname !== targetRoute) {
                window.history.replaceState({}, '', targetRoute);
            }

            if (payload.closeSidebar && window.innerWidth < 768) {
                setIsSidebarOpen(false);
            }

            if (sameDisplayed && sameRequested) {
                if (shouldEnterWorkspace && !payload.skipCollaborationLockPreparation) {
                    const token = workspaceSwitchSeqRef.current + 1;
                    workspaceSwitchSeqRef.current = token;
                    const lockPreparation = await prepareWorkspaceLockForSelection(resolved.brandId);
                    if (workspaceSwitchSeqRef.current !== token) return false;
                    if (lockPreparation.status === 'blocked') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        reportActionError(lockPreparation.message);
                        return false;
                    }
                    if (lockPreparation.status === 'failed') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        return false;
                    }
                }
                if (shouldEnterWorkspace) {
                    setAccountsFocusAppId(null);
                    setActivePage('workspace');
                }
                setWorkspaceSwitchState(null);
                return true;
            }

            const token = workspaceSwitchSeqRef.current + 1;
            workspaceSwitchSeqRef.current = token;
            setWorkspaceSwitchState({
                label: resolved.app?.name || resolved.brand?.name || text('loading'),
            });

            const preparation = await prepareWorkspaceForSwitch({
                brandId: resolved.brandId,
                appId: resolved.appId,
            });
            if (workspaceSwitchSeqRef.current !== token) return false;
            if (preparation.status === 'blocked') {
                restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                setWorkspaceSwitchState(null);
                reportActionError(preparation.message);
                return false;
            }
            if (preparation.status === 'failed') {
                restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                setWorkspaceSwitchState(null);
                return false;
            }

            const cachedTargetSnapshot =
                resolved.app && resolved.brandId ? workspaceSnapshotsRef.current[resolved.app.id] ?? null : null;
            const canUseWarmSnapshotImmediately =
                Boolean(cachedTargetSnapshot && cachedTargetSnapshot.brandId === resolved.brandId) &&
                !connectorHasStaleConflict;

            if (canUseWarmSnapshotImmediately) {
                if (!payload.skipCollaborationLockPreparation) {
                    const lockPreparation = await prepareWorkspaceLockForSelection(resolved.brandId);
                    if (workspaceSwitchSeqRef.current !== token) return false;
                    if (lockPreparation.status === 'blocked') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        reportActionError(lockPreparation.message);
                        return false;
                    }
                    if (lockPreparation.status === 'failed') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        return false;
                    }
                }

                persistResolvedWorkspaceSelection(resolved);
                startWorkspaceCommitTransition(() => {
                    if (shouldEnterWorkspace) {
                        setAccountsFocusAppId(null);
                        setActivePage('workspace');
                    }
                    setSelectedBrandId(resolved.brandId);
                    setSelectedAppId(resolved.appId);
                    setWorkspaceSwitchState(null);
                });
                return true;
            }

            try {
                await hydrateWorkspaceSnapshot(resolved.brand, resolved.app);
                if (workspaceSwitchSeqRef.current !== token) return false;

                if (!payload.skipCollaborationLockPreparation) {
                    const lockPreparation = await prepareWorkspaceLockForSelection(resolved.brandId);
                    if (workspaceSwitchSeqRef.current !== token) return false;
                    if (lockPreparation.status === 'blocked') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        reportActionError(lockPreparation.message);
                        return false;
                    }
                    if (lockPreparation.status === 'failed') {
                        restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                        setWorkspaceSwitchState(null);
                        return false;
                    }
                }

                persistResolvedWorkspaceSelection(resolved);
                startWorkspaceCommitTransition(() => {
                    if (shouldEnterWorkspace) {
                        setAccountsFocusAppId(null);
                        setActivePage('workspace');
                    }
                    setSelectedBrandId(resolved.brandId);
                    setSelectedAppId(resolved.appId);
                    setWorkspaceSwitchState(null);
                });
                return true;
            } catch (error: any) {
                if (workspaceSwitchSeqRef.current !== token) return false;
                restoreRequestedNavigationToDisplayed(previousPage, previousAccountsFocusAppId);
                setWorkspaceSwitchState(null);
                reportActionError(String(error?.message || text('download_failed')));
                return false;
            }
        },
        [
            activePage,
            accountsFocusAppId,
            connectorHasStaleConflict,
            hydrateWorkspaceSnapshot,
            prepareWorkspaceLockForSelection,
            prepareWorkspaceForSwitch,
            reportActionError,
            resolveWorkspaceSelection,
            restoreRequestedNavigationToDisplayed,
            routeAppId,
            routeBrandId,
            selectedAppId,
            selectedBrandId,
            setAccountsFocusAppId,
            setActivePage,
            setIsSidebarOpen,
            setRequestedAppId,
            setRequestedBrandId,
            setSelectedAppId,
            setSelectedBrandId,
            setWorkspaceSwitchState,
            startWorkspaceCommitTransition,
            persistResolvedWorkspaceSelection,
            text,
            workspaceSnapshotsRef,
            workspaceSwitchSeqRef,
        ]
    );

    useEffect(() => {
        if (workspaceSwitchPending) return;
        if (requestedBrandId === selectedBrandId && requestedAppId === selectedAppId) return;
        setRequestedBrandId(selectedBrandId);
        setRequestedAppId(selectedAppId);
    }, [
        requestedAppId,
        requestedBrandId,
        selectedAppId,
        selectedBrandId,
        setRequestedAppId,
        setRequestedBrandId,
        workspaceSwitchPending,
    ]);

    const requestPageNavigation = useCallback(
        async (
            page: Exclude<AppPage, 'workspace'>,
            options?: {
                historyMode?: 'push' | 'replace' | 'none';
                closeSidebar?: boolean;
                focusAppId?: string | null;
                fromPopState?: boolean;
            }
        ) => {
            const previousRoute = buildPageRoute(activePage, selectedBrand, selectedApp);

            if (activePage === 'accounts' && accountsHasUnsavedChanges && page !== 'accounts') {
                if (options?.fromPopState && window.location.pathname !== previousRoute) {
                    window.history.replaceState({}, '', previousRoute);
                }
                reportActionError(text('accounts_unsaved_block'));
                return false;
            }

            if (activePage === 'workspace') {
                const token = workspaceSwitchSeqRef.current + 1;
                workspaceSwitchSeqRef.current = token;
                setWorkspaceSwitchState({
                    label: text(page === 'accounts' ? 'accounts' : 'ideas'),
                });

                const preparation = await prepareWorkspaceForSwitch(
                    {
                        brandId: selectedBrandId,
                        appId: selectedAppId,
                    },
                    { normalizeVisibleWorkspaceState: true }
                );
                if (workspaceSwitchSeqRef.current !== token) return false;
                if (preparation.status === 'blocked') {
                    if (options?.fromPopState && window.location.pathname !== previousRoute) {
                        window.history.replaceState({}, '', previousRoute);
                    }
                    setWorkspaceSwitchState(null);
                    reportActionError(preparation.message);
                    return false;
                }
                if (preparation.status === 'failed') {
                    if (options?.fromPopState && window.location.pathname !== previousRoute) {
                        window.history.replaceState({}, '', previousRoute);
                    }
                    setWorkspaceSwitchState(null);
                    return false;
                }
            }

            setAccountsFocusAppId(page === 'accounts' ? options?.focusAppId || null : null);
            setActivePage(page);

            const targetRoute = page === 'accounts' ? buildAccountsRoute() : buildIdeasRoute();
            if (options?.historyMode === 'push' && window.location.pathname !== targetRoute) {
                window.history.pushState({}, '', targetRoute);
            } else if (options?.historyMode === 'replace' && window.location.pathname !== targetRoute) {
                window.history.replaceState({}, '', targetRoute);
            }

            if (options?.closeSidebar && window.innerWidth < 768) {
                setIsSidebarOpen(false);
            }

            setWorkspaceSwitchState(null);
            return true;
        },
        [
            accountsHasUnsavedChanges,
            activePage,
            buildPageRoute,
            prepareWorkspaceForSwitch,
            reportActionError,
            selectedApp,
            selectedAppId,
            selectedBrand,
            selectedBrandId,
            setAccountsFocusAppId,
            setActivePage,
            setIsSidebarOpen,
            setWorkspaceSwitchState,
            text,
            workspaceSwitchSeqRef,
        ]
    );

    return {
        requestWorkspaceSelection,
        requestPageNavigation,
    };
}
