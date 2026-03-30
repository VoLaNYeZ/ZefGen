import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { restoreSeededNoBrandApp } from './support/backend';
import {
    SMOKE_DEVICE_ID_KEY,
    claimWorkspaceEditLockIfPrompted,
    escapeRegex,
    grantClipboardPermissions,
    gotoNoBrandCollapsedWorkspace,
    gotoWorkspace,
    selectOptionContainingText,
    smokeEnv,
} from './support/helpers';

type ConnectorJobRow = {
    id: string;
    user_id: string;
    app_id: string | null;
    brand_id: string | null;
    kind: string;
    status: string;
    requested_by: string | null;
    input: Record<string, unknown>;
    repo_full_name: string;
    base_branch: string;
    work_branch: string | null;
    result_commit_sha: string | null;
    pr_url: string | null;
    pr_number: number | null;
    verify_status: 'pass' | 'fail' | 'skipped' | null;
    verify_tail: string | null;
    summary: string | null;
    claimed_by: string | null;
    claimed_at: string | null;
    started_at: string | null;
    heartbeat_at: string | null;
    ended_at: string | null;
    cancel_requested_at: string | null;
    error: string | null;
    updated_at: string;
    created_at: string;
};

const isoAt = (minuteOffset = 0) => new Date(Date.now() + minuteOffset * 60_000).toISOString();
const smokeJobId = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const buildConnectorJobRow = (overrides: Partial<ConnectorJobRow> = {}): ConnectorJobRow => {
    const now = isoAt();
    return {
        id: smokeJobId(1),
        user_id: 'smoke-user',
        app_id: smokeEnv.seed.primaryApp.id,
        brand_id: smokeEnv.seed.brand.id,
        kind: 'generate',
        status: 'queued',
        requested_by: null,
        input: {},
        repo_full_name: 'example/smoke-primary',
        base_branch: 'main',
        work_branch: null,
        result_commit_sha: null,
        pr_url: null,
        pr_number: null,
        verify_status: null,
        verify_tail: null,
        summary: null,
        claimed_by: null,
        claimed_at: null,
        started_at: now,
        heartbeat_at: now,
        ended_at: null,
        cancel_requested_at: null,
        error: null,
        updated_at: now,
        created_at: now,
        ...overrides,
    };
};

const readRequestJson = (pageRequest: { postDataJSON(): unknown }) => {
    try {
        return pageRequest.postDataJSON();
    } catch {
        return null;
    }
};

