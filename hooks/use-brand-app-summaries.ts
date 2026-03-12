import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchAllExportStatuses, fetchAllScreenshotSetCounts } from '../data/app-indicators';
import type { AppItem, Brand } from '../types/zefgen';

export type BrandAppSummary = {
    total: number;
    active: number;
    green: number;
    yellow: number;
    red: number;
};

type Params = {
    apps: AppItem[];
    brands: Brand[];
    session: Session | null;
};

export function useBrandAppSummaries({ apps, brands, session }: Params) {
    const [appScreenshotSetCountByAppId, setAppScreenshotSetCountByAppId] = useState<Record<string, number>>({});
    const [appCompletedByAppId, setAppCompletedByAppId] = useState<Record<string, boolean>>({});

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

            let green = 0;
            let yellow = 0;
            let red = 0;
            for (const app of brandApps) {
                if (app.is_banned) {
                    red += 1;
                    continue;
                }
                const setCount = appScreenshotSetCountByAppId[app.id] || 0;
                if (setCount > 1) {
                    green += 1;
                    continue;
                }
                if (appCompletedByAppId[app.id]) {
                    yellow += 1;
                }
            }

            byBrand[brand.id] = {
                total: brandApps.length,
                active: Math.max(0, brandApps.length - red),
                green,
                yellow,
                red,
            };
        }

        return byBrand;
    }, [appCompletedByAppId, appScreenshotSetCountByAppId, apps, brands]);

    useEffect(() => {
        if (!session) {
            setAppScreenshotSetCountByAppId({});
            setAppCompletedByAppId({});
            return;
        }
        if (!apps.length) {
            setAppScreenshotSetCountByAppId({});
            setAppCompletedByAppId({});
            return;
        }

        let active = true;
        (async () => {
            const [setsResp, statusResp] = await Promise.all([
                fetchAllScreenshotSetCounts(session.user.id),
                fetchAllExportStatuses(session.user.id),
            ]);

            if (!active) return;

            if (!setsResp.error) {
                const counts: Record<string, number> = {};
                for (const row of setsResp.data || []) {
                    const appId = String((row as any).app_id || '');
                    if (!appId) continue;
                    counts[appId] = (counts[appId] || 0) + 1;
                }
                setAppScreenshotSetCountByAppId(counts);
            }

            if (!statusResp.error) {
                const completed: Record<string, boolean> = {};
                for (const row of statusResp.data || []) {
                    const appId = String((row as any).app_id || '');
                    if (!appId) continue;
                    completed[appId] = Boolean((row as any).is_completed);
                }
                setAppCompletedByAppId(completed);
            }
        })();

        return () => {
            active = false;
        };
    }, [apps.length, session]);

    return {
        brandAppSummaryByBrandId,
    };
}
