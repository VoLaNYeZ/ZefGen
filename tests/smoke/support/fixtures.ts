import { test as base, expect } from '@playwright/test';
import { ensureSmokeBackendSanity } from './backend';
import { loadSmokeEnv } from './smoke-env';

const formatPageError = (error: Error) => {
    const stack = error.stack ? `\n${error.stack}` : '';
    return `[pageerror] ${error.message}${stack}`;
};

const smokeEnv = loadSmokeEnv();
const githubMainShaByAppId = new Map<string, string>([
    [smokeEnv.seed.primaryApp.id, 'abc123'],
    [smokeEnv.seed.accountsTargetApp.id, 'def456'],
    [smokeEnv.seed.noBrandCompletedApp.id, 'abc123'],
]);

export const test = base.extend<{
    _browserGuards: void;
    _smokeBackendSanity: void;
    allowedConsoleErrors: RegExp[];
}>({
    allowedConsoleErrors: [[], { option: true }],
    _smokeBackendSanity: [
        async ({}, use) => {
            await ensureSmokeBackendSanity();
            await use();
        },
        { auto: true },
    ],
    _browserGuards: [
        async ({ page, allowedConsoleErrors }, use, testInfo) => {
            const failures: string[] = [];

            await page.route('**/api/github-main-head', async (route) => {
                const appId = (() => {
                    try {
                        const payload = route.request().postDataJSON() as Record<string, unknown> | null;
                        return String(payload?.appId || '').trim();
                    } catch {
                        return '';
                    }
                })();
                const sha = githubMainShaByAppId.get(appId) || 'abc123';
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        branch: 'main',
                        repoFullName: 'example/smoke-primary',
                        sha,
                    }),
                });
            });

            const onPageError = (error: Error) => {
                failures.push(formatPageError(error));
            };

            const onConsole = (msg: { type(): string; text(): string }) => {
                if (msg.type() !== 'error') return;
                if (allowedConsoleErrors.some((pattern) => pattern.test(msg.text()))) return;
                failures.push(`[console.error] ${msg.text()}`);
            };

            const onRequestFailed = (request: {
                isNavigationRequest(): boolean;
                method(): string;
                url(): string;
                failure(): { errorText?: string } | null;
            }) => {
                if (!request.isNavigationRequest()) return;
                failures.push(
                    `[navigation-failed] ${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`
                );
            };

            page.on('pageerror', onPageError);
            page.on('console', onConsole);
            page.on('requestfailed', onRequestFailed);

            await use();

            page.off('pageerror', onPageError);
            page.off('console', onConsole);
            page.off('requestfailed', onRequestFailed);

            if (failures.length === 0) return;

            await testInfo.attach('browser-failures.txt', {
                body: failures.join('\n\n'),
                contentType: 'text/plain',
            });
            throw new Error(`Unexpected browser failures:\n\n${failures.join('\n\n')}`);
        },
        { auto: true },
    ],
});

export { expect };
