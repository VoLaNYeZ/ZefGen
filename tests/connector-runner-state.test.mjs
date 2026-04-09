import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildIntegrationRequirements,
    deriveConnectorJobState,
    getIntegrationReadiness,
    groupConnectorArtifacts,
    hasSuccessfulGenerateJob,
} from '../utils/connector-runner-state.js';

test('deriveConnectorJobState enables QA from the latest successful code-producing SHA', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'integration-1',
                kind: 'integration',
                status: 'succeeded',
                result_commit_sha: 'ABC123',
            },
        ],
        { liveMainSha: 'abc123' }
    );

    assert.equal(state.canRunQa, true);
    assert.equal(state.qaDisabledReason, '');
    assert.equal(state.qaSourceJob?.id, 'integration-1');
    assert.equal(state.latestSuccessfulCodeSha, 'abc123');
});

test('step 5 completion only counts successful generate jobs', () => {
    assert.equal(
        hasSuccessfulGenerateJob([
            {
                id: 'generate-1',
                kind: 'generate',
                status: 'succeeded',
            },
        ]),
        true
    );

    const nonGenerateState = deriveConnectorJobState([
        {
            id: 'integration-1',
            kind: 'integration',
            status: 'succeeded',
        },
        {
            id: 'qa-1',
            kind: 'visual_qa',
            status: 'succeeded',
        },
    ]);

    assert.equal(nonGenerateState.hasSuccessfulGenerateJob, false);
    assert.equal(nonGenerateState.latestSuccessfulGenerateJob, null);
});

test('deriveConnectorJobState keeps screenshots enabled when QA is stale for the latest SHA', () => {
    const state = deriveConnectorJobState(
        [
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
                verify_status: 'pass',
                result_commit_sha: 'abc123',
            },
        ],
        { liveMainSha: 'def456' }
    );

    assert.equal(state.canRunQa, true);
    assert.equal(state.canRunScreenshots, true);
    assert.equal(state.screenshotsDisabledReason, '');
    assert.equal(state.screenshotsAdvisoryReason, 'stale_qa');
    assert.equal(state.screenshotsSourceJob?.id, 'integration-2');
});

test('deriveConnectorJobState exposes cancel-requested active jobs', () => {
    const state = deriveConnectorJobState([
        {
            id: 'fix-1',
            kind: 'fix',
            status: 'running',
            cancel_requested_at: '2026-03-22T08:00:00.000Z',
        },
        {
            id: 'generate-1',
            kind: 'generate',
            status: 'succeeded',
        },
    ]);

    assert.equal(state.latestActiveJob?.id, 'fix-1');
    assert.equal(state.activeJobCancelRequested, true);
});

test('deriveConnectorJobState blocks QA until GitHub main is synced', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'generate-1',
                kind: 'generate',
                status: 'succeeded',
                result_commit_sha: 'abc123',
            },
        ],
        { liveMainSha: 'def456' }
    );

    assert.equal(state.canRunQa, false);
    assert.equal(state.qaDisabledReason, 'stale_main');
    assert.equal(state.effectiveCurrentSourceSha, null);
});

test('deriveConnectorJobState enables QA from a trusted synced main SHA', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'generate-1',
                kind: 'generate',
                status: 'succeeded',
                result_commit_sha: 'abc123',
            },
        ],
        {
            liveMainSha: 'def456',
            trustedMainSourceSha: 'def456',
        }
    );

    assert.equal(state.canRunQa, true);
    assert.equal(state.qaDisabledReason, '');
    assert.equal(state.qaSourceKind, 'github_main_sync');
    assert.equal(state.qaSourceJob, null);
    assert.equal(state.effectiveCurrentSourceSha, 'def456');
});

