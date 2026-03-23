import { useCallback } from 'react';
import type { TranslationKey } from '../i18n';
import type { AppItem, Brand } from '../types/zefgen';
import type { AppPage, NonWorkspacePage } from '../utils/routes';

type RequestPageNavigation = (
    page: NonWorkspacePage,
    options?: {
        historyMode?: 'push' | 'replace' | 'none';
        closeSidebar?: boolean;
        focusAppId?: string | null;
        fromPopState?: boolean;
    }
) => Promise<boolean> | void;

type RequestWorkspaceSelection = (payload: {
    brandId: string | null;
    appId: string | null;
    historyMode?: 'push' | 'replace' | 'none';
    closeSidebar?: boolean;
    skipCollaborationLockPreparation?: boolean;
}) => Promise<boolean> | void;

type Params = {
    activePage: AppPage;
    accountsHasUnsavedChanges: boolean;
    apps: AppItem[];
    brands: Brand[];
    reportActionError: (message: string) => void;
    requestPageNavigation: RequestPageNavigation;
    requestWorkspaceSelection: RequestWorkspaceSelection;
    text: (key: TranslationKey) => string;
};

export function useWorkspaceNavigationActions({
    activePage,
    accountsHasUnsavedChanges,
    apps,
    brands,
    reportActionError,
    requestPageNavigation,
    requestWorkspaceSelection,
    text,
}: Params) {
    const openAccounts = useCallback(
        (focusAppId?: string | null) => {
            void requestPageNavigation('accounts', {
                focusAppId: focusAppId || null,
                historyMode: 'push',
                closeSidebar: true,
            });
        },
        [requestPageNavigation]
    );

    const openIdeas = useCallback(() => {
        void requestPageNavigation('ideas', {
            historyMode: 'push',
            closeSidebar: true,
        });
    }, [requestPageNavigation]);

    const openHelp = useCallback(() => {
        void requestPageNavigation('help', {
            historyMode: 'push',
            closeSidebar: true,
        });
    }, [requestPageNavigation]);

    const openWorkspaceForApp = useCallback(
        (appId: string) => {
            void (async () => {
                if (activePage === 'accounts' && accountsHasUnsavedChanges) {
                    reportActionError(text('accounts_unsaved_block'));
                    return;
                }
                const app = apps.find((candidate) => candidate.id === appId) || null;
                if (!app) return;
                const brand = brands.find((candidate) => candidate.id === app.brand_id) || null;
                if (!brand) return;

                await requestWorkspaceSelection({
                    brandId: brand.id,
                    appId: app.id,
                    historyMode: 'push',
                    closeSidebar: true,
                });
            })();
        },
        [
            activePage,
            accountsHasUnsavedChanges,
            apps,
            brands,
            reportActionError,
            requestWorkspaceSelection,
            text,
        ]
    );

    const selectBrandFromSidebar = useCallback(
        (brandId: string | null) => {
            void (async () => {
                if (activePage === 'accounts' && accountsHasUnsavedChanges) {
                    reportActionError(text('accounts_unsaved_block'));
                    return;
                }

                await requestWorkspaceSelection({
                    brandId,
                    appId: null,
                    historyMode: 'push',
                    closeSidebar: true,
                });
            })();
        },
        [
            activePage,
            accountsHasUnsavedChanges,
            reportActionError,
            requestWorkspaceSelection,
            text,
        ]
    );

    return {
        openAccounts,
        openHelp,
        openIdeas,
        openWorkspaceForApp,
        selectBrandFromSidebar,
    };
}
