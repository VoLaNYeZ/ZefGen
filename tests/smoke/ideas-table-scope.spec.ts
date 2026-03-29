import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { gotoWorkspace, openIdeas, smokeEnv } from './support/helpers';

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

const readIdeaGeneratorPrefs = async (page: Page) =>
    page.evaluate(() => {
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (!key || !key.startsWith('zefgen.ideaGenerator.v2.')) continue;
            const raw = window.localStorage.getItem(key);
            if (!raw) continue;
            try {
                const prefs = JSON.parse(raw) as { scope_brand_id?: string; table_scope_brand_id?: string };
                return {
                    scope_brand_id: prefs.scope_brand_id || '',
                    table_scope_brand_id: prefs.table_scope_brand_id || '',
                };
            } catch {
                return null;
            }
        }
        return null;
    });

test('generator scope updates table scope one-way and both persist independently', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    const generatorScopeSelect = page.getByTestId('ideas-generator-scope-select');
    const tableScopeSelect = page.getByTestId('ideas-table-scope-select');
    await generatorScopeSelect.selectOption(smokeEnv.seed.noBrand.id);
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);
    await expect(tableScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);

    await tableScopeSelect.selectOption(smokeEnv.seed.brand.id);
    await expect(tableScopeSelect).toHaveValue(smokeEnv.seed.brand.id);
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);

    await expect
        .poll(async () => readIdeaGeneratorPrefs(page))
        .toEqual({
            scope_brand_id: smokeEnv.seed.noBrand.id,
            table_scope_brand_id: smokeEnv.seed.brand.id,
        });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ideas-page-root')).toBeVisible();

    await expect(page.getByTestId('ideas-generator-scope-select')).toHaveValue(smokeEnv.seed.noBrand.id);
    await expect(page.getByTestId('ideas-table-scope-select')).toHaveValue(smokeEnv.seed.brand.id);
});
