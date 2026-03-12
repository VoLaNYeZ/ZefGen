import { useMemo } from 'react';
import {
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_LOCK_ENFORCEMENT_ENABLED,
    WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED,
} from '../constants/zefgen';
import type { AppPage } from '../utils/routes';

type Params = {
    activePage: AppPage;
    lockConflictBrandId: string | null;
    lockedBrandIdSet: Set<string>;
    selectedBrandId: string | null;
};

export function useWorkspaceReadOnlyState({
    activePage,
    lockConflictBrandId,
    lockedBrandIdSet,
    selectedBrandId,
}: Params) {
    const sidebarLockedBrandIdSet = useMemo(
        () => (WORKSPACE_LOCK_ENFORCEMENT_ENABLED ? lockedBrandIdSet : new Set<string>()),
        [lockedBrandIdSet]
    );

    const softLockViewModeEnabled =
        WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED &&
        WORKSPACE_COLLAB_ENABLED &&
        WORKSPACE_LOCK_ENFORCEMENT_ENABLED;

    const isCurrentBrandBusyByOtherDevice = Boolean(
        activePage === 'workspace' && selectedBrandId && sidebarLockedBrandIdSet.has(selectedBrandId)
    );

    const isCurrentBrandReadOnly = Boolean(
        softLockViewModeEnabled &&
            activePage === 'workspace' &&
            selectedBrandId &&
            (isCurrentBrandBusyByOtherDevice || lockConflictBrandId === selectedBrandId)
    );

    return {
        isCurrentBrandReadOnly,
        sidebarLockedBrandIdSet,
        softLockViewModeEnabled,
    };
}
