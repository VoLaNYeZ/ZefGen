import fs from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';
import { AUTH_FILE, BASE_URL, loadSmokeEnv } from './smoke-env';
import { LAST_WORKSPACE_SELECTION_STORAGE_KEY } from '../../../utils/workspace-selection.ts';

export const smokeEnv = loadSmokeEnv();
export const SMOKE_DEVICE_ID_KEY = 'zefgen.deviceId';
export const SMOKE_DEVICE_ID = 'smoke-playwright-device';

export const emptyStorageState = { cookies: [], origins: [] };

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const slugifyForSmoke = (value: string) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

export const writeAuthDir = async () => {
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
};

export const gotoPath = async (page: Page, route: string) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `Expected ${route} to load successfully`).toBeTruthy();
};

export const waitForShell = async (page: Page) => {
    await expect(page.getByTestId('app-shell-root')).toBeVisible();
};

export const loginThroughUi = async (page: Page) => {
    await gotoPath(page, '/');
    await expect(page.getByLabel('Email')).toBeVisible();
    await page.getByLabel('Email').fill(smokeEnv.credentials.email);
    await page.getByLabel('Password').fill(smokeEnv.credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await waitForShell(page);
};

export const parkAuthenticatedSession = async (page: Page) => {
    await gotoPath(page, smokeEnv.seed.routes.accounts);
    await expect(page.getByTestId('accounts-page-root')).toBeVisible();
    await page.waitForTimeout(500);
};

export const seedSmokeDeviceId = async (page: Page) => {
    await page.evaluate(
        ({ key, value }) => {
            window.localStorage.setItem(key, value);
        },
        { key: SMOKE_DEVICE_ID_KEY, value: SMOKE_DEVICE_ID }
    );
};

export const seedLastWorkspaceSelection = async (
    page: Page,
    selection: { brandId: string; appId: string } | null
) => {
    await page.evaluate(
        ({ key, selection: nextSelection }) => {
            if (!nextSelection) {
                window.localStorage.removeItem(key);
                return;
            }
            window.localStorage.setItem(key, JSON.stringify(nextSelection));
        },
        { key: LAST_WORKSPACE_SELECTION_STORAGE_KEY, selection }
    );
};

export const gotoWorkspace = async (page: Page) => {
    await gotoPath(page, smokeEnv.seed.routes.workspace);
    await expect(page.getByTestId('workspace-page-root')).toBeVisible();
};

export const gotoAccountsTargetWorkspace = async (page: Page) => {
    await gotoPath(page, smokeEnv.seed.routes.accountsTargetWorkspace);
    await expect(page.getByTestId('workspace-page-root')).toBeVisible();
};

export const gotoNoBrandCollapsedWorkspace = async (page: Page) => {
    await gotoPath(page, smokeEnv.seed.routes.noBrandCollapsedWorkspace);
    await expect(page.getByTestId('workspace-page-root')).toBeVisible();
};

export const claimWorkspaceEditLockIfPrompted = async (page: Page) => {
    const startEditingButton = page.getByRole('button', { name: /^Start editing$/ });
    if (!(await startEditingButton.count())) return;
    if (!(await startEditingButton.first().isVisible().catch(() => false))) return;
    await startEditingButton.first().click();
    await expect
        .poll(
            async () => {
                const button = startEditingButton.first();
                const stillVisible = await button.isVisible().catch(() => false);
                if (!stillVisible) return 'claimed';

                const editBrandButton = page.getByRole('button', { name: /^Edit brand$/ });
                const canEditBrand = await editBrandButton.isEnabled().catch(() => false);
                if (canEditBrand) return 'claimed';

                return 'pending';
            },
            {
                timeout: 7000,
                message: 'Expected workspace edit lock claim to leave read-only mode',
            }
        )
        .toBe('claimed');
};

export const openAccounts = async (page: Page) => {
    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^Accounts$/ }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.accounts)}$`));
    await expect(page.getByTestId('accounts-page-root')).toBeVisible();
};

export const openIdeas = async (page: Page) => {
    await page.getByTestId('brand-sidebar').getByRole('button', { name: /^Ideas$/ }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.ideas)}$`));
    await expect(page.getByTestId('ideas-page-root')).toBeVisible();
};

export const openWorkspaceFromSidebar = async (page: Page) => {
    await page.getByTestId('active-brand-row').click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(smokeEnv.seed.routes.workspace)}$`));
    await expect(page.getByTestId('workspace-page-root')).toBeVisible();
};

export const grantClipboardPermissions = async (page: Page) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
};

export const pasteInto = async (page: Page, target: Locator, payload: string) => {
    await grantClipboardPermissions(page);
    await page.evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
    }, payload);
    await target.click();
    await target.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
};

export const selectOptionContainingText = async (select: Locator, needle: string) => {
    const options = await select.locator('option').evaluateAll((nodes) =>
        nodes.map((node) => ({
            value: (node as HTMLOptionElement).value,
            label: (node.textContent || '').trim(),
        }))
    );
    const match = options.find((option) => option.label.includes(needle));
    if (!match) {
        throw new Error(`Could not find select option containing "${needle}". Options: ${options.map((option) => option.label).join(' | ')}`);
    }
    await select.selectOption(match.value);
};
