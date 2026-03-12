import type { ComponentProps, RefObject } from 'react';
import { Menu } from 'lucide-react';
import { AppShellOverlays } from './AppShellOverlays';
import { AppShellPageContent } from './AppShellPageContent';
import { Sidebar } from './Sidebar';
import { WorkspaceShellChrome } from './WorkspaceShellChrome';

type Props = {
    isSidebarOpen: boolean;
    mainScrollRef: RefObject<HTMLDivElement | null>;
    setIsSidebarOpen: ComponentProps<typeof Sidebar>['setIsSidebarOpen'];
    sidebarProps: ComponentProps<typeof Sidebar>;
    shellChromeProps: ComponentProps<typeof WorkspaceShellChrome>;
    pageContentProps: ComponentProps<typeof AppShellPageContent>;
    overlayProps: ComponentProps<typeof AppShellOverlays>;
};

export function AppShellLayout({
    isSidebarOpen,
    mainScrollRef,
    setIsSidebarOpen,
    sidebarProps,
    shellChromeProps,
    pageContentProps,
    overlayProps,
}: Props) {
    const isWorkspacePage = pageContentProps.activePage === 'workspace';

    return (
        <div
            data-ui-lang={sidebarProps.lang}
            data-testid="app-shell-root"
            className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Manrope']"
        >
            {!isSidebarOpen ? (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 rounded-full bg-slate-800 p-2 shadow-lg md:hidden"
                >
                    <Menu size={18} />
                </button>
            ) : null}

            {isSidebarOpen ? (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            ) : null}

            <Sidebar {...sidebarProps} />

            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div ref={mainScrollRef} className="flex-1 overflow-y-auto">
                    <div className="min-h-full px-6 py-8 lg:px-10">
                        <div className={`mx-auto space-y-8 ${isWorkspacePage ? 'max-w-6xl' : 'max-w-none'}`}>
                            <WorkspaceShellChrome {...shellChromeProps} />
                            <AppShellPageContent {...pageContentProps} />
                        </div>
                    </div>
                </div>
            </main>

            <AppShellOverlays {...overlayProps} />
        </div>
    );
}
