import { expect, test } from './support/fixtures';
import { deleteBrandCascade } from './support/backend';
import { gotoWorkspace, slugifyForSmoke } from './support/helpers';

test('can create a new brand and app and keep the route after reload', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Smoke QA ${suffix}`;
    const brandSlug = slugifyForSmoke(brandName);
    const appName = `QA${suffix}`;
    const appAlias = `qa-${suffix}`;
    const routePattern = new RegExp(`/${brandSlug}/${appAlias}$`);
    let createdBrandId: string | null = null;

    try {
        await gotoWorkspace(page);

        const sidebar = page.getByTestId('brand-sidebar');
        await sidebar.getByRole('button', { name: /^New$/ }).click();
        await page.getByLabel('Brand name').fill(brandName);
        await sidebar.getByRole('button', { name: /create brand/i }).click();

        const activeBrandRow = page.getByTestId('active-brand-row');
        await expect(activeBrandRow).toContainText(brandName);
        createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
        expect(createdBrandId, 'Expected the new CRUD smoke brand to expose a brand id').toBeTruthy();
        await expect(page).toHaveURL(new RegExp(`/${brandSlug}$`));

        const createAppButton = page.getByRole('button', { name: /create app/i });
        if (!(await createAppButton.isVisible())) {
            await page.getByRole('button', { name: /add app/i }).click();
        }
        await page.getByLabel('App name').fill(appName);
        await page.getByLabel('Alias').fill(appAlias);
        await page.getByRole('button', { name: /create app/i }).click();

        await expect(page).toHaveURL(routePattern);
        await expect(page.getByTestId('active-app-pill')).toContainText(appAlias.toUpperCase());

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(routePattern);
        await expect(page.getByTestId('active-brand-row')).toContainText(brandName);
        await expect(page.getByTestId('active-app-pill')).toContainText(appAlias.toUpperCase());
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
    }
});
