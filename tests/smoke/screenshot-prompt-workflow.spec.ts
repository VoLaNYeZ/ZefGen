import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
    claimWorkspaceEditLockIfPrompted,
    gotoNoBrandCollapsedWorkspace,
    gotoWorkspace,
    smokeEnv,
} from './support/helpers';

const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnSUs8AAAAASUVORK5CYII=';
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_B64, 'base64');
const LONG_CLIENT_SPEC =
    'A finance planning app for small teams that turns scattered receipts, handwritten notes, and banking screenshots into one calm workspace with shared budgets, reimbursement tracking, weekly summaries, and fast mobile review flows.';
const admin = createClient(smokeEnv.supabase.url, smokeEnv.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});
let screenshotSetSlotMappingsSupportPromise: Promise<boolean> | null = null;

const supportsScreenshotSetSlotMappings = async () => {
    if (!screenshotSetSlotMappingsSupportPromise) {
        screenshotSetSlotMappingsSupportPromise = admin
            .from('app_screenshot_sets')
            .select('slot_mappings')
            .limit(1)
            .then(({ error }) => !error);
    }
    return screenshotSetSlotMappingsSupportPromise;
};

const DEFAULT_AUTOGEN_TITLES = [
    'Track every expense clearly',
    'Stay on top of budgets',
    'See patterns faster',
];

const requireData = <T,>(label: string, value: T | null | undefined): T => {
    if (!value) {
        throw new Error(`Missing required smoke value: ${label}`);
    }
    return value;
};

const assertNoError = (error: { message?: string } | null, label: string) => {
    if (error) {
        throw new Error(`${label}: ${error.message || String(error)}`);
    }
};

type ScreenshotWorkflowStateSnapshot = {
    appId: string;
    brandId: string;
    projectBrief: string;
    screenshotSets: any[];
    iconPicks: any[];
    iconAssets: any[];
    screenshotPicks: any[];
    generatedAssets: any[];
    appScreenshots: any[];
    screenshotPrompts: any[];
    brandReferences: any[];
    exportStatus: any | null;
};

const captureScreenshotWorkflowState = async (appId: string): Promise<ScreenshotWorkflowStateSnapshot> => {
    const { data: appRow, error: appError } = await admin
        .from('apps')
        .select('id, brand_id')
        .eq('id', appId)
        .single();
    assertNoError(appError, 'Could not load screenshot workflow state app row');

    const brandId = requireData('screenshot workflow brand id', appRow?.brand_id);

    const [
        screenshotSetsResult,
        screenshotPicksResult,
        iconPicksResult,
        generatedAssetsResult,
        iconAssetsResult,
        appScreenshotsResult,
        screenshotPromptsResult,
        brandReferencesResult,
        connectorConfigResult,
        exportStatusResult,
    ] = await Promise.all([
        admin.from('app_screenshot_sets').select('*').eq('app_id', appId).order('order_index', { ascending: true }),
        admin.from('app_asset_picks').select('*').eq('app_id', appId).eq('kind', 'screenshot'),
        admin.from('app_asset_picks').select('*').eq('app_id', appId).eq('kind', 'icon'),
        admin
            .from('app_generated_assets')
            .select('*')
            .eq('app_id', appId)
            .in('kind', ['screenshot', 'screenshot_enhanced']),
        admin
            .from('app_generated_assets')
            .select('*')
            .eq('app_id', appId)
            .in('kind', ['icon', 'icon_enhanced']),
        admin.from('app_screenshots').select('*').eq('app_id', appId),
        admin.from('app_screenshot_prompts').select('*').eq('app_id', appId),
        admin.from('brand_references').select('*').eq('brand_id', brandId).eq('kind', 'screenshot'),
        admin.from('connector_app_configs').select('project_brief').eq('app_id', appId).maybeSingle(),
        admin.from('app_export_status').select('*').eq('app_id', appId).maybeSingle(),
    ]);

    assertNoError(screenshotSetsResult.error, 'Could not snapshot screenshot sets');
    assertNoError(screenshotPicksResult.error, 'Could not snapshot screenshot picks');
    assertNoError(iconPicksResult.error, 'Could not snapshot icon picks');
    assertNoError(generatedAssetsResult.error, 'Could not snapshot generated screenshot assets');
    assertNoError(iconAssetsResult.error, 'Could not snapshot generated icon assets');
    assertNoError(appScreenshotsResult.error, 'Could not snapshot app screenshots');
    assertNoError(screenshotPromptsResult.error, 'Could not snapshot screenshot prompts');
    assertNoError(brandReferencesResult.error, 'Could not snapshot screenshot brand references');
    assertNoError(connectorConfigResult.error, 'Could not snapshot connector config');
    assertNoError(exportStatusResult.error, 'Could not snapshot export status');

    return {
        appId,
        brandId,
        projectBrief: String(connectorConfigResult.data?.project_brief || ''),
        screenshotSets: screenshotSetsResult.data || [],
        iconPicks: iconPicksResult.data || [],
        iconAssets: iconAssetsResult.data || [],
        screenshotPicks: screenshotPicksResult.data || [],
        generatedAssets: generatedAssetsResult.data || [],
        appScreenshots: appScreenshotsResult.data || [],
        screenshotPrompts: screenshotPromptsResult.data || [],
        brandReferences: brandReferencesResult.data || [],
        exportStatus: exportStatusResult.data || null,
    };
};

