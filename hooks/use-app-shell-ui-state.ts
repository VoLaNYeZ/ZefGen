import { useEffect, useRef, useState } from 'react';
import type { AppPage } from '../utils/routes';
import { parseRoute } from '../utils/routes';

export function useAppShellUiState() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lang, setLang] = useState<'en' | 'ru'>(() => {
        try {
            const raw = window.localStorage.getItem('zefgen.lang');
            return raw === 'ru' ? 'ru' : 'en';
        } catch {
            return 'en';
        }
    });
    const [activePage, setActivePage] = useState<AppPage>(() => {
        try {
            return parseRoute().page;
        } catch {
            return 'workspace';
        }
    });
    const [accountsFocusAppId, setAccountsFocusAppId] = useState<string | null>(null);
    const [accountsHasUnsavedChanges, setAccountsHasUnsavedChanges] = useState(false);
    const [ideasHasUnsavedChanges, setIdeasHasUnsavedChanges] = useState(false);
    const [logoVariantIndex, setLogoVariantIndex] = useState(4);
    const logoWord = 'ZEFGEN';
    const logoContainerRef = useRef<HTMLDivElement>(null);
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const [logoFontReady, setLogoFontReady] = useState(false);
    const [gooeyDebug, _setGooeyDebug] = useState(false);
    const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
    const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);

    useEffect(() => {
        try {
            window.localStorage.setItem('zefgen.lang', lang);
        } catch {
            // ignore
        }
    }, [lang]);

    useEffect(() => {
        let active = true;
        const ready = () => {
            if (active) setLogoFontReady(true);
        };
        if (document?.fonts?.ready) {
            document.fonts.ready.then(ready).catch(ready);
        } else {
            ready();
        }
        return () => {
            active = false;
        };
    }, []);

    return {
        accountsFocusAppId,
        accountsHasUnsavedChanges,
        activePage,
        draggingAppId,
        dragOverAppId,
        gooeyDebug,
        ideasHasUnsavedChanges,
        isSidebarOpen,
        lang,
        logoContainerRef,
        logoFontReady,
        logoVariantIndex,
        logoWord,
        mainScrollRef,
        setAccountsFocusAppId,
        setAccountsHasUnsavedChanges,
        setActivePage,
        setDraggingAppId,
        setDragOverAppId,
        setIdeasHasUnsavedChanges,
        setIsSidebarOpen,
        setLang,
        setLogoVariantIndex,
        stickyHeaderRef,
    };
}
