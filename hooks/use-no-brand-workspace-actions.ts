import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
    WORKSPACE_COLLAB_ENABLED,
    WORKSPACE_LOCK_ENFORCEMENT_ENABLED,
} from '../constants/zefgen';
import { generateNoBrandIconPrompt } from '../data/icon-prompt';
import { moveAppToBrand } from '../data/apps';
import type { TranslationKey } from '../i18n';
import type { AppItem, Brand, BrandLockResult } from '../types/zefgen';
import { makeUniqueAlias, slugify } from '../utils/slug';

type RequestWorkspaceSelection = (payload: {
    brandId: string | null;
    appId: string | null;
    historyMode?: 'push' | 'replace' | 'none';
    closeSidebar?: boolean;
    skipCollaborationLockPreparation?: boolean;
}) => Promise<boolean>;

type IconPromptParams = {
    clientSpec: string;
    isNoBrandMode: boolean;
    patchApp: (appId: string, patch: Partial<AppItem>) => Promise<AppItem | null>;
    reportActionError: (message: string) => void;
    selectedApp: AppItem | null;
    session: Session | null;
    showAliasNotice: (message: string) => void;
    text: (key: TranslationKey) => string;
};

type MoveToBrandParams = {
    apps: AppItem[];
    isCurrentBrandReadOnly: boolean;
    isNoBrandMode: boolean;
    lockedBrandIdSet: Set<string>;
    refreshAppScreenshots: () => Promise<unknown>;
    refreshApps: () => Promise<unknown>;
    refreshGeneratedAssets: () => Promise<unknown>;
    regularBrands: Brand[];
    reportActionError: (message: string) => void;
    reportLockedBrandWarning: () => void;
    reportReadOnlyBlocked: () => void;
    requestWorkspaceSelection: RequestWorkspaceSelection;
    selectedApp: AppItem | null;
    selectedBrand: Brand | null;
    session: Session | null;
    showAliasNotice: (message: string) => void;
    text: (key: TranslationKey) => string;
    tryClaimBrand: (brandId: string) => Promise<BrandLockResult>;
};

export function useNoBrandIconPromptActions({
    clientSpec,
    isNoBrandMode,
    patchApp,
    reportActionError,
    selectedApp,
    session,
    showAliasNotice,
    text,
}: IconPromptParams) {
    const [noBrandIconPromptDraft, setNoBrandIconPromptDraft] = useState('');
    const [noBrandIconPromptAutogenBusy, setNoBrandIconPromptAutogenBusy] = useState(false);

    useEffect(() => {
        if (!selectedApp || !isNoBrandMode) {
            setNoBrandIconPromptDraft('');
            return;
        }
        setNoBrandIconPromptDraft(String(selectedApp.icon_prompt || ''));
    }, [isNoBrandMode, selectedApp?.icon_prompt, selectedApp?.id]);

    useEffect(() => {
        setNoBrandIconPromptAutogenBusy(false);
    }, [isNoBrandMode, selectedApp?.id]);

    const handleNoBrandIconPromptChange = useCallback((value: string) => {
        setNoBrandIconPromptDraft(value);
    }, []);

    const handleNoBrandIconPromptSave = useCallback(
        async (value: string) => {
            if (!selectedApp || !isNoBrandMode) return true;
            const nextValue = String(value || '');
            const currentValue = String(selectedApp.icon_prompt || '');
            if (nextValue === currentValue) return true;
            const patched = await patchApp(selectedApp.id, { icon_prompt: nextValue });
            if (!patched) {
                reportActionError(text('upload_failed'));
                return false;
            }
            setNoBrandIconPromptDraft(String(patched.icon_prompt || nextValue));
            return true;
        },
        [isNoBrandMode, patchApp, reportActionError, selectedApp, text]
    );

    const handleNoBrandIconPromptAutogen = useCallback(async () => {
        if (!session || !selectedApp || !isNoBrandMode) return;
        const normalizedClientSpec = String(clientSpec || '').trim();
        if (!normalizedClientSpec) {
            reportActionError(text('no_brand_icon_prompt_autogen_need_spec'));
            return;
        }

        setNoBrandIconPromptAutogenBusy(true);
        try {
            const response = await generateNoBrandIconPrompt({
                clientSpec: normalizedClientSpec,
                appName: String(selectedApp.name || '').trim(),
                appAlias: String(selectedApp.alias || '').trim(),
                accessTokenHint: String(session.access_token || ''),
            });

            if (response.status === 'skipped_short_spec') {
                reportActionError(text('no_brand_icon_prompt_autogen_need_spec'));
                return;
            }
            if (response.status === 'error') {
                reportActionError(String(response.error || text('upload_failed')));
                return;
            }

            const nextPrompt = String(response.text || '').trim();
            if (!nextPrompt) {
                reportActionError(text('upload_failed'));
                return;
            }

            setNoBrandIconPromptDraft(nextPrompt);
            const patched = await patchApp(selectedApp.id, { icon_prompt: nextPrompt });
            if (!patched) {
                reportActionError(text('upload_failed'));
                return;
            }
            setNoBrandIconPromptDraft(String(patched.icon_prompt || nextPrompt));
            showAliasNotice(text('no_brand_icon_prompt_autogen_applied'));
        } catch (error: any) {
            reportActionError(String(error?.message || text('upload_failed')));
        } finally {
            setNoBrandIconPromptAutogenBusy(false);
        }
    }, [
        clientSpec,
        isNoBrandMode,
        patchApp,
        reportActionError,
        selectedApp,
        session,
        showAliasNotice,
        text,
    ]);

    return {
        handleNoBrandIconPromptAutogen,
        handleNoBrandIconPromptChange,
        handleNoBrandIconPromptSave,
        noBrandIconPromptAutogenBusy,
        noBrandIconPromptDraft,
    };
}

