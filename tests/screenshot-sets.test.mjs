import test from 'node:test';
import assert from 'node:assert/strict';

import { getCanonicalOriginalScreenshotSet, isOriginalScreenshotSetName } from '../utils/screenshot-sets.js';

test('isOriginalScreenshotSetName matches both canonical and localized original labels', () => {
    assert.equal(isOriginalScreenshotSetName('Original', 'Original'), true);
    assert.equal(isOriginalScreenshotSetName(' original ', 'Original'), true);
    assert.equal(isOriginalScreenshotSetName('Control', 'Original'), false);
});

test('getCanonicalOriginalScreenshotSet prefers the lowest order_index original candidate', () => {
    const original = getCanonicalOriginalScreenshotSet([
        { id: 'b', name: 'Original', order_index: 1, created_at: '2026-04-04T10:00:00.000Z' },
        { id: 'a', name: 'Original', order_index: 0, created_at: '2026-04-04T11:00:00.000Z' },
        { id: 'c', name: 'AB Test 1', order_index: 2, created_at: '2026-04-04T09:00:00.000Z' },
    ]);

    assert.equal(original?.id, 'a');
});

test('getCanonicalOriginalScreenshotSet prefers a real Original name over a non-original row at order 0', () => {
    const original = getCanonicalOriginalScreenshotSet([
        { id: 'control', name: 'AB Test 1', order_index: 0, created_at: '2026-04-04T08:00:00.000Z' },
        { id: 'original', name: 'Original', order_index: 1, created_at: '2026-04-04T09:00:00.000Z' },
    ]);

    assert.equal(original?.id, 'original');
});

test('getCanonicalOriginalScreenshotSet falls back to the earliest created duplicate original', () => {
    const original = getCanonicalOriginalScreenshotSet([
        { id: 'late', name: 'Original', order_index: 4, created_at: '2026-04-04T12:00:00.000Z' },
        { id: 'early', name: 'Original', order_index: 4, created_at: '2026-04-04T09:00:00.000Z' },
    ]);

    assert.equal(original?.id, 'early');
});
