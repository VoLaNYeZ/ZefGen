import React from 'react';
import type { TextLayer } from '../../types/zefgen';
import { drawTextLayerToContext } from '../../utils/images';

export const TextLayersCanvasOverlay = (props: { layers: TextLayer[] }) => {
    const { layers } = props;
    const wrapRef = React.useRef<HTMLDivElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

    React.useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        const update = () => {
            const w = Math.max(0, Math.floor(el.clientWidth));
            const h = Math.max(0, Math.floor(el.clientHeight));
            setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        };

        update();
        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!size.w || !size.h) return;

        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        canvas.width = Math.max(1, Math.floor(size.w * dpr));
        canvas.height = Math.max(1, Math.floor(size.h * dpr));
        canvas.style.width = `${size.w}px`;
        canvas.style.height = `${size.h}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Work in CSS pixels for easier % positioning.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);

        for (const layer of layers || []) {
            drawTextLayerToContext({
                context: ctx,
                width: size.w,
                height: size.h,
                layer: layer as any,
            });
        }
    }, [layers, size.w, size.h]);

    return (
        <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
};

