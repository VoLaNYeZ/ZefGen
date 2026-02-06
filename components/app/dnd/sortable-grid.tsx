import React, { useEffect, useRef, useState } from 'react';
import {
    closestCenter,
    DndContext,
    type DragCancelEvent,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    type DragOverEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type SortableCommitPayload = {
    activeId: string;
    fromIndex: number;
    toIndex: number;
};

type SortableGridProps = {
    ids: string[];
    disabled?: boolean;
    onCommitMove: (payload: SortableCommitPayload) => void;
    children: (orderedIds: string[], activeId: string | null) => React.ReactNode;
    renderOverlay?: (activeId: string) => React.ReactNode;
};

export function SortableGrid({ ids, disabled, onCommitMove, children, renderOverlay }: SortableGridProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [orderedIds, setOrderedIds] = useState<string[]>(ids);
    const orderedIdsRef = useRef<string[]>(ids);
    const startIndexRef = useRef<number | null>(null);
    const startIdsRef = useRef<string[] | null>(null);

    const setOrderedIdsSynced = (next: string[]) => {
        orderedIdsRef.current = next;
        setOrderedIds(next);
    };

    // Keep preview order in sync with the authoritative order when not dragging.
    useEffect(() => {
        if (activeId) return;
        setOrderedIdsSynced(ids);
    }, [ids]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const onDragStart = ({ active }: DragStartEvent) => {
        if (disabled) return;
        const activeId = String(active.id);
        startIdsRef.current = ids;
        setOrderedIdsSynced(ids);
        startIndexRef.current = ids.indexOf(activeId);
        setActiveId(activeId);
    };

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (disabled) return;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        if (activeId === overId) return;

        const current = orderedIdsRef.current;
        const fromIndex = current.indexOf(activeId);
        const toIndex = current.indexOf(overId);
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
        const activeId = String(active.id);
        const startIds = startIdsRef.current ?? ids;
        const fromIndex = startIndexRef.current ?? startIds.indexOf(activeId);

        // Dropped outside any sortable target: cancel.
        if (!over) {
            resetDrag();
            return;
        }

        const overId = String(over.id);

        // Ensure the final order accounts for the final `over` target, even if the last onDragOver
        // update didn't flush before drag end.
        let finalIds = orderedIdsRef.current;
        const fromPreviewIndex = finalIds.indexOf(activeId);
        const toPreviewIndex = finalIds.indexOf(overId);
        if (fromPreviewIndex !== -1 && toPreviewIndex !== -1 && fromPreviewIndex !== toPreviewIndex) {
            finalIds = arrayMove(finalIds, fromPreviewIndex, toPreviewIndex);
            setOrderedIdsSynced(finalIds);
        }

        const toIndex = finalIds.indexOf(activeId);
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
            onCommitMove({ activeId, fromIndex, toIndex });
            // Keep orderedIds as-is to avoid flicker; parent state should reconcile quickly.
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
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
                {children(orderedIds, activeId)}
            </SortableContext>
            <DragOverlay>{activeId && renderOverlay ? renderOverlay(activeId) : null}</DragOverlay>
        </DndContext>
    );
}

export function useSortableTile(id: string, disabled?: boolean) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id, disabled });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        // When we render a DragOverlay, dim the original so the overlay reads as "the thing moving".
        opacity: isDragging ? 0.15 : undefined,
    };

    return {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        style,
        isDragging,
    };
}
