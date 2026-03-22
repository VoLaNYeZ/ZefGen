import { expect, test } from './support/fixtures';
import { clearAppStoreAccountsForApp } from './support/backend';
import {
    claimWorkspaceEditLockIfPrompted,
    gotoAccountsTargetWorkspace,
    gotoWorkspace,
    openAccounts,
    pasteInto,
    smokeEnv,
} from './support/helpers';

test('accounts support single-row paste, persist saves, and block navigation while dirty', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const pastedEmail = `qa+${suffix}@paste-target.test`;
    const pastedCompany = `Paste Signal Labs ${suffix}`;
    const pastedRow = [
        smokeEnv.seed.accountsTargetApp.alias,
        pastedEmail,
        'paste-pass-001',
        'paste-mail-pass-001',
        '+15550001099',
        'US',
        pastedCompany,
        'http://127.0.0.1:9090',
        `Created by Playwright smoke test ${suffix}`,
    ].join('\t');

    try {
        await gotoWorkspace(page);
        await openAccounts(page);

        const accountsPage = page.getByTestId('accounts-page-root');
        await accountsPage.getByRole('button', { name: /^Edit$/ }).click();
        await accountsPage.getByRole('button', { name: /new account/i }).click();

        const newRow = page.locator('#account-row-new');
        const appCell = newRow.locator('[data-paste-field="app_id"]');
        await pasteInto(page, appCell, pastedRow);

        await newRow.getByTitle(/^Save$/).click();
        await expect(page.locator('#account-row-new')).toHaveCount(0);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator(`input[value="${pastedEmail}"]`)).toBeVisible();

        await accountsPage.getByRole('button', { name: /^Edit$/ }).click();
        await accountsPage.getByRole('button', { name: /new account/i }).click();
        await page.getByTestId('brand-sidebar').getByRole('button', { name: /^Ideas$/ }).click();

        await expect(page).toHaveURL(/\/accounts$/);
        await expect(page.getByTestId('app-shell-action-error')).toContainText(/unsaved/i);
        await expect(page.getByTestId('accounts-unsaved-banner')).toBeVisible();
        await page.getByTestId('accounts-unsaved-banner').getByRole('button', { name: /^Cancel$/ }).click();

        await gotoAccountsTargetWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);
        await expect(page.locator(`input[value="${pastedCompany}"]`)).toBeVisible();
    } finally {
        await clearAppStoreAccountsForApp(smokeEnv.seed.accountsTargetApp.id);
    }
});