const installPrimaryWorkspaceRunnerMocks = async (page: Page, initialJobs: ConnectorJobRow[]) => {
    let rows = [...initialJobs];
    let createCallCount = 0;
    let finishCanceled = false;

    await page.addInitScript(
        ({ appId, repoUrl }) => {
            window.localStorage.setItem(`zefgen.githubRepoUrl.${appId}`, repoUrl);
        },
        {
            appId: smokeEnv.seed.primaryApp.id,
            repoUrl: 'https://github.com/example/smoke-primary',
        }
    );

    await page.route('**/rest/v1/app_asset_picks*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        const now = isoAt();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: 'pick-icon-1',
                    user_id: 'smoke-user',
                    brand_id: smokeEnv.seed.brand.id,
                    app_id: smokeEnv.seed.primaryApp.id,
                    kind: 'icon',
                    screenshot_set_id: null,
                    slot_index: null,
                    generated_asset_id: 'picked-icon-asset-1',
                    created_at: now,
                    updated_at: now,
                },
            ]),
        });
    });

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        const method = route.request().method();
        const now = isoAt();

        if (method === 'GET') {
            const body = rows.map((row) =>
                finishCanceled && row.cancel_requested_at && ['queued', 'running', 'waiting_for_user'].includes(row.status)
                    ? {
                          ...row,
                          status: 'canceled',
                          ended_at: now,
                          updated_at: now,
                      }
                    : row
            );
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
            return;
        }

        if (method === 'POST') {
            const rawBody = readRequestJson(route.request()) as Record<string, unknown> | Record<string, unknown>[] | null;
            const payload = Array.isArray(rawBody) ? rawBody[0] ?? {} : rawBody ?? {};
            createCallCount += 1;
            const created = buildConnectorJobRow({
                id: smokeJobId(1000 + createCallCount),
                user_id: String(payload.user_id ?? 'smoke-user'),
                app_id: String(payload.app_id ?? smokeEnv.seed.primaryApp.id),
                brand_id: typeof payload.brand_id === 'string' ? payload.brand_id : smokeEnv.seed.brand.id,
                kind: String(payload.kind ?? 'generate'),
                input:
                    payload.input && typeof payload.input === 'object' && !Array.isArray(payload.input)
                        ? (payload.input as Record<string, unknown>)
                        : {},
                repo_full_name: String(payload.repo_full_name ?? 'example/smoke-primary'),
                base_branch: String(payload.base_branch ?? 'main'),
                started_at: null,
                heartbeat_at: null,
                created_at: now,
                updated_at: now,
            });
            rows = [created, ...rows];
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(created),
            });
            return;
        }

        if (method === 'PATCH') {
            const rawBody = readRequestJson(route.request()) as Record<string, unknown> | null;
            const payload = rawBody && typeof rawBody === 'object' ? rawBody : {};
            const requestUrl = new URL(route.request().url());
            const jobId = String(requestUrl.searchParams.get('id') || '').replace(/^eq\./, '');

            rows = rows.map((row) =>
                row.id === jobId
                    ? {
                          ...row,
                          ...payload,
                          updated_at: now,
                      }
                    : row
            );

            const updated = rows.find((row) => row.id === jobId) ?? null;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(updated),
            });
            return;
        }

        await route.continue();
    });

    return {
        getCreateCallCount: () => createCallCount,
        setFinishCanceled: (next: boolean) => {
            finishCanceled = next;
        },
    };
};

type WorkspaceSessionsMockState = {
    activeSessionCountries: string[];
    brandId: string;
    claimCalls: number;
    failTakeOverForDeviceId: string | null;
    ownerDeviceId: string | null;
    seenDeviceIds: Set<string>;
    takeOverCalls: number;
};

const installWorkspaceSessionsMock = async (context: BrowserContext, state: WorkspaceSessionsMockState) => {
    await context.route('**/api/workspace-sessions', async (route) => {
        const payload = (readRequestJson(route.request()) as Record<string, unknown> | null) ?? {};
        const action = String(payload.action || '');
        const clientDeviceId = String(payload.clientDeviceId || '').trim();
        const brandId = typeof payload.brandId === 'string' && payload.brandId.trim() ? payload.brandId.trim() : null;

        if (clientDeviceId) {
            state.seenDeviceIds.add(clientDeviceId);
        }

        const lockedBrandIds =
            state.ownerDeviceId && clientDeviceId && state.ownerDeviceId !== clientDeviceId ? [state.brandId] : [];

        if (action === 'snapshot') {
            const activeSessionCount = Math.max(1, state.seenDeviceIds.size || (state.ownerDeviceId ? 1 : 0));
            const activeSessionCountries = Array.from({ length: activeSessionCount }, (_, index) => {
                return state.activeSessionCountries[index % state.activeSessionCountries.length] || 'unknown';
            });
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    active_session_count: activeSessionCount,
                    active_session_countries: activeSessionCountries,
                    locked_brand_ids_by_other_devices: lockedBrandIds,
                }),
            });
            return;
        }

        if (action === 'release_brand') {
            if (brandId === state.brandId && state.ownerDeviceId === clientDeviceId) {
                state.ownerDeviceId = null;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, reason: null }),
            });
            return;
        }

        if (action === 'claim_brand') {
            state.claimCalls += 1;
            if (brandId === state.brandId && state.ownerDeviceId && state.ownerDeviceId !== clientDeviceId) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: false, reason: 'locked_by_other_device' }),
                });
                return;
            }
            if (brandId === state.brandId && clientDeviceId) {
                state.ownerDeviceId = clientDeviceId;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, reason: null }),
            });
            return;
        }

        if (action === 'take_over_brand') {
            state.takeOverCalls += 1;
            if (clientDeviceId && state.failTakeOverForDeviceId === clientDeviceId) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: false, reason: 'unavailable' }),
                });
                return;
            }
            if (brandId === state.brandId && clientDeviceId) {
                state.ownerDeviceId = clientDeviceId;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, reason: null }),
            });
            return;
        }

        if (action === 'heartbeat') {
            if (brandId === state.brandId && state.ownerDeviceId && state.ownerDeviceId !== clientDeviceId) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: false, reason: 'locked_by_other_device' }),
                });
                return;
            }
            if (brandId === state.brandId && clientDeviceId) {
                state.ownerDeviceId = clientDeviceId;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, reason: null }),
            });
            return;
        }

        await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: `Unexpected action: ${action}` }),
        });
    });
};

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

