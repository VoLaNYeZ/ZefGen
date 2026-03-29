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
        brand_id: smokeEnv.seed.brand.id,
        kind: 'idea_generation',
        status: 'waiting_for_user',
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
        summary: 'Waiting for category confirmation',
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

test('idea generator keeps typed guidance when confirming selected categories', async ({ page }) => {
    await gotoWorkspace(page);

    const jobId = smokeJobId(201);
    const questionId = 'runner-question-1';
    let capturedAnswerContent: string | null = null;

    const connectorJob = buildConnectorJobRow({
        id: jobId,
        brand_id: smokeEnv.seed.brand.id,
        created_at: isoAt(-2),
        updated_at: isoAt(-1),
        started_at: isoAt(-2),
        heartbeat_at: isoAt(-1),
    });

    const messages: Array<Record<string, unknown>> = [
        {
            id: questionId,
            job_id: jobId,
            user_id: 'smoke-user',
            role: 'runner',
            kind: 'question',
            in_reply_to: null,
            content: 'Confirm categories and add extra guidance if needed.',
            options: [
                { slug: 'utilities', label: 'Utilities', reason: 'Matches practical app ideas.', confidence: 0.92 },
                { slug: 'productivity', label: 'Productivity', reason: 'Fits the existing brand context.', confidence: 0.81 },
            ],
            created_at: isoAt(-1),
        },
    ];

    await page.route('**/rest/v1/connector_jobs*', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([connectorJob]),
        });
    });

    await page.route('**/rest/v1/connector_job_messages*', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(messages),
            });
            return;
        }

        if (method === 'POST') {
            const rawBody = readRequestJson(route.request()) as Record<string, unknown> | Record<string, unknown>[] | null;
            const payload = Array.isArray(rawBody) ? rawBody[0] ?? {} : rawBody ?? {};
            capturedAnswerContent = typeof payload.content === 'string' ? payload.content : null;

            const created = {
                id: 'runner-answer-1',
                job_id: jobId,
                user_id: String(payload.user_id ?? 'smoke-user'),
                role: 'user',
                kind: 'answer',
                in_reply_to: String(payload.in_reply_to ?? questionId),
                content: capturedAnswerContent || '',
                options: null,
                created_at: isoAt(),
            };
            messages.push(created);

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

    await expect(page.getByText('Confirm categories and add extra guidance if needed.')).toBeVisible();

    const guidance =
        'Bias toward offline-friendly utilities and keep the onboarding simple for the first release.';
    await page
        .getByPlaceholder('Type the answer you want to send back to the runner.')
        .fill(guidance);

    const sendSelectedButton = page.getByRole('button', { name: 'Send selected categories' });
    await expect(sendSelectedButton).toBeEnabled();
    await sendSelectedButton.click();

    await expect.poll(() => capturedAnswerContent).not.toBeNull();

    const parsed = JSON.parse(String(capturedAnswerContent));
    expect(parsed.action).toBe('confirm_categories');
    expect(parsed.confirmed_category_ids).toHaveLength(2);
    expect([...(parsed.confirmed_category_slugs as string[])].sort()).toEqual(['productivity', 'utilities']);
    expect(parsed.user_guidance).toBe(guidance);
});
