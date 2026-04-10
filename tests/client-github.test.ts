import test from 'node:test';
import assert from 'node:assert/strict';

import { isActiveConnectorJobStatus } from '../data/connector-jobs.ts';
import {
    EMAPPSTORE777_OWNER,
    toEmappstore777RepoFullNameFromSource,
    toEmappstore777RepoNameFromSourceName,
    toGithubRepoFullNameFromUrl,
} from '../utils/client-github.ts';

test('extracts repo full name from GitHub URLs', () => {
    assert.equal(
        toGithubRepoFullNameFromUrl('https://github.com/example-owner/-ef-06-ProblemNoteKeeper-Home'),
        'example-owner/-ef-06-ProblemNoteKeeper-Home'
    );
    assert.equal(
        toGithubRepoFullNameFromUrl('https://github.com/example-owner/-ef-06-ProblemNoteKeeper-Home.git'),
        'example-owner/-ef-06-ProblemNoteKeeper-Home'
    );
});

test('normalizes ef prefix to EF for emappstore777 repo names', () => {
    assert.equal(
        toEmappstore777RepoNameFromSourceName('-ef-06-ProblemNoteKeeper-Home'),
        '-EF-06-ProblemNoteKeeper-Home'
    );
    assert.equal(
        toEmappstore777RepoNameFromSourceName('plain-repo-name'),
        'plain-repo-name'
    );
});

test('builds emappstore777 repo full name from source repo full name', () => {
    assert.equal(
        toEmappstore777RepoFullNameFromSource('executor-owner/-ef-06-ProblemNoteKeeper-Home'),
        `${EMAPPSTORE777_OWNER}/-EF-06-ProblemNoteKeeper-Home`
    );
});

test('treats queued and running connector jobs as active', () => {
    assert.equal(isActiveConnectorJobStatus('queued'), true);
    assert.equal(isActiveConnectorJobStatus('running'), true);
    assert.equal(isActiveConnectorJobStatus('waiting_for_user'), true);
    assert.equal(isActiveConnectorJobStatus('succeeded'), false);
});
