import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
    deleteBrandCascade,
    listSmokeAppstoreAccounts,
    updateSmokeAppstoreAccount,
} from './support/backend';
import {
    claimWorkspaceEditLockIfPrompted,
    gotoWorkspace,
    slugifyForSmoke,
} from './support/helpers';

const LONG_CLIENT_SPEC =
    'Smoke test client spec for App Store description regeneration. ' +
    'It is intentionally long enough to clear the minimum description generation threshold, ' +
    'while staying stable and deterministic for the Playwright regression.';

const MANUAL_DESCRIPTION =
    'Manual App Store description text that should remain untouched when legal links are generated.';
const MANUAL_SUBTITLE = 'Custom steady routine';

const GENERATED_DESCRIPTION =
    'Generated App Store description from the smoke stub. This should only appear after clicking Regenerate.';
const GENERATED_DESCRIPTION_V2 =
    'Second generated App Store description from the smoke stub. Existing subtitle and keywords should stay untouched.';
const GENERATED_SUBTITLE_OPTIONS_A = [
    'Build calmer routines',
    'Track habits clearly',
    'Stay steady every day',
    'Plan with less stress',
    'Keep progress visible',
];
const GENERATED_SUBTITLE_OPTIONS_B = [
    'Move with more clarity',
    'Find calmer momentum',
    'Keep your day aligned',
    'See progress faster',
    'Stay organized daily',
];
const GENERATED_KEYWORDS_A =
    'focus,clarity,habits,routine,calm,coach,energy,journal,planner,wellness,mindset,reset,tracker,rhythm';
const GENERATED_KEYWORDS_B =
    'focus,clarity,habits,routine,calm,coach,energy,journal,planner,wellness,mindset,reset,balance,rhythm';

if (GENERATED_KEYWORDS_A.length !== 100 || GENERATED_KEYWORDS_B.length !== 100) {
    throw new Error('Smoke keyword fixtures must stay at exactly 100 characters.');
}

const getSetupDataPanel = (page: Page) => page.getByTestId('workspace-panel-variables-secrets');

const getAccountSelect = (page: Page) => getSetupDataPanel(page).locator('select[aria-label="Account"]');

const getRegenerateDescriptionButton = (page: Page) =>
    getSetupDataPanel(page).getByTestId('connector-appstore-description-regenerate');

const createBrandAndAppInCurrentWorkspace = async (page: Page, suffix: string) => {
    const brandName = `Setup Description ${suffix}`;
    const brandSlug = slugifyForSmoke(brandName);
    const appAlias = `desc-${suffix}`;
    let createdBrandId: string | null = null;

    const sidebar = page.getByTestId('brand-sidebar');
    await sidebar.getByRole('button', { name: /^New$/ }).click();
    await page.getByLabel('Brand name').fill(brandName);
    await sidebar.getByRole('button', { name: /create brand/i }).click();

    const activeBrandRow = page.getByTestId('active-brand-row');
    await expect(activeBrandRow).toContainText(brandName);
    createdBrandId = await activeBrandRow.getAttribute('data-brand-id');
    expect(createdBrandId, 'Expected the new description test brand to expose a brand id').toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`/${brandSlug}$`));

    const createAppButton = page.getByRole('button', { name: /create app/i });
    if (!(await createAppButton.isVisible())) {
        await page.getByRole('button', { name: /add app/i }).click();
    }

    await page.getByLabel('Alias').fill(appAlias);
    await page.getByRole('button', { name: /create app/i }).click();

    await expect(page).toHaveURL(new RegExp(`/${brandSlug}/${appAlias}$`));
    const activeAppPill = page.getByTestId('active-app-pill');
    await expect(activeAppPill).toContainText(appAlias.toUpperCase());

    const createdAppId = await activeAppPill.getAttribute('data-app-id');
    expect(createdAppId, 'Expected the new description test app to expose an app id').toBeTruthy();

    return {
        createdBrandId,
        createdAppId: String(createdAppId),
    };
};

const createBrandAndApp = async (page: Page, suffix: string) => {
    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);
    return createBrandAndAppInCurrentWorkspace(page, suffix);
};

