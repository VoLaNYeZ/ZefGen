import React from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'bottom';

export function InstantTooltip(props: {
    content: React.ReactNode;
    children: React.ReactNode;
    disabled?: boolean;
    side?: TooltipSide;
    offset?: number;
    className?: string;
}) {
    const { content, children, disabled, side = 'top', offset = 10, className } = props;

    const anchorRef = React.useRef<HTMLSpanElement | null>(null);
    const tooltipRef = React.useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

    const update = React.useCallback(() => {
        const el = anchorRef.current;
        if (!el || !el.isConnected) return;
        const rect = el.getBoundingClientRect();
        const left = rect.left + rect.width / 2;
        const top = side === 'top' ? rect.top - offset : rect.bottom + offset;
        setPos({ top, left });
    }, [offset, side]);

    React.useLayoutEffect(() => {
        if (!open) return;
        update();
    }, [open, update]);

    React.useEffect(() => {
        if (!open) return;
        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(update);
        };

        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
        };
    }, [open, update]);

    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    return (
        <>
            <span
                ref={anchorRef}
                className="inline-flex min-w-0"
                onMouseEnter={() => {
                    if (disabled) return;
                    setOpen(true);
                }}
                onMouseLeave={() => setOpen(false)}
            >
                {children}
            </span>

            {open && pos
                ? createPortal(
                      <div
                          ref={tooltipRef}
                          className={`pointer-events-none fixed z-[200] -translate-x-1/2 ${
                              side === 'top' ? '-translate-y-full' : ''
                          } ${className || ''}`}
                          style={{
                              top: `${pos.top}px`,
                              left: `${pos.left}px`,
                          }}
                      >
                          <div className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[11px] font-medium text-indigo-100 shadow-xl shadow-black/30 backdrop-blur">
                              {content}
                          </div>
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}

