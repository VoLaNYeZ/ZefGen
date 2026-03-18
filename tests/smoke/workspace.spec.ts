import { expect, test } from './support/fixtures';
import {
    claimWorkspaceEditLockIfPrompted,
    escapeRegex,
    gotoNoBrandCollapsedWorkspace,
    gotoWorkspace,
    selectOptionContainingText,
    smokeEnv,
} from './support/helpers';

test('seeded workspace renders core panels without runtime errors', async ({ page }) => {
    await gotoWorkspace(page);

    await expect(page.getByTestId('brand-sidebar')).toBeVisible();
    await expect(page.getByTestId('workspace-app-selection')).toBeVisible();
    await expect(page.getByTestId('no-brand-row')).toBeVisible();

    for (const testId of [
        'workspace-panel-appstore-link',
        'workspace-panel-client-spec',
        'workspace-panel-variables-secrets',
        'workspace-panel-dev-files',
        'workspace-panel-runner',
        'workspace-panel-integration',
        'workspace-panel-auto-release',
        'workspace-panel-simulator',
        'workspace-panel-screenshot-prompts',
        'workspace-panel-generated-screenshots',
    ]) {
        await expect(page.getByTestId(testId)).toBeVisible();
    }
});

test('deliverables rail stays pinned while scrolling through the screenshot workflow', async ({ page }) => {
    await gotoWorkspace(page);

    const scroller = page.locator('main .flex-1.overflow-y-auto').first();
    const simulatorPanel = page.getByTestId('workspace-panel-simulator');
    const rail = page.getByTestId('workspace-deliverables-rail');

    await simulatorPanel.scrollIntoViewIfNeeded();
    const getRailState = async () =>
        rail.evaluate((element) => ({
            opacity: Number(getComputedStyle(element).opacity || '0'),
            top: Math.round(element.getBoundingClientRect().top),
        }));

    let pinnedState = await getRailState();
    for (let index = 0; index < 8; index += 1) {
        if (pinnedState.opacity > 0.9 && pinnedState.top <= 140) break;
        await scroller.evaluate((element) => {
            element.scrollTop += 120;
            element.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(150);
        pinnedState = await getRailState();
    }

    await expect(rail).toBeVisible();
    expect(pinnedState.opacity).toBeGreaterThan(0.9);
    expect(pinnedState.top).toBeGreaterThanOrEqual(96);
    expect(pinnedState.top).toBeLessThanOrEqual(140);

    const topBefore = pinnedState.top;
    await scroller.evaluate((element) => {
        element.scrollTop += 400;
        element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(250);
    const topAfter = (await getRailState()).top;

    expect(topAfter).toBeGreaterThanOrEqual(96);
    expect(topAfter).toBeLessThanOrEqual(140);
    expect(Math.abs(topAfter - topBefore)).toBeLessThan(12);
});

test('apple review drafts block switching to another app until they are saved', async ({ page }) => {
    await gotoWorkspace(page);

    await page.getByRole('button', { name: /^Open setup$/ }).click();
    const createReceiverButton = page.getByRole('button', { name: /create receiver/i });
    if (await createReceiverButton.isVisible().catch(() => false)) {
        await createReceiverButton.click();
    }

    await expect(page.getByRole('button', { name: /save apple config/i })).toBeVisible();
    await page.getByLabel('Key ID').fill('SMOKEKEY123');
    await page.locator(`[data-app-id="${smokeEnv.seed.accountsTargetApp.id}"]`).click();

    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('app-shell-action-error')).toContainText(/save apple config/i);
    await expect(page.getByLabel('Key ID')).toHaveValue('SMOKEKEY123');
});

test.describe('noncritical hydration failures', () => {
    test.use({
        allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 500 \(Internal Server Error\)/],
    });

    test('workspace switching survives a noncritical hydration fetch failure', async ({ page }) => {
        await gotoWorkspace(page);

        const targetAppId = smokeEnv.seed.accountsTargetApp.id;
        await page.route('**/rest/v1/appstore_review_events*', async (route) => {
            const url = route.request().url();
            if (url.includes(`app_id=eq.${targetAppId}`) || url.includes(`app_id=eq.${encodeURIComponent(targetAppId)}`)) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'forced smoke hydration failure' }),
                });
                return;
            }
            await route.continue();
        });

        await page.locator(`[data-app-id="${targetAppId}"]`).click();

        await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.accountsTargetWorkspace)}$`));
        await expect(page.getByTestId('workspace-page-root')).toBeVisible();
        await expect(page.getByTestId('active-app-pill')).toContainText(
            smokeEnv.seed.accountsTargetApp.alias.toUpperCase()
        );
    });
});

test('workspace does not stay collapsed when a switched app receives mismatched completed export status', async ({ page }) => {
    await gotoNoBrandCollapsedWorkspace(page);

    const targetAppId = smokeEnv.seed.primaryApp.id;
    const mismatchedCompletedAppId = smokeEnv.seed.noBrandCompletedApp.id;
    let mismatchedStatusInjected = false;

    await page.evaluate((appId) => {
        window.localStorage.setItem(`zefgen.assetsCollapsed.${appId}`, '1');
    }, targetAppId);

    await page.route('**/rest/v1/app_export_status*', async (route) => {
        const url = route.request().url();
        const matchesTargetApp =
            url.includes(`app_id=eq.${targetAppId}`) || url.includes(`app_id=eq.${encodeURIComponent(targetAppId)}`);
        if (!matchesTargetApp || mismatchedStatusInjected) {
            await route.continue();
            return;
        }

        mismatchedStatusInjected = true;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                app_id: mismatchedCompletedAppId,
                brand_id: smokeEnv.seed.noBrand.id,
                is_completed: true,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }),
        });
    });

    await page.locator(`[data-brand-id="${smokeEnv.seed.brand.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.primaryApp.alias.toUpperCase());

    await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
    });

    await expect
        .poll(() => mismatchedStatusInjected, {
            message: 'Expected the mismatched export-status response to be injected during the workspace switch',
        })
        .toBe(true);
    await expect(page.getByTestId('workspace-panel-generated-screenshots')).toBeVisible();
    await expect(page.getByRole('button', { name: /show workspace/i })).toHaveCount(0);
});