test('step 6 manual copy action stays visible in EN and RU and writes the expected clipboard payload', async ({ page }) => {
    await gotoWorkspace(page);
    await grantClipboardPermissions(page);

    const appStoreName = await page.getByLabel("App's App Store name").inputValue();
    const apphudKey = await page.getByLabel('Apphud Key').inputValue();
    const analyticsUrl = await page.getByLabel('Analytics URL').inputValue();
    const privacyUrl = (await page.getByLabel('Privacy Policy URL').getAttribute('href')) || '';
    const termsUrl = (await page.getByLabel('Terms of Use URL').getAttribute('href')) || '';
    const supportUrl = (await page.getByLabel('Support form URL').getAttribute('href')) || '';
    const bundleId = await page.getByLabel('Bundle ID').inputValue();
    const iapProductId = await page.getByLabel('IAP Product ID').inputValue();
    const expectedClipboard = [
        `Привет, нужна интеграция - [${smokeEnv.seed.primaryApp.alias.toUpperCase()}] ${appStoreName.trim()}`,
        `Apphud Key - "${apphudKey.trim()}"`,
        `Analytics URL - "${analyticsUrl.trim()}"`,
        `privacy - "${privacyUrl.trim()}"`,
        `terms - "${termsUrl.trim()}"`,
        `support - "${supportUrl.trim()}"`,
        `Bundle ID - "${bundleId.trim()}"`,
        `*IAP Product ID - ${iapProductId.trim() || 'без покупок'}`,
        '+ Firebase нужно создать',
        '+ Пуш подрубить',
    ].join('\n');

    const integrationPanel = page.getByTestId('workspace-panel-integration');
    const manualCopyButton = integrationPanel.getByTestId('manual-integration-copy-button');

    await expect(manualCopyButton).toBeVisible();
    await expect(manualCopyButton).toContainText('Copy for manual');

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^RU$/ }).click();
    await expect(manualCopyButton).toBeVisible();

    await manualCopyButton.click();

    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()), {
            message: 'Expected the Step 6 manual copy button to write the integration handoff text to the clipboard.',
        })
        .toBe(expectedClipboard);

    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^EN$/ }).click();
    await expect(manualCopyButton).toBeVisible();
});

