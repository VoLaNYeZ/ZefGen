import type { AppItem, Brand } from '../types/zefgen';

export type AppPage = 'workspace' | 'accounts' | 'help' | 'ideas';
export type NonWorkspacePage = Exclude<AppPage, 'workspace'>;

const NON_WORKSPACE_ROUTES: Record<NonWorkspacePage, string> = {
    accounts: '/accounts',
    help: '/help',
    ideas: '/ideas',
};

export const buildRoute = (brand?: Brand | null, app?: AppItem | null) => {
    if (!brand) return '/';
    if (!app) return `/${brand.slug}`;
    return `/${brand.slug}/${app.alias}`;
};

export const buildNonWorkspaceRoute = (page: NonWorkspacePage) => NON_WORKSPACE_ROUTES[page];
export const buildAccountsRoute = () => buildNonWorkspaceRoute('accounts');
export const buildHelpRoute = () => buildNonWorkspaceRoute('help');
export const buildIdeasRoute = () => buildNonWorkspaceRoute('ideas');

export const parseRoute = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const head = String(parts[0] || '').toLowerCase();
    if (head === 'accounts') return { page: 'accounts' as const };
    if (head === 'help') return { page: 'help' as const };
    if (head === 'ideas') return { page: 'ideas' as const };
    return { page: 'workspace' as const, brandSlug: parts[0], appAlias: parts[1] };
};
