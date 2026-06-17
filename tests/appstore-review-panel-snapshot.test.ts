import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAppStoreReviewPanelSnapshot,
    type AppStoreReviewPanelSnapshot,
} from '../types/appstore-review-panel-snapshot.ts';
import type { AppstoreConnectAppCandidate, AppstoreReviewWebhookStatus } from '../types/zefgen';

const candidate: AppstoreConnectAppCandidate = {
    id: 'asc-app-1',
    name: 'Primary Cached App',
    bundle_id: 'com.example.primary',
    sku: 'PRIMARY-1',
    bundle_match: true,
};

const status: AppstoreReviewWebhookStatus = {
    webhook: {
        app_id: 'app-1',
        public_token: 'public-token',
        secret: 'secret-token',
        public_subdomain: 'primary-review',
        key_mode: 'team',
        key_id: 'KEY-PRIMARY',
        issuer_id: '57246542-96fe-1a63-e053-0824d011072a',
        asc_app_id: candidate.id,
        asc_app_name: candidate.name,
        asc_bundle_id: candidate.bundle_id,
        latest_review_state: 'IN_REVIEW',
        last_delivery_status: 'received',
        last_sync_status: 'connected',
    },
    events: [],
    bundle_id: candidate.bundle_id,
    private_key_configured: true,
    effective_public_webhook_url: 'https://primary-review.example.com/appstore-review?token=public-token',
    effective_public_page_url: 'https://primary-review.example.com/',
    credential_issues: [],
    webhook_readiness_issues: [],
};

test('buildAppStoreReviewPanelSnapshot keeps only clean restorable panel state', () => {
    const snapshot = buildAppStoreReviewPanelSnapshot({
        appId: 'app-1',
        status,
        appStoreNameHint: 'Primary App Store Name',
        appleCandidates: [candidate],
        appleCandidatesLoaded: true,
        expanded: true,
        quickSetupEditing: false,
        hasDraftChanges: false,
        privateKeyDraft: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
    });

    const typedSnapshot = snapshot as AppStoreReviewPanelSnapshot;
    assert.ok(typedSnapshot);
    assert.deepEqual(typedSnapshot.appleCandidates, [candidate]);
    assert.equal(typedSnapshot.appleCandidatesLoaded, true);
    assert.equal(typedSnapshot.expanded, true);
    assert.equal(typedSnapshot.quickSetupEditing, false);
    assert.deepEqual(Object.keys(typedSnapshot).sort(), [
        'appId',
        'appStoreNameHint',
        'appleCandidates',
        'appleCandidatesLoaded',
        'expanded',
        'quickSetupEditing',
        'status',
    ]);
    assert.equal('privateKeyDraft' in typedSnapshot, false);
});

test('buildAppStoreReviewPanelSnapshot skips dirty panel state', () => {
    const snapshot = buildAppStoreReviewPanelSnapshot({
        appId: 'app-1',
        status,
        appStoreNameHint: 'Primary App Store Name',
        appleCandidates: [candidate],
        appleCandidatesLoaded: true,
        expanded: true,
        quickSetupEditing: true,
        hasDraftChanges: true,
        privateKeyDraft: 'secret',
    });

    assert.equal(snapshot, null);
});
