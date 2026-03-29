import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';
const PROJECT_ROOT = process.cwd();
const AUTH_FILE = path.join(PROJECT_ROOT, 'playwright', '.auth', 'smoke-user.json');
const SMOKE_ENV_FILE = path.join(PROJECT_ROOT, 'playwright', '.tmp', 'smoke-env.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'help');
const VIEWPORT = { width: 1600, height: 1160 };
const DEVICE_SCALE_FACTOR = 2;
const SMOKE_DEVICE_ID_KEY = 'zefgen.deviceId';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const logStep = (message) => console.log(`[capture-help] ${message}`);

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};

const getViewportSize = (page) => {
    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error('Viewport size is not available.');
    }
    return viewport;
};

const clampClip = (page, clip) => {
    const viewport = getViewportSize(page);
    const x = Math.max(0, Math.floor(clip.x));
    const y = Math.max(0, Math.floor(clip.y));
    const width = Math.min(viewport.width - x, Math.ceil(clip.width));
    const height = Math.min(viewport.height - y, Math.ceil(clip.height));

    if (width <= 0 || height <= 0) {
        throw new Error(`Invalid clip after clamping: ${JSON.stringify({ x, y, width, height })}`);
    }

    return { x, y, width, height };
};

const getVisibleBox = async (locator, label) => {
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`Could not resolve bounding box for ${label}.`);
    }
    return box;
};

const captureElementCrop = async (page, locator, outputName, options = {}) => {
    const {
        padding = 16,
        maxHeight = Number.POSITIVE_INFINITY,
        maxWidth = Number.POSITIVE_INFINITY,
        minHeight = 0,
    } = options;

    await locator.scrollIntoViewIfNeeded();
    await sleep(250);

    const box = await getVisibleBox(locator, outputName);
    const clip = clampClip(page, {
        x: box.x - padding,
        y: box.y - padding,
        width: Math.min(box.width + padding * 2, maxWidth),
        height: Math.max(minHeight, Math.min(box.height + padding * 2, maxHeight)),
    });

    await page.screenshot({
        path: path.join(OUTPUT_DIR, outputName),
        clip,
        animations: 'disabled',
        caret: 'hide',
    });
};

const captureUnionCrop = async (page, locators, outputName, options = {}) => {
    const {
        padding = 16,
        maxHeight = Number.POSITIVE_INFINITY,
        maxWidth = Number.POSITIVE_INFINITY,
    } = options;

    await locators[0].scrollIntoViewIfNeeded();
    await sleep(250);

    const boxes = await Promise.all(locators.map((locator, index) => getVisibleBox(locator, `${outputName}:${index}`)));
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));

    const clip = clampClip(page, {
        x: left - padding,
        y: top - padding,
        width: Math.min(right - left + padding * 2, maxWidth),
        height: Math.min(bottom - top + padding * 2, maxHeight),
    });

    await page.screenshot({
        path: path.join(OUTPUT_DIR, outputName),
        clip,
        animations: 'disabled',
        caret: 'hide',
    });
};

const captureViewport = async (page, outputName, options = {}) => {
    const { clip } = options;
    const screenshotOptions = {
        path: path.join(OUTPUT_DIR, outputName),
        animations: 'disabled',
        caret: 'hide',
    };

    if (clip) {
        screenshotOptions.clip = clampClip(page, clip);
    }

    await page.screenshot(screenshotOptions);
};

const applyCaptureStyles = async (page) => {
    await page.addStyleTag({
        content: `
            [data-testid="generation-queue-widget"] { display: none !important; }
            [data-testid="workspace-switch-overlay"] { display: none !important; }
            * { caret-color: transparent !important; }
        `,
    });
};

const gotoRoute = async (page, route) => {
    const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) {
        throw new Error(`Route ${route} failed to load (${response?.status() ?? 'no-response'}).`);
    }
};

const waitForAuthResolution = async (page) => {
    return Promise.any([
        page
            .getByTestId('app-shell-root')
            .waitFor({ state: 'visible', timeout: 6000 })
            .then(() => 'shell'),
        page
            .getByLabel('Email')
            .waitFor({ state: 'visible', timeout: 6000 })
            .then(() => 'login'),
    ]);
};