test('step 5 generate asks for confirmation before re-running after a successful generate', async ({ page }) => {
    const runnerMock = await installPrimaryWorkspaceRunnerMocks(page, [
        buildConnectorJobRow({
            id: smokeJobId(11),
            kind: 'generate',
            status: 'succeeded',
            result_commit_sha: 'abc123',
            created_at: isoAt(-10),
            updated_at: isoAt(-9),
            started_at: isoAt(-10),
            ended_at: isoAt(-9),
        }),
    ]);

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const runnerPanel = page.getByTestId('workspace-panel-runner');
    const generateButton = runnerPanel.getByTestId('runner-generate-button');

    await expect(generateButton).toBeEnabled();
    await generateButton.click();
    await expect(runnerPanel.getByTestId('runner-generate-button-popover')).toBeVisible();
    expect(runnerMock.getCreateCallCount()).toBe(0);

    await runnerPanel.getByTestId('runner-generate-button-cancel').click();
    await expect(runnerPanel.getByTestId('runner-generate-button-popover')).toHaveCount(0);
    expect(runnerMock.getCreateCallCount()).toBe(0);

    await generateButton.click();
    await runnerPanel.getByTestId('runner-generate-button-confirm').click();
    await expect.poll(() => runnerMock.getCreateCallCount()).toBe(1);
});

test('step 5 cancel shows cancel requested and then terminal canceled after refresh', async ({ page }) => {
    const runnerMock = await installPrimaryWorkspaceRunnerMocks(page, [
        buildConnectorJobRow({
            id: smokeJobId(21),
            kind: 'fix',
            status: 'running',
            created_at: isoAt(-1),
            updated_at: isoAt(-1),
            started_at: isoAt(-1),
        }),
        buildConnectorJobRow({
            id: smokeJobId(22),
            kind: 'generate',
            status: 'succeeded',
            result_commit_sha: 'abc123',
            created_at: isoAt(-10),
            updated_at: isoAt(-9),
            started_at: isoAt(-10),
            ended_at: isoAt(-9),
        }),
    ]);

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const runnerPanel = page.getByTestId('workspace-panel-runner');
    const activeCancelButton = runnerPanel.getByTestId('runner-cancel-active-button');

    await expect(activeCancelButton).toBeVisible();
    await activeCancelButton.click();
    await expect(activeCancelButton).toContainText(/cancel requested/i);

    runnerMock.setFinishCanceled(true);
    await runnerPanel.getByRole('button', { name: /^refresh$/i }).click();

    await expect(runnerPanel.getByTestId('runner-cancel-active-button')).toHaveCount(0);
    await expect(runnerPanel.getByTestId('runner-selected-job-status')).toHaveText(/^canceled$/i);
});