test('Generate Links does not regenerate App Store description', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded App Store account').toBeTruthy();

    const restoreAccountPatch = {
        app_id: seededAccount.app_id,
        usability: seededAccount.usability,
        was_used_before: seededAccount.was_used_before,
    };

    let createdBrandId: string | null = null;
    let descriptionApiCallCount = 0;
    let legalLinksCallCount = 0;

    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    await page.route('**/api/generate-appstore-description', async (route) => {
        descriptionApiCallCount += 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'generated',
                text: GENERATED_DESCRIPTION,
                subtitleOptions: GENERATED_SUBTITLE_OPTIONS_A,
                keywords: GENERATED_KEYWORDS_A,
                promptKey: 'smoke-description',
                model: 'smoke-model',
            }),
        });
    });

    await page.route('**/functions/v1/generate-legal-links*', async (route) => {
        const method = route.request().method();
        if (method === 'OPTIONS') {
            await route.fulfill({
                status: 204,
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
                    'access-control-allow-methods': 'POST, OPTIONS',
                },
            });
            return;
        }

        legalLinksCallCount += 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
                'access-control-allow-methods': 'POST, OPTIONS',
            },
            body: JSON.stringify({
                status: 'generated',
                urls: {
                    privacy_policy_url: 'https://example.test/privacy',
                    terms_of_use_url: 'https://example.test/terms',
                    support_form_url: 'https://example.test/support',
                },
                fingerprint: 'smoke-links-fingerprint',
                runId: 'smoke-links-run',
            }),
        });
    });

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        const setupDataPanel = getSetupDataPanel(page);
        await expect.poll(async () => getAccountSelect(page).inputValue()).not.toBe('unassigned');

        const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
        await clientSpecPanel.locator('textarea').fill(LONG_CLIENT_SPEC);

        await setupDataPanel.getByTestId('connector-variable-input-appstore_name').fill('Smoke Link App');

        const descriptionTextarea = setupDataPanel.getByTestId('connector-variable-textarea-appstore_description');
        await descriptionTextarea.fill(MANUAL_DESCRIPTION);
        await expect(descriptionTextarea).toHaveValue(MANUAL_DESCRIPTION);

        await setupDataPanel.getByRole('button', { name: /generate links|regenerate links/i }).click();
        await expect(setupDataPanel.getByText('Links generated.')).toBeVisible();

        expect(legalLinksCallCount, 'Expected Generate Links to hit the legal-links backend once').toBe(1);
        expect(descriptionApiCallCount, 'Generate Links should not call the App Store description API').toBe(0);
        await expect(descriptionTextarea).toHaveValue(MANUAL_DESCRIPTION);

        await getRegenerateDescriptionButton(page).click();
        await expect(setupDataPanel.getByText('App Store description generated and saved.')).toBeVisible();

        expect(descriptionApiCallCount, 'Regenerate should call the App Store description API exactly once').toBe(1);
        await expect(descriptionTextarea).toHaveValue(GENERATED_DESCRIPTION);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, restoreAccountPatch);
    }
});

