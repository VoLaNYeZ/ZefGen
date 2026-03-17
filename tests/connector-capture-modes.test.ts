import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_RUNNER_CAPTURE_MODE,
    RUNNER_SUPPORTED_CAPTURE_MODES,
    assertRunnerSupportedCaptureMode,
} from '../data/connector-jobs.ts';
import {
    buildScreenshotsConnectorJobInput,
    buildVisualQaConnectorJobInput,
} from '../hooks/use-connector-jobs.ts';

test('screenshots UI source only exposes runner-supported capture modes', () => {
    assert.deepEqual(RUNNER_SUPPORTED_CAPTURE_MODES, ['renders']);
    assert.equal(DEFAULT_RUNNER_CAPTURE_MODE, 'renders');
});

test('createScreenshotsJob input builder rejects unsupported capture modes', () => {
    assert.throws(
        () =>
            buildScreenshotsConnectorJobInput({
                sourceJobId: 'qa-1',
                sourceRef: 'sha-1',
                captureMode: 'simulator',
            }),
        /Unsupported capture mode/
    );

    assert.throws(() => assertRunnerSupportedCaptureMode('both'), /Unsupported capture mode/);
});

test('createScreenshotsJob input builder accepts runner-supported capture modes', () => {
    assert.deepEqual(
        buildScreenshotsConnectorJobInput({
            sourceJobId: 'qa-1',
            sourceRef: 'sha-1',
            captureMode: 'renders',
        }),
        {
            source_job_id: 'qa-1',
            source_ref: 'sha-1',
            capture_mode: 'renders',
        }
    );
});

test('visual_qa input builder always submits renders', () => {
    assert.deepEqual(
        buildVisualQaConnectorJobInput({
            sourceJobId: 'integration-1',
            sourceRef: 'ABC123',
        }),
        {
            source_job_id: 'integration-1',
            source_ref: 'ABC123',
            capture_mode: 'renders',
        }
    );
});
