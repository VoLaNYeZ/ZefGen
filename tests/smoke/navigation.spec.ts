import { expect, test } from './support/fixtures';
import {
    claimWorkspaceEditLockIfPrompted,
    escapeRegex,
    gotoPath,
    gotoWorkspace,
    openAccounts,
    openIdeas,
    openWorkspaceFromSidebar,
    seedLastWorkspaceSelection,
    smokeEnv,
} from './support/helpers';

test('sidebar navigation and browser history preserve page transitions', async ({ page }) => {
    await gotoWorkspace(page);
    await openAccounts(page);
    await openIdeas(page);
    await openWorkspaceFromSidebar(page);

    await page.goBack();
    await expect(page.getByTestId('ideas-page-root')).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId('accounts-page-root')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('ideas-page-root')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('workspace-page-root')).toBeVisible();
});

test('root startup restores the last active workspace the user left open', async ({ page }) => {
    await gotoWorkspace(page);

    await page.locator(`[data-app-id="${smokeEnv.seed.accountsTargetApp.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.accountsTargetWorkspace)}$`));

    await gotoPath(page, '/');
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.accountsTargetWorkspace)}$`));
    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.accountsTargetApp.alias.toUpperCase());
});

test('root startup skips an invalid remembered inactive workspace and falls back to the first active brand/app', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Startup Inactive ${suffix}`;

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const sidebar = page.getByTestId('brand-sidebar');
    await sidebar.getByRole('button', { name: /^New$/ }).click();
    await page.getByLabel('Brand name').fill(brandName);
    await sidebar.getByRole('button', { name: /create brand/i }).click();

    const activeBrandRow = page.getByTestId('active-brand-row');
    await expect(activeBrandRow).toContainText(brandName);
    const inactiveBrandId = await activeBrandRow.getAttribute('data-brand-id');
    expect(inactiveBrandId, 'Expected the new brand row to expose a brand id').toBeTruthy();

    await page.getByRole('button', { name: /^Edit brand$/ }).click();
    await page.getByTestId('brand-inactive-toggle').click();
    await sidebar.getByRole('button', { name: /update brand/i }).click();

    await seedLastWorkspaceSelection(page, {
        brandId: String(inactiveBrandId),
        appId: 'missing-app',
    });

    await gotoPath(page, '/');
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('active-brand-row')).toContainText(smokeEnv.seed.brand.name);
    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.primaryApp.alias.toUpperCase());
});

test('explicit workspace URLs still win over remembered startup state', async ({ page }) => {
    await gotoWorkspace(page);

    await seedLastWorkspaceSelection(page, {
        brandId: smokeEnv.seed.brand.id,
        appId: smokeEnv.seed.accountsTargetApp.id,
    });

    await gotoPath(page, smokeEnv.seed.routes.workspace);
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.primaryApp.alias.toUpperCase());
});
