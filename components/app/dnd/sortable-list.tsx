import React, { useEffect, useRef, useState } from 'react';
import {
    closestCenter,
    DndContext,
    type DragCancelEvent,
    type DragEndEvent,
    DragOverlay,
    type DragOverEvent,
    type DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export type SortableCommitPayload = {
    activeId: string;
    fromIndex: number;
    toIndex: number;
};

type SortableListProps = {
    ids: string[];
    disabled?: boolean;
    onCommitMove: (payload: SortableCommitPayload) => void;
    onActiveIdChange?: (activeId: string | null) => void;
    children: (orderedIds: string[], activeId: string | null) => React.ReactNode;
    renderOverlay?: (activeId: string) => React.ReactNode;
};

export function SortableList({
    ids,
    disabled,
    onCommitMove,
    onActiveIdChange,
    children,
    renderOverlay,
}: SortableListProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [orderedIds, setOrderedIds] = useState<string[]>(ids);
    const orderedIdsRef = useRef<string[]>(ids);
    const startIndexRef = useRef<number | null>(null);
    const startIdsRef = useRef<string[] | null>(null);

    const setOrderedIdsSynced = (next: string[]) => {
        orderedIdsRef.current = next;
        setOrderedIds(next);
    };

    useEffect(() => {
        onActiveIdChange?.(activeId);
    }, [activeId, onActiveIdChange]);

    // Keep preview order in sync with the authoritative order when not dragging.
    useEffect(() => {
        if (activeId) return;
        setOrderedIdsSynced(ids);
    }, [ids]);

    const sensors = useSensors(
        // Higher distance than grids, to reduce accidental drags on click.
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const onDragStart = ({ active }: DragStartEvent) => {
        if (disabled) return;
        const nextActiveId = String(active.id);
        startIdsRef.current = ids;
        setOrderedIdsSynced(ids);
        startIndexRef.current = ids.indexOf(nextActiveId);
        setActiveId(nextActiveId);
    };

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (disabled) return;
        if (!over) return;
        const aId = String(active.id);
        const oId = String(over.id);
        if (aId === oId) return;

        const current = orderedIdsRef.current;
        const fromIndex = current.indexOf(aId);
        const toIndex = current.indexOf(oId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
        setOrderedIdsSynced(arrayMove(current, fromIndex, toIndex));
    };

    const resetDrag = () => {
        setActiveId(null);
        startIndexRef.current = null;
        startIdsRef.current = null;
        setOrderedIdsSynced(ids);
    };

    const onDragCancel = (_event: DragCancelEvent) => {
        resetDrag();
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (disabled) return;
        const aId = String(active.id);
        const startIds = startIdsRef.current ?? ids;
        const fromIndex = startIndexRef.current ?? startIds.indexOf(aId);

        if (!over) {
            resetDrag();
            return;
        }

        const oId = String(over.id);

        // Ensure final order reflects the last over target.
        let finalIds = orderedIdsRef.current;
        const fromPreviewIndex = finalIds.indexOf(aId);
        const toPreviewIndex = finalIds.indexOf(oId);
        if (fromPreviewIndex !== -1 && toPreviewIndex !== -1 && fromPreviewIndex !== toPreviewIndex) {
            finalIds = arrayMove(finalIds, fromPreviewIndex, toPreviewIndex);
            setOrderedIdsSynced(finalIds);
        }

        const toIndex = finalIds.indexOf(aId);
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
            onCommitMove({ activeId: aId, fromIndex, toIndex });
        }

        setActiveId(null);
        startIndexRef.current = null;
        startIdsRef.current = null;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
        >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {children(orderedIds, activeId)}
            </SortableContext>
            <DragOverlay>{activeId && renderOverlay ? renderOverlay(activeId) : null}</DragOverlay>
        </DndContext>
    );
}

