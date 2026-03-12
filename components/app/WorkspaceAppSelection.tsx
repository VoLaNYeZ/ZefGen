import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppPillPanState } from '../../hooks/use-app-pill-pan';
import type { AppFormState, AppItem } from '../../types/zefgen';
import { AppFormCard } from './AppFormCard';
import { AppPills } from './AppPills';

type WorkspaceAppSelectionProps = {
    appActivePillRef: React.MutableRefObject<HTMLButtonElement | null>;
    appAliasPreview: string;
    appForm: AppFormState;
    appFormError: string | null;
    appFormLoading: boolean;
    appFormOpen: boolean;
    aliasPlaceholder: string;
    appPillPanHandlers: {
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    };
    appPillPanRef: React.MutableRefObject<AppPillPanState>;
    appPillRowRef: React.RefObject<HTMLDivElement>;
    appPillScrollRef: React.RefObject<HTMLDivElement>;
    bannedApps: AppItem[];
    canAddApp: boolean;
    draggingAppId: string | null;
    dragOverAppId: string | null;
    editingAppId: string | null;
    hasAnyAppsForBrand: boolean;
    isAppPillPanning: boolean;
    isAppReorderMode: boolean;
    isBannedView: boolean;
    isEditingBanned: boolean;
    isReadOnly: boolean;
    lockedAppId: string | null;
    onBanApp: (appId: string) => void;
    onBlockedAction: () => void;
    onCancelAppForm: () => void;
    onDeleteApp: () => void;
    onEditLockedAction: () => void;
    onOpenCreateApp: () => void;
    onOpenEditSelectedApp: () => void;
    onReorderBrandApps: (sourceId: string, targetId: string) => void;
    onSelectApp: (appId: string | null) => void;
    onSubmitAppForm: (event: React.FormEvent) => void;
    onUnbanApp: (appId: string) => void;
    selectedApp: AppItem | null;
    selectedAppId: string | null;
    selectedBrandName?: string;
    selectedBrandSlug?: string;
    setAppForm: React.Dispatch<React.SetStateAction<AppFormState>>;
    setDraggingAppId: (value: string | null) => void;
    setDragOverAppId: (value: string | null) => void;
    setIsBannedView: (value: boolean) => void;
    showBannedToggle: boolean;
    showNoAppsEmptyState: boolean;
    tabButtonHeight?: number;
    tabButtonWidth: number;
    text: (key: TranslationKey) => string;
    visibleActiveApps: AppItem[];
    visibleApps: AppItem[];
};

export function WorkspaceAppSelection({
    appActivePillRef,
    appAliasPreview,
    appForm,
    appFormError,
    appFormLoading,
    appFormOpen,
    aliasPlaceholder,
    appPillPanHandlers,
    appPillPanRef,
    appPillRowRef,
    appPillScrollRef,
    bannedApps,
    canAddApp,
    draggingAppId,
    dragOverAppId,
    editingAppId,
    hasAnyAppsForBrand,
    isAppPillPanning,
    isAppReorderMode,
    isBannedView,
    isEditingBanned,
    isReadOnly,
    lockedAppId,
    onBanApp,
    onBlockedAction,
    onCancelAppForm,
    onDeleteApp,
    onEditLockedAction,
    onOpenCreateApp,
    onOpenEditSelectedApp,
    onReorderBrandApps,
    onSelectApp,
    onSubmitAppForm,
    onUnbanApp,
    selectedApp,
    selectedAppId,
    selectedBrandName,
    selectedBrandSlug,
    setAppForm,
    setDraggingAppId,
    setDragOverAppId,
    setIsBannedView,
    showBannedToggle,
    showNoAppsEmptyState,
    tabButtonHeight,
    tabButtonWidth,
    text,
    visibleActiveApps,
    visibleApps,
}: WorkspaceAppSelectionProps) {
    return (
        <div data-testid="workspace-app-selection" className="space-y-4">
            {!showNoAppsEmptyState && (
                <div className="flex items-center justify-end gap-2">
                    {selectedApp && (
                        <button
                            type="button"
                            onClick={onOpenEditSelectedApp}
                            onDoubleClick={onCancelAppForm}
                            disabled={isReadOnly}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                        >
                            <Pencil size={11} />
                            {text('edit')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpenCreateApp}
                        disabled={!canAddApp || isReadOnly}
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            canAddApp && !isReadOnly
                                ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30'
                                : 'cursor-not-allowed border-white/10 text-indigo-200/40'
                        }`}
                    >
                        <Plus size={12} />
                        {text('add_app')}
                    </button>
                </div>
            )}

            {hasAnyAppsForBrand ? (
                <AppPills
                    visibleApps={visibleApps}
                    selectedAppId={selectedAppId}
                    setSelectedAppId={onSelectApp}
                    isBusy={false}
                    onBlockedAction={onBlockedAction}
                    lockedAppId={lockedAppId}
                    onEditLockedAction={onEditLockedAction}
                    isAppReorderMode={isAppReorderMode}
                    draggingAppId={draggingAppId}
                    setDraggingAppId={setDraggingAppId}
                    dragOverAppId={dragOverAppId}
                    setDragOverAppId={setDragOverAppId}
                    reorderBrandApps={onReorderBrandApps}
                    appActivePillRef={appActivePillRef}
                    appPillScrollRef={appPillScrollRef}
                    appPillRowRef={appPillRowRef}
                    appPillPanRef={appPillPanRef}
                    appPillPanHandlers={appPillPanHandlers}
                    isAppPillPanning={isAppPillPanning}
                    showBannedToggle={showBannedToggle}
                    tabButtonWidth={tabButtonWidth}
                    tabButtonHeight={tabButtonHeight}
                    isBannedView={isBannedView}
                    setIsBannedView={setIsBannedView}
                    visibleActiveApps={visibleActiveApps}
                    bannedApps={bannedApps}
                    text={text}
                />
            ) : null}

            <AppFormCard
                appFormOpen={appFormOpen}
                appForm={appForm}
                setAppForm={setAppForm}
                appFormError={appFormError}
                appFormLoading={appFormLoading}
                editingAppId={editingAppId}
                isEditingBanned={isEditingBanned}
                selectedBrandSlug={selectedBrandSlug}
                selectedBrandName={selectedBrandName}
                appAliasPreview={appAliasPreview}
                aliasPlaceholder={aliasPlaceholder}
                onCancel={onCancelAppForm}
                onSubmit={onSubmitAppForm}
                onDelete={onDeleteApp}
                onBan={onBanApp}
                onUnban={onUnbanApp}
                text={text}
            />

            {!selectedApp && hasAnyAppsForBrand ? (
                <p className="mt-2 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            ) : null}
        </div>
    );
}