const restoreScreenshotWorkflowState = async (snapshot: ScreenshotWorkflowStateSnapshot) => {
    const { appId, brandId } = snapshot;

    const { error: deletePicksError } = await admin
        .from('app_asset_picks')
        .delete()
        .eq('app_id', appId)
        .eq('kind', 'screenshot');
    assertNoError(deletePicksError, 'Could not clear screenshot picks before restore');

    const { error: deleteIconPicksError } = await admin
        .from('app_asset_picks')
        .delete()
        .eq('app_id', appId)
        .eq('kind', 'icon');
    assertNoError(deleteIconPicksError, 'Could not clear icon picks before restore');

    const { error: deleteGeneratedError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['screenshot', 'screenshot_enhanced']);
    assertNoError(deleteGeneratedError, 'Could not clear generated screenshot assets before restore');

    const { error: deleteIconAssetsError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['icon', 'icon_enhanced']);
    assertNoError(deleteIconAssetsError, 'Could not clear generated icon assets before restore');

    const { error: deleteScreenshotsError } = await admin.from('app_screenshots').delete().eq('app_id', appId);
    assertNoError(deleteScreenshotsError, 'Could not clear app screenshots before restore');

    const { error: deleteScreenshotSetsError } = await admin.from('app_screenshot_sets').delete().eq('app_id', appId);
    assertNoError(deleteScreenshotSetsError, 'Could not clear screenshot sets before restore');

    const { error: deletePromptsError } = await admin.from('app_screenshot_prompts').delete().eq('app_id', appId);
    assertNoError(deletePromptsError, 'Could not clear screenshot prompts before restore');

    const { error: deleteRefsError } = await admin
        .from('brand_references')
        .delete()
        .eq('brand_id', brandId)
        .eq('kind', 'screenshot');
    assertNoError(deleteRefsError, 'Could not clear screenshot brand references before restore');

    const { error: restoreConfigError } = await admin
        .from('connector_app_configs')
        .update({ project_brief: snapshot.projectBrief })
        .eq('app_id', appId);
    assertNoError(restoreConfigError, 'Could not restore connector config');

    const { error: deleteExportStatusError } = await admin.from('app_export_status').delete().eq('app_id', appId);
    assertNoError(deleteExportStatusError, 'Could not clear export status before restore');

    if (snapshot.brandReferences.length) {
        const { error } = await admin.from('brand_references').insert(snapshot.brandReferences);
        assertNoError(error, 'Could not restore screenshot brand references');
    }

    if (snapshot.appScreenshots.length) {
        const { error } = await admin.from('app_screenshots').insert(snapshot.appScreenshots);
        assertNoError(error, 'Could not restore app screenshots');
    }

    if (snapshot.screenshotSets.length) {
        const { error } = await admin.from('app_screenshot_sets').insert(snapshot.screenshotSets);
        assertNoError(error, 'Could not restore screenshot sets');
    }

    if (snapshot.generatedAssets.length) {
        const { error } = await admin.from('app_generated_assets').insert(snapshot.generatedAssets);
        assertNoError(error, 'Could not restore generated screenshot assets');
    }

    if (snapshot.iconAssets.length) {
        const { error } = await admin.from('app_generated_assets').insert(snapshot.iconAssets);
        assertNoError(error, 'Could not restore generated icon assets');
    }

    if (snapshot.screenshotPicks.length) {
        const { error } = await admin.from('app_asset_picks').insert(snapshot.screenshotPicks);
        assertNoError(error, 'Could not restore screenshot picks');
    }

    if (snapshot.iconPicks.length) {
        const { error } = await admin.from('app_asset_picks').insert(snapshot.iconPicks);
        assertNoError(error, 'Could not restore icon picks');
    }

    if (snapshot.screenshotPrompts.length) {
        const { error } = await admin.from('app_screenshot_prompts').insert(snapshot.screenshotPrompts);
        assertNoError(error, 'Could not restore screenshot prompts');
    }

    if (snapshot.exportStatus) {
        const { error } = await admin.from('app_export_status').insert(snapshot.exportStatus);
        assertNoError(error, 'Could not restore export status');
    }
};

