import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEffectivePublicWebhookUrl,
    buildPublicSecurityHeaders,
    publicTextResponse,
    redirectTo,
    validateExplicitPublicWebhookUrl,
    withPublicHeaders,
} from '../cloudflare/appstore-review-bridge/worker.js';

test('public Worker responses include hardened headers', () => {
    const response = withPublicHeaders(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));

    assert.equal(response.headers.get('content-security-policy'), buildPublicSecurityHeaders()['content-security-policy']);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('public text responses return generic anonymous errors', async () => {
    const response = publicTextResponse('Server error.', { status: 502 });

    assert.equal(response.status, 502);
    assert.equal(await response.text(), 'Server error.');
    assert.equal(response.headers.get('content-security-policy'), buildPublicSecurityHeaders()['content-security-policy']);
});

test('public redirects preserve hardened headers and reject non-http targets', () => {
    const okRedirect = redirectTo('https://example.com/privacy');
    assert.equal(okRedirect.status, 302);
    assert.equal(okRedirect.headers.get('location'), 'https://example.com/privacy');
    assert.equal(okRedirect.headers.get('x-frame-options'), 'DENY');

    const blockedRedirect = redirectTo('javascript:alert(1)');
    assert.equal(blockedRedirect.status, 404);
});

test('worker effective webhook URL keeps explicit custom URLs and rejects direct Supabase URLs', () => {
    const env = {
        PUBLIC_ROOT_DOMAIN: 'appshelp.cc',
        SUPABASE_URL: 'https://project.supabase.co',
    };

    assert.deepEqual(
        validateExplicitPublicWebhookUrl(env, 'https://hooks.client-a.example.com/appstore-review'),
        {
            url: 'https://hooks.client-a.example.com/appstore-review',
            issue: '',
        }
    );

    assert.deepEqual(
        buildEffectivePublicWebhookUrl(env, {
            public_token: 'abc123',
            public_subdomain: '',
            public_webhook_url: 'https://project.supabase.co/functions/v1/appstore-review-webhook?token=abc123',
        }),
        {
            effectiveUrl: '',
            issue: 'Direct Supabase webhook URLs are not allowed here. Use appshelp.cc or a custom public proxy URL.',
        }
    );

    assert.deepEqual(
        buildEffectivePublicWebhookUrl(env, {
            public_token: 'abc123',
            public_subdomain: '',
            public_webhook_url: 'https://hooks.client-a.example.com/appstore-review',
        }),
        {
            effectiveUrl: 'https://hooks.client-a.example.com/appstore-review',
            issue: '',
        }
    );
});