test('step 5 previous fix reports stay read-only and reveal prior bug details', async ({ page }) => {
    const runnerMock = await installPrimaryWorkspaceRunnerMocks(page, [
        buildConnectorJobRow({
            id: smokeJobId(31),
            kind: 'fix',
            status: 'failed',
            input: {
                bug_report:
                    'Settings screen still crashes after the first render when the user opens reminders from the dashboard.',
            },
            error: 'Verify failed on Settings after launch.',
            created_at: isoAt(-1),
            updated_at: isoAt(-1),
            started_at: isoAt(-1),
            ended_at: isoAt(-1),
        }),
        buildConnectorJobRow({
            id: smokeJobId(32),
            kind: 'fix',
            status: 'succeeded',
            input: {
                bug_report:
                    'Onboarding CTA does not respond after choosing a category. Repro: open onboarding, tap a category, then tap Continue.',
            },
            summary: 'Adjusted the CTA state handling after category selection.',
            result_commit_sha: 'def456',
            pr_url: 'https://github.com/example/smoke-primary/pull/42',
            created_at: isoAt(-8),
            updated_at: isoAt(-7),
            started_at: isoAt(-8),
            ended_at: isoAt(-7),
        }),
        buildConnectorJobRow({
            id: smokeJobId(33),
            kind: 'fix',
            status: 'failed',
            input: {},
            created_at: isoAt(-12),
            updated_at: isoAt(-12),
            started_at: isoAt(-12),
            ended_at: isoAt(-11),
        }),
    ]);

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const runnerPanel = page.getByTestId('workspace-panel-runner');
    const fixInput = runnerPanel.getByPlaceholder(/Describe the issue and how to reproduce it\./i);
    const fixHistoryToggle = runnerPanel.getByTestId('runner-fix-history-toggle');

    await expect(fixHistoryToggle).toBeVisible();
    await expect(fixInput).toHaveValue('');
    expect(runnerMock.getCreateCallCount()).toBe(0);

    await fixHistoryToggle.click();

    const fixHistoryList = runnerPanel.getByTestId('runner-fix-history-list');
    const fixHistoryItems = fixHistoryList.locator('[data-testid^="runner-fix-history-item-"]');

    await expect(fixHistoryList).toBeVisible();
    await expect(fixHistoryItems).toHaveCount(2);
    await expect(fixHistoryItems.nth(0)).toContainText(/Settings screen still crashes/i);
    await expect(fixHistoryItems.nth(0)).toContainText(/failed/i);
    await expect(fixHistoryItems.nth(1)).toContainText(/Onboarding CTA does not respond/i);
    await expect(fixHistoryItems.nth(1)).toContainText(/succeeded/i);
    await expect(fixHistoryList).toContainText(/Some fix jobs do not have a saved bug report\./i);

    await fixHistoryItems.nth(1).getByRole('button').click();

    await expect(runnerPanel.getByTestId(`runner-fix-history-detail-${smokeJobId(32)}`)).toContainText(
        /Onboarding CTA does not respond after choosing a category/i
    );
    await expect(runnerPanel.getByTestId(`runner-fix-history-detail-${smokeJobId(32)}`)).toContainText(
        /Adjusted the CTA state handling after category selection\./i
    );
    await expect(runnerPanel.getByTestId(`runner-fix-history-detail-${smokeJobId(32)}`)).toContainText(/def456/i);
    await expect(runnerPanel.getByTestId(`runner-fix-history-detail-${smokeJobId(32)}`)).toContainText(
        /Open result/i
    );

    await expect(runnerPanel.getByTestId('runner-selected-job-status')).toHaveText(/^failed$/i);
    await expect(fixInput).toHaveValue('');
    expect(runnerMock.getCreateCallCount()).toBe(0);

    await fixHistoryItems.nth(1).getByRole('button').click();
    await expect(runnerPanel.getByTestId(`runner-fix-history-detail-${smokeJobId(32)}`)).toHaveCount(0);
    await expect(fixInput).toHaveValue('');
    expect(runnerMock.getCreateCallCount()).toBe(0);
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

test('client spec opens in a clean reader window without the removed header copy', async ({ page }) => {
    await gotoWorkspace(page);

    const knownBrief = 'A calm iPhone expense journal';
    await page.getByTestId('workspace-panel-client-spec').locator('textarea').fill(knownBrief);

    const openButton = page.getByTestId('client-spec-reader-open-button');
    await expect(openButton).toBeEnabled();
    const [popup] = await Promise.all([page.waitForEvent('popup'), openButton.click()]);
    await popup.waitForLoadState('domcontentloaded');

    await expect(popup.locator('body')).toContainText(knownBrief);
    await expect(popup.locator('body')).not.toContainText('Read only');
    await expect(popup.locator('body')).not.toContainText('Read-only window for QA, comparison, and longer review sessions.');
    await popup.close();
});

test('locked brand opens in view-only mode without auto takeover', async ({ page }) => {
    const currentDeviceId = 'smoke-view-only-device';
    await page.context().addInitScript(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: currentDeviceId }
    );

    const sessionState: WorkspaceSessionsMockState = {
        activeSessionCountries: ['us', 'de'],
        brandId: smokeEnv.seed.brand.id,
        claimCalls: 0,
        failTakeOverForDeviceId: null,
        ownerDeviceId: 'smoke-other-device',
        seenDeviceIds: new Set(['smoke-other-device']),
        takeOverCalls: 0,
    };
    await installWorkspaceSessionsMock(page.context(), sessionState);

    await gotoWorkspace(page);

    await expect(page.getByRole('button', { name: /^Take over editing$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Edit brand$/ })).toBeDisabled();
    expect(sessionState.claimCalls).toBe(0);
    expect(sessionState.takeOverCalls).toBe(0);
});

test('read-only workspace can take over editing and push the displaced session into view-only mode', async ({ page }) => {
    const currentDeviceId = 'smoke-takeover-current-device';
    const otherDeviceId = 'smoke-takeover-other-device';
    const browser = page.context().browser();
    if (!browser) {
        throw new Error('Expected Playwright browser to be available for the takeover smoke test.');
    }

    const sessionState: WorkspaceSessionsMockState = {
        activeSessionCountries: ['us', 'de'],
        brandId: smokeEnv.seed.brand.id,
        claimCalls: 0,
        failTakeOverForDeviceId: null,
        ownerDeviceId: otherDeviceId,
        seenDeviceIds: new Set([otherDeviceId]),
        takeOverCalls: 0,
    };

    await page.context().addInitScript(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: currentDeviceId }
    );
    await installWorkspaceSessionsMock(page.context(), sessionState);

    const storageState = await page.context().storageState();
    const otherContext = await browser.newContext({ storageState });
    await otherContext.addInitScript(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: otherDeviceId }
    );
    await installWorkspaceSessionsMock(otherContext, sessionState);

    try {
        const otherPage = await otherContext.newPage();
        await gotoWorkspace(otherPage);
        await expect(otherPage.getByRole('button', { name: /^Edit brand$/ })).toBeEnabled();

        await gotoWorkspace(page);
        await expect(page.getByRole('button', { name: /^Take over editing$/ })).toBeVisible();
        expect(sessionState.takeOverCalls).toBe(0);

        await claimWorkspaceEditLockIfPrompted(page);
        await expect(page.getByRole('button', { name: /^Take over editing$/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^Edit brand$/ })).toBeEnabled();
        expect(sessionState.ownerDeviceId).toBe(currentDeviceId);
        expect(sessionState.takeOverCalls).toBe(1);

        await otherPage.evaluate(() => {
            window.dispatchEvent(new Event('focus'));
            window.dispatchEvent(new Event('online'));
        });

        await expect(otherPage.getByRole('button', { name: /^Take over editing$/ })).toBeVisible();
        await expect(otherPage.getByRole('button', { name: /^Edit brand$/ })).toBeDisabled();
    } finally {
        await otherContext.close();
    }
});