const resetScreenshotWorkflowState = async ({
    appId,
    projectBrief = LONG_CLIENT_SPEC,
    screenshotReferencePrompt,
    ensurePickedExportIcon = false,
}: {
    appId: string;
    projectBrief?: string;
    screenshotReferencePrompt?: string | null;
    ensurePickedExportIcon?: boolean;
}) => {
    const { data: appRow, error: appError } = await admin
        .from('apps')
        .select('id, user_id, brand_id')
        .eq('id', appId)
        .single();
    assertNoError(appError, 'Could not load smoke app row');

    const userId = requireData('smoke app user id', appRow?.user_id);
    const brandId = requireData('smoke app brand id', appRow?.brand_id);

    const { error: picksError } = await admin
        .from('app_asset_picks')
        .delete()
        .eq('app_id', appId)
        .eq('kind', 'screenshot');
    assertNoError(picksError, 'Could not delete screenshot picks');

    const { error: iconPicksError } = await admin
        .from('app_asset_picks')
        .delete()
        .eq('app_id', appId)
        .eq('kind', 'icon');
    assertNoError(iconPicksError, 'Could not delete icon picks');

    const { error: generatedError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['screenshot', 'screenshot_enhanced']);
    assertNoError(generatedError, 'Could not delete generated screenshots');

    const { error: generatedIconsError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['icon', 'icon_enhanced']);
    assertNoError(generatedIconsError, 'Could not delete generated icons');

    const { error: screenshotsError } = await admin.from('app_screenshots').delete().eq('app_id', appId);
    assertNoError(screenshotsError, 'Could not delete simulator screenshots');

    const { error: screenshotPromptsError } = await admin
        .from('app_screenshot_prompts')
        .delete()
        .eq('app_id', appId);
    assertNoError(screenshotPromptsError, 'Could not delete screenshot prompts');

    const { error: configError } = await admin
        .from('connector_app_configs')
        .update({ project_brief: projectBrief })
        .eq('app_id', appId);
    assertNoError(configError, 'Could not update connector project brief');

    const resetScreenshotSetPatch = (await supportsScreenshotSetSlotMappings())
        ? { slot_count: 3, size_label: '6.5', slot_mappings: {} }
        : { slot_count: 3, size_label: '6.5' };
    const { error: resetScreenshotSetsError } = await admin
        .from('app_screenshot_sets')
        .update(resetScreenshotSetPatch)
        .eq('app_id', appId);
    assertNoError(resetScreenshotSetsError, 'Could not reset screenshot sets');

    if (typeof screenshotReferencePrompt !== 'undefined') {
        const { error: deleteRefsError } = await admin
            .from('brand_references')
            .delete()
            .eq('brand_id', brandId)
            .eq('kind', 'screenshot');
        assertNoError(deleteRefsError, 'Could not delete screenshot brand references');

        if (screenshotReferencePrompt) {
            const { data: insertedRef, error: insertRefError } = await admin
                .from('brand_references')
                .insert({
                    user_id: userId,
                    brand_id: brandId,
                    kind: 'screenshot',
                    image_path: `${userId}/brands/${brandId}/screenshots/smoke-ref-1.jpg`,
                    prompt: '',
                    order_index: 0,
                })
                .select('id')
                .single();
            assertNoError(insertRefError, 'Could not insert screenshot brand reference');

            const brandReferenceId = requireData('smoke screenshot brand reference id', insertedRef?.id);
            const { error: insertPromptError } = await admin.from('app_screenshot_prompts').insert({
                user_id: userId,
                brand_id: brandId,
                app_id: appId,
                brand_reference_id: brandReferenceId,
                prompt: screenshotReferencePrompt,
            });
            assertNoError(insertPromptError, 'Could not insert screenshot reference prompt');
        }
    }

    if (ensurePickedExportIcon) {
        const { data: insertedAsset, error: insertAssetError } = await admin
            .from('app_generated_assets')
            .insert({
                user_id: userId,
                brand_id: brandId,
                app_id: appId,
                kind: 'icon',
                slot_index: 1,
                version_index: 1,
                image_path: `${userId}/apps/${appId}/generated/icons/slot-1/smoke-picked-export-icon.jpg`,
                screenshot_set_id: null,
                size_label: '1024',
                width: 1024,
                height: 1024,
                status: 'ready',
                edit_state: null,
            })
            .select('id')
            .single();
        assertNoError(insertAssetError, 'Could not insert picked export icon asset');

        const generatedAssetId = requireData('smoke picked export icon asset id', insertedAsset?.id);
        const { error: insertPickError } = await admin.from('app_asset_picks').insert({
            user_id: userId,
            brand_id: brandId,
            app_id: appId,
            kind: 'icon',
            screenshot_set_id: null,
            slot_index: null,
            generated_asset_id: generatedAssetId,
        });
        assertNoError(insertPickError, 'Could not insert picked export icon pick');
    }
};

