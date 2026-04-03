import test from 'node:test';
import assert from 'node:assert/strict';

import {
    filterRunnerScreenshotArtifactsForApp,
    validatePersistedRunnerScreenshotArtifacts,
} from '../utils/app-screenshot-runner-import.js';

test('filterRunnerScreenshotArtifactsForApp keeps valid screenshot artifacts from a mixed job', () => {
    const { validArtifacts, mismatchedArtifacts } = filterRunnerScreenshotArtifactsForApp({
        expectedAppId: 'app-1',
        artifacts: [
            { id: 'shot-1', app_id: 'app-1', object_path: 'good-1.png' },
            { id: 'shot-2', app_id: 'app-2', object_path: 'bad.png' },
            { id: 'shot-3', app_id: 'app-1', object_path: 'good-2.png' },
        ],
    });

    assert.deepEqual(
        validArtifacts.map((artifact) => artifact.id),
        ['shot-1', 'shot-3']
    );
    assert.deepEqual(
        mismatchedArtifacts.map((artifact) => artifact.id),
        ['shot-2']
    );
});

test('validatePersistedRunnerScreenshotArtifacts enforces both app and imported job ownership', () => {
    const { artifactValidityById, invalidShots } = validatePersistedRunnerScreenshotArtifacts({
        expectedAppId: 'app-1',
        shots: [
            { artifact_id: 'artifact-good', imported_from_job_id: 'job-1' },
            { artifact_id: 'artifact-wrong-job', imported_from_job_id: 'job-1' },
            { artifact_id: 'artifact-wrong-app', imported_from_job_id: 'job-2' },
            { artifact_id: 'artifact-missing', imported_from_job_id: 'job-3' },
        ],
        artifactIdentities: [
            { id: 'artifact-good', app_id: 'app-1', job_id: 'job-1' },
            { id: 'artifact-wrong-job', app_id: 'app-1', job_id: 'job-9' },
            { id: 'artifact-wrong-app', app_id: 'app-9', job_id: 'job-2' },
        ],
    });

    assert.deepEqual(artifactValidityById, {
        'artifact-good': true,
        'artifact-wrong-job': false,
        'artifact-wrong-app': false,
        'artifact-missing': false,
    });
    assert.deepEqual(invalidShots, [
        { artifactId: 'artifact-wrong-job', importedFromJobId: 'job-1' },
        { artifactId: 'artifact-wrong-app', importedFromJobId: 'job-2' },
        { artifactId: 'artifact-missing', importedFromJobId: 'job-3' },
    ]);
});
