import { expect, test } from './support/fixtures';
import { clearSmokeIdeasByTitles, fetchSmokeIdeaByTitle, updateSmokeIdea } from './support/backend';
import { gotoWorkspace, openIdeas } from './support/helpers';

test('ideas block navigation while dirty, persist save-all edits, and bump revision for row edits', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const createdTitle = `Smoke Idea ${suffix}`;
    const createdDescription = `Original smoke idea ${suffix} for persistence coverage.`;
    const updatedTitle = `${createdTitle} Edited`;
    const updatedDescription = `Edited smoke idea ${suffix} survives page switches and reloads.`;

    try {
        await gotoWorkspace(page);
        await openIdeas(page);

        const ideasRoot = page.getByTestId('ideas-page-root');
        await ideasRoot.getByRole('button', { name: /^new idea$/i }).click();

        const newRow = page.locator('#idea-row-new');
        await newRow.locator('input').fill(createdTitle);
        await newRow.locator('textarea').fill(createdDescription);
        await newRow.getByTitle(/^Save$/).click();

        const titleInput = page.locator(`input[value="${createdTitle}"]`).first();
        await expect(titleInput).toBeVisible();
        await titleInput.fill(updatedTitle);

        const editedRow = page
            .locator(`input[value="${updatedTitle}"]`)
            .first()
            .locator('xpath=ancestor::div[contains(@class,"grid")][1]');
        await editedRow.locator('textarea').nth(0).fill(updatedDescription);

        await page.getByTestId('brand-sidebar').getByRole('button', { name: /^Help$/ }).click();

        await expect(page).toHaveURL(/\/ideas$/);
        await expect(page.getByTestId('app-shell-action-error')).toContainText(/unsaved/i);

        const unsavedBanner = page.getByTestId('ideas-unsaved-banner');
        await expect(unsavedBanner).toBeVisible();
        await unsavedBanner.getByRole('button', { name: /^save all$/i }).click();
        await expect(unsavedBanner).toHaveCount(0);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('ideas-page-root')).toBeVisible();

        const savedTitleInput = page.locator(`input[value="${updatedTitle}"]`).first();
        await expect(savedTitleInput).toBeVisible();

        const savedRow = savedTitleInput.locator('xpath=ancestor::div[contains(@class,"grid")][1]');
        await expect(savedRow).toContainText(/rev\s+2/i);
        await expect(savedRow.locator('textarea').nth(0)).toHaveValue(updatedDescription);
    } finally {
        await clearSmokeIdeasByTitles([createdTitle, updatedTitle]);
    }
});

test('ideas reject stale saves after the row changes elsewhere', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const createdTitle = `Conflict Idea ${suffix}`;
    const createdDescription = `Original conflict idea ${suffix}.`;
    const updatedTitle = `${createdTitle} Local Edit`;

    try {
        await gotoWorkspace(page);
        await openIdeas(page);

        const ideasRoot = page.getByTestId('ideas-page-root');
        await ideasRoot.getByRole('button', { name: /^new idea$/i }).click();

        const newRow = page.locator('#idea-row-new');
        await newRow.locator('input').fill(createdTitle);
        await newRow.locator('textarea').fill(createdDescription);
        await newRow.getByTitle(/^Save$/).click();

        let createdIdea = await fetchSmokeIdeaByTitle(createdTitle);
        await expect
            .poll(
                async () => {
                    createdIdea = await fetchSmokeIdeaByTitle(createdTitle);
                    return createdIdea?.id ?? null;
                },
                {
                    timeout: 5000,
                    message: 'Expected the created idea to be readable from the smoke backend',
                }
            )
            .not.toBeNull();
        expect(createdIdea?.id).toBeTruthy();

        await page.locator(`input[value="${createdTitle}"]`).first().fill(updatedTitle);

        await updateSmokeIdea(String(createdIdea?.id || ''), {
            description: `Server-side edit ${suffix}.`,
            client_spec_current: `Server-side edit ${suffix}.`,
            spec_revision_index: Number(createdIdea?.spec_revision_index || 1) + 1,
        });

        const editedRow = page
            .locator(`input[value="${updatedTitle}"]`)
            .first()
            .locator('xpath=ancestor::div[contains(@class,"grid")][1]');
        await editedRow.getByTitle(/^Save$/).click();

        await expect(page.getByTestId('app-shell-action-error')).toContainText(/updated elsewhere/i);
        await expect(editedRow).toContainText(/updated elsewhere/i);
        await expect(page.locator(`input[value="${updatedTitle}"]`).first()).toBeVisible();
    } finally {
        await clearSmokeIdeasByTitles([createdTitle, updatedTitle]);
    }
});