const stubStorageApi = async (page: Page) => {
    await page.route('**/storage/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.includes('/storage/v1/object/sign/')) {
            const fullPath = url.pathname.split('/storage/v1/object/sign/')[1] || '';
            if (request.method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        signedURL: `/object/sign/${fullPath}?token=smoke-token`,
                    }),
                });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: TINY_PNG_BUFFER,
            });
            return;
        }

        if (url.pathname.includes('/storage/v1/object/') && ['POST', 'PUT'].includes(request.method())) {
            const key = url.pathname.split('/storage/v1/object/')[1] || 'smoke/object.png';
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    Id: `smoke-${Date.now()}`,
                    Key: key,
                }),
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: request.method() === 'GET' ? 'image/png' : 'application/json',
            body: request.method() === 'GET' ? TINY_PNG_BUFFER : JSON.stringify({ ok: true }),
        });
    });
};

const stubScreenshotPromptAutogenApi = async (page: Page, titles = DEFAULT_AUTOGEN_TITLES) => {
    await page.route('**/api/generate-screenshot-prompts', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'generated',
                appTheme: 'finance dashboards',
                titles,
                model: 'test-model',
            }),
        });
    });
};

const stubGenerateScreenshotApi = async (page: Page, onRequest?: (body: any) => void) => {
    await page.route('**/api/generate-screenshot', async (route) => {
        onRequest?.(route.request().postDataJSON?.() ?? null);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                mimeType: 'image/png',
                b64: TINY_PNG_B64,
            }),
        });
    });
};

