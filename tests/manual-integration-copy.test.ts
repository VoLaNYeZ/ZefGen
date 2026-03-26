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
    });

    assert.equal(
        copy,
        [
            'Привет, нужна интеграция - [EF-XX] Store Name',
            'Apphud Key - ""',
            'Analytics URL - ""',
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
    });

    assert.equal(
        copy,
        [
            'Привет, нужна интеграция - [EF-YY] Selected Name',
            'Apphud Key - "legacy-apphud-key"',
            'Analytics URL - "https://analytics.example.com"',
            'Bundle ID - "com.example.app"',
            '*IAP Product ID - premium.yearly',
            '+ Firebase нужно создать',
            '+ Пуш подрубить',
        ].join('\n')
    );
});