test('take over failure stays inline even while the job queue is visible', async ({ page }) => {
    const currentDeviceId = 'smoke-takeover-failure-device';
    await page.context().addInitScript(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: currentDeviceId }
    );

    const sessionState: WorkspaceSessionsMockState = {
        activeSessionCountries: ['us', 'de'],
        brandId: smokeEnv.seed.brand.id,
        claimCalls: 0,
        failTakeOverForDeviceId: currentDeviceId,
        ownerDeviceId: 'smoke-takeover-queue-owner',
        seenDeviceIds: new Set(['smoke-takeover-queue-owner']),
        takeOverCalls: 0,
    };
    await installWorkspaceSessionsMock(page.context(), sessionState);
    await installPrimaryWorkspaceRunnerMocks(page, [
        buildConnectorJobRow({
            id: smokeJobId(31),
            kind: 'generate',
            status: 'running',
            created_at: isoAt(-1),
            updated_at: isoAt(-1),
            started_at: isoAt(-1),
        }),
    ]);

    await gotoWorkspace(page);

    await expect(page.getByTestId('generation-queue-widget')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Take over editing$/ })).toBeVisible();

    await page.getByRole('button', { name: /^Take over editing$/ }).click();

    await expect(page.getByTestId('workspace-readonly-banner-error')).toContainText(/take over editing/i);
    await expect(page.getByRole('button', { name: /^Take over editing$/ })).toBeVisible();
    await expect(page.getByTestId('generation-queue-widget')).toBeVisible();
    expect(sessionState.takeOverCalls).toBe(1);
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
    try {
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
    } finally {
        await restoreSeededNoBrandApp();
    }
});
