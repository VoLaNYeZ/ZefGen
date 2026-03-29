import type { TranslationKey } from '../i18n.ts';
import { pickFirstAvailableAppstoreAccount } from './appstore-account-selection.ts';
import type { AppItem, AppstoreAccount } from '../types/zefgen.ts';

type BindAppstoreAccountForAppParams = {
    app: Pick<AppItem, 'id'>;
    appstoreAccounts: AppstoreAccount[];
    nextAccountId: string | null;
    reportActionError: (message: string) => void;
    text: (key: TranslationKey) => string;
    updateAppstoreAccount: (params: { id: string; patch: Partial<AppstoreAccount> }) => Promise<void>;
    currentAccount?: AppstoreAccount | null;
    requireSwitchConfirmation?: boolean;
};

const findAssignedAccountForApp = (appId: string, appstoreAccounts: AppstoreAccount[]) =>
    appstoreAccounts.find((account) => account.app_id === appId) || null;

const formatBindingError = (error: unknown) => String((error as any)?.message || error);

export const bindAppstoreAccountForApp = async ({
    app,
    appstoreAccounts,
    nextAccountId,
    reportActionError,
    text,
    updateAppstoreAccount,
    currentAccount,
    requireSwitchConfirmation = false,
}: BindAppstoreAccountForAppParams) => {
    const current = currentAccount ?? findAssignedAccountForApp(app.id, appstoreAccounts);

    try {
        if (nextAccountId === null) {
            if (!current) return null;
            if (requireSwitchConfirmation) {
                const confirmed = window.confirm(text('accounts_confirm_switch_account'));
                if (!confirmed) return current;
            }
            await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
            return null;
        }

        const next = appstoreAccounts.find((account) => account.id === nextAccountId) || null;
        if (!next) {
            reportActionError(text('download_failed'));
            return current;
        }

        if (next.app_id && next.app_id !== app.id) {
            reportActionError(text('accounts_app_already_has_account'));
            return current;
        }

        if (current && next.id === current.id) return next;

        if (current && current.id !== next.id) {
            if (requireSwitchConfirmation) {
                const confirmed = window.confirm(text('accounts_confirm_switch_account'));
                if (!confirmed) return current;
            }
            await updateAppstoreAccount({ id: current.id, patch: { app_id: null } });
            try {
                await updateAppstoreAccount({ id: next.id, patch: { app_id: app.id } });
            } catch (error: any) {
                try {
                    await updateAppstoreAccount({ id: current.id, patch: { app_id: app.id } });
                } catch (restoreError: any) {
                    throw new Error(
                        `${formatBindingError(error)} (restore failed: ${formatBindingError(restoreError)})`
                    );
                }
                throw error;
            }
            return next;
        }

        await updateAppstoreAccount({ id: next.id, patch: { app_id: app.id } });
        return next;
    } catch (error: any) {
        reportActionError(formatBindingError(error));
        throw error;
    }
};

type AssignFirstAvailableAppstoreAccountToAppParams = Omit<
    BindAppstoreAccountForAppParams,
    'nextAccountId' | 'currentAccount' | 'requireSwitchConfirmation'
>;

export const assignFirstAvailableAppstoreAccountToApp = async ({
    app,
    appstoreAccounts,
    reportActionError,
    text,
    updateAppstoreAccount,
}: AssignFirstAvailableAppstoreAccountToAppParams) => {
    const next = pickFirstAvailableAppstoreAccount(appstoreAccounts);
    if (!next) return null;

    return bindAppstoreAccountForApp({
        app,
        appstoreAccounts,
        nextAccountId: next.id,
        reportActionError,
        text,
        updateAppstoreAccount,
    });
};
