import { expect, test } from './support/fixtures';
import {
    gotoWorkspace,
    openIdeas,
    selectOptionContainingText,
} from './support/helpers';

test('ideas show up in client spec picker and App Store links validate and persist', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const ideaTitle = `Zeta Smoke ${suffix}`;
    const legacyIdeaDescription =
        `Zeta Smoke ${suffix} helps operators turn noisy receipts into one weekly audit trail.\\n` +
        'Keep the output calm, reviewable, and clearly structured for small iPhone teams.';
    const normalizedIdeaDescription =
        `Zeta Smoke ${suffix} helps operators turn noisy receipts into one weekly audit trail.\n` +
        'Keep the output calm, reviewable, and clearly structured for small iPhone teams.';
    const validAppStoreUrl = 'https://apps.apple.com/us/app/id1234567899';

    await gotoWorkspace(page);
    await openIdeas(page);

    const newIdeaRow = page.locator('#idea-row-new');
    await page.getByTestId('ideas-page-root').getByRole('button', { name: /^new idea$/i }).click();
    await newIdeaRow.locator('select').selectOption({ label: 'Business' });
    await newIdeaRow.locator('input').fill(ideaTitle);
    await newIdeaRow.locator('textarea').fill(legacyIdeaDescription);
    await newIdeaRow.getByTitle(/^Save$/).click();

    await gotoWorkspace(page);

    const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
    const categorySelect = clientSpecPanel.locator('select').nth(0);
    const ideaSelect = clientSpecPanel.locator('select').nth(1);
    const projectBrief = clientSpecPanel.locator('textarea');

    await categorySelect.selectOption({ label: 'Business' });
    await selectOptionContainingText(ideaSelect, ideaTitle);
    await expect(projectBrief).toHaveValue(normalizedIdeaDescription);

    const openButton = page.getByTestId('client-spec-reader-open-button');
    await expect(openButton).toBeEnabled();
    const [popup] = await Promise.all([page.waitForEvent('popup'), openButton.click()]);
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup.locator('body')).toContainText('turn noisy receipts into one weekly audit trail.');
    await expect(popup.locator('body')).toContainText('Keep the output calm, reviewable, and clearly structured');
    await popup.close();

    const appStorePanel = page.getByTestId('workspace-panel-appstore-link');
    await appStorePanel.getByRole('button', { name: /^Edit$/ }).click();
    const appStoreInput = appStorePanel.getByLabel(/app store/i);
    await appStoreInput.fill('totally-not-a-store-url');
    await appStorePanel.getByRole('button', { name: /set/i }).click();
    await expect(appStorePanel).toContainText(/valid app store url|app id/i);

    await appStoreInput.fill(validAppStoreUrl);
    await appStorePanel.getByRole('button', { name: /set/i }).click();
    await expect(appStorePanel.getByRole('link', { name: validAppStoreUrl })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('workspace-panel-appstore-link').getByRole('link', { name: validAppStoreUrl })).toBeVisible();
});
