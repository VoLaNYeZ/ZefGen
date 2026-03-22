import { lazy, type ComponentType } from 'react';

const CHUNK_ERROR_RELOAD_PREFIX = 'zefgen.lazyChunkReload';
const CHUNK_ERROR_PATTERN =
    /error loading dynamically imported module|failed to fetch dynamically imported module|importing a module script failed/i;

const isRecoverableChunkLoadError = (error: unknown) => {
    const message = String((error as { message?: unknown } | null)?.message ?? error ?? '').trim();
    return CHUNK_ERROR_PATTERN.test(message);
};

const getReloadStorageKey = () => {
    if (typeof window === 'undefined') return CHUNK_ERROR_RELOAD_PREFIX;
    return `${CHUNK_ERROR_RELOAD_PREFIX}:${window.location.pathname}`;
};

export const lazyWithReload = <T extends ComponentType<any>>(
    importer: () => Promise<{ default: T }>
) =>
    lazy(async () => {
        try {
            const module = await importer();
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem(getReloadStorageKey());
            }
            return module;
        } catch (error) {
            if (typeof window !== 'undefined' && isRecoverableChunkLoadError(error)) {
                const reloadKey = getReloadStorageKey();
                if (window.sessionStorage.getItem(reloadKey) !== '1') {
                    window.sessionStorage.setItem(reloadKey, '1');
                    window.location.reload();
                    return new Promise<never>(() => {});
                }
                window.sessionStorage.removeItem(reloadKey);
            }

            throw error;
        }
    });
