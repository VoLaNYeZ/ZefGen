import { expect, test } from './support/fixtures';
import { gotoPath, openHelp } from './support/helpers';

test('authenticated direct /help load renders the help center', async ({ page }) => {
    await gotoPath(page, '/help');
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByTestId('help-page-root')).toBeVisible();
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/^Help$/i);
    await expect(page.getByTestId('help-group-product-map')).toContainText(/Карта продукта/i);
    await expect(page.getByTestId('help-group-main-workflow')).toContainText(/Основной процесс/i);
    await expect(page.getByTestId('help-group-special-cases')).toContainText(/Особые сценарии/i);
    await expect(page.getByTestId('help-visual-overview')).toHaveAttribute('data-visual-placement', 'wide');
    await expect(page.getByTestId('help-visual-step-5-development')).toHaveAttribute('data-visual-medium', 'gif');
});

test('help center stays russian even when platform language changes', async ({ page }) => {
    await openHelp(page);
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/^Help$/i);
    await expect(page.getByTestId('help-section-overview')).toContainText(/One-shot платформа полного цикла/i);
    await expect(page.getByTestId('help-section-selected-app-setup')).toContainText(/webhook/i);
    await expect(page.getByTestId('help-section-step-7-auto-release')).toContainText(/Under development, пока вручную\./i);
    await expect(page.getByTestId('help-page-nav')).toContainText(/No Brand \/ Шаг 11/i);
    await expect(page.getByTestId('help-page-root')).not.toContainText(/Переходи сразу к нужной странице или шагу процесса/i);

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^EN$/ }).click();
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/^Help$/i);
    await expect(page.getByTestId('help-section-overview')).toContainText(/One-shot платформа полного цикла/i);
    await expect(page.getByTestId('help-page-nav')).toContainText(/No Brand \/ Шаг 11/i);

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^RU$/ }).click();
    await expect(page.getByTestId('help-page-root').getByRole('heading', { level: 1 })).toHaveText(/^Help$/i);
    await expect(page.getByTestId('help-section-overview')).toContainText(/One-shot платформа полного цикла/i);
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

test('help visuals open in a lightbox and close on escape', async ({ page }) => {
    await openHelp(page);

    await page.getByTestId('help-visual-overview').click();
    await expect(page.getByTestId('help-visual-lightbox')).toBeVisible();
    await expect(page.getByTestId('help-visual-lightbox-title')).toHaveText(/One-shot платформа полного цикла/i);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-visual-lightbox')).toHaveCount(0);
});

test('clicking the last desktop help nav item keeps that item active on the first try', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHelp(page);

    const nav = page.getByTestId('help-page-nav');
    const deliverablesButton = nav.getByRole('button', { name: /^Deliverables$/i });

    await deliverablesButton.click();

    await expect(page).toHaveURL(/\/help#deliverables-export$/);
    await expect(deliverablesButton).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('help-section-deliverables-export')).toBeVisible();
});