const ensureAuthenticated = async (page, smokeEnv) => {
    await gotoRoute(page, smokeEnv.seed.routes.workspace);
    const state = await waitForAuthResolution(page).catch(() => null);
    if (state === 'shell') return;

    const emailField = page.getByLabel('Email');
    await emailField.fill(smokeEnv.credentials.email);
    await page.getByLabel('Password').fill(smokeEnv.credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByTestId('app-shell-root').waitFor({ state: 'visible', timeout: 15000 });
    await gotoRoute(page, smokeEnv.seed.routes.workspace);
    await page.getByTestId('workspace-page-root').waitFor({ state: 'visible', timeout: 15000 });
    await page.context().storageState({ path: AUTH_FILE });
};

const setRussianUi = async (page) => {
    const sidebar = page.getByTestId('brand-sidebar');
    const ruButton = sidebar.getByRole('button', { name: /^RU$/ });
    if (await ruButton.isVisible().catch(() => false)) {
        await ruButton.click();
        await sleep(250);
    }
};

const claimWorkspaceEditLockIfPrompted = async (page) => {
    const takeOverEditingButton = page.getByRole('button', { name: /^Take over editing$/ });
    if (!(await takeOverEditingButton.count())) return;
    if (!(await takeOverEditingButton.first().isVisible().catch(() => false))) return;

    await takeOverEditingButton.first().click();
    await page.getByRole('button', { name: /^Take over editing$/ }).waitFor({ state: 'hidden', timeout: 7000 });
};

const scrollMainToTop = async (page) => {
    const scroller = page.locator('main .flex-1.overflow-y-auto').first();
    if (!(await scroller.count())) return;
    await scroller.evaluate((element) => {
        element.scrollTop = 0;
        element.dispatchEvent(new Event('scroll'));
    });
    await sleep(150);
};

const openWebhookSetup = async (page) => {
    const webhookPanel = page.getByTestId('workspace-panel-app-review-webhook');
    const buttons = webhookPanel.getByRole('button');
    const count = await buttons.count();
    if (count === 0) return;
    await buttons.nth(count - 1).click();
    await sleep(250);
};

const installWorkspaceSessionsMock = async (context, state) => {
    await context.route('**/api/workspace-sessions', async (route) => {
        let payload = null;
        try {
            payload = route.request().postDataJSON();
        } catch {
            payload = null;
        }

        const requestPayload = (payload && typeof payload === 'object' ? payload : {}) || {};
        const action = String(requestPayload.action || '');
        const clientDeviceId = String(requestPayload.clientDeviceId || '').trim();
        const brandId =
            typeof requestPayload.brandId === 'string' && requestPayload.brandId.trim()
                ? requestPayload.brandId.trim()
                : null;

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

const captureWorkspaceShots = async (page, smokeEnv) => {
    logStep('workspace route');
    await gotoRoute(page, smokeEnv.seed.routes.workspace);
    await page.getByTestId('workspace-page-root').waitFor({ state: 'visible' });
    await applyCaptureStyles(page);
    await claimWorkspaceEditLockIfPrompted(page);
    await setRussianUi(page);
    await scrollMainToTop(page);

    logStep('overview');
    await captureViewport(page, 'overview.png', {
        clip: { x: 20, y: 92, width: 1540, height: 868 },
    });

    logStep('navigation');
    await captureElementCrop(page, page.getByTestId('brand-sidebar'), 'navigation.png', {
        padding: 12,
        maxHeight: 940,
    });

    logStep('brands-and-apps');
    await captureElementCrop(page, page.getByTestId('workspace-panel-brand-release-info'), 'brands-and-apps.png', {
        padding: 16,
        maxHeight: 560,
    });

    logStep('selected-app-setup');
    await openWebhookSetup(page);
    await captureUnionCrop(
        page,
        [page.getByTestId('workspace-panel-appstore-link'), page.getByTestId('workspace-panel-app-review-webhook')],
        'selected-app-setup.png',
        { padding: 16, maxHeight: 720 }
    );

    logStep('step-1-icon');
    await captureElementCrop(page, page.getByTestId('workspace-panel-icon'), 'step-1-icon.png', {
        padding: 16,
        maxHeight: 420,
    });
    logStep('step-2-client-spec');
    await captureElementCrop(page, page.getByTestId('workspace-panel-client-spec'), 'step-2-client-spec.png', {
        padding: 16,
        maxHeight: 420,
    });
    logStep('step-3-setup-data');
    await captureElementCrop(page, page.getByTestId('workspace-panel-variables-secrets'), 'step-3-setup-data.png', {
        padding: 16,
        maxHeight: 560,
    });
    logStep('step-4-dev-files');
    await captureElementCrop(page, page.getByTestId('workspace-panel-dev-files'), 'step-4-dev-files.png', {
        padding: 16,
        maxHeight: 420,
    });
    logStep('step-5-development');
    await captureElementCrop(page, page.getByTestId('workspace-panel-runner'), 'step-5-development.png', {
        padding: 16,
        maxHeight: 560,
    });
    logStep('step-6-integration');
    await captureElementCrop(page, page.getByTestId('workspace-panel-integration'), 'step-6-integration.png', {
        padding: 16,
        maxHeight: 500,
    });
    logStep('step-8-simulator');
    await captureElementCrop(page, page.getByTestId('workspace-panel-simulator'), 'step-8-simulator-screenshots.png', {
        padding: 16,
        maxHeight: 500,
    });
    logStep('step-9-screenshot-prompts');
    await captureElementCrop(
        page,
        page.getByTestId('workspace-panel-screenshot-prompts'),
        'step-9-screenshot-prompts.png',
        {
            padding: 16,
            maxHeight: 560,
        }
    );
    logStep('step-10-generated-screenshots');
    await captureElementCrop(
        page,
        page.getByTestId('workspace-panel-generated-screenshots'),
        'step-10-generated-screenshots.png',
        {
            padding: 16,
            maxHeight: 560,
        }
    );

    logStep('deliverables-export');
    const scroller = page.locator('main .flex-1.overflow-y-auto').first();
    const simulatorPanel = page.getByTestId('workspace-panel-simulator');
    const rail = page.getByTestId('workspace-deliverables-rail');
    await simulatorPanel.scrollIntoViewIfNeeded();
    await sleep(150);

    let railState = { opacity: 0, top: 999 };
    for (let index = 0; index < 8; index += 1) {
        railState = await rail.evaluate((element) => ({
            opacity: Number(getComputedStyle(element).opacity || '0'),
            top: Math.round(element.getBoundingClientRect().top),
        }));
        if (railState.opacity > 0.9 && railState.top <= 140) break;
        await scroller.evaluate((element) => {
            element.scrollTop += 120;
            element.dispatchEvent(new Event('scroll'));
        });
        await sleep(180);
    }
    await captureElementCrop(page, rail, 'deliverables-export.png', {
        padding: 12,
        maxHeight: 520,
    });
};

const captureAccountsShot = async (page, smokeEnv) => {
    logStep('accounts route');
    await gotoRoute(page, smokeEnv.seed.routes.accounts);
    await page.getByTestId('accounts-page-root').waitFor({ state: 'visible' });
    await applyCaptureStyles(page);
    await setRussianUi(page);
    await captureElementCrop(page, page.getByTestId('accounts-page-root'), 'accounts.png', {
        padding: 16,
        maxHeight: 640,
    });
};

const captureIdeasShot = async (page, smokeEnv) => {
    logStep('ideas route');
    await gotoRoute(page, smokeEnv.seed.routes.ideas);
    await page.getByTestId('ideas-page-root').waitFor({ state: 'visible' });
    await applyCaptureStyles(page);
    await setRussianUi(page);
    await captureElementCrop(page, page.getByTestId('ideas-page-root'), 'ideas.png', {
        padding: 16,
        maxHeight: 640,
    });
};

const captureNoBrandShot = async (page, smokeEnv) => {
    logStep('no-brand route');
    await gotoRoute(page, smokeEnv.seed.routes.noBrandCollapsedWorkspace);
    await page.getByTestId('workspace-panel-no-brand-move').waitFor({ state: 'visible' });
    await applyCaptureStyles(page);
    await setRussianUi(page);
    await captureElementCrop(page, page.getByTestId('workspace-panel-no-brand-move'), 'no-brand-flow.png', {
        padding: 16,
        maxHeight: 520,
    });
};

const captureCollaborationShot = async (browser, smokeEnv) => {
    logStep('collaboration route');
    const context = await browser.newContext({
        storageState: AUTH_FILE,
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    const sessionState = {
        activeSessionCountries: ['us', 'de'],
        brandId: smokeEnv.seed.brand.id,
        claimCalls: 0,
        failTakeOverForDeviceId: null,
        ownerDeviceId: 'smoke-help-other-device',
        seenDeviceIds: new Set(['smoke-help-other-device']),
        takeOverCalls: 0,
    };

    await context.addInitScript(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: 'smoke-help-current-device' }
    );
    await installWorkspaceSessionsMock(context, sessionState);

    const page = await context.newPage();
    await gotoRoute(page, smokeEnv.seed.routes.workspace);
    await page.getByTestId('workspace-page-root').waitFor({ state: 'visible' });
    await applyCaptureStyles(page);
    await setRussianUi(page);
    await sleep(350);

    await captureViewport(page, 'collaboration-and-guards.png', {
        clip: { x: 248, y: 92, width: 1304, height: 420 },
    });

    await context.close();
};

const main = async () => {
    const smokeEnv = await readJson(SMOKE_ENV_FILE);
    await ensureDir(OUTPUT_DIR);
    logStep('launch browser');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        storageState: AUTH_FILE,
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    try {
        const page = await context.newPage();
        logStep('ensure auth');
        await ensureAuthenticated(page, smokeEnv);
        await captureWorkspaceShots(page, smokeEnv);
        await captureAccountsShot(page, smokeEnv);
        await captureIdeasShot(page, smokeEnv);
        await captureNoBrandShot(page, smokeEnv);
        await captureCollaborationShot(browser, smokeEnv);
    } finally {
        await context.close();
        await browser.close();
    }

    logStep(`saved help screenshots to ${path.relative(PROJECT_ROOT, OUTPUT_DIR)}`);
};

await main();
