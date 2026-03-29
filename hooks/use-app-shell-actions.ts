import { useCallback } from 'react';
import type { FormEvent } from 'react';
import type { TranslationKey } from '../i18n.ts';
import { signOut } from '../data/auth.ts';
import { syncAutoGrowTextarea } from '../utils/dom.ts';
import type { AppItem, AppstoreAccount } from '../types/zefgen.ts';
import {
    assignFirstAvailableAppstoreAccountToApp,
    bindAppstoreAccountForApp,
} from '../utils/appstore-account-binding.ts';

type UseAppShellActionsParams = {
    appstoreAccounts: AppstoreAccount[];
    appstoreAccountsLoading: boolean;
    isCurrentBrandReadOnly: boolean;
    refreshAppIdeas: () => void | Promise<void>;
    refreshApps: () => void | Promise<void>;
    refreshAppScreenshots: () => void | Promise<void>;
    refreshAppstoreAccounts: () => void | Promise<void>;
    refreshBrandReferences: () => void | Promise<void>;
    refreshBrands: () => void | Promise<void>;
    refreshGeneratedAssets: () => void | Promise<void>;
    reportActionError: (message: string) => void;
    reportReadOnlyBlocked: () => void;
    selectedApp: AppItem | null;
    selectedAppstoreAccount: AppstoreAccount | null;
    setDataError: (value: string | null) => void;
    text: (key: TranslationKey) => string;
    updateAppstoreAccount: (params: { id: string; patch: Partial<AppstoreAccount> }) => Promise<void>;
};

export { assignFirstAvailableAppstoreAccountToApp, bindAppstoreAccountForApp } from '../utils/appstore-account-binding.ts';

export function useAppShellActions({
    appstoreAccounts,
    appstoreAccountsLoading,
    isCurrentBrandReadOnly,
    refreshAppIdeas,
    refreshApps,
    refreshAppScreenshots,
    refreshAppstoreAccounts,
    refreshBrandReferences,
    refreshBrands,
    refreshGeneratedAssets,
    reportActionError,
    reportReadOnlyBlocked,
    selectedApp,
    selectedAppstoreAccount,
    setDataError,
    text,
    updateAppstoreAccount,
}: UseAppShellActionsParams) {
    const handleRetry = useCallback(() => {
        setDataError(null);
        refreshBrands();
        refreshApps();
        refreshAppstoreAccounts();
        refreshAppIdeas();
        refreshBrandReferences();
        refreshAppScreenshots();
        refreshGeneratedAssets();
    }, [
        refreshAppIdeas,
        refreshApps,
        refreshAppScreenshots,
        refreshAppstoreAccounts,
        refreshBrandReferences,
        refreshBrands,
        refreshGeneratedAssets,
        setDataError,
    ]);

    const handleLogout = useCallback(async () => {
        await signOut();
    }, []);

    const pickAccountForSelectedApp = useCallback(
        async (modeOrId: null | string) => {
            if (!selectedApp) return;
            if (appstoreAccountsLoading) return;
            await bindAppstoreAccountForApp({
                app: selectedApp,
                appstoreAccounts,
                nextAccountId: modeOrId,
                reportActionError,
                text,
                updateAppstoreAccount,
                currentAccount: selectedAppstoreAccount,
                requireSwitchConfirmation: true,
            });
        },
        [
            appstoreAccounts,
            appstoreAccountsLoading,
            reportActionError,
            selectedApp,
            selectedAppstoreAccount,
            text,
            updateAppstoreAccount,
        ]
    );

    const handleAutoGrowInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
        syncAutoGrowTextarea(event.currentTarget);
    }, []);

    const runWriteAction = useCallback(
        async (action: () => void | Promise<void>) => {
            if (isCurrentBrandReadOnly) {
                reportReadOnlyBlocked();
                return;
            }
            await action();
        },
        [isCurrentBrandReadOnly, reportReadOnlyBlocked]
    );

    return {
        handleAutoGrowInput,
        handleLogout,
        handleRetry,
        pickAccountForSelectedApp,
        runWriteAction,
    };
}