test('first description generation creates subtitle options and keywords, and later regenerate preserves them', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded App Store account').toBeTruthy();

    const restoreAccountPatch = {
        app_id: seededAccount.app_id,
        usability: seededAccount.usability,
        was_used_before: seededAccount.was_used_before,
    };

    let createdBrandId: string | null = null;
    let descriptionApiCallCount = 0;

    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    await page.route('**/api/generate-appstore-description', async (route) => {
        descriptionApiCallCount += 1;
        const isFirstCall = descriptionApiCallCount === 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'generated',
                text: isFirstCall ? GENERATED_DESCRIPTION : GENERATED_DESCRIPTION_V2,
                subtitleOptions: isFirstCall ? GENERATED_SUBTITLE_OPTIONS_A : GENERATED_SUBTITLE_OPTIONS_B,
                keywords: isFirstCall ? GENERATED_KEYWORDS_A : GENERATED_KEYWORDS_B,
                promptKey: isFirstCall ? 'smoke-description-a' : 'smoke-description-b',
                model: 'smoke-model',
            }),
        });
    });

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        const setupDataPanel = getSetupDataPanel(page);
        await expect.poll(async () => getAccountSelect(page).inputValue()).not.toBe('unassigned');

        const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
        await clientSpecPanel.locator('textarea').fill(LONG_CLIENT_SPEC);
        await setupDataPanel.getByTestId('connector-variable-input-appstore_name').fill('Smoke Metadata App');

        const descriptionTextarea = setupDataPanel.getByTestId('connector-variable-textarea-appstore_description');
        const subtitleInput = setupDataPanel.getByTestId('connector-variable-input-appstore_initial_subtitle');
        const keywordsTextarea = setupDataPanel.getByTestId('connector-variable-textarea-appstore_initial_keywords');

        await getRegenerateDescriptionButton(page).click();
        await expect(setupDataPanel.getByText('App Store description generated and saved.')).toBeVisible();

        expect(descriptionApiCallCount, 'First regenerate should call the description API once').toBe(1);
        await expect(descriptionTextarea).toHaveValue(GENERATED_DESCRIPTION);
        await expect(keywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);
        await expect(setupDataPanel.getByText('100/100')).toBeVisible();
        await expect(setupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveText(
            GENERATED_SUBTITLE_OPTIONS_A[0]
        );
        await expect(setupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-5')).toHaveText(
            GENERATED_SUBTITLE_OPTIONS_A[4]
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('workspace-page-root')).toBeVisible();
        await expect(page.getByTestId('workspace-panel-variables-secrets')).toBeVisible();

        const reloadedSetupDataPanel = getSetupDataPanel(page);
        const reloadedSubtitleInput = reloadedSetupDataPanel.getByTestId('connector-variable-input-appstore_initial_subtitle');
        const reloadedKeywordsTextarea = reloadedSetupDataPanel.getByTestId(
            'connector-variable-textarea-appstore_initial_keywords'
        );
        await expect(reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveText(
            GENERATED_SUBTITLE_OPTIONS_A[0]
        );
        await expect(reloadedKeywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);

        await reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-2').click();
        await expect(reloadedSubtitleInput).toHaveValue(GENERATED_SUBTITLE_OPTIONS_A[1]);
        await expect(reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveCount(0);
        await page.waitForTimeout(1200);

        const descriptionApiCallCountBeforeSecondRegenerate = descriptionApiCallCount;
        await getRegenerateDescriptionButton(page).click();
        await expect(reloadedSetupDataPanel.getByText('App Store description generated and saved.')).toBeVisible();

        expect(descriptionApiCallCount, 'Second regenerate should call the description API exactly once more').toBe(
            descriptionApiCallCountBeforeSecondRegenerate + 1
        );
        await expect(reloadedSetupDataPanel.getByTestId('connector-variable-textarea-appstore_description')).toHaveValue(
            GENERATED_DESCRIPTION_V2
        );
        await expect(reloadedSubtitleInput).toHaveValue(GENERATED_SUBTITLE_OPTIONS_A[1]);
        await expect(reloadedKeywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);
        await expect(reloadedSetupDataPanel.getByText('100/100')).toBeVisible();
        await expect(reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveCount(0);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, restoreAccountPatch);
    }
});

