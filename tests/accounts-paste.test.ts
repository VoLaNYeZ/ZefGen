import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftPatchFromClipboard, parseClipboardRows } from '../utils/accounts-paste.ts';

test('parseClipboardRows keeps one structured row with trailing newline', () => {
    assert.deepEqual(parseClipboardRows('mail@example.com\tpass123\tUS\t\n'), [
        ['mail@example.com', 'pass123', 'US', ''],
    ]);
});

test('buildDraftPatchFromClipboard maps a partial row from the email column', () => {
    const result = buildDraftPatchFromClipboard({
        startField: 'email',
        cells: ['mail@example.com', 'pass123', 'mailpass', '+123', 'US', 'Acme LLC', '1.2.3.4:80', 'note'],
        resolveStatus: () => null,
        resolveAppId: () => undefined,
    });

    assert.deepEqual(result, {
        patch: {
            email: 'mail@example.com',
            password: 'pass123',
            email_password: 'mailpass',
            number: '+123',
            geo: 'US',
            company_name: 'Acme LLC',
            proxy: '1.2.3.4:80',
            notes: 'note',
        },
        issues: [],
    });
});

test('buildDraftPatchFromClipboard maps full-row status and app alias values', () => {
    const result = buildDraftPatchFromClipboard({
        startField: 'usability',
        cells: ['Used before', 'APP1', 'mail@example.com', 'pass123'],
        resolveStatus: (value) =>
            value === 'Used before' ? { usability: false, was_used_before: true } : null,
        resolveAppId: (value) => (value === 'APP1' ? 'app-1' : undefined),
    });

    assert.deepEqual(result, {
        patch: {
            usability: false,
            was_used_before: true,
            app_id: 'app-1',
            email: 'mail@example.com',
            password: 'pass123',
        },
        issues: [],
    });
});

test('buildDraftPatchFromClipboard reports unknown pasted app aliases', () => {
    const result = buildDraftPatchFromClipboard({
        startField: 'app_id',
        cells: ['MISSING', 'mail@example.com'],
        resolveStatus: () => null,
        resolveAppId: () => undefined,
    });

    assert.deepEqual(result, {
        patch: {
            email: 'mail@example.com',
        },
        issues: [{ code: 'unknown_app', value: 'MISSING' }],
    });
});
