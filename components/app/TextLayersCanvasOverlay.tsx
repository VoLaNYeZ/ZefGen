import React from 'react';
import type { TextLayer } from '../../types/zefgen';
import { drawTextLayerToContext } from '../../utils/images';

export const TextLayersCanvasOverlay = (props: {
    layers: TextLayer[];
    baseWidth?: number;
    baseHeight?: number;
}) => {
    const { layers, baseWidth, baseHeight } = props;
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

        const scale =
            baseWidth && baseHeight && baseWidth > 0 && baseHeight > 0
                ? Math.max(0.05, Math.min(20, size.h / baseHeight))
                : 1;

        for (const layer of layers || []) {
            const scaled =
                scale === 1
                    ? (layer as any)
                    : {
                          ...layer,
                          size: (Number((layer as any)?.size) || 0) * scale,
                          shadow: (layer as any)?.shadow
                              ? {
                                    ...(layer as any).shadow,
                                    blur: (Number((layer as any).shadow.blur) || 0) * scale,
                                    offsetX: (Number((layer as any).shadow.offsetX) || 0) * scale,
                                    offsetY: (Number((layer as any).shadow.offsetY) || 0) * scale,
                                }
                              : undefined,
                          outline: (layer as any)?.outline
                              ? {
                                    ...(layer as any).outline,
                                    width: (Number((layer as any).outline.width) || 0) * scale,
                                }
                              : undefined,
                      };
            drawTextLayerToContext({
                context: ctx,
                width: size.w,
                height: size.h,
                layer: scaled,
            });
        }
    }, [layers, size.w, size.h, baseWidth, baseHeight]);

    return (
        <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
};
