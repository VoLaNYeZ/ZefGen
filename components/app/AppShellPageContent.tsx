import { Suspense, type ComponentProps } from 'react';
import type { Brand } from '../../types/zefgen';
import type { AppPage } from '../../utils/routes';
import { lazyWithReload } from '../../utils/lazy-with-reload';

type AccountsPageComponent = (typeof import('./AccountsPage'))['AccountsPage'];
type IdeasPageComponent = (typeof import('./IdeasPage'))['IdeasPage'];
type WorkspacePageComponent = (typeof import('./WorkspacePage'))['WorkspacePage'];

const LazyAccountsPage = lazyWithReload(async () => {
    const module = await import('./AccountsPage');
    return { default: module.AccountsPage };
});

const LazyIdeasPage = lazyWithReload(async () => {
    const module = await import('./IdeasPage');
    return { default: module.IdeasPage };
});

const LazyWorkspacePage = lazyWithReload(async () => {
    const module = await import('./WorkspacePage');
    return { default: module.WorkspacePage };
});

type WorkspaceContentProps = Omit<ComponentProps<WorkspacePageComponent>, 'selectedBrand'> & {
    selectedBrand: Brand | null;
};

export type AppShellPageContentProps = {
    accounts: ComponentProps<AccountsPageComponent>;
    activePage: AppPage;
    ideas: ComponentProps<IdeasPageComponent>;
    loadingLabel: string;
    workspace: WorkspaceContentProps;
};

function PageContentFallback({ label }: { label: string }) {
    return (
        <div className="rounded-[32px] border border-white/8 bg-slate-900/45 px-6 py-12 text-center shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)]">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-300/25 border-t-indigo-300" />
            <p className="mt-4 text-sm font-medium text-indigo-100/80">{label}</p>
        </div>
    );
}

export function AppShellPageContent({
    accounts,
    activePage,
    ideas,
    loadingLabel,
    workspace,
}: AppShellPageContentProps) {
    if (activePage === 'workspace') {
        const selectedBrand = workspace.selectedBrand;
        if (!selectedBrand) return null;
        const workspacePageProps: ComponentProps<WorkspacePageComponent> = {
            ...workspace,
            selectedBrand,
        };
        return (
            <Suspense fallback={<PageContentFallback label={loadingLabel} />}>
                <LazyWorkspacePage {...workspacePageProps} />
            </Suspense>
        );
    }

    if (activePage === 'accounts') {
        return (
            <Suspense fallback={<PageContentFallback label={loadingLabel} />}>
                <LazyAccountsPage {...accounts} />
            </Suspense>
        );
    }

    if (activePage === 'ideas') {
        return (
            <Suspense fallback={<PageContentFallback label={loadingLabel} />}>
                <LazyIdeasPage {...ideas} />
            </Suspense>
        );
    }

    return null;
}
