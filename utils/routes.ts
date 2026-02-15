import type { AppItem, Brand } from '../types/zefgen';

export type AppPage = 'workspace' | 'accounts' | 'ideas';

export const buildRoute = (brand?: Brand | null, app?: AppItem | null) => {
    if (!brand) return '/';
    if (!app) return `/${brand.slug}`;
    return `/${brand.slug}/${app.alias}`;
};

export const buildAccountsRoute = () => '/accounts';
export const buildIdeasRoute = () => '/ideas';

export const parseRoute = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const head = String(parts[0] || '').toLowerCase();
    if (head === 'accounts') return { page: 'accounts' as const };
    if (head === 'ideas') return { page: 'ideas' as const };
    return { page: 'workspace' as const, brandSlug: parts[0], appAlias: parts[1] };
};
