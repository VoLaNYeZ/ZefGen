import type { Page, Route } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace, smokeEnv } from './support/helpers';
import type { AppstoreReviewWebhook, AppstoreReviewWebhookStatus } from '../../types/zefgen';

const nowIso = () => new Date().toISOString();
const TEAM_ISSUER_ID = '57246542-96fe-1a63-e053-0824d011072a';

const primaryCandidate = {
    id: 'primary-asc-app',
    name: 'Primary Cached App',
    bundle_id: 'com.smoke.primary',
    sku: 'PRIMARY-1',
    bundle_match: true,
};

const secondaryCandidate = {
    id: 'secondary-asc-app',
    name: 'Secondary Cached App',
    bundle_id: 'com.smoke.secondary',
    sku: 'SECONDARY-1',
    bundle_match: true,
};

const buildWebhookStatus = (payload: {
    appId: string;
    appStoreName: string;
    bundleId: string;
    keyId: string;
    publicSubdomain: string;
    latestReviewState: string;
    ascAppId?: string | null;
    ascAppName?: string | null;
    ascBundleId?: string | null;
}): AppstoreReviewWebhookStatus => {
    const eventAt = nowIso();
    const publicToken = `token-${payload.appId}`;
    return {
        webhook: {
            app_id: payload.appId,
            public_token: publicToken,
            secret: `secret-${payload.appId}`,
            public_subdomain: payload.publicSubdomain,
            key_mode: 'team',
            key_id: payload.keyId,
            issuer_id: TEAM_ISSUER_ID,
            public_webhook_url: `https://${payload.publicSubdomain}.appshelp.cc/appstore-review?token=${publicToken}`,
            asc_app_id: payload.ascAppId ?? null,
            asc_app_name: payload.ascAppName ?? null,
            asc_bundle_id: payload.ascBundleId ?? null,
            latest_event_type: 'APP_REVIEW',
            latest_review_state: payload.latestReviewState,
            latest_previous_state: null,
            latest_event_at: eventAt,
            last_snapshot_at: eventAt,
            last_delivery_at: eventAt,
            last_delivery_status: 'received',
            last_error: null,
            last_sync_at: eventAt,
            last_sync_status: 'connected',
            last_sync_error: null,
            created_at: eventAt,
            updated_at: eventAt,
        },
        events: [],
        bundle_id: payload.bundleId,
        private_key_configured: true,
        effective_public_webhook_url: `https://${payload.publicSubdomain}.appshelp.cc/appstore-review?token=${publicToken}`,
        effective_public_page_url: `https://${payload.publicSubdomain}.appshelp.cc/`,
        credential_issues: [],
        webhook_readiness_issues: [],
    };
};

const buildConnectorConfigRow = (status: AppstoreReviewWebhookStatus) => ({
    app_id: status.webhook?.app_id || '',
    user_id: 'smoke-user',
    project_kind: 'ios',
    project_brief: '',
    idea_id: null,
    base_branch: 'main',
    variables: {
        appstore_name: status.webhook?.asc_app_name || status.webhook?.app_id || '',
        bundle_id: status.bundle_id || '',
    },
    verify_command: null,
    created_at: nowIso(),
    updated_at: nowIso(),
});

const mergeWebhookPatch = (status: AppstoreReviewWebhookStatus, patch: Record<string, unknown>): AppstoreReviewWebhookStatus => ({
    ...status,
    webhook: {
        ...(status.webhook as AppstoreReviewWebhook),
        ...patch,
        updated_at: nowIso(),
    },
});

const openWebhookSetup = async (page: Page) => {
    const panel = page.getByTestId('workspace-panel-app-review-webhook');
    const keyIdInput = panel.getByLabel(/^Key ID$/);
    const isVisible = await keyIdInput.isVisible().catch(() => false);
    if (!isVisible) {
        await panel.getByRole('button', { name: /open setup/i }).click();
    }
    await expect(keyIdInput).toBeVisible();
    return panel;
};

const switchToApp = async (page: Page, appId: string, alias: string) => {
    await page.locator(`[data-app-id="${appId}"]`).click();
    await expect(page.getByTestId('active-app-pill')).toContainText(alias.toUpperCase());
};

