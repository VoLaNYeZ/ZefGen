import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { ExternalLink, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import { upsertConnectorAppConfig } from '../../data/connector-app-config';
import { useConnectorJobs } from '../../hooks/use-connector-jobs';
import { useConnectorJobMessages } from '../../hooks/use-connector-messages';
import { MatrixTerminal } from './MatrixTerminal';
import { humanizeStage, parseRunnerLog } from '../../utils/runner-log';

const SPINNER = ['|', '/', '-', '\\'];

const formatElapsed = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m >= 60) {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return `${String(h).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
    }
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

const badge = (status: string) => {
    const base = 'inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]';
    if (status === 'succeeded') return `${base} border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90`;
    if (status === 'failed') return `${base} border-rose-400/25 bg-rose-500/10 text-rose-100/90`;
    if (status === 'waiting_for_user') return `${base} border-amber-400/25 bg-amber-500/10 text-amber-100/90`;
    if (status === 'running') return `${base} border-indigo-400/25 bg-indigo-500/10 text-indigo-100/90`;
    if (status === 'queued') return `${base} border-indigo-400/10 bg-slate-950/20 text-indigo-200/60`;
    return `${base} border-white/10 bg-slate-950/20 text-indigo-200/60`;
};

type ConnectorForm = ReturnType<typeof import('../../hooks/use-connector-config-form').useConnectorConfigForm>;

export function ConnectorRunnerPanel(props: {
    session: Session | null;
    selectedApp: AppItem | null;
    githubRepoUrl?: string | null;
    connectorForm: ConnectorForm;
    pickedIcon: boolean;
    text: (key: TranslationKey) => string;
    reportError?: (msg: string) => void;
}) {
    const { session, selectedApp, githubRepoUrl, connectorForm, pickedIcon, text, reportError } = props;
    const [bugReport, setBugReport] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);

    const { jobs, latestJob, loading, error, refresh, createGenerateJob, createContinueJob, createFixJob, requestCancel } =
        useConnectorJobs({ session, selectedApp, githubRepoUrl, pollMs: 3000 });

    const { messages, unansweredQuestions, answerQuestion } = useConnectorJobMessages({
        session,
        jobId: latestJob?.id || null,
        pollMs: 2500,
    });

    // DEBUG ONLY:
    // Verbose runner output (raw log lines).
    //   localStorage.setItem('zefgen.debug.runnerVerbose', '1'); location.reload();
    const runnerVerbose = React.useMemo(() => {
        try {
            return window.localStorage.getItem('zefgen.debug.runnerVerbose') === '1';
        } catch {
            return false;
        }
    }, []);

    // DEBUG ONLY:
    // The verify tail is noisy and not product-grade for normal users.
    // To inspect it locally, run:
    //   localStorage.setItem('zefgen.debug.verifyTail', '1'); location.reload();
    const showVerifyTailFlag = React.useMemo(() => {
        try {
            return window.localStorage.getItem('zefgen.debug.verifyTail') === '1';
        } catch {
            return false;
        }
    }, []);

    const showVerifyTail = showVerifyTailFlag || runnerVerbose;

    const [spinnerTick, setSpinnerTick] = React.useState(0);
    const [nowMs, setNowMs] = React.useState(() => Date.now());
    const isJobActive =
        latestJob?.status === 'queued' || latestJob?.status === 'running' || latestJob?.status === 'waiting_for_user';

    React.useEffect(() => {
        if (!isJobActive) return;
        const t1 = window.setInterval(() => setSpinnerTick((t) => t + 1), 200);
        const t2 = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => {
            window.clearInterval(t1);
            window.clearInterval(t2);
        };
    }, [isJobActive, latestJob?.id]);

    const logLines = React.useMemo(() => messages.filter((m) => m.kind === 'log'), [messages]);
    const runnerState = React.useMemo(() => parseRunnerLog(logLines as any[]), [logLines]);

    const terminalMode: 'idle' | 'compact' | 'verbose' = !latestJob ? 'idle' : runnerVerbose ? 'verbose' : 'compact';
    const spinnerChar = SPINNER[spinnerTick % SPINNER.length] || '|';

    const stageStartMs = React.useMemo(() => {
        if (runnerState.stageStartedAtMs) return runnerState.stageStartedAtMs;
        const started = Date.parse(String(latestJob?.started_at || latestJob?.created_at || ''));
        return Number.isFinite(started) ? started : null;
    }, [runnerState.stageStartedAtMs, latestJob?.started_at, latestJob?.created_at]);

    const elapsedText = stageStartMs ? formatElapsed(nowMs - stageStartMs) : '';

    const compactLines = React.useMemo(() => {
        if (terminalMode === 'idle') {
            return [
                { level: 'info' as const, text: `>>> ${String(text('connector_no_jobs') || '').trim()}` },
                { level: 'info' as const, text: `>>> Press "${text('connector_generate')}" to start.` },
            ];
        }

        const lines: Array<{ level: 'info' | 'warn' | 'error' | 'success'; text: string }> = [];
        const jobKind = String(latestJob?.kind || '').trim();
        const jobStatus = String(latestJob?.status || '').trim();

        lines.push({ level: 'info', text: `>>> JOB: ${jobKind || 'runner'} · STATUS: ${jobStatus || '-'}` });

        const repo = String(latestJob?.repo_full_name || runnerState.repo || '').trim();
        if (repo) lines.push({ level: 'info', text: `REPO: ${repo}` });

        if (latestJob?.status === 'waiting_for_user' || unansweredQuestions.length > 0) {
            lines.push({ level: 'warn', text: '!!! ACTION REQUIRED: waiting for your input' });
        }

        const stage = humanizeStage(runnerState.currentStage);
        const milestoneIdx = runnerState.currentMilestoneIndex;
        const milestoneTotal = runnerState.milestonesTotal;

        if (isJobActive) {
            if (milestoneIdx && milestoneTotal) {
                lines.push({
                    level: 'info',
                    text: `||| Milestone ${milestoneIdx}/${milestoneTotal}  ${spinnerChar}  ${elapsedText}`,
                });
            } else if (stage) {
                lines.push({ level: 'info', text: `||| ${stage}  ${spinnerChar}  ${elapsedText}` });
            } else {
                lines.push({ level: 'info', text: `||| Working  ${spinnerChar}  ${elapsedText}` });
            }
        } else if (stage) {
            lines.push({ level: 'info', text: `||| ${stage}` });
        }

        if (latestJob?.status === 'failed' && latestJob?.error) {
            lines.push({ level: 'error', text: `ERR: ${String(latestJob.error)}` });
        }

        for (const ev of runnerState.events) {
            if (ev.level === 'success') lines.push({ level: 'success', text: `OK: ${ev.text}` });
            else if (ev.level === 'error') lines.push({ level: 'error', text: `ERR: ${ev.text}` });
            else if (ev.level === 'warn') lines.push({ level: 'warn', text: `WARN: ${ev.text}` });
            else lines.push({ level: 'info', text: `... ${ev.text}` });
        }

        if (runnerState.pushedUrl && !lines.some((l) => l.text.includes(runnerState.pushedUrl || ''))) {
            lines.push({ level: 'success', text: `LINK: ${runnerState.pushedUrl}` });
        }

        const MAX = 12;
        return lines.slice(0, MAX);
    }, [
        terminalMode,
        text,
        latestJob?.kind,
        latestJob?.status,
        latestJob?.repo_full_name,
        latestJob?.error,
        unansweredQuestions.length,
        runnerState.repo,
        runnerState.currentStage,
        runnerState.currentMilestoneIndex,
        runnerState.milestonesTotal,
        runnerState.events,
        runnerState.pushedUrl,
        isJobActive,
        spinnerChar,
        elapsedText,
    ]);

    const verboseLines = React.useMemo(() => {
        return logLines.map((m: any) => ({
            role: String(m.role || ''),
            text: String(m.content || ''),
        }));
    }, [logLines]);

    const showVerifyStatus = runnerVerbose || latestJob?.verify_status === 'fail';

    const missingGeneratePrereqs = React.useMemo(() => {
        const missing: string[] = [];
        if (!pickedIcon) missing.push(text('connector_missing_icon'));
        if (String(connectorForm.projectBrief || '').trim().length === 0) missing.push(text('connector_missing_client_spec'));
        const vars = (connectorForm.variables ?? {}) as any;
        if (String(vars?.home_screen_name || '').trim().length === 0) missing.push(text('connector_missing_home_screen_name'));

        const toRepoFullNameFromUrl = (url: string | null | undefined) => {
            let u = String(url || '').trim();
            if (!u) return '';
            u = u.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
            // Only accept root repo URLs. This matches the job creation logic in use-connector-jobs.
            const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
            if (!m) return '';
            return `${m[1]}/${m[2]}`;
        };

        const repoFullName =
            String((selectedApp as any)?.github_repo_full_name || '').trim() ||
            toRepoFullNameFromUrl((selectedApp as any)?.github_repo_url) ||
            toRepoFullNameFromUrl(githubRepoUrl) ||
            '';
        const repoOk = Boolean(repoFullName);
        if (!repoOk) missing.push(text('connector_missing_repo'));
        return missing;
    }, [pickedIcon, connectorForm.projectBrief, connectorForm.variables, selectedApp, githubRepoUrl, text]);

    const generateBlocked = missingGeneratePrereqs.length > 0;
    const generateBlockedMessage = React.useMemo(() => {
        if (!generateBlocked) return '';
        return String(text('connector_generate_blocked_missing') || '').replace('{items}', missingGeneratePrereqs.join(', '));
    }, [generateBlocked, missingGeneratePrereqs, text]);

    const runGenerate = async () => {
        if (generateBlocked) {
            setLocalError(generateBlockedMessage || String(text('connector_generate_blocked_missing') || 'Cannot generate yet.'));
            return;
        }
        if (!session || !selectedApp) return;
        setBusy(true);
        setLocalError(null);
        try {
            // Best-effort: persist latest config before creating the job to avoid "forgot to press Save" runs.
            const { error: saveErr } = await upsertConnectorAppConfig({
                userId: session.user.id,
                appId: selectedApp.id,
                patch: {
                    // UI invariant: always iOS for now.
                    project_kind: 'ios',
                    project_brief: String(connectorForm.projectBrief || ''),
                    variables: connectorForm.variables || {},
                } as any,
            });
            if (saveErr) throw saveErr;
            await createGenerateJob();
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const runFix = async () => {
        setBusy(true);
        setLocalError(null);
        try {
            await createFixJob(bugReport);
            setBugReport('');
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const canContinue =
        Boolean(latestJob) &&
        String(latestJob?.status || '') === 'failed' &&
        String(latestJob?.kind || '') === 'generate' &&
        Boolean(String(latestJob?.work_branch || '').trim());

    const runContinue = async () => {
        if (!latestJob?.id) return;
        setBusy(true);
        setLocalError(null);
        try {
            await createContinueJob(String(latestJob.id));
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (jobId: string) => {
        setBusy(true);
        setLocalError(null);
        try {
            await requestCancel(jobId);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const answer = async (questionId: string, content: string) => {
        setBusy(true);
        setLocalError(null);
        try {
            await answerQuestion(questionId, content);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('connector_runner_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('connector_runner_subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={!session || !selectedApp || loading}
                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {loading ? text('loading') : text('refresh')}
                    </button>
                </div>
            </div>

            {(error || localError) && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {localError || error}
                </div>
            )}

            <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_actions')}</div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={runGenerate}
                                disabled={generateBlocked || busy || !session || !selectedApp}
                                className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                            >
                                {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                {text('connector_generate')}
                            </button>
                            {canContinue && (
                                <button
                                    type="button"
                                    onClick={runContinue}
                                    disabled={busy || !session || !selectedApp}
                                    className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-50/95 hover:border-amber-300/40 hover:bg-amber-500/15 disabled:opacity-60"
                                >
                                    {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {text('connector_continue')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 text-[11px] text-indigo-200/50">
                        Client spec and config are edited in the steps above.
                    </div>
                    {generateBlocked && (
                        <div className="mt-2 text-[11px] font-semibold text-amber-100/90">{generateBlockedMessage}</div>
                    )}
                    {canContinue && (
                        <div className="mt-2 text-[11px] text-indigo-200/45">{text('connector_continue_hint')}</div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_latest_job')}</div>
                        {latestJob?.status && <span className={badge(String(latestJob.status))}>{String(latestJob.status)}</span>}
                    </div>

                    {!latestJob && (
                        <div className="mt-3 text-xs text-indigo-200/50">{text('connector_no_jobs')}</div>
                    )}

                    {latestJob && (
                        <div className="mt-3 grid gap-2 text-xs text-indigo-200/70">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="truncate">
                                    {text('connector_job_kind')}{' '}
                                    <span className="font-semibold text-indigo-100">{String(latestJob.kind)}</span>
                                </div>
                                {(latestJob.status === 'running' || latestJob.status === 'queued' || latestJob.status === 'waiting_for_user') && (
                                    <button
                                        type="button"
                                        onClick={() => cancel(String(latestJob.id))}
                                        disabled={busy}
                                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
                                    >
                                        {text('cancel')}
                                    </button>
                                )}
                            </div>

                            {latestJob.pr_url && (
                                <a
                                    href={String(latestJob.pr_url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                >
                                    {text('connector_open_pr')}
                                    <ExternalLink size={14} />
                                </a>
                            )}

                            {showVerifyStatus && latestJob.verify_status && (
                                <div>
                                    {text('connector_verify_status')}{' '}
                                    <span className="font-semibold text-indigo-100">{String(latestJob.verify_status)}</span>
                                </div>
                            )}

                            {latestJob.summary && (
                                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/85 whitespace-pre-wrap">
                                    {String(latestJob.summary)}
                                </div>
                            )}

                            {showVerifyTail && latestJob.verify_tail && (
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] text-indigo-100/80 whitespace-pre-wrap max-h-[220px] overflow-y-auto">
                                    {String(latestJob.verify_tail)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {selectedApp && (
                    <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_messages')}</div>

                        {unansweredQuestions.length > 0 && (
                            <div className="mt-3 grid gap-2">
                                {unansweredQuestions.map((q) => (
                                    <QuestionCard
                                        key={q.id}
                                        question={q}
                                        onAnswer={answer}
                                        disabled={busy}
                                        text={text}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="mt-4">
                            <MatrixTerminal
                                mode={terminalMode}
                                compactLines={terminalMode === 'compact' || terminalMode === 'idle' ? compactLines : undefined}
                                verboseLines={terminalMode === 'verbose' ? verboseLines : undefined}
                                heightClass="h-[260px]"
                            />
                        </div>

                        <div className="mt-4">
                            <div className="text-[11px] font-semibold text-indigo-100">{text('connector_fix')}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                    value={bugReport}
                                    onChange={(e) => setBugReport(e.target.value)}
                                    className="min-w-[220px] flex-1 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                                    placeholder={text('connector_fix_placeholder')}
                                />
                                <button
                                    type="button"
                                    onClick={runFix}
                                    disabled={busy || !bugReport.trim() || !session || !selectedApp}
                                    className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                                >
                                    {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {text('connector_submit_fix')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {jobs.length > 1 && (
                    <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_history')}</div>
                        <div className="mt-3 grid gap-2">
                            {jobs.slice(0, 8).map((j: any) => (
                                <div
                                    key={j.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-indigo-200/70"
                                >
                                    <div className="min-w-0 truncate">
                                        <span className="font-semibold text-indigo-100">{String(j.kind)}</span>{' '}
                                        <span className="text-indigo-200/45">({String(j.created_at).slice(0, 19).replace('T', ' ')})</span>
                                    </div>
                                    <span className={badge(String(j.status))}>{String(j.status)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function QuestionCard(props: {
    question: any;
    onAnswer: (questionId: string, content: string) => Promise<void>;
    disabled: boolean;
    text: (key: TranslationKey) => string;
}) {
    const { question, onAnswer, disabled, text } = props;
    const [content, setContent] = React.useState('');
    const options: string[] = Array.isArray(question?.options) ? question.options : [];

    return (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
            <div className="text-[11px] font-semibold text-amber-100/90">{text('connector_question')}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-[11px] text-amber-50/85">{String(question.content || '')}</div>

            {options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {options.slice(0, 8).map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setContent(opt)}
                            className="ui-btn-fit ui-btn-fit-dense rounded-full border border-amber-400/20 bg-black/10 px-3 py-1 text-[11px] font-semibold text-amber-50/90 hover:border-amber-300/40"
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-w-[220px] flex-1 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-[11px] text-amber-50/90 outline-none placeholder:text-amber-50/40 focus:border-amber-300/40"
                    placeholder={text('connector_answer_placeholder')}
                />
                <button
                    type="button"
                    onClick={() => onAnswer(String(question.id), content)}
                    disabled={disabled || !content.trim()}
                    className="ui-btn-fit inline-flex items-center justify-center rounded-full border border-amber-400/25 bg-amber-500/15 px-4 py-2 text-[11px] font-semibold text-amber-50/95 hover:border-amber-300/40 disabled:opacity-60"
                >
                    {text('connector_send_answer')}
                </button>
            </div>
        </div>
    );
}