test('client spec changes survive an immediate app switch', async ({ page }) => {
    await gotoWorkspace(page);

    const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
    const projectBrief = clientSpecPanel.locator('textarea');
    const nextValue = `Smoke switch persistence ${Date.now()} keeps the connector spec durable while moving between apps so the workspace switch flush cannot drop queued edits.`;

    await projectBrief.fill(nextValue);
    await page.locator(`[data-app-id="${smokeEnv.seed.accountsTargetApp.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.accountsTargetWorkspace)}$`));

    await page.locator(`[data-app-id="${smokeEnv.seed.primaryApp.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.primaryApp.alias.toUpperCase());
    await expect(page.getByTestId('workspace-panel-client-spec').locator('textarea')).toHaveValue(nextValue);
});

test('read-only workspace can claim editing lock and re-enable writes', async ({ page }) => {
    let editLockClaimed = false;
    await page.route('**/api/workspace-sessions', async (route) => {
        const action = String(route.request().postDataJSON()?.action || '');
        if (action === 'claim_brand') {
            editLockClaimed = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, reason: null }),
            });
            return;
        }

        const lockedBrandIds = editLockClaimed ? [] : [smokeEnv.seed.brand.id];
        const body =
            action === 'heartbeat'
                ? { ok: !lockedBrandIds.length, reason: lockedBrandIds.length ? 'locked_by_other_device' : null }
                : {
                      active_session_count: 2,
                      active_session_countries: ['us', 'de'],
                      locked_brand_ids_by_other_devices: lockedBrandIds,
                  };

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });

    await gotoWorkspace(page);

    await expect(page.getByRole('button', { name: /^Start editing$/ })).toBeVisible();
    await claimWorkspaceEditLockIfPrompted(page);
    await expect(page.getByRole('button', { name: /^Start editing$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit brand$/ })).toBeEnabled();
});

test('no-brand move step stays visible when the image workspace is collapsed', async ({ page }) => {
    await gotoNoBrandCollapsedWorkspace(page);

    await expect
        .poll(async () =>
            page.locator('.app-folder-layer').evaluate((element) => Number(getComputedStyle(element).opacity || '0'))
        )
        .toBeGreaterThan(0.9);
    await expect(page.getByTestId('deliverables-download-simulator-zip')).toBeVisible();
    await expect(page.getByTestId('workspace-panel-no-brand-move')).toBeVisible();
    await expect(page.getByTestId('workspace-panel-generated-screenshots')).toHaveCount(0);
});

test('no-brand move transfers the app into a regular brand and keeps the route coherent', async ({ page }) => {
    await gotoNoBrandCollapsedWorkspace(page);

    const movePanel = page.getByTestId('workspace-panel-no-brand-move');
    const targetBrandSelect = movePanel.locator('select');

    await expect(movePanel).toBeVisible();
    await expect(targetBrandSelect).toBeVisible();
    await expect
        .poll(async () => targetBrandSelect.locator('option').count(), {
            message: 'Expected no-brand move target options to load before moving the app',
        })
        .toBeGreaterThan(0);

    await selectOptionContainingText(targetBrandSelect, smokeEnv.seed.brand.name);
    await movePanel.getByRole('button', { name: /move app/i }).click();

    await expect(
        page
    ).toHaveURL(
        new RegExp(`/${escapeRegex(smokeEnv.seed.brand.slug)}/${escapeRegex(smokeEnv.seed.noBrandCompletedApp.alias)}$`)
    );
    await expect(page.getByTestId('active-brand-row')).toContainText(smokeEnv.seed.brand.name);
    await expect(page.getByTestId('workspace-panel-no-brand-move')).toHaveCount(0);
});