const uploadThreeSimulatorShots = async (page: Page) => {
    const screenshotFile = path.join(process.cwd(), 'public', 'no-brand-screenshot-anchor-65.png');
    await page.locator('#app-screenshots-upload').setInputFiles([
        screenshotFile,
        screenshotFile,
        screenshotFile,
    ]);
};

const ensureScreenshotPromptWorkspaceVisible = async (page: Page) => {
    const showWorkspaceButton = page.getByRole('button', { name: /show workspace/i });
    const screenshotPromptsPanel = page.getByTestId('workspace-panel-screenshot-prompts');

    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (await screenshotPromptsPanel.isVisible().catch(() => false)) return;
        if (await showWorkspaceButton.isVisible().catch(() => false)) {
            await showWorkspaceButton.click();
        }
        await page.waitForTimeout(250);
    }

    await expect(screenshotPromptsPanel).toBeVisible();
};

test.use({
    allowedConsoleErrors: [
        /(?:Failed to load resource: the server responded with a status of 503 \(Service Temporarily Unavailable\)|Loading the image 'http:\/\/127\.0\.0\.1:54321\/storage\/v1\/object\/sign\/.*' violates the following Content Security Policy directive)/,
    ],
});

test('no-brand screenshot prompts default to Nano 2, autogen fills visible slots, and slot 1 pick unlocks later slots', async ({
    page,
}) => {
    const appId = smokeEnv.seed.noBrandCompletedApp.id;
    const snapshot = await captureScreenshotWorkflowState(appId);

    try {
        await resetScreenshotWorkflowState({ appId, projectBrief: LONG_CLIENT_SPEC });

        await gotoNoBrandCollapsedWorkspace(page);

        await claimWorkspaceEditLockIfPrompted(page);
        await ensureScreenshotPromptWorkspaceVisible(page);

        await stubStorageApi(page);
        await stubScreenshotPromptAutogenApi(page);
        await stubGenerateScreenshotApi(page);
        await uploadThreeSimulatorShots(page);

        await expect(page.getByTestId('screenshot-slot-sim-1')).not.toHaveValue('');
        await expect(page.getByTestId('screenshot-slot-sim-2')).not.toHaveValue('');
        await expect(page.getByTestId('screenshot-slot-sim-3')).not.toHaveValue('');

        await expect(page.getByTestId('screenshot-provider-select')).toHaveValue('replicate:nano-banana-2');
        await expect(page.getByTestId('screenshot-generate-all-button')).toBeDisabled();

        await page.getByTestId('screenshot-prompt-autogen-button').click();

        await expect(page.getByTestId('screenshot-slot-prompt-1')).toHaveValue(/Track every expense clearly/i);
        await expect(page.getByTestId('screenshot-slot-prompt-2')).toHaveValue(/Stay on top of budgets/i);
        await expect(page.getByTestId('screenshot-slot-prompt-3')).toHaveValue(/See patterns faster/i);
        await expect(page.getByTestId('screenshot-slot-prompt-4')).toHaveCount(0);
        await expect(page.getByTestId('screenshot-generate-all-button')).toBeEnabled();

        await page.getByTestId('screenshot-slot-prompt-2').fill('');
        await expect(page.getByTestId('screenshot-generate-all-button')).toBeDisabled();

        await page.getByTestId('screenshot-slot-generate-1').click();
        await expect(page.getByTestId('screenshot-pick-1')).toBeEnabled({ timeout: 20_000 });

        await expect(page.getByTestId('screenshot-slot-generate-2')).toBeDisabled();
        await expect(page.getByTestId('screenshot-slot-blocked-2')).toContainText(/slot 1/i);

        await page.getByTestId('screenshot-pick-1').click();

        await expect(page.getByTestId('screenshot-slot-generate-2')).toBeEnabled();
        await expect(page.getByTestId('screenshot-slot-blocked-2')).toHaveCount(0);
    } finally {
        await restoreScreenshotWorkflowState(snapshot);
    }
});

