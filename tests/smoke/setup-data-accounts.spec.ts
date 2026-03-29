import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
    createSmokeAppstoreAccount,
    deleteBrandCascade,
    deleteSmokeAppstoreAccount,
    fetchSmokeAppstoreAccountForApp,
    listSmokeAppstoreAccounts,
    updateSmokeAppstoreAccount,
} from './support/backend';
import {
    claimWorkspaceEditLockIfPrompted,
    gotoAccountsTargetWorkspace,
    gotoWorkspace,
    selectOptionContainingText,
    slugifyForSmoke,
    smokeEnv,
} from './support/helpers';

const getSetupDataPanel = (page: Page) => page.getByTestId('workspace-panel-variables-secrets');

const getAccountSelect = (page: Page) => getSetupDataPanel(page).locator('select[aria-label="Account"]');

const getAccountOptionLabels = async (page: Page) =>
    getAccountSelect(page).locator('option').evaluateAll((nodes) => nodes.map((node) => (node.textContent || '').trim()));

const createBrandAndAppInCurrentWorkspace = async (page: Page, suffix: string) => {
    const brandName = `Setup Accounts ${suffix}`;
    const brandSlug = slugifyForSmoke(brandName);
    const appAlias = `acct-${suffix}`;
    let createdBrandId: string | null = null;

    const sidebar = page.getByTestId('brand-sidebar');
    await sidebar.getByRole('button', { name: /^New$/ }).click();
    await page.getByLabel('Brand name').fill(brandName);
    await sidebar.getByRole('button', { name: /create brand/i }).click();

    const activeBrandRow = page.getByTestId('active-brand-row');
    await expect(activeBrandRow).toContainText(brandName);
    createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
    expect(createdBrandId, 'Expected the new setup-accounts test brand to expose a brand id').toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`/${brandSlug}$`));

    const createAppButton = page.getByRole('button', { name: /create app/i });
    if (!(await createAppButton.isVisible())) {
        await page.getByRole('button', { name: /add app/i }).click();
    }

    await page.getByLabel('Alias').fill(appAlias);
    await page.getByRole('button', { name: /create app/i }).click();

    await expect(page).toHaveURL(new RegExp(`/${brandSlug}/${appAlias}$`));
    const activeAppPill = page.getByTestId('active-app-pill');
    await expect(activeAppPill).toContainText(appAlias.toUpperCase());

    const createdAppId = await activeAppPill.getAttribute('data-app-id');
    expect(createdAppId, 'Expected the new setup-accounts test app to expose an app id').toBeTruthy();

    return {
        createdBrandId,
        createdAppId: String(createdAppId),
        brandSlug,
    };
};

const createBrandAndApp = async (page: Page, suffix: string) => {
    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);
    return createBrandAndAppInCurrentWorkspace(page, suffix);
};

