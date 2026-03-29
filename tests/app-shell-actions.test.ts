import test from 'node:test';
import assert from 'node:assert/strict';

import { bindAppstoreAccountForApp } from '../utils/appstore-account-binding.ts';
import type { AppstoreAccount } from '../types/zefgen';

test('bindAppstoreAccountForApp restores the current account when switching fails mid-flight', async () => {
    const calls: Array<{ id: string; patch: Partial<AppstoreAccount> }> = [];
    const reportedErrors: string[] = [];
    const currentAccount: AppstoreAccount = {
        id: 'current-account',
        user_id: 'user-1',
        app_id: 'app-1',
        usability: true,
        was_used_before: false,
        email: 'current@example.test',
        password: null,
        email_password: null,
        number: null,
        geo: null,
        company_name: null,
        proxy: null,
        notes: null,
        updated_at: '2026-03-29T00:00:00.000Z',
        created_at: '2026-03-29T00:00:00.000Z',
    };
    const nextAccount: AppstoreAccount = {
        ...currentAccount,
        id: 'next-account',
        app_id: null,
        email: 'next@example.test',
    };

    await assert.rejects(
        bindAppstoreAccountForApp({
            app: { id: 'app-1' },
            appstoreAccounts: [currentAccount, nextAccount],
            nextAccountId: nextAccount.id,
            reportActionError: (message) => {
                reportedErrors.push(message);
            },
            text: () => '',
            updateAppstoreAccount: async ({ id, patch }) => {
                calls.push({ id, patch });
                if (id === currentAccount.id && patch.app_id === null) return;
                if (id === nextAccount.id && patch.app_id === 'app-1') {
                    throw new Error('bind failed');
                }
                if (id === currentAccount.id && patch.app_id === 'app-1') return;
                throw new Error(`unexpected update ${id}`);
            },
            currentAccount,
        }),
        /bind failed/
    );

    assert.deepEqual(calls, [
        { id: currentAccount.id, patch: { app_id: null } },
        { id: nextAccount.id, patch: { app_id: 'app-1' } },
        { id: currentAccount.id, patch: { app_id: 'app-1' } },
    ]);
    assert.deepEqual(reportedErrors, ['bind failed']);
});
