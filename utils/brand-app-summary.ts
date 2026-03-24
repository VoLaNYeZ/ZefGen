import {
    isActiveAppstoreReviewState,
    isAttentionAppstoreReviewState,
    normalizeAppstoreReviewState,
} from '../lib/appstore-review-state.shared.js';
import type { AppItem } from '../types/zefgen';

export type BrandAppSummary = {
    total: number;
    nonBanned: number;
    active: number;
    inProgress: number;
    banned: number;
    inProgressAttentionCount: number;
};

export const EMPTY_BRAND_APP_SUMMARY: BrandAppSummary = Object.freeze({
    total: 0,
    nonBanned: 0,
    active: 0,
    inProgress: 0,
    banned: 0,
    inProgressAttentionCount: 0,
});

type ReviewStateMap = Record<string, string | null | undefined>;

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export const resolveBrandSummaryReviewState = (payload: {
    appId: string;
    reviewStateByAppId?: ReviewStateMap;
    reviewStateOverridesByAppId?: ReviewStateMap;
}) => {
    const appId = String(payload.appId || '').trim();
    if (!appId) return '';

    const overrides = payload.reviewStateOverridesByAppId || {};
    if (hasOwn(overrides, appId)) {
        return normalizeAppstoreReviewState(overrides[appId]);
    }

    return normalizeAppstoreReviewState(payload.reviewStateByAppId?.[appId]);
};

export const summarizeBrandApps = (payload: {
    apps: AppItem[];
    reviewStateByAppId?: ReviewStateMap;
    reviewStateOverridesByAppId?: ReviewStateMap;
}): BrandAppSummary => {
    const apps = Array.isArray(payload.apps) ? payload.apps : [];
    const summary: BrandAppSummary = {
        total: apps.length,
        nonBanned: 0,
        active: 0,
        inProgress: 0,
        banned: 0,
        inProgressAttentionCount: 0,
    };

    for (const app of apps) {
        if (app.is_banned) {
            summary.banned += 1;
            continue;
        }

        summary.nonBanned += 1;
        const reviewState = resolveBrandSummaryReviewState({
            appId: app.id,
            reviewStateByAppId: payload.reviewStateByAppId,
            reviewStateOverridesByAppId: payload.reviewStateOverridesByAppId,
        });

        if (isActiveAppstoreReviewState(reviewState)) {
            summary.active += 1;
            continue;
        }

        summary.inProgress += 1;
        if (isAttentionAppstoreReviewState(reviewState)) {
            summary.inProgressAttentionCount += 1;
        }
    }

    return summary;
};
