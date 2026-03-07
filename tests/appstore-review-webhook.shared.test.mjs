import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
    buildDefaultPublicWebhookUrl,
    buildManagedPublicPageUrl,
    buildManagedPublicWebhookUrl,
    createAppStoreConnectJwt,
    extractManagedPublicSubdomainFromUrl,
    getAppleCredentialIssues,
    isUsingSharedDefaultWebhookUrl,
    normalizeAppleAppCandidates,
    normalizeApplePrivateKeyPem,
    normalizePublicSubdomain,
    pickAutoBoundAppleApp,
    withSubdomainSuffix,
} from '../api/appstore-review-webhook.shared.js';

const decodeBase64UrlJson = (input) => {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

const decodeBase64UrlBuffer = (input) => {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
};

test('createAppStoreConnectJwt signs a valid team token', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const nowMs = 1_710_000_000_000;

    const token = createAppStoreConnectJwt({
        keyMode: 'team',
        keyId: '2X9R4HXF34',
        issuerId: '57246542-96fe-1a63-e053-0824d011072a',
        privateKeyPem,
        nowMs,
    });

    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const header = decodeBase64UrlJson(encodedHeader);
    const payload = decodeBase64UrlJson(encodedPayload);
    const signature = decodeBase64UrlBuffer(encodedSignature);

    assert.equal(header.alg, 'ES256');
    assert.equal(header.kid, '2X9R4HXF34');
    assert.equal(header.typ, 'JWT');
    assert.equal(payload.iss, '57246542-96fe-1a63-e053-0824d011072a');
    assert.equal(payload.aud, 'appstoreconnect-v1');
    assert.equal(payload.iat, Math.floor(nowMs / 1000));
    assert.equal(payload.exp, Math.floor(nowMs / 1000) + 20 * 60);
    assert.equal(payload.sub, undefined);

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const verified = crypto.verify('sha256', Buffer.from(signingInput), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    assert.equal(verified, true);
});

test('createAppStoreConnectJwt supports individual keys and escaped newlines', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const escapedPem = privateKeyPem.replace(/\n/g, '\\n');

    const token = createAppStoreConnectJwt({
        keyMode: 'individual',
        keyId: 'ABCD123456',
        privateKeyPem: escapedPem,
        nowMs: 1_710_000_000_000,
    });

    const [, encodedPayload] = token.split('.');
    const payload = decodeBase64UrlJson(encodedPayload);

    assert.equal(payload.sub, 'user');
    assert.equal(payload.iss, undefined);
    assert.equal(normalizeApplePrivateKeyPem(escapedPem), privateKeyPem.endsWith('\n') ? privateKeyPem : `${privateKeyPem}\n`);
});

test('normalizeAppleAppCandidates marks bundle matches and auto-binding only when unique', () => {
    const candidates = normalizeAppleAppCandidates(
        [
            { id: '3', attributes: { name: 'Zeta', bundleId: 'com.other.app', sku: 'SKU-3' } },
            { id: '2', attributes: { name: 'Beta', bundleId: 'com.example.app', sku: 'SKU-2' } },
            { id: '1', attributes: { name: 'Alpha', bundleId: 'com.duplicate.app', sku: 'SKU-1' } },
        ],
        'com.example.app'
    );

    assert.equal(candidates[0].id, '2');
    assert.equal(candidates[0].bundle_match, true);
    assert.equal(pickAutoBoundAppleApp(candidates, 'com.example.app')?.id, '2');

    const duplicateCandidates = normalizeAppleAppCandidates(
        [
            { id: '1', attributes: { name: 'Alpha', bundleId: 'com.duplicate.app', sku: 'SKU-1' } },
            { id: '2', attributes: { name: 'Beta', bundleId: 'com.duplicate.app', sku: 'SKU-2' } },
        ],
        'com.duplicate.app'
    );
    assert.equal(pickAutoBoundAppleApp(duplicateCandidates, 'com.duplicate.app'), null);
});

test('buildDefaultPublicWebhookUrl and shared-host detection distinguish shared vs custom hosts', () => {
    const defaultUrl = buildDefaultPublicWebhookUrl({
        publicToken: 'abc123',
        publicBaseUrl: 'https://hooks.shared.example.com/appstore-review',
        supabaseUrl: 'https://project.supabase.co',
    });

    assert.equal(defaultUrl, 'https://hooks.shared.example.com/appstore-review?token=abc123');
    assert.equal(
        isUsingSharedDefaultWebhookUrl({
            configuredUrl: '',
            defaultUrl,
        }),
        true
    );
    assert.equal(
        isUsingSharedDefaultWebhookUrl({
            configuredUrl: 'https://hooks.shared.example.com/client-a/appstore-review',
            defaultUrl,
        }),
        true
    );
    assert.equal(
        isUsingSharedDefaultWebhookUrl({
            configuredUrl: 'https://hooks.client-a.example.com/appstore-review',
            defaultUrl,
        }),
        false
    );
});

test('managed webhook URL helpers use clean subdomains without token suffixes', () => {
    assert.equal(normalizePublicSubdomain('HoldList: In Due Time'), 'holdlist-in-due-time');
    assert.equal(withSubdomainSuffix('holdlist-in-due-time', 1), 'holdlist-in-due-time');
    assert.equal(withSubdomainSuffix('holdlist-in-due-time', 2), 'holdlist-in-due-time-2');

    const managedUrl = buildManagedPublicWebhookUrl({
        publicToken: 'edaa857508c7bbf7b74cb6312811b33a',
        publicSubdomain: 'holdlist-in-due-time',
        rootDomain: 'appshelp.cc',
    });

    assert.equal(
        managedUrl,
        'https://holdlist-in-due-time.appshelp.cc/appstore-review?token=edaa857508c7bbf7b74cb6312811b33a'
    );
    assert.equal(
        extractManagedPublicSubdomainFromUrl(managedUrl, 'appshelp.cc'),
        'holdlist-in-due-time'
    );
    assert.equal(
        buildManagedPublicPageUrl({
            publicSubdomain: 'holdlist-in-due-time',
            rootDomain: 'appshelp.cc',
        }),
        'https://holdlist-in-due-time.appshelp.cc/'
    );
});

test('getAppleCredentialIssues reflects missing fields for team keys', () => {
    assert.deepEqual(
        getAppleCredentialIssues({
            keyMode: 'team',
            keyId: '',
            issuerId: '',
            privateKeyConfigured: false,
        }),
        ['Enter key ID.', 'Enter issuer ID.', 'Upload the .p8 private key.']
    );
});
