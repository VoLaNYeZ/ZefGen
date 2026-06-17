import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
    buildEffectivePublicWebhookUrl,
    buildPublicSecurityHeaders,
    pickBestAppleVersionSnapshot,
    publicTextResponse,
    redirectTo,
    runScheduledAppleSnapshotSweep,
    shouldRunScheduledSnapshotForWebhook,
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
        PUBLIC_ROOT_DOMAIN: 'example.com',
        SUPABASE_URL: 'https://project.supabase.co',
    };

    assert.deepEqual(
        validateExplicitPublicWebhookUrl(env, 'https://hooks.client-a.test/appstore-review'),
        {
            url: 'https://hooks.client-a.test/appstore-review',
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
            issue: 'Direct Supabase webhook URLs are not allowed here. Use example.com or a custom public proxy URL.',
        }
    );

    assert.deepEqual(
        buildEffectivePublicWebhookUrl(env, {
            public_token: 'abc123',
            public_subdomain: '',
            public_webhook_url: 'https://hooks.client-a.test/appstore-review',
        }),
        {
            effectiveUrl: 'https://hooks.client-a.test/appstore-review',
            issue: '',
        }
    );
});

test('pickBestAppleVersionSnapshot prefers active review states over older live or draft versions', () => {
    const snapshot = pickBestAppleVersionSnapshot([
        {
            id: 'live-version',
            attributes: {
                versionString: '1.0',
                appStoreState: 'READY_FOR_SALE',
                platform: 'IOS',
                createdDate: '2026-02-01T10:00:00Z',
            },
        },
        {
            id: 'review-version',
            attributes: {
                versionString: '1.1',
                appStoreState: 'IN_REVIEW',
                platform: 'IOS',
                createdDate: '2026-03-01T10:00:00Z',
            },
        },
        {
            id: 'draft-version',
            attributes: {
                versionString: '1.2',
                appStoreState: 'PREPARE_FOR_SUBMISSION',
                platform: 'IOS',
                createdDate: '2026-03-02T10:00:00Z',
            },
        },
    ]);

    assert.equal(snapshot?.id, 'review-version');
    assert.equal(snapshot?.state, 'IN_REVIEW');
});

test('pickBestAppleVersionSnapshot falls back to the live version when the only newer one is a draft', () => {
    const snapshot = pickBestAppleVersionSnapshot([
        {
            id: 'live-version',
            attributes: {
                versionString: '1.0',
                appStoreState: 'READY_FOR_SALE',
                platform: 'IOS',
                createdDate: '2026-02-01T10:00:00Z',
            },
        },
        {
            id: 'draft-version',
            attributes: {
                versionString: '1.1',
                appStoreState: 'PREPARE_FOR_SUBMISSION',
                platform: 'IOS',
                createdDate: '2026-03-02T10:00:00Z',
            },
        },
    ]);

    assert.equal(snapshot?.id, 'live-version');
    assert.equal(snapshot?.state, 'READY_FOR_SALE');
});

test('scheduled snapshot sweep skips terminal or recently refreshed apps', () => {
    const now = Date.now();

    assert.equal(
        shouldRunScheduledSnapshotForWebhook({
            last_sync_status: 'connected',
            asc_app_id: 'apple-app',
            latest_review_state: 'WAITING_FOR_REVIEW',
            last_snapshot_at: new Date(now - 61 * 60 * 1000).toISOString(),
        }, now),
        true
    );
    assert.equal(
        shouldRunScheduledSnapshotForWebhook({
            last_sync_status: 'connected',
            asc_app_id: 'apple-app',
            latest_review_state: 'READY_FOR_SALE',
            last_snapshot_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        }, now),
        false
    );
    assert.equal(
        shouldRunScheduledSnapshotForWebhook({
            last_sync_status: 'connected',
            asc_app_id: 'apple-app',
            latest_review_state: 'IN_REVIEW',
            last_snapshot_at: new Date(now - 10 * 60 * 1000).toISOString(),
        }, now),
        false
    );
});