const installWebhookMocks = async (page: Page, options?: { failFallbackForAppId?: string | null }) => {
    const primaryAppId = smokeEnv.seed.primaryApp.id;
    const secondaryAppId = smokeEnv.seed.accountsTargetApp.id;

    const primaryStatuses = {
        initial: buildWebhookStatus({
            appId: primaryAppId,
            appStoreName: 'Primary Cached App',
            bundleId: primaryCandidate.bundle_id,
            keyId: 'KEY-PRIMARY',
            publicSubdomain: 'primary-review',
            latestReviewState: 'IN_REVIEW',
        }),
        afterLoad: buildWebhookStatus({
            appId: primaryAppId,
            appStoreName: 'Primary Cached App',
            bundleId: primaryCandidate.bundle_id,
            keyId: 'KEY-PRIMARY',
            publicSubdomain: 'primary-review',
            latestReviewState: 'IN_REVIEW',
            ascAppId: primaryCandidate.id,
            ascAppName: primaryCandidate.name,
            ascBundleId: primaryCandidate.bundle_id,
        }),
        afterSwitchBack: buildWebhookStatus({
            appId: primaryAppId,
            appStoreName: 'Primary Cached App',
            bundleId: primaryCandidate.bundle_id,
            keyId: 'KEY-PRIMARY',
            publicSubdomain: 'primary-review',
            latestReviewState: 'READY_FOR_SALE',
            ascAppId: primaryCandidate.id,
            ascAppName: primaryCandidate.name,
            ascBundleId: primaryCandidate.bundle_id,
        }),
    };
    const secondaryStatuses = {
        initial: buildWebhookStatus({
            appId: secondaryAppId,
            appStoreName: 'Secondary Cached App',
            bundleId: secondaryCandidate.bundle_id,
            keyId: 'KEY-SECONDARY',
            publicSubdomain: 'secondary-review',
            latestReviewState: 'WAITING_FOR_REVIEW',
        }),
        afterLoad: buildWebhookStatus({
            appId: secondaryAppId,
            appStoreName: 'Secondary Cached App',
            bundleId: secondaryCandidate.bundle_id,
            keyId: 'KEY-SECONDARY',
            publicSubdomain: 'secondary-review',
            latestReviewState: 'WAITING_FOR_REVIEW',
            ascAppId: secondaryCandidate.id,
            ascAppName: secondaryCandidate.name,
            ascBundleId: secondaryCandidate.bundle_id,
        }),
    };
    let primaryPhase: keyof typeof primaryStatuses = 'initial';
    let secondaryPhase: keyof typeof secondaryStatuses = 'initial';
    const currentStatusByAppId = new Map<string, AppstoreReviewWebhookStatus>([
        [primaryAppId, primaryStatuses.initial],
        [secondaryAppId, secondaryStatuses.initial],
    ]);

    const fulfillJson = async (route: Route, payload: unknown, status = 200) => {
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(payload),
        });
    };

    await page.route('**/api/appstore-review-webhook-status*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('appId') || '').trim();
        const inFailurePhase =
            options?.failFallbackForAppId &&
            appId === options.failFallbackForAppId &&
            appId === primaryAppId &&
            primaryPhase === 'afterSwitchBack';

        if (inFailurePhase) {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Simulated status refresh failure' }),
            });
            return;
        }

        const nextStatus =
            appId === primaryAppId
                ? primaryStatuses[primaryPhase]
                : appId === secondaryAppId
                  ? secondaryStatuses[secondaryPhase]
                  : currentStatusByAppId.get(appId) || null;
        if (!nextStatus) {
            await route.continue();
            return;
        }
        currentStatusByAppId.set(appId, nextStatus);

        if (appId === primaryAppId && primaryPhase === 'afterSwitchBack') {
            await new Promise((resolve) => setTimeout(resolve, 1200));
        }

        await fulfillJson(route, nextStatus);
    });

    await page.route('**/rest/v1/appstore_review_webhooks*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('app_id') || '').replace(/^eq\./, '').trim();
        const method = route.request().method();
        const currentStatus = currentStatusByAppId.get(appId) || null;

        if (method === 'PATCH' && currentStatus) {
            const patch = (route.request().postDataJSON() as Record<string, unknown> | null) ?? {};
            const nextStatus = mergeWebhookPatch(currentStatus, patch);
            currentStatusByAppId.set(appId, nextStatus);
            await fulfillJson(route, nextStatus.webhook || null);
            return;
        }

        if (method === 'GET') {
            if (options?.failFallbackForAppId && appId === options.failFallbackForAppId) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Simulated fallback failure' }),
                });
                return;
            }
            await fulfillJson(route, currentStatus?.webhook || null);
            return;
        }

        await route.continue();
    });

    await page.route('**/rest/v1/appstore_review_events*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('app_id') || '').replace(/^eq\./, '').trim();
        await fulfillJson(route, currentStatusByAppId.get(appId)?.events || []);
    });

    await page.route('**/rest/v1/connector_app_configs*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('app_id') || '').replace(/^eq\./, '').trim();
        const currentStatus = currentStatusByAppId.get(appId) || null;
        if (!currentStatus) {
            await fulfillJson(route, null);
            return;
        }
        await fulfillJson(route, buildConnectorConfigRow(currentStatus));
    });

    await page.route('**/rest/v1/connector_app_secrets*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('app_id') || '').replace(/^eq\./, '').trim();
        await fulfillJson(route, [
            {
                id: `secret-meta-${Date.now()}`,
                app_id: appId || smokeEnv.seed.primaryApp.id,
                user_id: 'smoke-user',
                key: 'APPSTORE_CONNECT_PRIVATE_KEY',
                created_at: nowIso(),
                updated_at: nowIso(),
            },
        ]);
    });

    await page.route('**/_bridge/appstore/apps*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.host.startsWith('primary-review.')) {
            await fulfillJson(route, {
                candidates: [primaryCandidate],
                auto_bound_app_id: primaryCandidate.id,
                webhook: currentStatusByAppId.get(primaryAppId)?.webhook || null,
            });
            return;
        }
        if (requestUrl.host.startsWith('secondary-review.')) {
            await fulfillJson(route, {
                candidates: [secondaryCandidate],
                auto_bound_app_id: secondaryCandidate.id,
                webhook: currentStatusByAppId.get(secondaryAppId)?.webhook || null,
            });
            return;
        }
        await route.continue();
    });

    return {
        setPrimaryPhase: (next: keyof typeof primaryStatuses) => {
            primaryPhase = next;
            currentStatusByAppId.set(primaryAppId, primaryStatuses[next]);
        },
        setSecondaryPhase: (next: keyof typeof secondaryStatuses) => {
            secondaryPhase = next;
            currentStatusByAppId.set(secondaryAppId, secondaryStatuses[next]);
        },
    };
};

