import React from 'react';
import { GripVertical } from 'lucide-react';
import type { AppItem } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';
import type { AppPillPanState } from '../../hooks/use-app-pill-pan';

type AppPillsProps = {
    visibleApps: AppItem[];
    selectedAppId: string | null;
    setSelectedAppId: (value: string | null) => void;
    isBusy: boolean;
    onBlockedAction: () => void;
    isAppReorderMode: boolean;
    draggingAppId: string | null;
    setDraggingAppId: (value: string | null) => void;
    dragOverAppId: string | null;
    setDragOverAppId: (value: string | null) => void;
    reorderBrandApps: (sourceId: string, targetId: string) => void;
    appActivePillRef: React.MutableRefObject<HTMLButtonElement | null>;
    appPillScrollRef: React.RefObject<HTMLDivElement>;
    appPillRowRef: React.RefObject<HTMLDivElement>;
    appPillPanRef: React.MutableRefObject<AppPillPanState>;
    appPillPanHandlers: {
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
        onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    };
    isAppPillPanning: boolean;
    showBannedToggle: boolean;
    tabButtonWidth: number;
    tabButtonHeight?: number;
    isBannedView: boolean;
    setIsBannedView: (value: boolean) => void;
    visibleActiveApps: AppItem[];
    bannedApps: AppItem[];
    text: (key: TranslationKey) => string;
};

export const AppPills = ({
    visibleApps,
    selectedAppId,
    setSelectedAppId,
    isBusy,
    onBlockedAction,
    isAppReorderMode,
    draggingAppId,
    setDraggingAppId,
    dragOverAppId,
    setDragOverAppId,
    reorderBrandApps,
    appActivePillRef,
    appPillScrollRef,
    appPillRowRef,
    appPillPanRef,
    appPillPanHandlers,
    isAppPillPanning,
    showBannedToggle,
    tabButtonWidth,
    tabButtonHeight,
    isBannedView,
    setIsBannedView,
    visibleActiveApps,
    bannedApps,
    text,
}: AppPillsProps) => {
    const bannedSlotWidth = showBannedToggle ? tabButtonWidth + 12 : 0;

    return (
        <div
            ref={appPillRowRef}
            className="mt-1 h-16 rounded-2xl border border-transparent bg-transparent px-0 py-0 relative"
        >
            <div className="w-full" style={showBannedToggle ? { paddingRight: bannedSlotWidth } : undefined}>
                <div
                    ref={appPillScrollRef}
                    className={`flex gap-2 overflow-x-auto pb-1 select-none ${
                        isAppReorderMode ? '' : 'cursor-grab'
                    } ${isAppPillPanning ? 'cursor-grabbing' : ''}`}
                    role="tablist"
                    aria-label={text('apps')}
                    onPointerDown={appPillPanHandlers.onPointerDown}
                    onPointerMove={appPillPanHandlers.onPointerMove}
                    onPointerUp={appPillPanHandlers.onPointerUp}
                    onPointerLeave={appPillPanHandlers.onPointerLeave}
                    onPointerCancel={appPillPanHandlers.onPointerCancel}
                >
                    {visibleApps.map((app, index) => {
                        const isActive = app.id === selectedAppId;
                        const isFirst = index === 0;
                        const isDragTarget = dragOverAppId === app.id && draggingAppId !== app.id;
                        const displayName =
                            app.name.length > 10 ? `${app.name.slice(0, 10).trimEnd()}…` : app.name;
                        const firstShiftClass = isFirst ? '-translate-x-3' : '';
                        const firstGapClass = isFirst ? '-mr-3' : '';
                        return (
                            <button
                                key={app.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => {
                                    if (isBusy) {
                                        onBlockedAction();
                                        return;
                                    }
                                    if (Date.now() - appPillPanRef.current.lastDragTime < 250) {
                                        return;
                                    }
                                    setSelectedAppId(app.id);
                                }}
                                ref={(el) => {
                                    if (isActive) appActivePillRef.current = el;
                                }}
                                draggable={isAppReorderMode}
                                onDragStart={(event) => {
                                    if (!isAppReorderMode) return;
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', app.id);
                                    setDraggingAppId(app.id);
                                }}
                                onDragEnd={() => {
                                    if (!isAppReorderMode) return;
                                    setDraggingAppId(null);
                                    setDragOverAppId(null);
                                }}
                                onDragOver={(event) => {
                                    if (!isAppReorderMode) return;
                                    event.preventDefault();
                                    setDragOverAppId(app.id);
                                }}
                                onDrop={(event) => {
                                    if (!isAppReorderMode) return;
                                    event.preventDefault();
                                    const sourceId = draggingAppId || event.dataTransfer.getData('text/plain');
                                    if (!sourceId || sourceId === app.id) return;
                                    reorderBrandApps(sourceId, app.id);
                                    setDraggingAppId(null);
                                    setDragOverAppId(null);
                                }}
                                style={{ width: tabButtonWidth || undefined, height: tabButtonHeight || undefined }}
                                className={`shrink-0 rounded-2xl border px-0 py-0 text-center transition flex flex-col items-center justify-center gap-0.5 leading-none relative ${firstGapClass} ${
                                    isActive
                                        ? 'border-transparent bg-transparent shadow-none text-indigo-100'
                                        : 'border-transparent bg-transparent text-indigo-200/70 hover:text-white'
                                } ${isDragTarget ? 'ring-1 ring-indigo-400/40' : ''}`}
                            >
                                <div className={`flex w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-indigo-200/60 leading-none ${firstShiftClass}`}>
                                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-indigo-200/70">
                                        {app.alias.toUpperCase()}
                                    </span>
                                </div>
                                <div className={`w-full text-center text-sm font-semibold text-white leading-none ${firstShiftClass}`}>{displayName}</div>
                                {isAppReorderMode && (
                                    <span className="absolute right-1 top-1 text-indigo-200/50">
                                        <GripVertical size={12} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            {showBannedToggle && (
                <button
                    type="button"
                    onClick={() => {
                        if (isBusy) {
                            onBlockedAction();
                            return;
                        }
                        if (Date.now() - appPillPanRef.current.lastDragTime < 250) {
                            return;
                        }
                        if (isBannedView) {
                            setIsBannedView(false);
                            setSelectedAppId(visibleActiveApps[0]?.id ?? null);
                        } else {
                            setIsBannedView(true);
                            setSelectedAppId(bannedApps[0]?.id ?? null);
                        }
                    }}
                    style={{
                        width: tabButtonWidth || 120,
                        height: tabButtonHeight ? Math.max(28, Math.round(tabButtonHeight * 0.55)) : 32,
                    }}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-2xl border px-0 py-0 text-center transition flex items-center justify-center leading-none ${
                        isBannedView
                            ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25'
                            : 'border-rose-400/50 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
                    }`}
                >
                    <span className="text-[10px] uppercase tracking-[0.22em] text-current leading-none">
                        {isBannedView ? text('active_apps') : text('banned_apps')}
                    </span>
                </button>
            )}
        </div>
    );
};
