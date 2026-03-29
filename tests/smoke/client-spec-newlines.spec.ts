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

test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 400 \(Bad Request\)/],
});

test('legacy client spec stays normalized after non-brief edits and keeps raw brief input while dirty', async ({ page }) => {
    const appId = smokeEnv.seed.primaryApp.id;
    const originalConfig = await readConnectorConfig(appId);
    const legacyProjectBrief = 'Legacy smoke brief line one\\nLegacy smoke brief line two';
    const normalizedLegacyProjectBrief = 'Legacy smoke brief line one\nLegacy smoke brief line two';
    const rawDirtyBrief = 'Operator typed literal \\n and wants to keep it visible while editing.';

    try {
        const { error } = await smokeAdmin
            .from('connector_app_configs')
            .update({ project_brief: legacyProjectBrief })
            .eq('user_id', originalConfig.user_id)
            .eq('app_id', appId);
        assertSmokeNoError(error, `Could not seed legacy connector brief for app ${appId}`);

        await gotoWorkspace(page);
        await claimWorkspaceEditLockIfPrompted(page);

        const clientSpecPanel = page.getByTestId('workspace-panel-client-spec');
        const briefField = clientSpecPanel.locator('textarea');
        await expect(briefField).toHaveValue(normalizedLegacyProjectBrief);

        const appstoreNameInput = page.getByTestId('connector-variable-input-appstore_name');
        await appstoreNameInput.fill('Legacy newline smoke');
        await expect(briefField).toHaveValue(normalizedLegacyProjectBrief);

        await briefField.fill(rawDirtyBrief);
        await expect(briefField).toHaveValue(rawDirtyBrief);
    } finally {
        await restoreConnectorConfig(originalConfig);
    }
});
