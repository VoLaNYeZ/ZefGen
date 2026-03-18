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
        screenshotPicksResult,
        generatedAssetsResult,
        appScreenshotsResult,
        screenshotPromptsResult,
        brandReferencesResult,
        connectorConfigResult,
        exportStatusResult,
    ] = await Promise.all([
        admin.from('app_asset_picks').select('*').eq('app_id', appId).eq('kind', 'screenshot'),
        admin
            .from('app_generated_assets')
            .select('*')
            .eq('app_id', appId)
            .in('kind', ['screenshot', 'screenshot_enhanced']),
        admin.from('app_screenshots').select('*').eq('app_id', appId),
        admin.from('app_screenshot_prompts').select('*').eq('app_id', appId),
        admin.from('brand_references').select('*').eq('brand_id', brandId).eq('kind', 'screenshot'),
        admin.from('connector_app_configs').select('project_brief').eq('app_id', appId).maybeSingle(),
        admin.from('app_export_status').select('*').eq('app_id', appId).maybeSingle(),
    ]);

    assertNoError(screenshotPicksResult.error, 'Could not snapshot screenshot picks');
    assertNoError(generatedAssetsResult.error, 'Could not snapshot generated screenshot assets');
    assertNoError(appScreenshotsResult.error, 'Could not snapshot app screenshots');
    assertNoError(screenshotPromptsResult.error, 'Could not snapshot screenshot prompts');
    assertNoError(brandReferencesResult.error, 'Could not snapshot screenshot brand references');
    assertNoError(connectorConfigResult.error, 'Could not snapshot connector config');
    assertNoError(exportStatusResult.error, 'Could not snapshot export status');

    return {
        appId,
        brandId,
        projectBrief: String(connectorConfigResult.data?.project_brief || ''),
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

    const { error: deleteGeneratedError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['screenshot', 'screenshot_enhanced']);
    assertNoError(deleteGeneratedError, 'Could not clear generated screenshot assets before restore');

    const { error: deleteScreenshotsError } = await admin.from('app_screenshots').delete().eq('app_id', appId);
    assertNoError(deleteScreenshotsError, 'Could not clear app screenshots before restore');

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

    if (snapshot.generatedAssets.length) {
        const { error } = await admin.from('app_generated_assets').insert(snapshot.generatedAssets);
        assertNoError(error, 'Could not restore generated screenshot assets');
    }

    if (snapshot.screenshotPicks.length) {
        const { error } = await admin.from('app_asset_picks').insert(snapshot.screenshotPicks);
        assertNoError(error, 'Could not restore screenshot picks');
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
}: {
    appId: string;
    projectBrief?: string;
    screenshotReferencePrompt?: string | null;
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

    const { error: generatedError } = await admin
        .from('app_generated_assets')
        .delete()
        .eq('app_id', appId)
        .in('kind', ['screenshot', 'screenshot_enhanced']);
    assertNoError(generatedError, 'Could not delete generated screenshots');

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
