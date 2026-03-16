import { expect, test } from './support/fixtures';
import { gotoWorkspace, openIdeas, selectOptionContainingText } from './support/helpers';

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('ideas generator defaults to the base suggestion trio', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    const generatorScopeSelect = page.getByTestId('ideas-generator-scope-select');
    await selectOptionContainingText(generatorScopeSelect, 'No Brand');
    await page.getByTestId('ideas-generator-reset-categories').click();

    const lifestyle = page.getByTestId('ideas-generator-category-lifestyle');
    const productivity = page.getByTestId('ideas-generator-category-productivity');
    const utilities = page.getByTestId('ideas-generator-category-utilities');

    await expect(lifestyle).toHaveAttribute('data-suggested', 'true');
    await expect(productivity).toHaveAttribute('data-suggested', 'true');
    await expect(utilities).toHaveAttribute('data-suggested', 'true');

    await expect(lifestyle).toHaveAttribute('data-selected', 'true');
    await expect(productivity).toHaveAttribute('data-selected', 'true');
    await expect(utilities).toHaveAttribute('data-selected', 'true');
});
