import type { AppItem, Brand } from '../types/zefgen';

export const buildRoute = (brand?: Brand | null, app?: AppItem | null) => {
    if (!brand) return '/';
    if (!app) return `/${brand.slug}`;
    return `/${brand.slug}/${app.alias}`;
};

export const parseRoute = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return {
        brandSlug: parts[0],
        appAlias: parts[1],
    };
};