test('branded autogen keeps slot prompts visible and combines them with reference prompts for ref-like slots', async ({
    page,
}) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const brandReferencePrompt = 'Keep a calm finance brand aesthetic with soft teal gradients.';
    let lastGeneratePrompt = '';
    const snapshot = await captureScreenshotWorkflowState(appId);

    try {
        await resetScreenshotWorkflowState({
            appId,
            projectBrief: LONG_CLIENT_SPEC,
            screenshotReferencePrompt: brandReferencePrompt,
        });

        await gotoWorkspace(page);
        await expect(page.getByTestId('workspace-panel-screenshot-prompts')).toBeVisible();

        await stubStorageApi(page);
        await stubScreenshotPromptAutogenApi(page);
        await stubGenerateScreenshotApi(page, (body) => {
            lastGeneratePrompt = String(body?.prompt || '');
        });
        await uploadThreeSimulatorShots(page);

        await expect(page.getByTestId('screenshot-slot-brand-1')).not.toHaveValue('');
        await expect(page.getByTestId('screenshot-prompt-autogen-button')).toBeVisible();

        await page.getByTestId('screenshot-prompt-autogen-button').click();

        await expect(page.getByTestId('screenshot-slot-prompt-1')).toHaveValue(/Track every expense clearly/i);
        await expect(page.getByTestId('screenshot-slot-reference-prompt-1')).toHaveValue(
            /Keep a calm finance brand aesthetic/i
        );

        await page.getByTestId('screenshot-slot-generate-1').click();

        await expect
            .poll(() => lastGeneratePrompt, {
                message: 'Expected branded screenshot generation to include both reference and slot prompts.',
            })
            .toContain('Keep a calm finance brand aesthetic');
        await expect
            .poll(() => lastGeneratePrompt, {
                message: 'Expected branded screenshot generation to include the autogenerated slot prompt.',
            })
            .toContain('Track every expense clearly');
    } finally {
        await restoreScreenshotWorkflowState(snapshot);
    }
});

