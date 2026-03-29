import type { AppstoreAccount } from '../types/zefgen';

type AppstoreAccountAvailability = Pick<AppstoreAccount, 'app_id' | 'usability' | 'was_used_before'>;

export const isAvailableAppstoreAccount = (account: AppstoreAccountAvailability) =>
    !account.app_id && account.usability && !account.was_used_before;

export const pickFirstAvailableAppstoreAccount = <T extends AppstoreAccountAvailability>(accounts: readonly T[]) =>
    accounts.find(isAvailableAppstoreAccount) || null;