test('scheduled snapshot sweep refreshes only eligible apps and never recreates the webhook', async () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const requestedUrls = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        requestedUrls.push(`${init.method || 'GET'} ${url.toString()}`);

        if (url.pathname === '/rest/v1/appstore_review_webhooks' && (init.method || 'GET') === 'GET') {
            return new Response(
                JSON.stringify([
                    {
                        app_id: 'app-1',
                        user_id: 'user-1',
                        key_mode: 'team',
                        key_id: '2X9R4HXF34',
                        issuer_id: '57246542-96fe-1a63-e053-0824d011072a',
                        asc_app_id: 'apple-app-1',
                        asc_app_name: 'Demo',
                        asc_bundle_id: 'com.demo.app',
                        latest_review_state: 'WAITING_FOR_REVIEW',
                        last_snapshot_at: '2026-03-23T08:00:00.000Z',
                        last_sync_status: 'connected',
                        last_sync_at: '2026-03-22T08:00:00.000Z',
                    },
                    {
                        app_id: 'app-2',
                        user_id: 'user-2',
                        key_mode: 'team',
                        key_id: '2X9R4HXF35',
                        issuer_id: '57246542-96fe-1a63-e053-0824d011072b',
                        asc_app_id: 'apple-app-2',
                        asc_app_name: 'Live',
                        asc_bundle_id: 'com.demo.live',
                        latest_review_state: 'READY_FOR_SALE',
                        last_snapshot_at: '2026-03-23T07:00:00.000Z',
                        last_sync_status: 'connected',
                        last_sync_at: '2026-03-22T07:00:00.000Z',
                    },
                ]),
                { status: 200, headers: { 'content-type': 'application/json' } }
            );
        }

        if (url.pathname === '/rest/v1/connector_app_secrets') {
            assert.equal(url.searchParams.get('app_id'), 'eq.app-1');
            return new Response(JSON.stringify([{ value: privateKeyPem }]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }

        if (url.pathname === '/v1/apps/apple-app-1/appStoreVersions') {
            return new Response(
                JSON.stringify({
                    data: [
                        {
                            id: 'version-1',
                            attributes: {
                                versionString: '1.2.3',
                                appStoreState: 'IN_REVIEW',
                                platform: 'IOS',
                                createdDate: '2026-03-23T09:00:00.000Z',
                            },
                        },
                    ],
                    links: {},
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            );
        }

        if (url.pathname === '/rest/v1/appstore_review_webhooks' && (init.method || 'GET') === 'PATCH') {
            return new Response(
                JSON.stringify([
                    {
                        app_id: 'app-1',
                        user_id: 'user-1',
                        latest_review_state: 'IN_REVIEW',
                        latest_previous_state: 'WAITING_FOR_REVIEW',
                        latest_event_type: 'APPLE_STATUS_SNAPSHOT',
                        latest_event_at: '2026-03-23T10:00:00.000Z',
                        last_snapshot_at: '2026-03-23T10:00:00.000Z',
                        last_error: null,
                        last_sync_status: 'connected',
                    },
                ]),
                { status: 200, headers: { 'content-type': 'application/json' } }
            );
        }

        if (url.pathname === '/rest/v1/appstore_review_events' && (init.method || 'GET') === 'POST') {
            return new Response('', { status: 201 });
        }

        throw new Error(`Unexpected fetch: ${(init.method || 'GET')} ${url.toString()}`);
    };

    try {
        const summary = await runScheduledAppleSnapshotSweep({
            SUPABASE_URL: 'https://supabase.test',
            SUPABASE_SERVICE_ROLE_KEY: 'service-key',
            PUBLIC_ROOT_DOMAIN: 'example.com',
        });

        assert.deepEqual(summary, {
            scanned: 2,
            attempted: 1,
            refreshed: 1,
            changed: 1,
            skipped: 1,
            failed: 0,
        });
        assert.equal(requestedUrls.some((entry) => entry.includes('/v1/webhooks')), false);
        assert.equal(requestedUrls.some((entry) => entry.includes('/v1/apps/apple-app-2/appStoreVersions')), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
