import { useRef, useState, type RefObject, type PointerEvent } from 'react';

export type AppPillPanState = {
    active: boolean;
    startX: number;
    scrollLeft: number;
    didDrag: boolean;
    lastDragTime: number;
};

type Params = {
    isReorderMode: boolean;
    scrollRef: RefObject<HTMLDivElement>;
};

export const useAppPillPan = ({ isReorderMode, scrollRef }: Params) => {
    const [isPanning, setIsPanning] = useState(false);
    const panRef = useRef<AppPillPanState>({
        active: false,
        startX: 0,
        scrollLeft: 0,
        didDrag: false,
        lastDragTime: 0,
    });

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (isReorderMode) return;
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        panRef.current = {
            active: true,
            startX: event.clientX,
            scrollLeft: scrollEl.scrollLeft,
            didDrag: false,
            lastDragTime: panRef.current.lastDragTime,
        };
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (isReorderMode) return;
        const scrollEl = scrollRef.current;
        if (!scrollEl || !panRef.current.active) return;
        const delta = event.clientX - panRef.current.startX;
        if (!panRef.current.didDrag && Math.abs(delta) < 6) return;
        if (!panRef.current.didDrag) {
            panRef.current.didDrag = true;
            setIsPanning(true);
        }
        scrollEl.scrollLeft = panRef.current.scrollLeft - delta;
        event.preventDefault();
    };

    const handlePointerEnd = () => {
        if (isReorderMode) return;
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        if (panRef.current.didDrag) {
            panRef.current.lastDragTime = Date.now();
        }
        panRef.current.active = false;
        panRef.current.didDrag = false;
        setIsPanning(false);
    };

    return {
        isPanning,
        panRef,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerEnd,
            onPointerLeave: handlePointerEnd,
            onPointerCancel: handlePointerEnd,
        },
    };
};
