import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { assertSmokeNoError, loadSmokeUserId, smokeAdmin } from './support/backend';
import { claimWorkspaceEditLockIfPrompted, gotoWorkspace, smokeEnv } from './support/helpers';

type ConnectorConfigSnapshot = {
    app_id: string;
    user_id: string;
    project_kind: string;
    project_brief: string;
    idea_id: string | null;
    base_branch: string;
    variables: Record<string, unknown>;
};

const readConnectorConfig = async (appId: string) => {
    const userId = await loadSmokeUserId();
    const { data, error } = await smokeAdmin
        .from('connector_app_configs')
        .select('app_id, user_id, project_kind, project_brief, idea_id, base_branch, variables')
        .eq('user_id', userId)
        .eq('app_id', appId)
        .maybeSingle<ConnectorConfigSnapshot>();
    assertSmokeNoError(error, `Could not load connector config for app ${appId}`);
    if (!data) {
        throw new Error(`Missing connector config for smoke app ${appId}`);
    }
    return data;
};

const restoreConnectorConfig = async (snapshot: ConnectorConfigSnapshot) => {
    const { error } = await smokeAdmin
        .from('connector_app_configs')
        .update({
            project_kind: snapshot.project_kind,
            project_brief: snapshot.project_brief,
            idea_id: snapshot.idea_id,
            base_branch: snapshot.base_branch,
            variables: snapshot.variables,
        })
        .eq('user_id', snapshot.user_id)
        .eq('app_id', snapshot.app_id);
    assertSmokeNoError(error, `Could not restore connector config for app ${snapshot.app_id}`);
};

const switchToApp = async (page: Page, appId: string, alias: string) => {
    await page.locator(`[data-app-id="${appId}"]`).click();
    await expect(page.getByTestId('active-app-pill')).toContainText(alias.toUpperCase());
};

const warmSwitchCurrentApp = async (page: Page) => {
    await switchToApp(page, smokeEnv.seed.accountsTargetApp.id, smokeEnv.seed.accountsTargetApp.alias);
    await switchToApp(page, smokeEnv.seed.primaryApp.id, smokeEnv.seed.primaryApp.alias);
};

test('Apphud key persists across reload after warm app switching', async ({ page }) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const originalConfig = await readConnectorConfig(appId);
    const nextValue = `apphud_key_live_smoke_${Date.now()}`;

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);
        await warmSwitchCurrentApp(page);

        const apphudInput = page.getByTestId('connector-variable-input-apphud_api_key');
        await expect(apphudInput).toBeVisible();

        await apphudInput.fill(nextValue);

        await expect
            .poll(
                async () => {
                    const config = await readConnectorConfig(appId);
                    return String(config.variables?.apphud_api_key || '');
                },
                {
                    timeout: 15_000,
                    message: 'Expected Apphud key autosave to persist the edited value.',
                }
            )
            .toBe(nextValue);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('workspace-page-root')).toBeVisible();
        await expect(apphudInput).toHaveValue(nextValue);
    } finally {
        await restoreConnectorConfig(originalConfig);
    }
});

test('client spec persists across reload after warm app switching', async ({ page }) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const originalConfig = await readConnectorConfig(appId);
    const nextValue = `Warm snapshot smoke brief ${Date.now()}`;

    try {
        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);
        await warmSwitchCurrentApp(page);

        const briefField = page.getByTestId('workspace-panel-client-spec').locator('textarea');
        await expect(briefField).toBeVisible();

        await briefField.fill(nextValue);

        await expect
            .poll(
                async () => {
                    const config = await readConnectorConfig(appId);
                    return String(config.project_brief || '');
                },
                {
                    timeout: 15_000,
                    message: 'Expected client spec autosave to persist the edited project brief.',
                }
            )
            .toBe(nextValue);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('workspace-page-root')).toBeVisible();
        await expect(briefField).toHaveValue(nextValue);
    } finally {
        await restoreConnectorConfig(originalConfig);
    }
});
