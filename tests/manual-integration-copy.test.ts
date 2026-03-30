import test from 'node:test';
import assert from 'node:assert/strict';

import { buildManualIntegrationCopyText } from '../utils/manual-integration-copy.ts';

test('manual integration copy uses App Store name and quoted empty values', () => {
    const copy = buildManualIntegrationCopyText({
        selectedApp: {
            alias: 'ef-xx',
            name: 'Fallback Name',
        },
        variables: {
            appstore_name: 'Store Name',
            apphud_api_key: '',
            domain: '   ',
            bundle_id: '',
            id_purchases: '',
        },
        legalLinks: {
            privacy_policy_url: '',
            terms_of_use_url: '   ',
            support_form_url: '',
        },
    });

    assert.equal(
        copy,
        [
            'Привет, нужна интеграция - [EF-XX] Store Name',
            'Apphud Key - ""',
            'Analytics URL - ""',
            'privacy - ""',
            'terms - ""',
            'support - ""',
            'Bundle ID - ""',
            '*IAP Product ID - без покупок',
            '+ Firebase нужно создать',
            '+ Пуш подрубить',
        ].join('\n')
    );
});

test('manual integration copy falls back to selected app name and legacy apphud field', () => {
    const copy = buildManualIntegrationCopyText({
        selectedApp: {
            alias: 'ef-yy',
            name: 'Selected Name',
        },
        variables: {
            appstore_name: '   ',
            apphud_api_url: 'legacy-apphud-key',
            domain: 'https://analytics.example.com',
            bundle_id: 'com.example.app',
            id_purchases: 'premium.yearly',
        },
        legalLinks: {
            privacy_policy_url: 'https://example.com/privacy',
            terms_of_use_url: 'https://example.com/terms',
            support_form_url: 'https://example.com/support',
        },
    });

    assert.equal(
        copy,
        [
            'Привет, нужна интеграция - [EF-YY] Selected Name',
            'Apphud Key - "legacy-apphud-key"',
            'Analytics URL - "https://analytics.example.com"',
            'privacy - "https://example.com/privacy"',
            'terms - "https://example.com/terms"',
            'support - "https://example.com/support"',
            'Bundle ID - "com.example.app"',
            '*IAP Product ID - premium.yearly',
            '+ Firebase нужно создать',
            '+ Пуш подрубить',
        ].join('\n')
    );
});
