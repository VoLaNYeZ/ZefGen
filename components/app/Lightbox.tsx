import React from 'react';
import { X } from 'lucide-react';

type LightboxState = {
    src: string;
    alt: string;
} | null;

type LightboxProps = {
    lightbox: LightboxState;
    onClose: () => void;
    closeLabel: string;
};

export const Lightbox = ({ lightbox, onClose, closeLabel }: LightboxProps) => {
    if (!lightbox) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
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
                <img
                    src={lightbox.src}
                    alt={lightbox.alt}
                    className="max-h-[85vh] w-auto max-w-[85vw] rounded-xl object-contain"
                />
            </div>
        </div>
    );
};