test('webhook panel restores cached app state instantly and revalidates in the background', async ({ page }) => {
    const webhookMocks = await installWebhookMocks(page);
    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const panel = await openWebhookSetup(page);
    webhookMocks.setPrimaryPhase('afterLoad');
    await panel.getByRole('button', { name: /load apple apps/i }).click();
    await expect(panel.locator('option').filter({ hasText: 'Primary Cached App' })).toHaveCount(1);
    await page.waitForTimeout(100);

    await switchToApp(page, smokeEnv.seed.accountsTargetApp.id, smokeEnv.seed.accountsTargetApp.alias);
    webhookMocks.setPrimaryPhase('afterSwitchBack');
    await switchToApp(page, smokeEnv.seed.primaryApp.id, smokeEnv.seed.primaryApp.alias);

    await expect(panel.getByLabel(/^Key ID$/)).toBeVisible();
    await expect(panel.locator('option').filter({ hasText: 'Primary Cached App' })).toHaveCount(1);
    await expect(panel.getByText(/^Loading\.\.\.$/)).toHaveCount(0);
    await expect(panel).toContainText(/ready for sale/i);
});

test('webhook panel keeps cached state visible and shows a warning when background refresh fails', async ({ page }) => {
    const webhookMocks = await installWebhookMocks(page, { failFallbackForAppId: smokeEnv.seed.primaryApp.id });
    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const panel = await openWebhookSetup(page);
    webhookMocks.setPrimaryPhase('afterLoad');
    await panel.getByRole('button', { name: /load apple apps/i }).click();
    await expect(panel.locator('option').filter({ hasText: 'Primary Cached App' })).toHaveCount(1);
    await page.waitForTimeout(100);

    await switchToApp(page, smokeEnv.seed.accountsTargetApp.id, smokeEnv.seed.accountsTargetApp.alias);
    webhookMocks.setPrimaryPhase('afterSwitchBack');
    await switchToApp(page, smokeEnv.seed.primaryApp.id, smokeEnv.seed.primaryApp.alias);

    await expect(panel.getByLabel(/^Key ID$/)).toBeVisible();
    await expect(panel.locator('option').filter({ hasText: 'Primary Cached App' })).toHaveCount(1);
    await expect(panel).toContainText(/server status route warning/i);
    await expect(panel.locator('option').filter({ hasText: 'Primary Cached App' })).toHaveCount(1);
});

test('webhook switch guard keeps dirty edits on cancel and discards them on leave anyway', async ({ page }) => {
    await installWebhookMocks(page);
    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const panel = await openWebhookSetup(page);
    const keyIdInput = panel.getByLabel(/^Key ID$/);
    await expect(keyIdInput).toHaveValue('KEY-PRIMARY');
    await keyIdInput.fill('DIRTY-KEY-ID');

    page.once('dialog', async (dialog) => {
        expect(dialog.message()).toMatch(/discard unsaved apple webhook changes/i);
        await dialog.dismiss();
    });
    await page.locator(`[data-app-id="${smokeEnv.seed.accountsTargetApp.id}"]`).click();

    await expect(page.getByTestId('active-app-pill')).toContainText(smokeEnv.seed.primaryApp.alias.toUpperCase());
    await expect(keyIdInput).toHaveValue('DIRTY-KEY-ID');

    page.once('dialog', async (dialog) => {
        await dialog.accept();
    });
    await switchToApp(page, smokeEnv.seed.accountsTargetApp.id, smokeEnv.seed.accountsTargetApp.alias);
    await switchToApp(page, smokeEnv.seed.primaryApp.id, smokeEnv.seed.primaryApp.alias);

    await expect(panel.getByLabel(/^Key ID$/)).toHaveValue('KEY-PRIMARY');
});
