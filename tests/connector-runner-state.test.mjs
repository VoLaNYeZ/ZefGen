import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildIntegrationRequirements,
    deriveConnectorJobState,
    getIntegrationReadiness,
    groupConnectorArtifacts,
} from '../utils/connector-runner-state.js';

test('deriveConnectorJobState enables QA from the latest successful code-producing SHA', () => {
    const state = deriveConnectorJobState([
        {
            id: 'integration-1',
            kind: 'integration',
            status: 'succeeded',
            result_commit_sha: 'ABC123',
        },
    ]);

    assert.equal(state.canRunQa, true);
    assert.equal(state.qaDisabledReason, '');
    assert.equal(state.qaSourceJob?.id, 'integration-1');
    assert.equal(state.latestSuccessfulCodeSha, 'abc123');
});

test('deriveConnectorJobState blocks screenshots when the latest QA SHA is stale', () => {
    const state = deriveConnectorJobState([
        {
            id: 'integration-2',
            kind: 'integration',
            status: 'succeeded',
            result_commit_sha: 'def456',
        },
        {
            id: 'qa-1',
            kind: 'visual_qa',
            status: 'succeeded',
            result_commit_sha: 'abc123',
        },
    ]);

    assert.equal(state.canRunQa, true);
    assert.equal(state.canRunScreenshots, false);
    assert.equal(state.screenshotsDisabledReason, 'stale_qa');
    assert.equal(state.screenshotsSourceJob, null);
});

test('integration readiness uses CRM variables including Apphud and Firebase fields', () => {
    const variables = {
        apphud_api_key: 'apphud-live-key',
        domain: 'https://analytics.example.com',
        bundle_id: 'com.example.release',
        privacy_policy_url: 'https://example.com/privacy',
        terms_of_use_url: 'https://example.com/terms',
        support_form_url: 'https://example.com/support',
        firebase_plist_snippet: '<plist></plist>',
        id_purchases: '',
    };
    const secretMetas = [];

    assert.equal(getIntegrationReadiness({ variables, secretMetas }), true);

    const requirements = buildIntegrationRequirements({ variables, secretMetas });
    assert.equal(requirements.find((item) => item.key === 'id_purchases')?.optional, true);
    assert.equal(requirements.find((item) => item.key === 'apphud_api_key')?.source, 'variable');
    assert.equal(requirements.find((item) => item.key === 'bundle_id')?.ok, true);
});

test('groupConnectorArtifacts groups evidence and screenshots by variant, theme, and viewport', () => {
    const grouped = groupConnectorArtifacts([
        {
            id: 'qa-report',
            kind: 'qa_report',
            object_path: 'apps/app/visual_qa/job/qa_report.json',
            metadata: { source_ref: 'sha-1' },
        },
        {
            id: 'qa-2',
            kind: 'qa_evidence',
            object_path: 'apps/app/visual_qa/job/render/dashboard.png',
            metadata: { theme: 'dark', viewport: 'iphone_15_pro', target_id: 'dashboard' },
        },
        {
            id: 'qa-1',
            kind: 'qa_evidence',
            object_path: 'apps/app/visual_qa/job/render/home.png',
            metadata: { theme: 'dark', viewport: 'iphone_15_pro', target_id: 'home' },
        },
        {
            id: 'manifest',
            kind: 'screenshot_manifest',
            object_path: 'apps/app/screenshots/job/manifest.json',
            metadata: { source_ref: 'sha-1' },
        },
        {
            id: 'shot-2',
            kind: 'screenshot_image',
            object_path: 'apps/app/screenshots/job/simulator/settings.png',
            metadata: { theme: 'light', viewport: 'iphone_se', target_id: 'settings' },
        },
        {
            id: 'shot-1',
            kind: 'screenshot_image',
            object_path: 'apps/app/screenshots/job/simulator/home.png',
            metadata: { theme: 'light', viewport: 'iphone_se', target_id: 'home' },
        },
    ]);

    assert.equal(grouped.qaReport?.id, 'qa-report');
    assert.equal(grouped.screenshotManifest?.id, 'manifest');
    assert.equal(grouped.qaEvidenceGroups.length, 1);
    assert.equal(grouped.qaEvidenceGroups[0].variant, 'render');
    assert.deepEqual(
        grouped.qaEvidenceGroups[0].items.map((item) => item.targetId),
        ['dashboard', 'home']
    );
    assert.equal(grouped.screenshotGroups.length, 1);
    assert.equal(grouped.screenshotGroups[0].variant, 'simulator');
    assert.deepEqual(
        grouped.screenshotGroups[0].items.map((item) => item.targetId),
        ['home', 'settings']
    );
});
