import React from 'react';
import { X } from 'lucide-react';
import type { TextLayer } from '../../types/zefgen';
import { TextLayersCanvasOverlay } from './TextLayersCanvasOverlay';

type LightboxState = {
    src: string;
    alt: string;
    layers?: TextLayer[];
    fullSrc?: string;
} | null;

type LightboxProps = {
    lightbox: LightboxState;
    onClose: () => void;
    closeLabel: string;
};

export const Lightbox = ({ lightbox, onClose, closeLabel }: LightboxProps) => {
    if (!lightbox) return null;

    const layers = Array.isArray(lightbox.layers) ? lightbox.layers : [];
    const [displaySrc, setDisplaySrc] = React.useState(lightbox.src);
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
        setDisplaySrc(lightbox.src);
        setLoaded(false);
    }, [lightbox.src]);

    const translateForAlign = (align: TextLayer['align']) => {
        if (align === 'left') return 'translate(0, -50%)';
        if (align === 'right') return 'translate(-100%, -50%)';
        return 'translate(-50%, -50%)';
    };

    const fullSrc = lightbox.fullSrc && lightbox.fullSrc !== lightbox.src ? lightbox.fullSrc : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
            onClick={onClose}
        >
            <div
                className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-indigo-400/30 bg-slate-950/70 p-3"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-2 top-2 rounded-full border border-white/10 bg-slate-950/80 p-2 text-indigo-200/70 hover:text-white"
                    aria-label={closeLabel}
                >
                    <X size={14} />
                </button>
                <div className="relative inline-block">
                    <img
                        src={displaySrc}
                        alt={lightbox.alt}
                        className="max-h-[85vh] w-auto max-w-[85vw] rounded-xl object-contain block"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        onLoad={() => setLoaded(true)}
                    />
                    {/* Preload the full-resolution image, then swap once loaded. */}
                    {fullSrc && displaySrc !== fullSrc && (
                        <img
                            src={fullSrc}
                            alt=""
                            className="hidden"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            onLoad={() => setDisplaySrc(fullSrc)}
                        />
                    )}

                    {/* Optional overlay layers (used for generated screenshot zoom previews). */}
                    {loaded && layers.length > 0 && <TextLayersCanvasOverlay layers={layers} />}
                </div>
            </div>
        </div>
    );
};
