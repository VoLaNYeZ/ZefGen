import React from 'react';
import { CheckCircle2, XCircle, Loader2, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { GenerationJob } from '../../hooks/use-generation-jobs';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const formatMs = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m <= 0) return `${r}s`;
    return `${m}m ${r}s`;
};

const parseEtaMsFromMessage = (message: string | undefined) => {
    const msg = String(message || '');
    const m = msg.match(/~\s*(\d+)\s*([sm])(?:\b|\/)/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = String(m[2] || '').toLowerCase();
    if (unit === 'm') return Math.round(n * 60_000);
    return Math.round(n * 1000);
};

const fallbackEtaMsForJob = (job: GenerationJob) => {
    if (job.providerId === 'replicate:seedream-4') return 40_000;
    if (job.providerId === 'replicate:nano-banana-2') return 120_000;
    if (job.providerId === 'replicate:nano-banana-pro') return 120_000;
    if (job.providerId && String(job.providerId).startsWith('openai:')) return 120_000;
    return null;
};

const hashU32 = (s: string) => {
    // Small deterministic hash for stable per-job wobble. Not crypto; just UI feel.
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

export const GenerationQueueWidget = (props: {
    jobs: GenerationJob[];
    onDismissJob: (id: string) => void;
    onClearFinished: () => void;
    onCancelJob?: (id: string) => void;
}) => {
    const { jobs, onDismissJob, onClearFinished, onCancelJob } = props;
    const runningCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
    const [open, setOpen] = React.useState(false);
    const [now, setNow] = React.useState(() => Date.now());

    const lastProgressByJobIdRef = React.useRef<Record<string, number>>({});
    const unitStartedAtByJobIdRef = React.useRef<Record<string, number>>({});
    const maxVisualByJobIdRef = React.useRef<Record<string, number>>({});

    React.useEffect(() => {
        if (runningCount <= 0) return;
        setNow(Date.now());
        const t = window.setInterval(() => setNow(Date.now()), 250);
        return () => window.clearInterval(t);
    }, [runningCount]);

    React.useEffect(() => {
        const seen = new Set(jobs.map((j) => j.id));
        const cleanup = (ref: React.MutableRefObject<Record<string, number>>) => {
            Object.keys(ref.current).forEach((id) => {
                if (!seen.has(id)) delete ref.current[id];
            });
        };
        cleanup(lastProgressByJobIdRef);
        cleanup(unitStartedAtByJobIdRef);
        cleanup(maxVisualByJobIdRef);

        const ts = Date.now();
        for (const job of jobs) {
            if (!job.progress) continue;
            const isRunning = job.status === 'running' || job.status === 'queued';
            if (!isRunning) {
                delete lastProgressByJobIdRef.current[job.id];
                delete unitStartedAtByJobIdRef.current[job.id];
                delete maxVisualByJobIdRef.current[job.id];
                continue;
            }

            const cur = Number(job.progress.current || 0);
            const total = Math.max(1, Number(job.progress.total || 1));
            const last = lastProgressByJobIdRef.current[job.id];
            if (typeof last !== 'number') {
                lastProgressByJobIdRef.current[job.id] = cur;
                unitStartedAtByJobIdRef.current[job.id] = job.startedAt;
                maxVisualByJobIdRef.current[job.id] = clamp01(cur / total);
            } else if (cur !== last) {
                lastProgressByJobIdRef.current[job.id] = cur;
                unitStartedAtByJobIdRef.current[job.id] = ts;
                maxVisualByJobIdRef.current[job.id] = Math.max(maxVisualByJobIdRef.current[job.id] ?? 0, clamp01(cur / total));
            }
        }
    }, [jobs]);

    const getVisualProgress = React.useCallback(
        (job: GenerationJob) => {
            if (!job.progress) return null;

            const total = Math.max(1, Number(job.progress.total || 1));
            const current = clamp(Number(job.progress.current || 0), 0, total);
            const real = current / total;

            if (job.status === 'success') return 1;
            const isRunning = job.status === 'running' || job.status === 'queued';
            if (!isRunning) return clamp01(real);

            const etaMs =
                parseEtaMsFromMessage(job.message) ??
                fallbackEtaMsForJob(job);
            if (!etaMs) return clamp01(real);

            const unitStartedAt = unitStartedAtByJobIdRef.current[job.id] ?? job.startedAt;
            const elapsedUnit = Math.max(0, now - unitStartedAt);
            const t = clamp01(elapsedUnit / etaMs);

            // Ease-out so it moves quickly at first but slows near the end of a unit.
            const eased = 1 - Math.pow(1 - t, 2.2);

            // Small deterministic wobble to avoid a perfectly linear feel.
            const h = hashU32(job.id);
            const phase = ((h % 1000) / 1000) * Math.PI * 2;
            const freq = 0.75 + (((h >>> 10) % 1000) / 1000) * 0.45;
            const amp = 0.028 + (((h >>> 20) % 1000) / 1000) * 0.02;
            const wobble = (Math.sin((now / 1000) * freq + phase) + 1) * 0.5 * amp;

            const withinUnit = clamp(eased + wobble, 0, 0.92);
            const pseudo = (current + withinUnit) / total;

            let visual = clamp(Math.max(real, pseudo), 0, 0.97);

            // Prevent jitter/backtracking (wobble should feel organic, not "shaky").
            const prevMax = maxVisualByJobIdRef.current[job.id] ?? 0;
            if (visual < prevMax) {
                visual = prevMax;
            } else {
                maxVisualByJobIdRef.current[job.id] = visual;
            }

            return visual;
        },
        [now]
    );

    React.useEffect(() => {
        if (runningCount > 0) setOpen(true);
    }, [runningCount]);

    if (!jobs.length) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[60] w-[340px] max-w-[92vw]">
            <div className="rounded-2xl border border-indigo-400/25 bg-slate-950/80 backdrop-blur-md shadow-[0_18px_55px_-40px_rgba(99,102,241,0.8)] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
                >
                    <div className="flex items-center gap-2">
                        {runningCount > 0 ? (
                            <Loader2 className="animate-spin text-indigo-200/80" size={14} />
                        ) : (
                            <CheckCircle2 className="text-emerald-300/80" size={14} />
                        )}
                        <div className="text-[11px] font-semibold tracking-[0.1em] text-indigo-200/70 uppercase">
                            {runningCount > 0 ? `Generating… (${runningCount})` : 'Jobs'}
                        </div>
                    </div>
                    <div className="text-indigo-200/60">
                        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                </button>

                {open && (
                    <div className="border-t border-white/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-indigo-200/60">Status</div>
                            <button
                                type="button"
                                onClick={onClearFinished}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                            >
                                <Trash2 size={12} />
                                Clear finished
                            </button>
                        </div>

                        <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-indigo-900/40">
                            {jobs.map((job) => {
                                const end = job.endedAt ?? now;
                                const elapsed = end - job.startedAt;
                                const progressText = job.progress
                                    ? `${job.progress.current}/${job.progress.total}`
                                    : null;

                                const statusIcon =
                                    job.status === 'running' || job.status === 'queued' ? (
                                        <Loader2 className="animate-spin text-indigo-200/70" size={14} />
                                    ) : job.status === 'success' ? (
                                        <CheckCircle2 className="text-emerald-300/80" size={14} />
                                    ) : job.status === 'error' ? (
                                        <XCircle className="text-rose-300/80" size={14} />
                                    ) : (
                                        <XCircle className="text-indigo-200/40" size={14} />
                                    );

                                return (
                                    <div key={job.id} className="rounded-xl border border-white/10 bg-slate-900/30 p-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {statusIcon}
                                                    <div className="text-[12px] font-semibold text-white truncate">{job.title}</div>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-indigo-200/50">
                                                    <span>{formatMs(elapsed)}</span>
                                                    {progressText && <span>{progressText}</span>}
                                                    {job.message && <span className="truncate">{job.message}</span>}
                                                </div>
                                            </div>
                                            {job.status === 'running' || job.status === 'queued' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onCancelJob?.(job.id)}
                                                    disabled={!onCancelJob}
                                                    className={`shrink-0 inline-flex items-center justify-center rounded-full border p-1.5 ${
                                                        onCancelJob
                                                            ? 'border-white/10 text-indigo-200/60 hover:border-rose-400/40 hover:text-white'
                                                            : 'border-white/10 text-indigo-200/30'
                                                    }`}
                                                    aria-label="Cancel"
                                                    title={onCancelJob ? 'Cancel' : undefined}
                                                >
                                                    <X size={12} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onDismissJob(job.id)}
                                                    className="shrink-0 inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white"
                                                    aria-label="Dismiss"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                        {job.progress && (
                                            <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                                                {/*
                                                    Visual progress is ETA-based (organic) so it keeps moving
                                                    even when real progress is 0 until the unit completes.
                                                */}
                                                <div
                                                    className="h-full bg-indigo-400/60"
                                                    style={{
                                                        width: `${Math.round(
                                                            (getVisualProgress(job) ?? job.progress.current / Math.max(1, job.progress.total)) *
                                                                100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
