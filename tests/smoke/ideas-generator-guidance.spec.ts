import { expect, test } from './support/fixtures';
import { gotoWorkspace, openIdeas, smokeEnv } from './support/helpers';

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('idea generator keeps guidance per brand across scope switches and reloads', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    const generatorScopeSelect = page.getByTestId('ideas-generator-scope-select');
    const guidanceField = page.getByTestId('ideas-generator-guidance');
    const smokeBrandGuidance = 'Keep the first batch focused on calm consumer utilities with low setup friction.';
    const noBrandGuidance = 'Bias the no-brand pool toward practical offline-friendly ideas with simple screenshots.';

    await generatorScopeSelect.selectOption({ label: 'Smoke Brand' });
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.brand.id);
    await guidanceField.fill(smokeBrandGuidance);

    await generatorScopeSelect.selectOption({ label: 'No Brand' });
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);
    await guidanceField.fill(noBrandGuidance);

    await generatorScopeSelect.selectOption({ label: 'Smoke Brand' });
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.brand.id);
    await expect(guidanceField).toHaveValue(smokeBrandGuidance);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ideas-page-root')).toBeVisible();

    const reloadedScopeSelect = page.getByTestId('ideas-generator-scope-select');
    const reloadedGuidanceField = page.getByTestId('ideas-generator-guidance');
    await expect(reloadedScopeSelect).toHaveValue(smokeEnv.seed.brand.id);
    await expect(reloadedGuidanceField).toHaveValue(smokeBrandGuidance);

    await reloadedScopeSelect.selectOption({ label: 'No Brand' });
    await expect(reloadedScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);
    await expect(reloadedGuidanceField).toHaveValue(noBrandGuidance);
});

test('idea generator guidance strings render in Russian locale', async ({ page }) => {
    await gotoWorkspace(page);
    await openIdeas(page);

    await page.getByRole('button', { name: 'RU' }).click();

    await expect(page.getByText('Дополнительные указания')).toBeVisible();

    const guidanceField = page.getByTestId('ideas-generator-guidance');
    await expect(guidanceField).toHaveAttribute(
        'placeholder',
        'Необязательно. Добавьте направление для этого запуска: аудитория, ограничения, тон или продуктовые условия.'
    );
    await expect(
        page.getByText(
            'Используется как мягкое направление для этого запуска, а выбранные категории остаются жёсткими ограничениями.'
        )
    ).toBeVisible();
});
