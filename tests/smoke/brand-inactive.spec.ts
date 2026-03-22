import { expect, test } from './support/fixtures';
import { deleteBrandCascade } from './support/backend';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace } from './support/helpers';

const readInactiveCount = async (text: string | null) => Number((text || '').match(/(\d+)\s*$/)?.[1] || '0');

test('brand can move into and out of the inactive drawer', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Inactive QA ${suffix}`;
    let createdBrandId: string | null = null;

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const sidebar = page.getByTestId('brand-sidebar');
        const inactiveToggle = page.getByTestId('inactive-brands-toggle');
        const baselineInactiveCount = await readInactiveCount(await inactiveToggle.textContent());

        await sidebar.getByRole('button', { name: /^New$/ }).click();
        await page.getByLabel('Brand name').fill(brandName);
        await sidebar.getByRole('button', { name: /create brand/i }).click();

        const activeBrandRow = page.getByTestId('active-brand-row');
        await expect(activeBrandRow).toContainText(brandName);
        createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
        expect(createdBrandId, 'Expected the new inactive smoke brand to expose a brand id').toBeTruthy();

        await page.getByRole('button', { name: /^Edit brand$/ }).click();
        await page.getByTestId('brand-inactive-toggle').click();
        await sidebar.getByRole('button', { name: /update brand/i }).click();

        await expect(inactiveToggle).toBeVisible();
        await expect
            .poll(async () => readInactiveCount(await inactiveToggle.textContent()), {
                message: 'Expected the inactive brand drawer count to increase after archiving the new brand',
            })
            .toBe(baselineInactiveCount + 1);

        await inactiveToggle.click();
        const inactivePanel = page.getByTestId('inactive-brands-panel');
        const createdBrandRow = inactivePanel.locator(`[data-brand-id="${createdBrandId}"]`).locator('xpath=..');
        await expect(inactivePanel).toContainText(brandName);
        await expect(page.getByTestId('active-brand-row')).toContainText(brandName);

        await createdBrandRow.getByRole('button', { name: /^Activate$/ }).click();
        await expect
            .poll(async () => readInactiveCount(await inactiveToggle.textContent()), {
                message: 'Expected the inactive brand drawer count to return to baseline after reactivation',
            })
            .toBe(baselineInactiveCount);
        await expect(page.getByTestId('active-brand-row')).toContainText(brandName);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
    }
});
