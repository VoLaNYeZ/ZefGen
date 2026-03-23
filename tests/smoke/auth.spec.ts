import { expect, test } from './support/fixtures';
import { emptyStorageState, loginThroughUi, parkAuthenticatedSession } from './support/helpers';

test.use({ storageState: emptyStorageState });

test('login page renders for anonymous users', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('anonymous users hitting /help still see the login gate', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByTestId('app-shell-root')).toHaveCount(0);
    await expect(page.getByTestId('help-page-root')).toHaveCount(0);
});

test.describe('invalid credentials', () => {
    test.use({
        allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
    });

    test('show an inline error without crashing', async ({ page }) => {
        await page.goto('/');
        await page.getByLabel('Email').fill('wrong-user@zefgen.test');
        await page.getByLabel('Password').fill('totally-wrong-password');
        await page.getByRole('button', { name: /sign in/i }).click();

        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('alert')).toContainText(/invalid|credential|fetch|login/i);
        await expect(page.getByTestId('app-shell-root')).toHaveCount(0);
    });
});

test('valid credentials land in the authenticated shell', async ({ page }) => {
    await loginThroughUi(page);
    await expect(page.getByTestId('app-shell-root')).toBeVisible();
    await parkAuthenticatedSession(page);
});