const createAdditionalAppInCurrentBrand = async (page: Page, brandSlug: string, appAlias: string) => {
    const createAppButton = page.getByRole('button', { name: /create app/i });
    if (!(await createAppButton.isVisible())) {
        await page.getByRole('button', { name: /add app/i }).click();
    }

    await page.getByLabel('Alias').fill(appAlias);
    await page.getByRole('button', { name: /create app/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${brandSlug}/${appAlias}$`));

    const activeAppPill = page.getByTestId('active-app-pill');
    await expect(activeAppPill).toContainText(appAlias.toUpperCase());

    const createdAppId = await activeAppPill.getAttribute('data-app-id');
    expect(createdAppId, 'Expected the new setup-accounts test app to expose an app id').toBeTruthy();
    return String(createdAppId);
};

test('new app auto-assigns the first available account and Step 3 shows a concrete selection', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded free account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    let createdBrandId: string | null = null;

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        const setupDataPanel = getSetupDataPanel(page);
        const accountSelect = getAccountSelect(page);
        await expect.poll(async () => accountSelect.inputValue()).not.toBe('unassigned');
        await expect(setupDataPanel.getByText('No account for this app.')).toHaveCount(0);

        const optionLabels = await getAccountOptionLabels(page);
        expect(optionLabels).not.toContain('Auto');

        const assignedAccount = await fetchSmokeAppstoreAccountForApp(created.createdAppId);
        expect(assignedAccount?.id).toBe(seededAccount.id);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
    }
});

test('new app stays unassigned when there is no free account and Step 3 keeps the warning state', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: smokeEnv.seed.accountsTargetApp.id,
        usability: true,
        was_used_before: false,
    });

    let createdBrandId: string | null = null;

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        const setupDataPanel = getSetupDataPanel(page);
        const accountSelect = getAccountSelect(page);
        await expect(accountSelect).toHaveValue('unassigned');
        await expect(setupDataPanel.getByText('No account for this app.')).toBeVisible();

        const optionLabels = await getAccountOptionLabels(page);
        expect(optionLabels).not.toContain('Auto');

        const assignedAccount = await fetchSmokeAppstoreAccountForApp(created.createdAppId);
        expect(assignedAccount).toBeNull();
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
    }
});

test('new app still auto-assigns when accounts finish hydrating after creation', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded free account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    let createdBrandId: string | null = null;
    let releaseFirstAccountsResponse: (() => void) | null = null;
    let heldFirstAccountsResponse = false;

    await page.route('**/rest/v1/appstore_accounts*', async (route) => {
        if (route.request().method() !== 'GET' || heldFirstAccountsResponse) {
            await route.continue();
            return;
        }

        heldFirstAccountsResponse = true;
        await new Promise<void>((resolve) => {
            releaseFirstAccountsResponse = resolve;
        });
        await route.continue();
    });

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;
        expect(releaseFirstAccountsResponse, 'Expected to hold the first appstore_accounts hydration request').toBeTruthy();

        releaseFirstAccountsResponse?.();

        const setupDataPanel = getSetupDataPanel(page);
        const accountSelect = getAccountSelect(page);
        await expect.poll(async () => accountSelect.inputValue()).not.toBe('unassigned');
        await expect(setupDataPanel.getByText('No account for this app.')).toHaveCount(0);

        const assignedAccount = await fetchSmokeAppstoreAccountForApp(created.createdAppId);
        expect(assignedAccount?.id).toBe(seededAccount.id);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
    }
});

test('multiple new apps created before account hydration each get one delayed assignment', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded free account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    const secondAvailable = await createSmokeAppstoreAccount();
    let createdBrandId: string | null = null;
    let releaseFirstAccountsResponse: (() => void) | null = null;
    let heldFirstAccountsResponse = false;

    await page.route('**/rest/v1/appstore_accounts*', async (route) => {
        if (route.request().method() !== 'GET' || heldFirstAccountsResponse) {
            await route.continue();
            return;
        }

        heldFirstAccountsResponse = true;
        await new Promise<void>((resolve) => {
            releaseFirstAccountsResponse = resolve;
        });
        await route.continue();
    });

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;
        const secondAppAlias = `acct-${`${Date.now()}`.slice(-4)}-b`;
        const secondAppId = await createAdditionalAppInCurrentBrand(page, created.brandSlug, secondAppAlias);
        expect(releaseFirstAccountsResponse, 'Expected to hold the first appstore_accounts hydration request').toBeTruthy();

        releaseFirstAccountsResponse?.();

        await expect
            .poll(async () => (await fetchSmokeAppstoreAccountForApp(created.createdAppId))?.id || null)
            .toBe(seededAccount.id);
        await expect.poll(async () => (await fetchSmokeAppstoreAccountForApp(secondAppId))?.id || null).toBe(
            secondAvailable.id
        );
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await updateSmokeAppstoreAccount(secondAvailable.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await deleteSmokeAppstoreAccount(secondAvailable.id);
    }
});

test('multiple new apps created after account hydration each keep a distinct auto-assignment', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded free account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    const secondAvailable = await createSmokeAppstoreAccount();
    let createdBrandId: string | null = null;
    let releaseFirstAssignment: (() => void) | null = null;
    let heldFirstAssignment = false;

    await page.route('**/rest/v1/appstore_accounts*', async (route) => {
        if (route.request().method() !== 'PATCH' || heldFirstAssignment) {
            await route.continue();
            return;
        }

        heldFirstAssignment = true;
        await new Promise<void>((resolve) => {
            releaseFirstAssignment = resolve;
        });
        await route.continue();
    });

    const accountsLoaded = page.waitForResponse(
        (response) => response.url().includes('/rest/v1/appstore_accounts') && response.request().method() === 'GET'
    );

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);
        await accountsLoaded;

        const created = await createBrandAndAppInCurrentWorkspace(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        await expect
            .poll(() => Boolean(releaseFirstAssignment), {
                message: 'Expected the first loaded-state account assignment to be in flight before creating a second app',
            })
            .toBe(true);

        const secondAppAlias = `acct-${`${Date.now()}`.slice(-4)}-c`;
        const secondAppId = await createAdditionalAppInCurrentBrand(page, created.brandSlug, secondAppAlias);

        releaseFirstAssignment?.();

        await expect
            .poll(async () => (await fetchSmokeAppstoreAccountForApp(created.createdAppId))?.id || null)
            .toBe(seededAccount.id);
        await expect.poll(async () => (await fetchSmokeAppstoreAccountForApp(secondAppId))?.id || null).toBe(
            secondAvailable.id
        );
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await updateSmokeAppstoreAccount(secondAvailable.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await deleteSmokeAppstoreAccount(secondAvailable.id);
    }
});

test('Step 3 lists only available accounts plus the current one and switching rebinds the app', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded account').toBeTruthy();
    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    const secondAvailable = await createSmokeAppstoreAccount();
    const disabledAccount = await createSmokeAppstoreAccount({
        email: `disabled-${Date.now()}@example.test`,
        usability: false,
        was_used_before: false,
    });
    const usedBeforeAccount = await createSmokeAppstoreAccount({
        email: `used-before-${Date.now()}@example.test`,
        usability: false,
        was_used_before: true,
    });

    try {
        await gotoAccountsTargetWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const setupDataPanel = getSetupDataPanel(page);
        const accountSelect = getAccountSelect(page);
        await expect
            .poll(async () => (await getAccountOptionLabels(page)).some((label) => label.includes(seededAccount.email)))
            .toBe(true);
        await expect
            .poll(async () => (await getAccountOptionLabels(page)).some((label) => label.includes(secondAvailable.email)))
            .toBe(true);
        const initialOptionLabels = await getAccountOptionLabels(page);
        expect(initialOptionLabels).not.toContain('Auto');
        expect(initialOptionLabels.some((label) => label.includes(seededAccount.email))).toBe(true);
        expect(initialOptionLabels.some((label) => label.includes(secondAvailable.email))).toBe(true);
        expect(initialOptionLabels.some((label) => label.includes(disabledAccount.email))).toBe(false);
        expect(initialOptionLabels.some((label) => label.includes(usedBeforeAccount.email))).toBe(false);

        await selectOptionContainingText(accountSelect, seededAccount.email);
        await expect.poll(async () => (await fetchSmokeAppstoreAccountForApp(smokeEnv.seed.accountsTargetApp.id))?.id || null).toBe(
            seededAccount.id
        );

        const assignedOptionLabels = await getAccountOptionLabels(page);
        expect(assignedOptionLabels.some((label) => label.includes(seededAccount.email))).toBe(true);
        expect(assignedOptionLabels.some((label) => label.includes(secondAvailable.email))).toBe(true);
        expect(assignedOptionLabels.some((label) => label.includes(disabledAccount.email))).toBe(false);
        expect(assignedOptionLabels.some((label) => label.includes(usedBeforeAccount.email))).toBe(false);

        page.once('dialog', (dialog) => dialog.accept());
        await selectOptionContainingText(accountSelect, secondAvailable.email);
        await expect.poll(async () => (await fetchSmokeAppstoreAccountForApp(smokeEnv.seed.accountsTargetApp.id))?.id || null).toBe(
            secondAvailable.id
        );
        await expect(setupDataPanel.locator(`input[value="${secondAvailable.email}"]`).first()).toBeVisible();
    } finally {
        await updateSmokeAppstoreAccount(seededAccount.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await updateSmokeAppstoreAccount(secondAvailable.id, {
            app_id: null,
            usability: true,
            was_used_before: false,
        });
        await deleteSmokeAppstoreAccount(secondAvailable.id);
        await deleteSmokeAppstoreAccount(disabledAccount.id);
        await deleteSmokeAppstoreAccount(usedBeforeAccount.id);
    }
});
