import React from 'react';

// ASCII-only set (no glyph issues, keeps CSP/fonts simple).
const MATRIX_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?;:[](){}<>/\\|_-.';

function joinClassNames(...parts: Array<string | undefined | null | false>) {
    return parts.filter(Boolean).join(' ');
}

function prefersReducedMotion() {
    try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
        return false;
    }
}

type ColumnState = {
    yRows: number;
    speedRowsPerSec: number;
    trailLen: number;
    chars: number[]; // char indices into MATRIX_CHARS (length === trailLen)
    lastStepRow: number;
    alphas: number[]; // precomputed alpha per tail position (length === trailLen)
};

export function MatrixRain(props: { className?: string }) {
    const wrapRef = React.useRef<HTMLDivElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const rafRef = React.useRef<number | null>(null);
    const lastFrameMsRef = React.useRef<number | null>(null);
    const reduceMotionRef = React.useRef<boolean>(false);
    const dprRef = React.useRef<number>(1);

    const colsRef = React.useRef<ColumnState[]>([]);
    const fontSizeRef = React.useRef<number>(14);
    const sizeRef = React.useRef<{ w: number; h: number }>({ w: 0, h: 0 });

    const randCharIdx = React.useCallback(() => {
        return Math.floor(Math.random() * MATRIX_CHARS.length);
    }, []);

    const buildAlphas = React.useCallback((trailLen: number) => {
        const out = new Array(trailLen).fill(0);
        for (let j = 0; j < trailLen; j += 1) {
            if (j === 0) out[j] = 1;
            else if (j === 1) out[j] = 0.9;
            else {
                const a = 0.85 * Math.exp(-j / (trailLen * 0.55));
                out[j] = Math.max(0.06, Math.min(0.82, a));
            }
        }
        return out;
    }, []);

    const initColumn = React.useCallback(
        (rows: number): ColumnState => {
            const trailLen = Math.floor(14 + Math.random() * 17); // 14..30
            const yRows = -Math.random() * rows * 0.6;
            const speedRowsPerSec = 6 + Math.random() * 12; // 6..18
            const chars = new Array(trailLen).fill(0).map(randCharIdx);
            const lastStepRow = Math.floor(yRows);
            const alphas = buildAlphas(trailLen);
            return { yRows, speedRowsPerSec, trailLen, chars, lastStepRow, alphas };
        },
        [randCharIdx, buildAlphas]
    );

    const resizeTo = React.useCallback((w: number, h: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        dprRef.current = dpr;

        sizeRef.current = { w, h };
        canvas.width = Math.max(1, Math.floor(w * dpr));
        canvas.height = Math.max(1, Math.floor(h * dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const fontSize = Math.max(12, Math.round(Math.min(18, w / 34)));
        fontSizeRef.current = fontSize;

        const colCount = Math.max(1, Math.floor(w / fontSize));
        const rows = Math.max(1, Math.floor(h / fontSize));

        const nextCols: ColumnState[] = new Array(colCount).fill(null).map((_, i) => {
            const prev = colsRef.current[i];
            // Keep existing columns when possible (prevents hard “pop” on resize),
            // but re-seed if structure is invalid.
            if (prev && prev.trailLen > 0 && prev.chars?.length === prev.trailLen) return prev;
            return initColumn(rows);
        });
        colsRef.current = nextCols;
    }, [initColumn]);

    React.useEffect(() => {
        reduceMotionRef.current = prefersReducedMotion();
        if (reduceMotionRef.current) return;

        const wrap = wrapRef.current;
        if (!wrap) return;

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const cr = entry.contentRect;
            resizeTo(Math.max(1, Math.floor(cr.width)), Math.max(1, Math.floor(cr.height)));
        });
        ro.observe(wrap);

        return () => {
            ro.disconnect();
        };
    }, [resizeTo]);

    React.useEffect(() => {
        if (prefersReducedMotion()) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const step = () => {
            rafRef.current = window.requestAnimationFrame(step);

            const now = performance.now();
            const last = lastFrameMsRef.current ?? now;
            lastFrameMsRef.current = now;
            const dtMs = Math.min(48, Math.max(0, now - last));
            const dtSec = dtMs / 1000;

            const { w, h } = sizeRef.current;
            if (!w || !h) return;

            const dpr = dprRef.current || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Fade the previous frame to create trails.
            // Note: we *draw the full tail every frame*, so this fade is just to clear leftovers.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(0, 0, w, h);

            const fontSize = fontSizeRef.current;
            ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
            ctx.textBaseline = 'top';

            const cols = colsRef.current;
            for (let i = 0; i < cols.length; i += 1) {
                const col = cols[i]!;
                const x = i * fontSize;

                col.yRows += col.speedRowsPerSec * dtSec;

                const stepRow = Math.floor(col.yRows);
                if (stepRow > col.lastStepRow) {
                    const steps = Math.min(12, stepRow - col.lastStepRow);
                    for (let s = 0; s < steps; s += 1) {
                        col.chars.unshift(randCharIdx());
                        col.chars.pop();
                    }
                    col.lastStepRow = stepRow;
                }

                // Draw tail every frame (guarantees long visible streams regardless of fade).
                for (let j = 0; j < col.trailLen; j += 1) {
                    const y = (col.yRows - j) * fontSize;
                    if (y < -fontSize * 2) continue;
                    if (y > h + fontSize * 2) continue;

                    const ch = MATRIX_CHARS[col.chars[j] ?? 0] ?? '0';

                    if (j === 0) {
                        // White head.
                        ctx.shadowColor = 'rgba(34, 197, 94, 0.55)';
                        ctx.shadowBlur = 16;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.fillText(ch, x, y);
                        ctx.shadowBlur = 0;
                        continue;
                    }

                    if (j === 1) {
                        ctx.fillStyle = 'rgba(134, 239, 172, 0.90)';
                        ctx.fillText(ch, x, y);
                        continue;
                    }

                    const a = col.alphas[j] ?? 0.2;
                    ctx.fillStyle = `rgba(34, 197, 94, ${a.toFixed(3)})`;
                    ctx.fillText(ch, x, y);
                }

                if ((col.yRows - col.trailLen) * fontSize > h + fontSize * 4) {
                    const rows = Math.max(1, Math.floor(h / fontSize));
                    const next = initColumn(rows);
                    cols[i] = next;
                }
            }
        };

        // Initial fill.
        const { w, h } = sizeRef.current;
        if (w && h) {
            ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
            ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            ctx.fillRect(0, 0, w, h);
        }

        lastFrameMsRef.current = null;
        rafRef.current = window.requestAnimationFrame(step);
        return () => {
            if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            lastFrameMsRef.current = null;
        };
    }, []);

    if (prefersReducedMotion()) return null;

    return (
        <div
            ref={wrapRef}
            className={joinClassNames('pointer-events-none absolute inset-0', props.className)}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} className="block w-full h-full opacity-[0.65]" />
        </div>
    );
}