test('brand reference can switch between screenshot refs, picked export icon, and style refs without conflicting state across slots', async ({
    page,
}) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const brandReferencePrompt = 'Keep a calm finance brand aesthetic with soft teal gradients.';
    const requestBodies: any[] = [];
    const snapshot = await captureScreenshotWorkflowState(appId);

    try {
        await resetScreenshotWorkflowState({
            appId,
            projectBrief: LONG_CLIENT_SPEC,
            screenshotReferencePrompt: brandReferencePrompt,
            ensurePickedExportIcon: true,
        });

        await gotoWorkspace(page);
        await expect(page.getByTestId('workspace-panel-screenshot-prompts')).toBeVisible();

        await stubStorageApi(page);
        await stubGenerateScreenshotApi(page, (body) => {
            requestBodies.push(body);
        });
        await uploadThreeSimulatorShots(page);

        const brandSelect = page.getByTestId('screenshot-slot-brand-1');
        const styleSelect = page.getByTestId('screenshot-slot-style-1');
        const slotTwoBrandSelect = page.getByTestId('screenshot-slot-brand-2');
        const slotTwoStyleSelect = page.getByTestId('screenshot-slot-style-2');
        const slotOneCard = brandSelect.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
        const systemPromptToggle = slotOneCard.getByRole('button', { name: /system prompt/i });

        await expect(brandSelect).not.toHaveValue('');
        await expect(styleSelect).toBeDisabled();
        await expect
            .poll(async () => await page.locator('[data-testid="screenshot-slot-brand-1"] option').allTextContents())
            .toContain('Picked export icon');
        await expect
            .poll(async () => await page.locator('[data-testid="screenshot-slot-brand-2"] option').allTextContents())
            .toContain('Picked export icon');

        await brandSelect.selectOption('');
        await expect(styleSelect).toBeEnabled();

        await page.getByTestId('screenshot-slot-prompt-1').fill('Use a clean finance hero layout.');
        await page.getByTestId('screenshot-slot-generate-1').click();
        await expect(page.getByTestId('screenshot-pick-1')).toBeEnabled({ timeout: 20_000 });
        await expect
            .poll(async () => await page.locator('[data-testid="screenshot-slot-style-1"] option').count())
            .toBeGreaterThan(1);

        await styleSelect.selectOption({ index: 1 });
        await expect(brandSelect).toBeDisabled();
        await expect(brandSelect).toHaveValue('');

        await systemPromptToggle.click();
        await expect(slotOneCard.getByRole('button', { name: 'samestyle-like' })).toBeVisible();
        await expect(slotOneCard.getByRole('button', { name: 'empty' })).toBeVisible();
        await expect(slotOneCard.getByRole('button', { name: 'samestyle-like' })).toHaveCount(1);

        await styleSelect.selectOption('');
        await expect(brandSelect).toBeEnabled();

        await brandSelect.selectOption('picked_export_icon');
        await expect(styleSelect).toBeDisabled();
        await expect(page.getByTestId('screenshot-slot-reference-prompt-1')).toHaveCount(0);
        await expect(slotOneCard.getByRole('button', { name: 'icon-palette-like' })).toBeVisible();

        await page.getByTestId('screenshot-slot-generate-1').click();

        await expect
            .poll(() => requestBodies.at(-1), {
                message: 'Expected screenshot generation request for picked export icon mode.',
            })
            .toBeTruthy();

        await expect
            .poll(() => String(requestBodies.at(-1)?.prompt || ''), {
                message: 'Expected picked export icon system prompt to be used.',
            })
            .toContain('brand icon palette/style reference');

        await expect
            .poll(() => Number(requestBodies.at(-1)?.imageInputUrls?.length || 0), {
                message: 'Expected anchor + picked export icon + simulator image inputs.',
            })
            .toBe(3);

        await slotTwoBrandSelect.selectOption('picked_export_icon');
        await expect(slotTwoStyleSelect).toBeDisabled();
        await expect(page.getByTestId('screenshot-slot-reference-prompt-2')).toHaveCount(0);

        await page.getByTestId('screenshot-slot-prompt-2').fill('Highlight approvals and shared budgets clearly.');
        await page.getByTestId('screenshot-slot-generate-2').click();
        await expect(page.getByTestId('screenshot-pick-2')).toBeEnabled({ timeout: 20_000 });

        await expect
            .poll(() => String(requestBodies.at(-1)?.prompt || ''), {
                message: 'Expected later-slot picked export icon generation to use the icon palette prompt.',
            })
            .toContain('brand icon palette/style reference');

        await expect
            .poll(() => Number(requestBodies.at(-1)?.imageInputUrls?.length || 0), {
                message: 'Expected later-slot generation to include anchor + picked export icon + simulator image inputs.',
            })
            .toBe(3);
    } finally {
        await restoreScreenshotWorkflowState(snapshot);
    }
});