export function useNoBrandMoveToBrand({
    apps,
    isCurrentBrandReadOnly,
    isNoBrandMode,
    lockedBrandIdSet,
    refreshAppScreenshots,
    refreshApps,
    refreshGeneratedAssets,
    regularBrands,
    reportActionError,
    reportLockedBrandWarning,
    reportReadOnlyBlocked,
    requestWorkspaceSelection,
    selectedApp,
    selectedBrand,
    session,
    showAliasNotice,
    text,
    tryClaimBrand,
}: MoveToBrandParams) {
    const [moveTargetBrandId, setMoveTargetBrandId] = useState('');
    const [moveToBrandLoading, setMoveToBrandLoading] = useState(false);

    useEffect(() => {
        if (!selectedApp || !isNoBrandMode) {
            setMoveTargetBrandId('');
            return;
        }
        if (!regularBrands.length) {
            setMoveTargetBrandId('');
            return;
        }
        setMoveTargetBrandId((prev) => {
            if (prev && regularBrands.some((brand) => brand.id === prev)) return prev;
            return regularBrands[0]!.id;
        });
    }, [isNoBrandMode, regularBrands, selectedApp?.id]);

    const moveTargetBrand = useMemo(
        () => regularBrands.find((brand) => brand.id === moveTargetBrandId) || null,
        [moveTargetBrandId, regularBrands]
    );

    const handleMoveNoBrandAppToBrand = useCallback(async () => {
        if (!session || !selectedApp || !selectedBrand || !isNoBrandMode) return;
        if (isCurrentBrandReadOnly) {
            reportReadOnlyBlocked();
            return;
        }

        if (!moveTargetBrand) {
            reportActionError(text('no_brand_move_select_target'));
            return;
        }

        setMoveToBrandLoading(true);
        try {
            if (WORKSPACE_COLLAB_ENABLED && WORKSPACE_LOCK_ENFORCEMENT_ENABLED) {
                const brandBusyByOtherDevice = lockedBrandIdSet.has(moveTargetBrand.id);
                if (brandBusyByOtherDevice) {
                    reportLockedBrandWarning();
                    return;
                }
                const claim = await tryClaimBrand(moveTargetBrand.id);
                if (!claim.ok) {
                    if (claim.reason === 'locked_by_other_device') {
                        reportLockedBrandWarning();
                        return;
                    }
                    reportActionError(text('brand_start_editing_failed'));
                    return;
                }
            } else if (WORKSPACE_COLLAB_ENABLED) {
                void tryClaimBrand(moveTargetBrand.id);
            }

            const existingAliases = apps
                .filter((app) => app.id !== selectedApp.id)
                .map((app) => slugify(String(app.alias || '').trim()))
                .filter(Boolean);
            const currentAliasRaw = String(selectedApp.alias || '').trim();
            const currentAlias = slugify(currentAliasRaw);
            const aliasBase = currentAlias || slugify(String(selectedApp.name || 'app'));
            const resolvedAlias = makeUniqueAlias(aliasBase, existingAliases);

            const { data, error } = await moveAppToBrand({
                appId: selectedApp.id,
                toBrandId: moveTargetBrand.id,
                newAlias: resolvedAlias !== currentAlias ? resolvedAlias : null,
            });
            if (error) throw error;

            const movedApp = (data || {
                ...selectedApp,
                brand_id: moveTargetBrand.id,
                alias: resolvedAlias,
            }) as AppItem;

            if (resolvedAlias !== currentAlias) {
                const message = String(text('alias_auto_applied') || '')
                    .replace('{from}', currentAliasRaw || aliasBase)
                    .replace('{to}', String(movedApp.alias || resolvedAlias));
                showAliasNotice(message);
            }

            await Promise.allSettled([refreshApps(), refreshAppScreenshots(), refreshGeneratedAssets()]);

            await requestWorkspaceSelection({
                brandId: moveTargetBrand.id,
                appId: selectedApp.id,
                historyMode: 'push',
                skipCollaborationLockPreparation: true,
            });
        } catch (error: any) {
            reportActionError(String(error?.message || text('upload_failed')));
        } finally {
            setMoveToBrandLoading(false);
        }
    }, [
        apps,
        isCurrentBrandReadOnly,
        isNoBrandMode,
        lockedBrandIdSet,
        moveTargetBrand,
        refreshApps,
        refreshAppScreenshots,
        refreshGeneratedAssets,
        reportActionError,
        reportLockedBrandWarning,
        reportReadOnlyBlocked,
        requestWorkspaceSelection,
        selectedApp,
        selectedBrand,
        session,
        showAliasNotice,
        text,
        tryClaimBrand,
    ]);

    return {
        handleMoveNoBrandAppToBrand,
        moveTargetBrandId,
        moveToBrandLoading,
        setMoveTargetBrandId,
    };
}
