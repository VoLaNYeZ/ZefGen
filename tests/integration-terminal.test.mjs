import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIntegrationTerminalModel } from '../utils/integration-terminal.js';

const labels = {
    connector_integration_phase_prepare: 'Prepare repository',
    connector_integration_phase_prepare_headline: 'Preparing repository',
    connector_integration_phase_load: 'Load integration package',
    connector_integration_phase_load_headline: 'Loading integration package',
    connector_integration_phase_plan: 'Plan changes',
    connector_integration_phase_plan_headline: 'Planning changes',
    connector_integration_phase_apply: 'Apply changes',
    connector_integration_phase_apply_headline: 'Applying integration changes',
    connector_integration_phase_check: 'Check result',
    connector_integration_phase_check_headline: 'Checking the result',
    connector_integration_phase_send: 'Send to GitHub',
    connector_integration_phase_send_headline: 'Sending changes to GitHub',
    connector_integration_detail_prepare: 'Getting the repository ready for integration.',
    connector_integration_detail_prepare_github: 'Checking the latest code on GitHub.',
    connector_integration_detail_prepare_open: 'Opening the latest main version.',
    connector_integration_detail_prepare_branch: 'Preparing a clean working branch.',
    connector_integration_detail_load: 'Loading the integration package into the app.',
    connector_integration_detail_plan: 'Deciding what needs to change.',
    connector_integration_detail_apply: 'Applying integration changes.',
    connector_integration_detail_apply_fix: 'Adjusting the integration until it fits cleanly.',
    connector_integration_detail_check: 'Checking that everything still works.',
    connector_integration_detail_send: 'Sending changes to GitHub.',
    connector_integration_waiting_headline: 'Needs your input to continue',
    connector_integration_waiting_detail: 'The runner is paused until you answer its question.',
    connector_integration_success_headline: 'Integration finished',
    connector_integration_success_detail: 'The result was sent to GitHub successfully.',
    connector_integration_failed_headline: 'Integration stopped',
    connector_integration_failure_secondary: 'The runner note below has the technical details.',
    connector_integration_error_repo: 'GitHub access needs attention before integration can continue.',
    connector_integration_error_package: 'The app package could not be read, so integration could not start.',
    connector_integration_error_plan: 'The runner could not decide the required integration changes.',
    connector_integration_error_apply: 'The runner could not apply the integration changes cleanly.',
    connector_integration_error_verify: 'The integration changes did not pass the final checks.',
    connector_integration_error_generic: 'Integration stopped before finishing.',
    connector_integration_timeline_done: 'Done',
    connector_integration_timeline_now: 'Now',
    connector_integration_timeline_next: 'Next',
    connector_integration_timeline_stopped: 'Stopped',
    connector_integration_queueing: 'Getting the integration job ready.',
};

const text = (key) => labels[key] ?? key;

const makeLog = (content, createdAt = '2026-03-07T10:00:00.000Z') => ({
    kind: 'log',
    content,
    created_at: createdAt,
});

test('queued integration shows repository preparation first', () => {
    const model = buildIntegrationTerminalModel({
        job: {
            status: 'queued',
            created_at: '2026-03-07T10:00:00.000Z',
        },
        messages: [],
        nowMs: Date.parse('2026-03-07T10:00:08.000Z'),
        text,
    });

    assert.equal(model.activePhase, 'prepare_repository');
    assert.equal(model.headline, 'Preparing repository');
    assert.equal(model.detail, 'Getting the integration job ready.');
    assert.match(model.timelineLines[0].text, /^Now  Prepare repository/);
});

test('repository logs stay in prepare phase and use plain GitHub wording', () => {
    const model = buildIntegrationTerminalModel({
        job: {
            status: 'running',
            started_at: '2026-03-07T10:00:00.000Z',
        },
        messages: [
            makeLog('Resolving latest remote commit on origin/main for integration...', '2026-03-07T10:00:05.000Z'),
            makeLog('Checking out integration base ref abc123...', '2026-03-07T10:00:06.000Z'),
        ],
        nowMs: Date.parse('2026-03-07T10:00:12.000Z'),
        text,
    });

    assert.equal(model.activePhase, 'prepare_repository');
    assert.equal(model.detail, 'Opening the latest main version.');
    assert.match(model.timelineLines[0].text, /^Now  Prepare repository/);
});

test('planner, executor, and fixer logs map to their human phases', () => {
    const planModel = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Running integration planner stage against the current repo...')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(planModel.activePhase, 'plan_changes');
    assert.equal(planModel.headline, 'Planning changes');
    assert.match(planModel.timelineLines[0].text, /^Done  Prepare repository/);
    assert.match(planModel.timelineLines[2].text, /^Now  Plan changes/);

    const executeModel = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Running integration executor stage...')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(executeModel.activePhase, 'apply_changes');
    assert.equal(executeModel.detail, 'Applying integration changes.');

    const fixerModel = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Running integration fixer stage (2/3)...')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(fixerModel.activePhase, 'apply_changes');
    assert.equal(fixerModel.detail, 'Adjusting the integration until it fits cleanly.');
});

test('verify activity and verify failures translate into result-check language', () => {
    const runningModel = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Running verify: ./scripts/verify.sh')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(runningModel.activePhase, 'check_result');
    assert.equal(runningModel.detail, 'Checking that everything still works.');

    const failedModel = buildIntegrationTerminalModel({
        job: {
            status: 'failed',
            summary: 'Verify fail after integration. Branch pushed for inspection: https://github.com/example/repo/tree/work',
        },
        messages: [],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(failedModel.headline, 'Integration stopped');
    assert.equal(failedModel.translatedError, 'The integration changes did not pass the final checks.');
    assert.match(failedModel.timelineLines[4].text, /^Stopped  Check result/);
});

test('publish and merge logs map to send-to-github phase and success copy', () => {
    const runningModel = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Pushing branch...')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(runningModel.activePhase, 'send_github');
    assert.equal(runningModel.headline, 'Sending changes to GitHub');

    const successModel = buildIntegrationTerminalModel({
        job: {
            status: 'succeeded',
            summary: 'Merged PR https://github.com/example/repo/pull/12',
        },
        messages: [],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });
    assert.equal(successModel.headline, 'Integration finished');
    assert.equal(successModel.detail, 'The result was sent to GitHub successfully.');
    assert.ok(successModel.timelineLines.every((line) => line.level === 'success'));
});

test('waiting-for-user status becomes the primary state', () => {
    const model = buildIntegrationTerminalModel({
        job: {
            status: 'waiting_for_user',
            started_at: '2026-03-07T10:00:00.000Z',
        },
        messages: [makeLog('Running integration planner stage against the current repo...')],
        unansweredQuestionCount: 1,
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });

    assert.equal(model.showActionRequired, true);
    assert.equal(model.headline, 'Needs your input to continue');
    assert.equal(model.detail, 'The runner is paused until you answer its question.');
    assert.equal(model.timelineLines[2].level, 'warn');
});

test('generic stage logs still map to phases when detailed logs are absent', () => {
    const model = buildIntegrationTerminalModel({
        job: { status: 'running', started_at: '2026-03-07T10:00:00.000Z' },
        messages: [makeLog('Running Codex (stage: integration_plan)')],
        nowMs: Date.parse('2026-03-07T10:00:10.000Z'),
        text,
    });

    assert.equal(model.activePhase, 'plan_changes');
    assert.equal(model.detail, 'Deciding what needs to change.');
});