test('manual subtitle entry clears pending options and later regenerate skips metadata generation', async ({ page }) => {
    const seededAccount = (await listSmokeAppstoreAccounts())[0];
    expect(seededAccount, 'Expected the smoke user to have a seeded App Store account').toBeTruthy();

    const restoreAccountPatch = {
        app_id: seededAccount.app_id,
        usability: seededAccount.usability,
        was_used_before: seededAccount.was_used_before,
    };

    let createdBrandId: string | null = null;
    let descriptionApiCallCount = 0;
    const requestBodies: Array<Record<string, unknown>> = [];

    await updateSmokeAppstoreAccount(seededAccount.id, {
        app_id: null,
        usability: true,
        was_used_before: false,
    });

    await page.route('**/api/generate-appstore-description', async (route) => {
        descriptionApiCallCount += 1;
        requestBodies.push((route.request().postDataJSON() as Record<string, unknown>) || {});
        const isFirstCall = descriptionApiCallCount === 1;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'generated',
                text: isFirstCall ? GENERATED_DESCRIPTION : GENERATED_DESCRIPTION_V2,
                subtitleOptions: isFirstCall ? GENERATED_SUBTITLE_OPTIONS_A : [],
                keywords: isFirstCall ? GENERATED_KEYWORDS_A : '',
                promptKey: isFirstCall ? 'smoke-description-a' : 'smoke-description-b',
                model: 'smoke-model',
            }),
        });
    });

    try {
        const created = await createBrandAndApp(page, `${Date.now()}`.slice(-6));
        createdBrandId = created.createdBrandId;

        const setupDataPanel = getSetupDataPanel(page);
        await expect.poll(async () => getAccountSelect(page).inputValue()).not.toBe('unassigned');

        const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
        await clientSpecPanel.locator('textarea').fill(LONG_CLIENT_SPEC);
        await setupDataPanel.getByTestId('connector-variable-input-appstore_name').fill('Smoke Manual Subtitle App');

        const descriptionTextarea = setupDataPanel.getByTestId('connector-variable-textarea-appstore_description');
        const subtitleInput = setupDataPanel.getByTestId('connector-variable-input-appstore_initial_subtitle');
        const keywordsTextarea = setupDataPanel.getByTestId('connector-variable-textarea-appstore_initial_keywords');

        await getRegenerateDescriptionButton(page).click();
        await expect(setupDataPanel.getByText('App Store description generated and saved.')).toBeVisible();

        expect(descriptionApiCallCount, 'First regenerate should call the description API once').toBe(1);
        expect(requestBodies[0]?.generateSubtitleOptions, 'First regenerate should request subtitle options').toBe(true);
        expect(requestBodies[0]?.generateKeywords, 'First regenerate should request keywords').toBe(true);
        await expect(descriptionTextarea).toHaveValue(GENERATED_DESCRIPTION);
        await expect(keywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);
        await expect(setupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveText(
            GENERATED_SUBTITLE_OPTIONS_A[0]
        );

        await subtitleInput.fill(MANUAL_SUBTITLE);
        await expect(subtitleInput).toHaveValue(MANUAL_SUBTITLE);
        await expect(setupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')).toHaveCount(0);
        await expect(setupDataPanel.getByText(/^Unsaved changes$/)).toBeVisible();
        await expect(setupDataPanel.getByText(/^Saved$/)).toBeVisible();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('workspace-page-root')).toBeVisible();

        const reloadedSetupDataPanel = getSetupDataPanel(page);
        const reloadedSubtitleInput = reloadedSetupDataPanel.getByTestId(
            'connector-variable-input-appstore_initial_subtitle'
        );
        const reloadedKeywordsTextarea = reloadedSetupDataPanel.getByTestId(
            'connector-variable-textarea-appstore_initial_keywords'
        );
        const reloadedDescriptionTextarea = reloadedSetupDataPanel.getByTestId(
            'connector-variable-textarea-appstore_description'
        );

        await expect(reloadedSubtitleInput).toHaveValue(MANUAL_SUBTITLE);
        await expect(reloadedKeywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);
        await expect(
            reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')
        ).toHaveCount(0);

        await getRegenerateDescriptionButton(page).click();
        await expect(reloadedSetupDataPanel.getByText('App Store description generated and saved.')).toBeVisible();

        expect(descriptionApiCallCount, 'Second regenerate should call the description API again').toBe(2);
        expect(
            requestBodies[1]?.generateSubtitleOptions,
            'Second regenerate should not request subtitle options once manual subtitle exists'
        ).toBe(false);
        expect(
            requestBodies[1]?.generateKeywords,
            'Second regenerate should not request keywords once they already exist'
        ).toBe(false);
        await expect(reloadedDescriptionTextarea).toHaveValue(GENERATED_DESCRIPTION_V2);
        await expect(reloadedSubtitleInput).toHaveValue(MANUAL_SUBTITLE);
        await expect(reloadedKeywordsTextarea).toHaveValue(GENERATED_KEYWORDS_A);
        await expect(
            reloadedSetupDataPanel.getByTestId('connector-appstore-initial-subtitle-option-1')
        ).toHaveCount(0);
    } finally {
        if (createdBrandId) {
            await deleteBrandCascade(createdBrandId);
        }
        await updateSmokeAppstoreAccount(seededAccount.id, restoreAccountPatch);
    }
});
