import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchAllAppstoreReviewStates } from '../data/app-indicators';
import type { AppItem, Brand } from '../types/zefgen';
import {
    EMPTY_BRAND_APP_SUMMARY,
    summarizeBrandApps,
    type BrandAppSummary,
} from '../utils/brand-app-summary';

export type { BrandAppSummary } from '../utils/brand-app-summary';

type Params = {
    apps: AppItem[];
    brands: Brand[];
    session: Session | null;
    reviewStateOverridesByAppId?: Record<string, string | null | undefined>;
};

export function useBrandAppSummaries({ apps, brands, session, reviewStateOverridesByAppId = {} }: Params) {
    const [appLatestReviewStateByAppId, setAppLatestReviewStateByAppId] = useState<Record<string, string | null>>({});

    const brandAppSummaryByBrandId = useMemo(() => {
        const byBrand: Record<string, BrandAppSummary> = {};

        for (const brand of brands) {
            const brandApps = apps
                .filter((app) => app.brand_id === brand.id)
                .sort((a, b) => {
                    const ai = a.order_index ?? Number.MAX_SAFE_INTEGER;
                    const bi = b.order_index ?? Number.MAX_SAFE_INTEGER;
                    if (ai !== bi) return ai - bi;
                    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return at - bt;
                });

            byBrand[brand.id] = summarizeBrandApps({
                apps: brandApps,
                reviewStateByAppId: appLatestReviewStateByAppId,
                reviewStateOverridesByAppId,
            });
        }

        return byBrand;
    }, [appLatestReviewStateByAppId, apps, brands, reviewStateOverridesByAppId]);

    useEffect(() => {
        if (!session) {
            setAppLatestReviewStateByAppId({});
            return;
        }
        if (!apps.length) {
            setAppLatestReviewStateByAppId({});
            return;
        }

        let active = true;
        (async () => {
            const reviewStateResp = await fetchAllAppstoreReviewStates(session.user.id);

            if (!active) return;

            if (!reviewStateResp.error) {
                const nextStateByAppId: Record<string, string | null> = {};
                for (const row of reviewStateResp.data || []) {
                    const appId = String((row as any).app_id || '');
                    if (!appId) continue;
                    nextStateByAppId[appId] = String((row as any).latest_review_state || '').trim() || null;
                }
                setAppLatestReviewStateByAppId(nextStateByAppId);
            }
        })();

        return () => {
            active = false;
        };
    }, [apps.length, session]);

    return {
        brandAppSummaryByBrandId,
        emptyBrandAppSummary: EMPTY_BRAND_APP_SUMMARY,
    };
}
