import { expect, test } from './support/fixtures';
import { gotoWorkspace, openIdeas, openWorkspaceFromSidebar, selectOptionContainingText } from './support/helpers';

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('ideas table scope persists after leaving and returning to ideas', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    const tableScopeSelect = page.getByTestId('ideas-table-scope-select');
    await selectOptionContainingText(tableScopeSelect, 'No Brand');

    await expect
        .poll(async () => {
            return tableScopeSelect.evaluate((node) => {
                const select = node as HTMLSelectElement;
                return select.options[select.selectedIndex]?.textContent?.trim() || '';
            });
        })
        .toMatch(/no brand/i);

    await openWorkspaceFromSidebar(page);
    await openIdeas(page);

    await expect
        .poll(async () => {
            return tableScopeSelect.evaluate((node) => {
                const select = node as HTMLSelectElement;
                return select.options[select.selectedIndex]?.textContent?.trim() || '';
            });
        })
        .toMatch(/no brand/i);
});
