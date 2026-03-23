import { expect, test } from './support/fixtures';
import { gotoPath, openHelp } from './support/helpers';

test('authenticated direct /help load renders the help center', async ({ page }) => {
    await gotoPath(page, '/help');
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByTestId('help-page-root')).toBeVisible();
    await expect(page.getByTestId('help-page-root')).toContainText(/Help Center/i);
});

test('help center content switches between english and russian', async ({ page }) => {
    await openHelp(page);
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/Help Center/i);
    await expect(page.getByTestId('help-section-overview')).toContainText(/Platform map/i);
    await expect(page.getByTestId('help-section-selected-app-setup')).toContainText(/webhook/i);
    await expect(page.getByTestId('help-page-nav')).toContainText(/No Brand \/ Step 11/i);
    await expect(page.getByTestId('help-page-root')).not.toContainText(/Jump straight to the page or workflow step you need/i);

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^RU$/ }).click();
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/Центр помощи/i);
    await expect(page.getByTestId('help-section-overview')).toContainText(/Карта платформы/i);
    await expect(page.getByTestId('help-section-selected-app-setup')).toContainText(/webhook/i);
    await expect(page.getByTestId('help-page-nav')).toContainText(/No Brand \/ Step 11/i);
    await expect(page.getByTestId('help-page-root')).not.toContainText(/Переходи сразу к нужной странице или шагу процесса/i);

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^EN$/ }).click();
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/Help Center/i);
});

test('desktop help guide rail is configured for internal scrolling on shorter viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 560 });
    await openHelp(page);

    const nav = page.getByTestId('help-page-nav');
    await expect(nav).toBeVisible();

    const navState = await nav.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
            maxHeight: styles.maxHeight,
            overflowY: styles.overflowY,
        };
    });

    expect(navState.overflowY).toBe('auto');
    expect(navState.maxHeight).not.toBe('none');
});
