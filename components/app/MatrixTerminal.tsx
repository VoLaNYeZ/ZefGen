import React from 'react';
import { MatrixRain } from './MatrixRain';

export type MatrixCompactLine = {
    level: 'info' | 'warn' | 'error' | 'success';
    text: string;
};

export type MatrixVerboseLine = {
    role?: string;
    text: string;
};

function joinClassNames(...parts: Array<string | undefined | null | false>) {
    return parts.filter(Boolean).join(' ');
}

function levelClass(level: MatrixCompactLine['level']) {
    if (level === 'success') return 'text-emerald-200/95';
    if (level === 'warn') return 'text-amber-200/95';
    if (level === 'error') return 'text-rose-200/95';
    return 'text-emerald-200/85';
}

export function MatrixTerminal(props: {
    title?: string;
    mode: 'idle' | 'compact' | 'verbose';
    compactLines?: MatrixCompactLine[];
    verboseLines?: MatrixVerboseLine[];
    heightClass?: string;
}) {
    const heightClass = props.heightClass ?? 'max-h-[260px]';
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const shouldStickToBottomRef = React.useRef(true);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldStickToBottomRef.current = distanceFromBottom < 48;
        };

        onScroll();
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (!shouldStickToBottomRef.current) return;
        el.scrollTop = el.scrollHeight;
    }, [props.mode, props.compactLines, props.verboseLines]);

    return (
        <div className="matrix-terminal rounded-2xl overflow-hidden">
            {props.title ? (
                <div className="flex items-center justify-between gap-3 border-b border-emerald-400/15 bg-black/40 px-3 py-2">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-emerald-100/85 uppercase">
                        {props.title}
                    </div>
                    <div className="text-[10px] text-emerald-200/40">
                        {props.mode === 'verbose' ? 'VERBOSE' : props.mode === 'compact' ? 'COMPACT' : 'IDLE'}
                    </div>
                </div>
            ) : null}

            <div
                ref={scrollRef}
                className={joinClassNames('relative overflow-y-auto px-3 py-3', heightClass)}
            >
                {props.mode === 'idle' ? <MatrixRain /> : null}

                <div className="relative z-10 space-y-1">
                    {props.mode === 'verbose' ? (
                        <div className="space-y-1">
                            {(props.verboseLines ?? []).map((l, idx) => (
                                <div key={idx} className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                                    {l.role ? (
                                        <span className="text-emerald-200/40">[{String(l.role)}]</span>
                                    ) : null}{' '}
                                    <span className="text-emerald-200/80">{String(l.text)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {(props.compactLines ?? []).map((l, idx) => (
                                <div
                                    key={idx}
                                    className={joinClassNames(
                                        'whitespace-pre-wrap break-words text-[12px] leading-relaxed',
                                        levelClass(l.level)
                                    )}
                                >
                                    {String(l.text)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
