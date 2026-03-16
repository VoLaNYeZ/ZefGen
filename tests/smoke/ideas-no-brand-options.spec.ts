import { expect, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import { gotoWorkspace, openIdeas } from './support/helpers';

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

const countMatchingOptions = async (testId: string, page: Page, pattern: RegExp) => {
    return page.getByTestId(testId).evaluate((node, source) => {
        const select = node as HTMLSelectElement;
        const regex = new RegExp(source, 'i');
        return Array.from(select.options).filter((option) => regex.test((option.textContent || '').trim())).length;
    }, pattern.source);
};

test('ideas scope pickers expose a single No Brand option', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    await expect
        .poll(() => countMatchingOptions('ideas-generator-scope-select', page, /^no brand$/i))
        .toBe(1);
    await expect
        .poll(() => countMatchingOptions('ideas-table-scope-select', page, /^no brand$/i))
        .toBe(1);
});
