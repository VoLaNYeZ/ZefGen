import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeBrandApps } from '../utils/brand-app-summary.ts';

test('summarizeBrandApps maps App Store review states into active, in-progress, and banned buckets', () => {
    const summary = summarizeBrandApps({
        apps: [
            {
                id: 'app-ready',
                brand_id: 'brand-1',
                name: 'Ready',
                alias: 'ready',
                is_banned: false,
            },
            {
                id: 'app-waiting',
                brand_id: 'brand-1',
                name: 'Waiting',
                alias: 'waiting',
                is_banned: false,
            },
            {
                id: 'app-review',
                brand_id: 'brand-1',
                name: 'Review',
                alias: 'review',
                is_banned: false,
            },
            {
                id: 'app-rejected',
                brand_id: 'brand-1',
                name: 'Rejected',
                alias: 'rejected',
                is_banned: false,
            },
            {
                id: 'app-no-state',
                brand_id: 'brand-1',
                name: 'No State',
                alias: 'no-state',
                is_banned: false,
            },
            {
                id: 'app-banned',
                brand_id: 'brand-1',
                name: 'Banned',
                alias: 'banned',
                is_banned: true,
            },
        ],
        reviewStateByAppId: {
            'app-ready': 'READY_FOR_SALE',
            'app-waiting': 'WAITING_FOR_REVIEW',
            'app-review': 'IN_REVIEW',
            'app-rejected': 'REJECTED',
            'app-banned': 'READY_FOR_SALE',
        },
    });

    assert.deepEqual(summary, {
        total: 6,
        nonBanned: 5,
        active: 1,
        inProgress: 4,
        banned: 1,
        inProgressAttentionCount: 1,
    });
    assert.equal(summary.nonBanned, summary.active + summary.inProgress);
});

test('summarizeBrandApps lets resolved snapshot overrides replace the fetched review state', () => {
    const summary = summarizeBrandApps({
        apps: [
            {
                id: 'app-1',
                brand_id: 'brand-1',
                name: 'App One',
                alias: 'app-one',
                is_banned: false,
            },
        ],
        reviewStateByAppId: {
            'app-1': 'READY_FOR_SALE',
        },
        reviewStateOverridesByAppId: {
            'app-1': 'REMOVED_FROM_SALE',
        },
    });

    assert.deepEqual(summary, {
        total: 1,
        nonBanned: 1,
        active: 0,
        inProgress: 1,
        banned: 0,
        inProgressAttentionCount: 1,
    });
});
