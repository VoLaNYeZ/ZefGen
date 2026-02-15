import React from 'react';
import { Check } from 'lucide-react';

export function StepBlock(props: {
    step: number;
    done: boolean;
    isLast?: boolean;
    children: React.ReactNode;
}) {
    const { step, done, isLast, children } = props;

    const desktopShell = done
        ? 'bg-[linear-gradient(160deg,rgba(16,185,129,0.75)_0%,rgba(52,211,153,0.38)_45%,rgba(99,102,241,0.25)_100%)] shadow-[0_18px_44px_-28px_rgba(16,185,129,0.9)]'
        : 'bg-[linear-gradient(160deg,rgba(99,102,241,0.85)_0%,rgba(56,189,248,0.35)_50%,rgba(15,23,42,0.5)_100%)] shadow-[0_18px_44px_-32px_rgba(99,102,241,0.85)]';
    const desktopInner = done
        ? 'bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.36)_0%,rgba(10,18,38,0.96)_58%,rgba(2,6,23,0.98)_100%)] text-emerald-50'
        : 'bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.32)_0%,rgba(10,18,38,0.95)_58%,rgba(2,6,23,0.98)_100%)] text-indigo-50/95';
    const mobileBadge = done
        ? 'bg-emerald-500/20 text-emerald-50 ring-1 ring-emerald-400/50 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]'
        : 'bg-slate-950/40 text-indigo-100/95 ring-1 ring-indigo-400/30';
    const stepNumber = String(Math.max(1, step)).padStart(2, '0');

    return (
        <div className={`relative ${isLast ? '' : 'pb-6'}`}>
            {/*
                Desktop: keep the number outside the folder body (left gutter).
                Mobile: render a smaller inline badge so it doesn't get cut off.
            */}
            <div className="hidden sm:flex absolute -left-[56px] top-0 bottom-0 flex-col items-center z-20">
                <div
                    className={`relative mt-5 rounded-[12px] p-[1px] ${desktopShell}`}
                    aria-label={`Step ${step}${done ? ' completed' : ''}`}
                    title={`Step ${step}${done ? ' completed' : ''}`}
                >
                    <div
                        className={`h-11 w-11 rounded-[11px] backdrop-blur-md border ${
                            done ? 'border-emerald-300/35' : 'border-indigo-300/25'
                        } ${desktopInner} flex items-center justify-center`}
                    >
                        <span className="font-roboto-flex text-[16px] leading-none font-semibold tabular-nums">
                            {stepNumber}
                        </span>
                    </div>
                    {done && (
                        <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/25 text-emerald-50">
                            <Check size={10} strokeWidth={3} />
                        </span>
                    )}
                </div>
                {!isLast && (
                    <div
                        aria-hidden="true"
                        className={`mt-3 w-px flex-1 ${done ? 'bg-emerald-300/25' : 'bg-indigo-300/20'}`}
                    />
                )}
            </div>

            <div className="sm:hidden mb-3 flex items-center gap-2">
                <div
                    className={`relative flex h-8 min-w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${mobileBadge}`}
                    aria-label={`Step ${step}${done ? ' completed' : ''}`}
                    title={`Step ${step}${done ? ' completed' : ''}`}
                >
                    {stepNumber}
                </div>
                <div className={`h-px flex-1 ${done ? 'bg-emerald-300/20' : 'bg-indigo-400/10'}`} aria-hidden="true" />
            </div>

            <div className="min-w-0">{children}</div>
        </div>
    );
}
