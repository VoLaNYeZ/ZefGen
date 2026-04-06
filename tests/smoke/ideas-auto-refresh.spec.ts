import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { gotoWorkspace, openIdeas, smokeEnv } from './support/helpers';

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

type AppIdeaRow = {
    id: string;
    user_id: string;
    brand_id: string | null;
    category_id: string;
    idea_source: string;
    status: string;
    title: string;
    description: string;
    client_spec_current: string;
    alternate_names: string[];
    idea_family_id: string | null;
    version_index: number;
    spec_revision_index: number;
    parent_idea_id: string | null;
    last_generated_output_id: string | null;
    edited_after_generation: boolean;
    memory_fingerprint: string | null;
    updated_at: string;
    created_at: string;
};

const isoAt = (minuteOffset = 0) => new Date(Date.now() + minuteOffset * 60_000).toISOString();
const smokeJobId = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const smokeIdeaId = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const buildConnectorJobRow = (overrides: Partial<ConnectorJobRow> = {}): ConnectorJobRow => {
    const now = isoAt();
    return {
        id: smokeJobId(1),
        user_id: 'smoke-user',
        app_id: null,
        brand_id: smokeEnv.seed.brand.id,
        kind: 'idea_generation',
        status: 'running',
        requested_by: null,
        input: {},
        repo_full_name: '',
        base_branch: 'main',
        work_branch: null,
        result_commit_sha: null,
        pr_url: null,
        pr_number: null,
        verify_status: null,
        verify_tail: null,
        summary: 'Generating ideas...',
        claimed_by: 'runner',
        claimed_at: now,
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

const buildIdeaRow = (overrides: Partial<AppIdeaRow> = {}): AppIdeaRow => {
    const now = isoAt();
    const description = String(overrides.description ?? 'Generated idea description');
    return {
        id: smokeIdeaId(1),
        user_id: 'smoke-user',
        brand_id: smokeEnv.seed.brand.id,
        category_id: smokeEnv.seed.category.id,
        idea_source: 'generated',
        status: 'generated',
        title: 'Generated idea',
        description,
        client_spec_current: String(overrides.client_spec_current ?? description),
        alternate_names: [],
        idea_family_id: null,
        version_index: 1,
        spec_revision_index: 1,
        parent_idea_id: null,
        last_generated_output_id: null,
        edited_after_generation: false,
        memory_fingerprint: null,
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

const routeEmptyIdeaAssignments = async (page: Page) => {
    await page.route('**/rest/v1/connector_app_configs*', async (route) => {
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
};

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('generated ideas appear during an active idea-generation run without forcing page-level loading', async ({ page }) => {
    await gotoWorkspace(page);

    let appIdeasRequestCount = 0;
    const progressiveIdea = buildIdeaRow({
        id: smokeIdeaId(401),
        title: 'Progressive Runner Idea',
        description: 'Appears while the runner is still active.',
        client_spec_current: 'Appears while the runner is still active.',
        updated_at: isoAt(1),
        created_at: isoAt(1),
    });

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                buildConnectorJobRow({
                    id: smokeJobId(401),
                    brand_id: smokeEnv.seed.brand.id,
                    status: 'running',
                    summary: 'Generating ideas...',
                    created_at: isoAt(-2),
                    updated_at: isoAt(-1),
                    started_at: isoAt(-2),
                    heartbeat_at: isoAt(-1),
                }),
            ]),
        });
    });

    await routeEmptyIdeaAssignments(page);

    await page.route('**/rest/v1/app_ideas*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        appIdeasRequestCount += 1;

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(appIdeasRequestCount >= 3 ? [progressiveIdea] : []),
        });
    });

    await openIdeas(page);

    const ideasRoot = page.getByTestId('ideas-page-root');
    const refreshButton = ideasRoot.getByRole('button', { name: /^refresh$/i }).first();
    const newIdeaButton = ideasRoot.getByRole('button', { name: /^new idea$/i }).first();

    await expect(refreshButton).toBeEnabled();
    await expect(newIdeaButton).toBeEnabled();
    await expect(refreshButton.locator('svg.animate-spin')).toHaveCount(0);

    await expect
        .poll(() => appIdeasRequestCount, {
            timeout: 10_000,
            message: 'Expected background idea refreshes while the job stays active',
        })
        .toBeGreaterThanOrEqual(3);

    await expect(ideasRoot.locator('input[value="Progressive Runner Idea"]')).toBeVisible();
    await expect(refreshButton).toBeEnabled();
    await expect(newIdeaButton).toBeEnabled();
    await expect(refreshButton.locator('svg.animate-spin')).toHaveCount(0);
});

