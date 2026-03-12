import { useCallback } from 'react';
import type { FormEvent } from 'react';
import type { TranslationKey } from '../i18n';
import { signOut } from '../data/auth';
import { syncAutoGrowTextarea } from '../utils/dom';
import type { AppItem, AppstoreAccount } from '../types/zefgen';

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
        async (modeOrId: 'auto' | null | string) => {
            if (!selectedApp) return;
            if (appstoreAccountsLoading) return;

            const current = selectedAppstoreAccount;
            const pickAuto = () =>
                appstoreAccounts.find((account) => !account.app_id && account.usability && !account.was_used_before) ||
                null;

            try {
                if (modeOrId === null) {
                    if (!current) return;
                    await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
                    return;
                }

                const next =
                    modeOrId === 'auto'
                        ? pickAuto()
                        : appstoreAccounts.find((account) => account.id === modeOrId) || null;

                if (!next) {
                    reportActionError(
                        modeOrId === 'auto' ? text('accounts_no_usable_accounts') : text('download_failed')
                    );
                    return;
                }

                if (current && next.id === current.id) return;

                if (current && current.id !== next.id) {
                    await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
                }

                await updateAppstoreAccount({ id: next.id, patch: { app_id: selectedApp.id } });
            } catch (error: any) {
                reportActionError(String(error?.message || error));
                throw error;
            }
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
