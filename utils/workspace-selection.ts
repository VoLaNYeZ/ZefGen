import type { AppItem, Brand } from '../types/zefgen';
import { isNoBrand } from './no-brand.ts';

export const LAST_APP_BY_BRAND_STORAGE_KEY = 'zefgen.lastAppByBrand';
export const LAST_WORKSPACE_SELECTION_STORAGE_KEY = 'zefgen.lastWorkspaceSelection';

export type WorkspaceSelection = {
    brandId: string | null;
    appId: string | null;
};

export type StoredWorkspaceSelection = {
    brandId: string;
    appId: string;
};

const normalize = (value: unknown) => String(value ?? '').trim();
const normalizeAlias = (value: unknown) => normalize(value).toLowerCase();

const isSelectableApp = (app: Pick<AppItem, 'is_banned'> | null | undefined) => !Boolean(app?.is_banned);
const isActiveBrand = (brand: Pick<Brand, 'is_inactive'> | null | undefined) => !Boolean(brand?.is_inactive);

export const readLastAppByBrand = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(LAST_APP_BY_BRAND_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        const result: Record<string, string> = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([brandId, appId]) => {
            const normalizedBrandId = normalize(brandId);
            const normalizedAppId = normalize(appId);
            if (normalizedBrandId && normalizedAppId) {
                result[normalizedBrandId] = normalizedAppId;
            }
        });
        return result;
    } catch {
        return {};
    }
};

export const writeLastAppByBrand = (map: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAST_APP_BY_BRAND_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // ignore write failures
    }
};

export const readLastWorkspaceSelection = (): StoredWorkspaceSelection | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LAST_WORKSPACE_SELECTION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const brandId = normalize((parsed as Record<string, unknown>).brandId);
        const appId = normalize((parsed as Record<string, unknown>).appId);
        return brandId && appId ? { brandId, appId } : null;
    } catch {
        return null;
    }
};

export const writeLastWorkspaceSelection = (selection: StoredWorkspaceSelection | null) => {
    if (typeof window === 'undefined') return;
    try {
        if (!selection?.brandId || !selection.appId) {
            window.localStorage.removeItem(LAST_WORKSPACE_SELECTION_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(LAST_WORKSPACE_SELECTION_STORAGE_KEY, JSON.stringify(selection));
    } catch {
        // ignore write failures
    }
};

export const getFirstActiveAppForBrand = (orderedApps: AppItem[], brandId: string | null | undefined) => {
    const normalizedBrandId = normalize(brandId);
    if (!normalizedBrandId) return null;
    return orderedApps.find((app) => normalize(app.brand_id) === normalizedBrandId && isSelectableApp(app)) || null;
};

export const getPreferredActiveAppForBrand = ({
    apps,
    brandId,
    lastAppByBrand,
    orderedApps,
}: {
    apps: AppItem[];
    brandId: string | null | undefined;
    lastAppByBrand?: Record<string, string> | null;
    orderedApps: AppItem[];
}) => {
    const normalizedBrandId = normalize(brandId);
    if (!normalizedBrandId) return null;

    const rememberedAppId = normalize(lastAppByBrand?.[normalizedBrandId]);
    if (rememberedAppId) {
        const rememberedApp =
            apps.find((app) => normalize(app.id) === rememberedAppId && normalize(app.brand_id) === normalizedBrandId) || null;
        if (rememberedApp && isSelectableApp(rememberedApp)) return rememberedApp;
    }

    return getFirstActiveAppForBrand(orderedApps, normalizedBrandId);
};

const getFirstActiveRegularBrand = (brands: Brand[]) =>
    brands.find((brand) => !isNoBrand(brand) && isActiveBrand(brand)) || null;

const resolveRememberedWorkspace = ({
    apps,
    brands,
    lastWorkspaceSelection,
}: {
    apps: AppItem[];
    brands: Brand[];
    lastWorkspaceSelection: StoredWorkspaceSelection | null;
}) => {
    if (!lastWorkspaceSelection) return null;
    const rememberedBrand = brands.find((brand) => normalize(brand.id) === normalize(lastWorkspaceSelection.brandId)) || null;
    if (!rememberedBrand || !isActiveBrand(rememberedBrand)) return null;

    const rememberedApp =
        apps.find(
            (app) =>
                normalize(app.id) === normalize(lastWorkspaceSelection.appId) &&
                normalize(app.brand_id) === normalize(rememberedBrand.id)
        ) || null;
    if (!rememberedApp || !isSelectableApp(rememberedApp)) return null;

    return {
        brandId: rememberedBrand.id,
        appId: rememberedApp.id,
    } satisfies WorkspaceSelection;
};

const resolveFallbackWorkspaceSelection = ({
    apps,
    brands,
    lastAppByBrand,
    lastWorkspaceSelection,
    orderedApps,
}: {
    apps: AppItem[];
    brands: Brand[];
    lastAppByBrand?: Record<string, string> | null;
    lastWorkspaceSelection: StoredWorkspaceSelection | null;
    orderedApps: AppItem[];
}) => {
    const rememberedSelection = resolveRememberedWorkspace({ apps, brands, lastWorkspaceSelection });
    if (rememberedSelection) return rememberedSelection;

    const fallbackBrand = getFirstActiveRegularBrand(brands) || brands[0] || null;
    if (!fallbackBrand) {
        return {
            brandId: null,
            appId: null,
        } satisfies WorkspaceSelection;
    }

    const fallbackApp = getPreferredActiveAppForBrand({
        apps,
        brandId: fallbackBrand.id,
        lastAppByBrand,
        orderedApps,
    });

    return {
        brandId: fallbackBrand.id,
        appId: fallbackApp?.id ?? null,
    } satisfies WorkspaceSelection;
};

export const resolveStartupWorkspaceSelection = ({
    appAlias,
    apps,
    brandSlug,
    brands,
    lastAppByBrand,
    lastWorkspaceSelection,
    orderedApps,
}: {
    appAlias?: string | null;
    apps: AppItem[];
    brandSlug?: string | null;
    brands: Brand[];
    lastAppByBrand?: Record<string, string> | null;
    lastWorkspaceSelection: StoredWorkspaceSelection | null;
    orderedApps: AppItem[];
}): WorkspaceSelection => {
    const normalizedBrandSlug = normalizeAlias(brandSlug);
    const normalizedAppAlias = normalizeAlias(appAlias);

    if (normalizedBrandSlug) {
        const matchedBrand = brands.find((brand) => normalizeAlias(brand.slug) === normalizedBrandSlug) || null;
        if (matchedBrand && normalizedAppAlias) {
            const matchedApp =
                apps.find(
                    (app) =>
                        normalize(app.brand_id) === normalize(matchedBrand.id) &&
                        normalizeAlias(app.alias) === normalizedAppAlias
                ) || null;
            if (matchedApp) {
                return {
                    brandId: matchedBrand.id,
                    appId: matchedApp.id,
                };
            }
            return resolveFallbackWorkspaceSelection({ apps, brands, lastAppByBrand, lastWorkspaceSelection, orderedApps });
        }

        if (matchedBrand) {
            const nextApp = getPreferredActiveAppForBrand({
                apps,
                brandId: matchedBrand.id,
                lastAppByBrand,
                orderedApps,
            });
            return {
                brandId: matchedBrand.id,
                appId: nextApp?.id ?? null,
            };
        }
    }

    return resolveFallbackWorkspaceSelection({ apps, brands, lastAppByBrand, lastWorkspaceSelection, orderedApps });
};
