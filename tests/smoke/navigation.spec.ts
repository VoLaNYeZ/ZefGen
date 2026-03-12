import { expect, test } from './support/fixtures';
import { gotoWorkspace, openAccounts, openIdeas, openWorkspaceFromSidebar } from './support/helpers';

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