test('ideas page queues one final sync when success lands during an in-flight idea refresh', async ({ page }) => {
    await gotoWorkspace(page);

    let connectorJobRequestCount = 0;
    let appIdeasRequestCount = 0;
    let latestJobStatus = 'running';
    const finalIdea = buildIdeaRow({
        id: smokeIdeaId(402),
        title: 'Final Sync Idea',
        description: 'Appears only after the job reaches succeeded.',
        client_spec_current: 'Appears only after the job reaches succeeded.',
        updated_at: isoAt(2),
        created_at: isoAt(2),
    });

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        connectorJobRequestCount += 1;
        latestJobStatus = connectorJobRequestCount >= 3 ? 'succeeded' : 'running';

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                buildConnectorJobRow({
                    id: smokeJobId(402),
                    brand_id: smokeEnv.seed.brand.id,
                    status: latestJobStatus,
                    summary: latestJobStatus === 'succeeded' ? 'Generated 1 idea.' : 'Generating ideas...',
                    created_at: isoAt(-3),
                    updated_at: isoAt(connectorJobRequestCount),
                    started_at: isoAt(-3),
                    heartbeat_at: latestJobStatus === 'succeeded' ? isoAt() : isoAt(-1),
                    ended_at: latestJobStatus === 'succeeded' ? isoAt() : null,
                }),
            ]),
        });
    });

    await routeEmptyIdeaAssignments(page);

    await page.route('**/rest/v1/app_ideas*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        appIdeasRequestCount += 1;

        if (appIdeasRequestCount === 2) {
            const staleBody = JSON.stringify([]);
            await new Promise((resolve) => setTimeout(resolve, 3500));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: staleBody,
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(latestJobStatus === 'succeeded' ? [finalIdea] : []),
        });
    });

    await openIdeas(page);

    const ideasRoot = page.getByTestId('ideas-page-root');
    await expect(ideasRoot.locator('input[value="Final Sync Idea"]')).toHaveCount(0);

    await expect
        .poll(() => connectorJobRequestCount, {
            timeout: 6_000,
            message: 'Expected connector job polling to observe the terminal succeeded state',
        })
        .toBeGreaterThanOrEqual(2);

    await expect
        .poll(() => appIdeasRequestCount, {
            timeout: 5_500,
            message: 'Expected a queued follow-up ideas refresh after the stale in-flight poll completed',
        })
        .toBeGreaterThanOrEqual(3);

    await expect(ideasRoot.locator('input[value="Final Sync Idea"]')).toBeVisible();
});

test('stale background idea refreshes do not overwrite a newly created idea row', async ({ page }) => {
    await gotoWorkspace(page);

    let appIdeasRequestCount = 0;
    let staleRefreshResolved = false;
    let createdIdea: AppIdeaRow | null = null;
    const createdTitle = 'Local Create Idea';
    const createdDescription = 'Created while a stale background ideas refresh is in flight.';

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                buildConnectorJobRow({
                    id: smokeJobId(403),
                    brand_id: smokeEnv.seed.brand.id,
                    status: 'running',
                    summary: 'Generating ideas...',
                    created_at: isoAt(-2),
                    updated_at: isoAt(-1),
                    started_at: isoAt(-2),
                    heartbeat_at: isoAt(-1),
                }),
            ]),
        });
    });

    await routeEmptyIdeaAssignments(page);

    await page.route('**/rest/v1/app_ideas*', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            appIdeasRequestCount += 1;

            if (appIdeasRequestCount === 2) {
                const staleBody = JSON.stringify([]);
                await new Promise((resolve) => setTimeout(resolve, 3500));
                staleRefreshResolved = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: staleBody,
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(createdIdea ? [createdIdea] : []),
            });
            return;
        }

        if (method === 'POST') {
            const rawBody = readRequestJson(route.request()) as Record<string, unknown> | Record<string, unknown>[] | null;
            const payload = Array.isArray(rawBody) ? rawBody[0] ?? {} : rawBody ?? {};
            const now = isoAt();
            createdIdea = buildIdeaRow({
                id: smokeIdeaId(403),
                brand_id: typeof payload.brand_id === 'string' ? payload.brand_id : smokeEnv.seed.brand.id,
                category_id: typeof payload.category_id === 'string' ? payload.category_id : smokeEnv.seed.category.id,
                idea_source: typeof payload.idea_source === 'string' ? payload.idea_source : 'manual',
                status: typeof payload.status === 'string' ? payload.status : 'generated',
                title: typeof payload.title === 'string' ? payload.title : createdTitle,
                description: typeof payload.description === 'string' ? payload.description : createdDescription,
                client_spec_current:
                    typeof payload.client_spec_current === 'string'
                        ? payload.client_spec_current
                        : typeof payload.description === 'string'
                          ? payload.description
                          : createdDescription,
                updated_at: now,
                created_at: now,
            });

            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(createdIdea),
            });
            return;
        }

        await route.continue();
    });

    await openIdeas(page);

    await expect
        .poll(() => appIdeasRequestCount, {
            timeout: 3_000,
            message: 'Expected the first delayed background ideas refresh to start',
        })
        .toBeGreaterThanOrEqual(2);

    const ideasRoot = page.getByTestId('ideas-page-root');
    await ideasRoot.getByRole('button', { name: /^new idea$/i }).first().click();

    const newRow = page.locator('#idea-row-new');
    await newRow.locator('input').fill(createdTitle);
    await newRow.locator('textarea').fill(createdDescription);
    await newRow.locator('button').first().click();

    await expect(ideasRoot.locator(`input[value="${createdTitle}"]`)).toBeVisible();

    await expect
        .poll(() => staleRefreshResolved, {
            timeout: 5_000,
            message: 'Expected the stale in-flight ideas refresh to complete after the local create',
        })
        .toBe(true);

    await expect(ideasRoot.locator(`input[value="${createdTitle}"]`)).toBeVisible();
});