test('deriveConnectorJobState reuses the latest code-producing job that matches the current SHA even if newer jobs target another SHA', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'fix-newer',
                kind: 'fix',
                status: 'succeeded',
                result_commit_sha: '999aaa',
            },
            {
                id: 'integration-current',
                kind: 'integration',
                status: 'succeeded',
                result_commit_sha: 'def456',
            },
            {
                id: 'generate-older',
                kind: 'generate',
                status: 'succeeded',
                result_commit_sha: 'abc123',
            },
        ],
        {
            liveMainSha: 'def456',
            trustedMainSourceSha: 'def456',
        }
    );

    assert.equal(state.canRunQa, true);
    assert.equal(state.qaDisabledReason, '');
    assert.equal(state.qaSourceKind, 'job');
    assert.equal(state.qaSourceJob?.id, 'integration-current');
    assert.equal(state.canRunScreenshots, true);
    assert.equal(state.screenshotsDisabledReason, '');
    assert.equal(state.screenshotsAdvisoryReason, 'missing_qa_job');
    assert.equal(state.screenshotsSourceJob?.id, 'integration-current');
});

test('deriveConnectorJobState keeps screenshots enabled when QA for the current SHA did not pass', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'generate-1',
                kind: 'generate',
                status: 'succeeded',
                result_commit_sha: 'def456',
            },
            {
                id: 'qa-2',
                kind: 'visual_qa',
                status: 'succeeded',
                verify_status: 'fail',
                result_commit_sha: 'def456',
            },
        ],
        { liveMainSha: 'def456' }
    );

    assert.equal(state.canRunScreenshots, true);
    assert.equal(state.screenshotsDisabledReason, '');
    assert.equal(state.screenshotsAdvisoryReason, 'qa_not_passed');
    assert.equal(state.screenshotsSourceJob?.id, 'qa-2');
});

test('deriveConnectorJobState enables screenshots only when QA passed on the live current SHA', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'integration-1',
                kind: 'integration',
                status: 'succeeded',
                result_commit_sha: 'fedcba',
            },
            {
                id: 'qa-3',
                kind: 'visual_qa',
                status: 'succeeded',
                verify_status: 'pass',
                result_commit_sha: 'fedcba',
            },
        ],
        { liveMainSha: 'fedcba' }
    );

    assert.equal(state.canRunScreenshots, true);
    assert.equal(state.screenshotsDisabledReason, '');
    assert.equal(state.screenshotsAdvisoryReason, '');
    assert.equal(state.screenshotsSourceJob?.id, 'qa-3');
});

test('deriveConnectorJobState keeps screenshots enabled without QA when the current SHA has a code-producing source job', () => {
    const state = deriveConnectorJobState(
        [
            {
                id: 'fix-1',
                kind: 'fix',
                status: 'succeeded',
                result_commit_sha: '123abc',
            },
        ],
        { liveMainSha: '123abc' }
    );

    assert.equal(state.canRunScreenshots, true);
    assert.equal(state.screenshotsDisabledReason, '');
    assert.equal(state.screenshotsAdvisoryReason, 'missing_qa_job');
    assert.equal(state.screenshotsSourceJob?.id, 'fix-1');
});

test('integration readiness uses CRM variables including Apphud and Firebase fields', () => {
    const variables = {
        apphud_api_key: 'apphud-live-key',
        domain: 'https://analytics.example.com',
        bundle_id: 'com.example.release',
        firebase_plist_snippet: '<plist></plist>',
        id_purchases: '',
    };
    const legalLinks = {
        privacy_policy_url: 'https://example.com/privacy',
        terms_of_use_url: 'https://example.com/terms',
        support_form_url: 'https://example.com/support',
    };
    const secretMetas = [];

    assert.equal(getIntegrationReadiness({ variables, legalLinks, secretMetas }), true);

    const requirements = buildIntegrationRequirements({ variables, legalLinks, secretMetas });
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

test('groupConnectorArtifacts accepts screenshot render variants from capture_mode metadata', () => {
    const grouped = groupConnectorArtifacts([
        {
            id: 'render-shot',
            kind: 'screenshot_image',
            object_path: 'apps/app/screenshots/job/home.png',
            metadata: {
                capture_mode: 'renders',
                theme: 'dark',
                viewport: 'iphone_17_pro_max',
                target_id: 'home',
            },
        },
    ]);

    assert.equal(grouped.screenshotGroups.length, 1);
    assert.equal(grouped.screenshotGroups[0].variant, 'render');
    assert.deepEqual(
        grouped.screenshotGroups[0].items.map((item) => item.targetId),
        ['home']
    );
});
