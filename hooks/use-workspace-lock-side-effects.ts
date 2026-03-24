import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_LOCK_ENFORCEMENT_ENABLED,
} from '../constants/zefgen';
import type { TranslationKey } from '../i18n';
import type { AppItem, Brand, BrandLockResult } from '../types/zefgen';
import type { AppPage } from '../utils/routes';

type RequestWorkspaceSelection = (payload: {
    brandId: string | null;
    appId: string | null;
    historyMode?: 'push' | 'replace' | 'none';
}) => Promise<boolean>;

type Params = {
    activePage: AppPage;
    brands: Brand[];
    isCurrentBrandReadOnly: boolean;
    lockConflictBrandId: string | null;
    lockedBrandIdSet: Set<string>;
    orderedApps: AppItem[];
    refreshSnapshot: () => Promise<void>;
    reportLockedBrandWarning: () => void;
    requestWorkspaceSelection: RequestWorkspaceSelection;
    selectedBrandId: string | null;
    setHeartbeatBrandId: Dispatch<SetStateAction<string | null>>;
    softLockViewModeEnabled: boolean;
    takeOverBrand: (brandId: string) => Promise<BrandLockResult>;
    text: (key: TranslationKey) => string;
    tryClaimBrand: (brandId: string) => Promise<BrandLockResult>;
    workspaceSwitchPending: boolean;
};

export function useWorkspaceLockSideEffects({
    activePage,
    brands,
    isCurrentBrandReadOnly,
    lockConflictBrandId,
    lockedBrandIdSet,
    orderedApps,
    refreshSnapshot,
    reportLockedBrandWarning,
    requestWorkspaceSelection,
    selectedBrandId,
    setHeartbeatBrandId,
    softLockViewModeEnabled,
    takeOverBrand,
    text,
    tryClaimBrand,
    workspaceSwitchPending,
}: Params) {
    const wasCurrentBrandReadOnlyRef = useRef(false);
    const previousSelectedBrandIdRef = useRef<string | null>(null);
    const lockFallbackAttemptRef = useRef('');
    const [isTakingOverEditLock, setIsTakingOverEditLock] = useState(false);
    const [takeOverEditLockErrorKey, setTakeOverEditLockErrorKey] = useState<TranslationKey | null>(null);

    useEffect(() => {
        if (!WORKSPACE_COLLAB_ENABLED) {
            setHeartbeatBrandId(null);
            return;
        }
        if (activePage !== 'workspace' || !selectedBrandId || isCurrentBrandReadOnly) {
            setHeartbeatBrandId(null);
            return;
        }
        setHeartbeatBrandId(selectedBrandId);
    }, [activePage, isCurrentBrandReadOnly, selectedBrandId, setHeartbeatBrandId]);

    useEffect(() => {
        if (isCurrentBrandReadOnly && !wasCurrentBrandReadOnlyRef.current) {
            reportLockedBrandWarning();
        }
        wasCurrentBrandReadOnlyRef.current = isCurrentBrandReadOnly;
    }, [isCurrentBrandReadOnly, reportLockedBrandWarning]);

    useEffect(() => {
        if (previousSelectedBrandIdRef.current !== selectedBrandId) {
            previousSelectedBrandIdRef.current = selectedBrandId;
            setTakeOverEditLockErrorKey(null);
            return;
        }
        if (!selectedBrandId || !isCurrentBrandReadOnly) {
            setTakeOverEditLockErrorKey(null);
        }
    }, [isCurrentBrandReadOnly, selectedBrandId]);

    useEffect(() => {
        if (!WORKSPACE_COLLAB_ENABLED || !WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
            lockFallbackAttemptRef.current = '';
            return;
        }
        if (softLockViewModeEnabled) {
            lockFallbackAttemptRef.current = '';
            return;
        }
        if (activePage !== 'workspace') {
            lockFallbackAttemptRef.current = '';
            return;
        }
        if (!selectedBrandId) {
            lockFallbackAttemptRef.current = '';
            return;
        }

        const conflictOnSelectedBrand =
            (lockConflictBrandId && lockConflictBrandId === selectedBrandId) ||
            lockedBrandIdSet.has(selectedBrandId);
        if (!conflictOnSelectedBrand) {
            lockFallbackAttemptRef.current = '';
            return;
        }

        const fallbackBrand = brands.find((brand) => !lockedBrandIdSet.has(brand.id)) || null;
        const fallbackApp = fallbackBrand
            ? orderedApps.find((app) => app.brand_id === fallbackBrand.id) || null
            : null;
        const attemptKey = `${selectedBrandId}->${fallbackBrand?.id ?? 'none'}:${fallbackApp?.id ?? 'none'}`;
        if (workspaceSwitchPending) return;
        if (lockFallbackAttemptRef.current === attemptKey) return;
        lockFallbackAttemptRef.current = attemptKey;

        if (!fallbackBrand) {
            void requestWorkspaceSelection({
                brandId: null,
                appId: null,
                historyMode: 'replace',
            });
            return;
        }

        if (fallbackBrand.id === selectedBrandId) return;
        void requestWorkspaceSelection({
            brandId: fallbackBrand.id,
            appId: fallbackApp?.id ?? null,
            historyMode: 'replace',
        });
    }, [
        activePage,
        brands,
        lockConflictBrandId,
        lockedBrandIdSet,
        orderedApps,
        requestWorkspaceSelection,
        selectedBrandId,
        softLockViewModeEnabled,
        workspaceSwitchPending,
    ]);

    const handleTakeOverEditing = useCallback(() => {
        if (!softLockViewModeEnabled || !selectedBrandId || isTakingOverEditLock) return;
        setTakeOverEditLockErrorKey(null);
        setIsTakingOverEditLock(true);
        void (async () => {
            try {
                const result = await takeOverBrand(selectedBrandId);
                if (!result.ok) {
                    setTakeOverEditLockErrorKey('brand_take_over_failed');
                    return;
                }
                setTakeOverEditLockErrorKey(null);
                setHeartbeatBrandId(selectedBrandId);
                await refreshSnapshot().catch(() => {});
            } catch {
                setTakeOverEditLockErrorKey('brand_take_over_failed');
            } finally {
                setIsTakingOverEditLock(false);
            }
        })();
    }, [
        isTakingOverEditLock,
        refreshSnapshot,
        selectedBrandId,
        setHeartbeatBrandId,
        softLockViewModeEnabled,
        takeOverBrand,
    ]);

    return {
        handleTakeOverEditing,
        isTakingOverEditLock,
        takeOverEditLockError: takeOverEditLockErrorKey ? text(takeOverEditLockErrorKey) : null,
    };
}
