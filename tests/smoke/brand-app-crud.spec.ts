import { expect, test } from './support/fixtures';
import { deleteBrandCascade } from './support/backend';
import {
    claimWorkspaceEditLockIfPrompted,
    gotoWorkspace,
    openIdeas,
    selectOptionContainingText,
    slugifyForSmoke,
} from './support/helpers';

test('can create a new brand and app and keep the route after reload', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Smoke QA ${suffix}`;
    const brandSlug = slugifyForSmoke(brandName);
    const appAlias = `qa-${suffix}`;
    const routePattern = new RegExp(`/${brandSlug}/${appAlias}$`);
    let createdBrandId: string | null = null;

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const sidebar = page.getByTestId('brand-sidebar');
        await sidebar.getByRole('button', { name: /^New$/ }).click();
        await page.getByLabel('Brand name').fill(brandName);
        await sidebar.getByRole('button', { name: /create brand/i }).click();

        const activeBrandRow = page.getByTestId('active-brand-row');
        await expect(activeBrandRow).toContainText(brandName);
        createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
        expect(createdBrandId, 'Expected the new CRUD smoke brand to expose a brand id').toBeTruthy();
        await expect(page).toHaveURL(new RegExp(`/${brandSlug}$`));

        const createAppButton = page.getByRole('button', { name: /create app/i });
        if (!(await createAppButton.isVisible())) {
            await page.getByRole('button', { name: /add app/i }).click();
        }
        await expect(page.getByLabel('App name')).toHaveCount(0);
        await page.getByLabel('Alias').fill(appAlias);
        await page.getByRole('button', { name: /create app/i }).click();

        await expect(page).toHaveURL(routePattern);
        await expect(page.getByTestId('active-app-pill')).toContainText(appAlias.toUpperCase());

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(routePattern);
        await expect(page.getByTestId('active-brand-row')).toContainText(brandName);
        await expect(page.getByTestId('active-app-pill')).toContainText(appAlias.toUpperCase());
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
    }
});

test('idea selection names an unnamed app while keeping alias and route stable', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-6);
    const brandName = `Idea Sync ${suffix}`;
    const brandSlug = slugifyForSmoke(brandName);
    const appAlias = `idea-${suffix}`;
    const shortSuffix = suffix.slice(-4);
    const ideaTitleOne = `Spark${shortSuffix}`;
    const ideaTitleTwo = `Pulse${shortSuffix}`;
    const ideaDescriptionOne = `${ideaTitleOne} helps independent teams organize recurring admin work with calmer weekly planning and clearer ownership on iPhone.`;
    const ideaDescriptionTwo = `${ideaTitleTwo} turns raw support notes into short guided checklists, follow-ups, and shared review summaries for compact mobile teams.`;
    const routePattern = new RegExp(`/${brandSlug}/${appAlias}$`);
    let createdBrandId: string | null = null;

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const sidebar = page.getByTestId('brand-sidebar');
        await sidebar.getByRole('button', { name: /^New$/ }).click();
        await page.getByLabel('Brand name').fill(brandName);
        await sidebar.getByRole('button', { name: /create brand/i }).click();

        const activeBrandRow = page.getByTestId('active-brand-row');
        await expect(activeBrandRow).toContainText(brandName);
        createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
        expect(createdBrandId, 'Expected the idea-sync smoke brand to expose a brand id').toBeTruthy();

        await page.getByRole('button', { name: /add app/i }).click();
        await expect(page.getByLabel('App name')).toHaveCount(0);
        await page.getByLabel('Alias').fill(appAlias);
        await page.getByRole('button', { name: /create app/i }).click();

        await expect(page).toHaveURL(routePattern);
        await expect(page.getByTestId('active-app-pill')).toContainText(appAlias.toUpperCase());

        const devFilesPanel = page.getByTestId('workspace-panel-dev-files');
        await expect(devFilesPanel.getByText(/pick an idea or set app name first/i)).toBeVisible();
        await expect(devFilesPanel.getByRole('button', { name: /create github repo/i })).toBeDisabled();

        await openIdeas(page);

        const newIdeaRow = page.locator('#idea-row-new');
        const ideasRoot = page.getByTestId('ideas-page-root');

        await ideasRoot.getByRole('button', { name: /^new idea$/i }).click();
        await newIdeaRow.locator('select').selectOption({ label: 'Business' });
        await newIdeaRow.locator('input').fill(ideaTitleOne);
        await newIdeaRow.locator('textarea').fill(ideaDescriptionOne);
        await newIdeaRow.getByTitle(/^Save$/).click();

        await ideasRoot.getByRole('button', { name: /^new idea$/i }).click();
        await newIdeaRow.locator('select').selectOption({ label: 'Business' });
        await newIdeaRow.locator('input').fill(ideaTitleTwo);
        await newIdeaRow.locator('textarea').fill(ideaDescriptionTwo);
        await newIdeaRow.getByTitle(/^Save$/).click();

        await page.getByTestId('active-brand-row').click();
        await expect(page).toHaveURL(routePattern);
        await claimWorkspaceEditLockIfPrompted(page);

        const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
        const categorySelect = clientSpecPanel.locator('select').nth(0);
        const ideaSelect = clientSpecPanel.locator('select').nth(1);
        const activeAppPill = page.getByTestId('active-app-pill');
        const appSelection = page.getByTestId('workspace-app-selection');

        await categorySelect.selectOption({ label: 'Business' });
        await selectOptionContainingText(ideaSelect, ideaTitleOne);
        await expect.poll(async () => (await activeAppPill.textContent()) || '').toContain(ideaTitleOne);
        await expect(page).toHaveURL(routePattern);
        await expect(devFilesPanel.getByRole('button', { name: /create github repo/i })).toBeEnabled();

        await appSelection.getByRole('button', { name: /^Edit$/ }).click();
        await expect(page.getByLabel('App name')).toHaveValue(ideaTitleOne);
        await page.getByRole('button', { name: /^Cancel$/ }).click();

        await selectOptionContainingText(ideaSelect, ideaTitleTwo);
        await expect.poll(async () => (await activeAppPill.textContent()) || '').toContain(ideaTitleTwo);
        await expect(page).toHaveURL(routePattern);

        await appSelection.getByRole('button', { name: /^Edit$/ }).click();
        await expect(page.getByLabel('App name')).toHaveValue(ideaTitleTwo);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
    }
});
