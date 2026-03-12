import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';
import { AUTH_FILE, BASE_URL, loadSmokeEnv } from './tests/smoke/support/smoke-env';

const smokeEnv = loadSmokeEnv();
const devEnv = loadEnv('development', process.cwd(), '');
const reuseExistingServer = !process.env.CI && process.env.SMOKE_REUSE_EXISTING_SERVER === '1';

export default defineConfig({
    testDir: path.join(process.cwd(), 'tests', 'smoke'),
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ],
    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                browserName: 'chromium',
            },
        },
        {
            name: 'auth-chromium',
            testMatch: /auth\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                browserName: 'chromium',
            },
        },
        {
            name: 'smoke-chromium',
            testIgnore: [/auth\.setup\.ts/, /auth\.spec\.ts/],
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                browserName: 'chromium',
                storageState: AUTH_FILE,
            },
        },
    ],
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: BASE_URL,
        reuseExistingServer,
        timeout: 180_000,
        env: {
            ...process.env,
            ...devEnv,
            VITE_SUPABASE_URL: smokeEnv.supabase.url,
            VITE_SUPABASE_ANON_KEY: smokeEnv.supabase.anonKey,
            SUPABASE_SERVICE_ROLE_KEY: smokeEnv.supabase.serviceRoleKey,
        },
    },
});
