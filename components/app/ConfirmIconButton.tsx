import React from 'react';

export const ConfirmIconButton = (props: {
    label: string;
    confirmLabel: string;
    cancelLabel: string;
    question: string;
    disabled?: boolean;
    onConfirm: () => void | Promise<void>;
    children: React.ReactNode;
    className?: string;
    triggerTestId?: string;
    popoverTestId?: string;
    confirmTestId?: string;
    cancelTestId?: string;
}) => {
    const {
        label,
        confirmLabel,
        cancelLabel,
        question,
        disabled,
        onConfirm,
        children,
        className,
        triggerTestId,
        popoverTestId,
        confirmTestId,
        cancelTestId,
    } = props;

    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const wrapRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!open) return;
        const onDown = (event: MouseEvent) => {
            const el = wrapRef.current;
            if (!el) return;
            if (el.contains(event.target as any)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const handleConfirm = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await onConfirm();
            setOpen(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div ref={wrapRef} className={`relative inline-flex ${className ?? ''}`}>
            <button
                type="button"
                disabled={disabled || busy}
                onClick={() => setOpen((v) => !v)}
                aria-label={label}
                data-testid={triggerTestId}
                className="inline-flex items-center justify-center"
            >
                {children}
            </button>

            {open && !disabled && (
                <div
                    data-testid={popoverTestId}
                    className="absolute right-0 bottom-full z-40 mb-2 w-[220px] rounded-xl border border-indigo-400/25 bg-slate-950/90 backdrop-blur p-2 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.8)]"
                >
                    <div className="text-[11px] text-indigo-100/90">{question}</div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            data-testid={cancelTestId}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={busy}
                            data-testid={confirmTestId}
                            className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-100 hover:bg-rose-500/20"
                        >
                            {busy ? '…' : confirmLabel}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
