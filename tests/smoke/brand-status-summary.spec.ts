import { expect, test } from './support/fixtures';
import { setBrandInactiveState } from './support/backend';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace, smokeEnv } from './support/helpers';

const NOW_ISO = '2026-03-23T12:00:00.000Z';
const readInactiveCount = (text: string | null) => Number((text || '').match(/(\d+)\s*$/)?.[1] || '0');

const buildWebhookRow = (payload: {
    appId: string;
    appName: string;
    bundleId: string;
    publicSubdomain: string;
    latestReviewState: string | null;
}) => ({
    app_id: payload.appId,
    user_id: 'smoke-user',
    public_token: `token-${payload.appId}`,
    secret: `secret-${payload.appId}`,
    public_subdomain: payload.publicSubdomain,
    public_page_published_at: null,
    key_mode: 'team',
    key_id: '2X9R4HXF34',
    issuer_id: '57246542-96fe-1a63-e053-0824d011072a',
    public_webhook_url: '',
    asc_app_id: `asc-${payload.appId}`,
    asc_app_name: payload.appName,
    asc_bundle_id: payload.bundleId,
    apple_webhook_id: `apple-${payload.appId}`,
    latest_event_type: 'APPLE_STATUS_SNAPSHOT',
    latest_review_state: payload.latestReviewState,
    latest_previous_state: null,
    latest_event_at: NOW_ISO,
    last_snapshot_at: NOW_ISO,
    last_delivery_at: NOW_ISO,
    last_delivery_status: 'received',
    last_error: null,
    last_sync_at: NOW_ISO,
    last_sync_status: 'connected',
    last_sync_error: null,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
});

test('workspace brand summaries use Apple review state and flag rejected in-progress apps', async ({ page }) => {
    const primaryWebhook = buildWebhookRow({
        appId: smokeEnv.seed.primaryApp.id,
        appName: smokeEnv.seed.primaryApp.name,
        bundleId: 'com.smoke.primary',
        publicSubdomain: 'smoke-primary',
        latestReviewState: 'READY_FOR_SALE',
    });
    const rejectedWebhook = buildWebhookRow({
        appId: smokeEnv.seed.accountsTargetApp.id,
        appName: smokeEnv.seed.accountsTargetApp.name,
        bundleId: 'com.smoke.rejected',
        publicSubdomain: 'smoke-rejected',
        latestReviewState: 'REJECTED',
    });
    const noBrandWebhook = buildWebhookRow({
        appId: smokeEnv.seed.noBrandCompletedApp.id,
        appName: smokeEnv.seed.noBrandCompletedApp.name,
        bundleId: 'com.smoke.no-brand',
        publicSubdomain: 'smoke-no-brand',
        latestReviewState: 'WAITING_FOR_REVIEW',
    });
    const webhookRows = [primaryWebhook, rejectedWebhook, noBrandWebhook];

    await page.route('**/rest/v1/appstore_review_webhooks*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        const url = new URL(route.request().url());
        const appIdFilter = String(url.searchParams.get('app_id') || '').replace(/^eq\./, '');
        const body = appIdFilter ? webhookRows.filter((row) => row.app_id === appIdFilter) : webhookRows;

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });

    await page.route('**/rest/v1/appstore_review_events*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
        });
    });

    await page.route('**/api/appstore-review-webhook-status?appId=*', async (route) => {
        const url = new URL(route.request().url());
        const appId = String(url.searchParams.get('appId') || '').trim();
        const webhook = webhookRows.find((row) => row.app_id === appId) || null;

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                webhook,
                events: [],
                bundle_id: webhook?.asc_bundle_id || null,
                private_key_configured: true,
                effective_public_webhook_url: webhook
                    ? `https://${webhook.public_subdomain}.appshelp.cc/appstore-review?token=${webhook.public_token}`
                    : '',
                effective_public_page_url: webhook ? `https://${webhook.public_subdomain}.appshelp.cc/` : '',
                credential_issues: [],
                webhook_readiness_issues: [],
            }),
        });
    });

    await page.setViewportSize({ width: 900, height: 960 });

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const headerSummary = page.getByTestId('workspace-brand-status-summary');
        await expect(headerSummary).toBeVisible();
        await expect(page.getByTestId('workspace-brand-status-active')).toContainText('1');
        await expect(page.getByTestId('workspace-brand-status-in-progress')).toContainText('1');
        await expect(page.getByTestId('workspace-brand-status-banned')).toContainText('0');
        await expect(page.getByTestId('workspace-brand-status-in-progress-warning')).toBeVisible();

        const activeBrandRow = page.getByTestId('active-brand-row');
        await expect(activeBrandRow.getByTestId('brand-row-status-summary')).toBeVisible();
        await expect(activeBrandRow.getByTestId('brand-row-non-banned-count')).toHaveText('2');
        await expect(activeBrandRow.getByTestId('brand-row-status-active')).toContainText('1');
        await expect(activeBrandRow.getByTestId('brand-row-status-in-progress')).toContainText('1');
        await expect(activeBrandRow.getByTestId('brand-row-status-banned')).toContainText('0');
        await expect(activeBrandRow.getByTestId('brand-row-in-progress-warning')).toBeVisible();

        const inactiveToggle = page.getByTestId('inactive-brands-toggle');
        const baselineInactiveCount = readInactiveCount(await inactiveToggle.textContent());

        await page.getByRole('button', { name: /^Edit brand$/ }).click();
        await page.getByTestId('brand-inactive-toggle').click();
        await page.getByRole('button', { name: /update brand/i }).click();

        await expect
            .poll(async () => readInactiveCount(await inactiveToggle.textContent()), {
                message: 'Expected the inactive brand drawer count to increase after archiving the seeded brand',
            })
            .toBe(baselineInactiveCount + 1);

        const inactivePanel = page.getByTestId('inactive-brands-panel');
        if (!(await inactivePanel.isVisible().catch(() => false))) {
            await inactiveToggle.click();
        }
        await expect(inactivePanel).toBeVisible();

        const inactiveBrandRow = inactivePanel.locator(`[data-brand-id="${smokeEnv.seed.brand.id}"]`);
        await expect(inactiveBrandRow.getByTestId('brand-row-status-summary')).toBeVisible();
        await expect(inactiveBrandRow.getByTestId('brand-row-non-banned-count')).toHaveText('2');
        await expect(inactiveBrandRow.getByTestId('brand-row-status-active')).toContainText('1');
        await expect(inactiveBrandRow.getByTestId('brand-row-status-in-progress')).toContainText('1');
        await expect(inactiveBrandRow.getByTestId('brand-row-status-banned')).toContainText('0');
        await expect(inactiveBrandRow.getByTestId('brand-row-in-progress-warning')).toBeVisible();
    } finally {
        await setBrandInactiveState(smokeEnv.seed.brand.id, false);
    }
});