test('add brand slot creates a brand-only slot that can generate from the picked icon without a simulator shot', async ({
    page,
}) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const requestBodies: any[] = [];
    const snapshot = await captureScreenshotWorkflowState(appId);

    try {
        await resetScreenshotWorkflowState({
            appId,
            projectBrief: LONG_CLIENT_SPEC,
            ensurePickedExportIcon: true,
        });

        await gotoWorkspace(page);
        await expect(page.getByTestId('workspace-panel-screenshot-prompts')).toBeVisible();

        await stubStorageApi(page);
        await stubGenerateScreenshotApi(page, (body) => {
            requestBodies.push(body);
        });
        await uploadThreeSimulatorShots(page);

        await page.getByTestId('screenshot-add-brand-slot-button').click();
        const activeSetId = await page.getByTestId('screenshot-set-select').inputValue();

        await expect(page.getByTestId('screenshot-slot-prompt-4')).toBeVisible();
        await expect(page.getByTestId('screenshot-slot-brand-4')).toHaveValue('picked_export_icon');
        await expect(page.getByTestId('screenshot-slot-sim-4')).toHaveCount(0);

        await page.getByTestId('screenshot-slot-prompt-4').fill('Create a bold productivity brand slide with a clean headline zone.');
        await page.getByTestId('screenshot-slot-generate-4').click();
        await expect(page.getByTestId('screenshot-pick-4')).toBeEnabled({ timeout: 20_000 });

        await expect
            .poll(() => String(requestBodies.at(-1)?.prompt || ''), {
                message: 'Expected brand-only slot generation to use the icon palette prompt.',
            })
            .toContain('brand icon palette/style reference');

        await expect
            .poll(() => Number(requestBodies.at(-1)?.imageInputUrls?.length || 0), {
                message: 'Expected brand-only slot generation to include only anchor + picked export icon.',
            })
            .toBe(2);

        if (await supportsScreenshotSetSlotMappings()) {
            const { data: screenshotSetRow, error: screenshotSetError } = await admin
                .from('app_screenshot_sets')
                .select('slot_count, slot_mappings')
                .eq('id', activeSetId)
                .single();
            assertNoError(screenshotSetError, 'Could not load persisted screenshot set');
            expect(screenshotSetRow?.slot_count).toBe(4);
            expect((screenshotSetRow as any)?.slot_mappings?.['4']?.slotMode).toBe('brand');
            expect((screenshotSetRow as any)?.slot_mappings?.['4']?.brandRefSource).toBe('picked_export_icon');
        }
    } finally {
        await restoreScreenshotWorkflowState(snapshot);
    }
});

test('brand slot mapping stays isolated to the active screenshot set', async ({ page }) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const snapshot = await captureScreenshotWorkflowState(appId);

    try {
        await resetScreenshotWorkflowState({
            appId,
            projectBrief: LONG_CLIENT_SPEC,
            ensurePickedExportIcon: true,
        });

        await gotoWorkspace(page);
        await expect(page.getByTestId('workspace-panel-screenshot-prompts')).toBeVisible();

        await stubStorageApi(page);
        await uploadThreeSimulatorShots(page);

        await page.getByTestId('screenshot-add-brand-slot-button').click();
        const originalSetId = await page.getByTestId('screenshot-set-select').inputValue();

        await page.getByTestId('screenshot-add-set-button').click();

        await expect
            .poll(() => page.getByTestId('screenshot-set-select').inputValue(), {
                message: 'Expected Add set to switch to the newly created screenshot set.',
            })
            .not.toBe(originalSetId);

        const newSetId = await page.getByTestId('screenshot-set-select').inputValue();
        expect(newSetId).not.toBe(originalSetId);
        await expect(page.getByTestId('screenshot-slot-sim-4')).toHaveCount(1);
        await expect(page.getByTestId('screenshot-slot-brand-4')).toHaveValue('');

        if (await supportsScreenshotSetSlotMappings()) {
            const { data: newSetRow, error: newSetError } = await admin
                .from('app_screenshot_sets')
                .select('slot_count, slot_mappings')
                .eq('id', newSetId)
                .single();
            assertNoError(newSetError, 'Could not load the new screenshot set');
            expect(newSetRow?.slot_count).toBe(4);
            expect(Object.prototype.hasOwnProperty.call((newSetRow as any)?.slot_mappings || {}, '4')).toBe(false);
        }
    } finally {
        await restoreScreenshotWorkflowState(snapshot);
    }
});
