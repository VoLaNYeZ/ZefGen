import React from 'react';
import { X } from 'lucide-react';
import type { TextLayer } from '../../types/zefgen';
import { TextLayersCanvasOverlay } from './TextLayersCanvasOverlay';
import { BreathingText } from '../fancy/text';

type LightboxState = {
    src: string;
    alt: string;
    layers?: TextLayer[];
    fullSrc?: string;
    overlayBaseWidth?: number;
    overlayBaseHeight?: number;
} | null;

type LightboxProps = {
    lightbox: LightboxState;
    onClose: () => void;
    closeLabel: string;
};

export const Lightbox = ({ lightbox, onClose, closeLabel }: LightboxProps) => {
    if (!lightbox) return null;

    const layers = Array.isArray(lightbox.layers) ? lightbox.layers : [];
    const fullSrc = lightbox.fullSrc && lightbox.fullSrc !== lightbox.src ? lightbox.fullSrc : null;
    const [displaySrc, setDisplaySrc] = React.useState(fullSrc ?? lightbox.src);
    const [loaded, setLoaded] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    React.useEffect(() => {
        // If a full-resolution source exists, load it directly to avoid flashing a lower-quality preview.
        setDisplaySrc(fullSrc ?? lightbox.src);
        setLoaded(false);
        setLoadError(null);
    }, [lightbox.src, fullSrc]);

    const translateForAlign = (align: TextLayer['align']) => {
        if (align === 'left') return 'translate(0, -50%)';
        if (align === 'right') return 'translate(-100%, -50%)';
        return 'translate(-50%, -50%)';
    };

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
                <div className="relative inline-flex items-center justify-center min-h-[240px] min-w-[240px]">
                    {!loaded && (
                        <div
                            className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/40"
                            aria-label="Loading"
                        >
                            <div className="pointer-events-none select-none text-center">
                                <BreathingText
                                    className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                    fromFontVariationSettings="'wght' 260, 'slnt' 0"
                                    toFontVariationSettings="'wght' 820, 'slnt' -8"
                                >
                                    ZEFGEN
                                </BreathingText>
                                <div className="mt-2 text-[11px] font-semibold tracking-[0.12em] text-indigo-200/45">
                                    {loadError ? 'FAILED TO LOAD' : 'LOADING'}
                                </div>
                            </div>
                        </div>
                    )}
                    <img
                        src={displaySrc}
                        alt={lightbox.alt}
                        className={`max-h-[85vh] w-auto max-w-[85vw] rounded-xl object-contain block transition-opacity duration-150 ${
                            loaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        onLoad={() => setLoaded(true)}
                        onError={() => {
                            // If the full-res URL fails (expired signed URL, deleted object, etc),
                            // fall back to the preview source rather than leaving the user stuck.
                            if (fullSrc && displaySrc === fullSrc) {
                                setDisplaySrc(lightbox.src);
                                setLoaded(false);
                                setLoadError('full_failed');
                                return;
                            }
                            setLoadError('preview_failed');
                            setLoaded(true);
                        }}
                    />

                    {/* Optional overlay layers (used for generated screenshot zoom previews). */}
                    {loaded && layers.length > 0 && (
                        <TextLayersCanvasOverlay
                            layers={layers}
                            baseWidth={lightbox.overlayBaseWidth}
                            baseHeight={lightbox.overlayBaseHeight}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
