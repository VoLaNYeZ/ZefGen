import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace, smokeEnv } from './support/helpers';

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

type ConnectorJobMessageRow = {
    id: string;
    job_id: string;
    user_id: string;
    role: 'runner' | 'user' | 'system';
    kind: 'log' | 'question' | 'answer';
    in_reply_to: string | null;
    content: string;
    options: null;
    created_at: string;
};

const isoAt = (minuteOffset = 0) => new Date(Date.now() + minuteOffset * 60_000).toISOString();
const smokeJobId = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const buildConnectorJobRow = (overrides: Partial<ConnectorJobRow> = {}): ConnectorJobRow => {
    const now = isoAt();
    return {
        id: smokeJobId(1),
        user_id: 'smoke-user',
        app_id: smokeEnv.seed.primaryApp.id,
        brand_id: smokeEnv.seed.brand.id,
        kind: 'generate',
        status: 'succeeded',
        requested_by: null,
        input: {},
        repo_full_name: 'example/smoke-primary',
        base_branch: 'main',
        work_branch: null,
        result_commit_sha: 'abc123',
        pr_url: null,
        pr_number: null,
        verify_status: 'pass',
        verify_tail: null,
        summary: 'Smoke runner summary.',
        claimed_by: null,
        claimed_at: null,
        started_at: now,
        heartbeat_at: now,
        ended_at: now,
        cancel_requested_at: null,
        error: null,
        updated_at: now,
        created_at: now,
        ...overrides,
    };
};

const buildConnectorJobMessageRow = (jobId: string, content: string, suffix: number): ConnectorJobMessageRow => ({
    id: `msg-${suffix}`,
    job_id: jobId,
    user_id: 'smoke-user',
    role: 'runner',
    kind: 'log',
    in_reply_to: null,
    content,
    options: null,
    created_at: isoAt(suffix),
});

const switchToApp = async (page: Page, appId: string, alias: string) => {
    await page.locator(`[data-app-id="${appId}"]`).click();
    await expect(page.getByTestId('active-app-pill')).toContainText(alias.toUpperCase());
};

test('runner and integration reuse cached execution state without duplicate refetches', async ({ page }) => {
    const primaryJob = buildConnectorJobRow({
        id: smokeJobId(11),
        app_id: smokeEnv.seed.primaryApp.id,
        repo_full_name: 'example/smoke-primary',
    });
    const secondaryJob = buildConnectorJobRow({
        id: smokeJobId(22),
        app_id: smokeEnv.seed.accountsTargetApp.id,
        repo_full_name: 'example/smoke-secondary',
        kind: 'fix',
        status: 'failed',
        verify_status: 'fail',
        error: 'Smoke secondary failure.',
        result_commit_sha: null,
    });

    const jobsByAppId = new Map<string, ConnectorJobRow[]>([
        [smokeEnv.seed.primaryApp.id, [primaryJob]],
        [smokeEnv.seed.accountsTargetApp.id, [secondaryJob]],
    ]);
    const messagesByJobId = new Map<string, ConnectorJobMessageRow[]>([
        [primaryJob.id, [buildConnectorJobMessageRow(primaryJob.id, 'Primary smoke log line', 1)]],
        [secondaryJob.id, [buildConnectorJobMessageRow(secondaryJob.id, 'Secondary smoke log line', 2)]],
    ]);
    const jobRequestCountByAppId = new Map<string, number>();
    const messageRequestCountByJobId = new Map<string, number>();
    const artifactRequestCountByJobId = new Map<string, number>();

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }
        const requestUrl = new URL(route.request().url());
        const appId = String(requestUrl.searchParams.get('app_id') || '').replace(/^eq\./, '').trim();
        jobRequestCountByAppId.set(appId, (jobRequestCountByAppId.get(appId) || 0) + 1);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(jobsByAppId.get(appId) || []),
        });
    });

    await page.route('**/rest/v1/connector_job_messages*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const jobId = String(requestUrl.searchParams.get('job_id') || '').replace(/^eq\./, '').trim();
        messageRequestCountByJobId.set(jobId, (messageRequestCountByJobId.get(jobId) || 0) + 1);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(messagesByJobId.get(jobId) || []),
        });
    });

    await page.route('**/rest/v1/connector_job_artifacts*', async (route) => {
        const requestUrl = new URL(route.request().url());
        const jobId = String(requestUrl.searchParams.get('job_id') || '').replace(/^eq\./, '').trim();
        artifactRequestCountByJobId.set(jobId, (artifactRequestCountByJobId.get(jobId) || 0) + 1);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
        });
    });

    await gotoWorkspace(page);
    await claimWorkspaceEditLockIfPrompted(page);

    const runnerPanel = page.getByTestId('workspace-panel-runner');
    await expect(runnerPanel.getByTestId('runner-selected-job-status')).toHaveText(/^succeeded$/i);
    await expect(runnerPanel.getByRole('button', { name: /^refresh$/i })).toBeVisible();

    await expect.poll(() => jobRequestCountByAppId.get(smokeEnv.seed.primaryApp.id) || 0).toBe(1);
    await expect.poll(() => messageRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);
    await expect.poll(() => artifactRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);

    await switchToApp(page, smokeEnv.seed.accountsTargetApp.id, smokeEnv.seed.accountsTargetApp.alias);
    await expect(runnerPanel.getByTestId('runner-selected-job-status')).toHaveText(/^failed$/i);

    await expect.poll(() => jobRequestCountByAppId.get(smokeEnv.seed.accountsTargetApp.id) || 0).toBe(1);
    await expect.poll(() => messageRequestCountByJobId.get(secondaryJob.id) || 0).toBe(1);
    await expect.poll(() => artifactRequestCountByJobId.get(secondaryJob.id) || 0).toBe(1);

    await switchToApp(page, smokeEnv.seed.primaryApp.id, smokeEnv.seed.primaryApp.alias);
    await expect(runnerPanel.getByTestId('runner-selected-job-status')).toHaveText(/^succeeded$/i);
    await expect(runnerPanel.getByRole('button', { name: /^refresh$/i })).toBeVisible();

    await expect.poll(() => jobRequestCountByAppId.get(smokeEnv.seed.primaryApp.id) || 0).toBe(1);
    await expect.poll(() => messageRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);
    await expect.poll(() => artifactRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);

    await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(200);

    await expect.poll(() => jobRequestCountByAppId.get(smokeEnv.seed.primaryApp.id) || 0).toBe(1);
    await expect.poll(() => messageRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);
    await expect.poll(() => artifactRequestCountByJobId.get(primaryJob.id) || 0).toBe(1);
});
