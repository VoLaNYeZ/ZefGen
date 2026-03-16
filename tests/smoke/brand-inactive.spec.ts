import { expect, test } from './support/fixtures';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace } from './support/helpers';

test('brand can move into and out of the inactive drawer', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Inactive QA ${suffix}`;

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const sidebar = page.getByTestId('brand-sidebar');
    await sidebar.getByRole('button', { name: /^New$/ }).click();
    await page.getByLabel('Brand name').fill(brandName);
    await sidebar.getByRole('button', { name: /create brand/i }).click();

    await expect(page.getByTestId('active-brand-row')).toContainText(brandName);

    await page.getByRole('button', { name: /^Edit brand$/ }).click();
    await page.getByLabel('Inactive brand').check();
    await sidebar.getByRole('button', { name: /update brand/i }).click();

    const inactiveToggle = page.getByTestId('inactive-brands-toggle');
    await expect(inactiveToggle).toBeVisible();
    await expect(inactiveToggle).toContainText(/1/);
    await inactiveToggle.click();
    await expect(page.getByTestId('inactive-brands-panel')).toContainText(brandName);
    await expect(page.getByTestId('active-brand-row')).toContainText(brandName);

    await page.getByRole('button', { name: /^Edit brand$/ }).click();
    await page.getByLabel('Inactive brand').uncheck();
    await sidebar.getByRole('button', { name: /update brand/i }).click();

    await expect(page.getByTestId('inactive-brands-toggle')).toBeVisible();
    await expect(page.getByTestId('inactive-brands-toggle')).toContainText(/0/);
    await expect(page.getByTestId('active-brand-row')).toContainText(brandName);
});
