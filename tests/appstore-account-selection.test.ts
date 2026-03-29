import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isAvailableAppstoreAccount,
    pickFirstAvailableAppstoreAccount,
} from '../utils/appstore-account-selection.ts';

test('isAvailableAppstoreAccount requires an unassigned usable account that was never used before', () => {
    assert.equal(
        isAvailableAppstoreAccount({
            app_id: null,
            usability: true,
            was_used_before: false,
        }),
        true
    );
    assert.equal(
        isAvailableAppstoreAccount({
            app_id: 'app-1',
            usability: true,
            was_used_before: false,
        }),
        false
    );
    assert.equal(
        isAvailableAppstoreAccount({
            app_id: null,
            usability: false,
            was_used_before: false,
        }),
        false
    );
    assert.equal(
        isAvailableAppstoreAccount({
            app_id: null,
            usability: false,
            was_used_before: true,
        }),
        false
    );
});

test('pickFirstAvailableAppstoreAccount returns the first available account in fetch order', () => {
    const selected = pickFirstAvailableAppstoreAccount([
        {
            id: 'assigned',
            app_id: 'app-1',
            usability: true,
            was_used_before: false,
        },
        {
            id: 'disabled',
            app_id: null,
            usability: false,
            was_used_before: false,
        },
        {
            id: 'used-before',
            app_id: null,
            usability: false,
            was_used_before: true,
        },
        {
            id: 'first-free',
            app_id: null,
            usability: true,
            was_used_before: false,
        },
        {
            id: 'second-free',
            app_id: null,
            usability: true,
            was_used_before: false,
        },
    ]);

    assert.equal(selected?.id, 'first-free');
});

test('pickFirstAvailableAppstoreAccount returns null when no account is available', () => {
    const selected = pickFirstAvailableAppstoreAccount([
        {
            id: 'assigned',
            app_id: 'app-1',
            usability: true,
            was_used_before: false,
        },
        {
            id: 'disabled',
            app_id: null,
            usability: false,
            was_used_before: false,
        },
        {
            id: 'used-before',
            app_id: null,
            usability: false,
            was_used_before: true,
        },
    ]);

    assert.equal(selected, null);
});
