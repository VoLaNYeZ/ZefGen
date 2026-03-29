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

const isoAt = (minuteOffset = 0) => new Date(Date.now() + minuteOffset * 60_000).toISOString();
const smokeJobId = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const buildConnectorJobRow = (overrides: Partial<ConnectorJobRow> = {}): ConnectorJobRow => {
    const now = isoAt();
    return {
        id: smokeJobId(1),
        user_id: 'smoke-user',
        app_id: null,
        brand_id: smokeEnv.seed.noBrand.id,
        kind: 'idea_generation',
        status: 'queued',
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

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('idea generator queues untouched current category selection as final confirmed categories on initial create', async ({ page }) => {
    await gotoWorkspace(page);

    let rows: ConnectorJobRow[] = [];
    let capturedCreateInput: Record<string, unknown> | null = null;

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(rows),
            });
            return;
        }

        if (method === 'POST') {
            const rawBody = readRequestJson(route.request()) as Record<string, unknown> | Record<string, unknown>[] | null;
            const payload = Array.isArray(rawBody) ? rawBody[0] ?? {} : rawBody ?? {};
            capturedCreateInput =
                payload.input && typeof payload.input === 'object' && !Array.isArray(payload.input)
                    ? (payload.input as Record<string, unknown>)
                    : null;

            const created = buildConnectorJobRow({
                id: smokeJobId(301),
                user_id: String(payload.user_id ?? 'smoke-user'),
                brand_id: typeof payload.brand_id === 'string' ? payload.brand_id : smokeEnv.seed.noBrand.id,
                input: capturedCreateInput || {},
            });
            rows = [created];

            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(created),
            });
            return;
        }

        await route.continue();
    });

    await openIdeas(page);

    const generatorScopeSelect = page.getByTestId('ideas-generator-scope-select');
    await generatorScopeSelect.selectOption({ label: 'No Brand' });
    await expect(generatorScopeSelect).toHaveValue(smokeEnv.seed.noBrand.id);
    const countInput = page.getByTestId('ideas-generator-count-input');
    await countInput.fill('1');
    await countInput.blur();
    await expect(countInput).toHaveValue('3');
    await expect(page.getByTestId('ideas-generator-mix-value')).toHaveText('1 / 1 / 1');
    await page.getByTestId('ideas-generator-count-input').fill('5');
    await expect(page.getByTestId('ideas-generator-count-input')).toHaveValue('5');
    await expect(page.getByTestId('ideas-generator-mix-value')).toHaveText('2 / 2 / 1');
    await expect(page.getByText('40% safe / 30% balanced / 30% wild')).toBeVisible();

    const guidance =
        'Prefer offline-friendly utility apps for busy parents. Avoid finance, crypto, and AI-wrapper ideas.';
    await page.getByTestId('ideas-generator-guidance').fill(guidance);

    await page.getByRole('button', { name: 'Generate idea specs' }).click();

    await expect.poll(() => capturedCreateInput).not.toBeNull();

    expect(capturedCreateInput?.count).toBe(5);
    expect(capturedCreateInput?.creativity_mix).toEqual({
        safe: 2,
        balanced: 2,
        wild: 1,
    });
    expect(Array.isArray(capturedCreateInput?.confirmed_category_ids)).toBe(true);
    expect((capturedCreateInput?.confirmed_category_ids as unknown[]).length).toBeGreaterThan(0);
    expect(capturedCreateInput?.category_confirmation_required).toBe(false);
    expect(capturedCreateInput?.user_guidance).toBe(guidance);
    expect(capturedCreateInput?.operator_seed_category_ids).toBeUndefined();
    expect(capturedCreateInput?.operator_seed_categories).toBeUndefined();
    expect(capturedCreateInput?.suggested_category_ids).toEqual([]);
});
