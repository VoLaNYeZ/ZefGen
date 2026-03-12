import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { ExternalLink, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import type { ConnectorJob, DownstreamCaptureMode } from '../../data/connector-jobs';
import { useConnectorJobs } from '../../hooks/use-connector-jobs';
import { useConnectorJobMessages } from '../../hooks/use-connector-messages';
import { useConnectorJobArtifacts } from '../../hooks/use-connector-job-artifacts';
import { MatrixTerminal } from './MatrixTerminal';
import { ConnectorSaveConflictBanner } from './ConnectorSaveConflictBanner';
import { humanizeStage, parseRunnerLog } from '../../utils/runner-log';
import { deriveConnectorJobState, groupConnectorArtifacts } from '../../utils/connector-runner-state.js';

const SPINNER = ['|', '/', '-', '\\'];
const PANEL_TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;
const CAPTURE_MODES: DownstreamCaptureMode[] = ['renders', 'simulator', 'both'];
const MAIN_BRANCH = 'main';

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

const formatDateTime = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) return raw;
    return new Date(parsed).toLocaleString();
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

const panelMotionProps = (delay: number, reducedMotion: boolean) => {
    const initial = reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 };
    const exit = reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.995 };
    return {
        initial,
        animate: { opacity: 1, y: 0, scale: 1 },
        exit,
        transition: reducedMotion
            ? { duration: 0.12, delay: 0 }
            : { duration: 0.34, delay, ease: PANEL_TRANSITION_EASE },
    };
};

const getQaDisabledMessage = (reason: string, text: (key: TranslationKey) => string) => {
    if (reason === 'missing_code_sha') return text('connector_qa_missing_sha');
    if (reason === 'missing_code_job') return text('connector_qa_missing_source');
    return '';
};

const getScreenshotsDisabledMessage = (reason: string, text: (key: TranslationKey) => string) => {
    if (reason === 'missing_qa_job') return text('connector_screenshots_missing_qa');
    if (reason === 'missing_qa_sha') return text('connector_screenshots_missing_qa_sha');
    if (reason === 'missing_code_job') return text('connector_screenshots_missing_code');
    if (reason === 'missing_code_sha') return text('connector_screenshots_missing_code_sha');
    if (reason === 'stale_qa') return text('connector_screenshots_stale_qa');
    return '';
};

const getCaptureModeLabel = (mode: DownstreamCaptureMode, text: (key: TranslationKey) => string) => {
    if (mode === 'renders') return text('connector_capture_mode_renders');
    if (mode === 'simulator') return text('connector_capture_mode_simulator');
    if (mode === 'both') return text('connector_capture_mode_both');
    return mode;
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
    isReadOnly?: boolean;
}) {
    const { session, selectedApp, githubRepoUrl, connectorForm, pickedIcon, text, reportError, isReadOnly = false } = props;
    const [bugReport, setBugReport] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);
    const [panelsRevealed, setPanelsRevealed] = React.useState(false);
    const [startingGenerate, setStartingGenerate] = React.useState(false);
    const [animateTerminalAccent, setAnimateTerminalAccent] = React.useState(false);
    const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
    const [captureMode, setCaptureMode] = React.useState<DownstreamCaptureMode>('renders');
    const prefersReducedMotion = useReducedMotion();

    const {
        jobs,
        latestJob,
        loading,
        error,
        refresh,
        createGenerateJob,
        createContinueJob,
        createFixJob,
        createQaJob,
        createScreenshotsJob,
        requestCancel,
    } = useConnectorJobs({
        session,
        selectedApp,
        githubRepoUrl,
        baseBranch: MAIN_BRANCH,
        pollMs: 3000,
    });

    const { messages, unansweredQuestions, answerQuestion } = useConnectorJobMessages({
        session,
        jobId: latestJob?.id || null,
        pollMs: 2500,
    });

    const selectedJob = React.useMemo(
        () => jobs.find((job) => String(job?.id || '') === String(selectedJobId || '')) ?? latestJob ?? null,
        [jobs, latestJob, selectedJobId]
    );

    const {
        artifacts,
        artifactUrlsById,
        artifactJsonById,
        loading: artifactsLoading,
        error: artifactsError,
    } = useConnectorJobArtifacts({
        session,
        jobId: selectedJob?.id || null,
        pollMs: 5000,
    });

    const groupedArtifacts = React.useMemo(() => groupConnectorArtifacts(artifacts), [artifacts]);
    const connectorJobState = React.useMemo(() => deriveConnectorJobState(jobs), [jobs]);

    React.useEffect(() => {
        setBugReport('');
        setLocalError(null);
        setPanelsRevealed(false);
        setStartingGenerate(false);
        setAnimateTerminalAccent(false);
        setSelectedJobId(null);
        setCaptureMode('renders');
    }, [selectedApp?.id]);

    React.useEffect(() => {
        if (jobs.length === 0) return;
        setPanelsRevealed(true);
        setStartingGenerate(false);
    }, [jobs.length]);

    React.useEffect(() => {
        if (!animateTerminalAccent) return;
        const timer = window.setTimeout(() => setAnimateTerminalAccent(false), prefersReducedMotion ? 120 : 620);
        return () => window.clearTimeout(timer);
    }, [animateTerminalAccent, prefersReducedMotion]);

    React.useEffect(() => {
        if (!latestJob?.id) {
            setSelectedJobId(null);
            return;
        }
        if (!selectedJobId) {
            setSelectedJobId(latestJob.id);
            return;
        }
        const exists = jobs.some((job) => String(job?.id || '') === String(selectedJobId));
        if (!exists) setSelectedJobId(latestJob.id);
    }, [jobs, latestJob?.id, selectedJobId]);

    const runnerVerbose = React.useMemo(() => {
        try {
            return window.localStorage.getItem('zefgen.debug.runnerVerbose') === '1';
        } catch {
            return false;
        }
    }, []);

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
        const tickTimer = window.setInterval(() => setSpinnerTick((tick) => tick + 1), 200);
        const nowTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => {
            window.clearInterval(tickTimer);
            window.clearInterval(nowTimer);
        };
    }, [isJobActive, latestJob?.id]);

    const logLines = React.useMemo(() => messages.filter((message) => message.kind === 'log'), [messages]);
    const runnerState = React.useMemo(() => parseRunnerLog(logLines as any[]), [logLines]);

    const hasOperationalPanels = panelsRevealed || jobs.length > 0;
    const showHeroGenerate = !loading && !hasOperationalPanels;
    const spinnerChar = SPINNER[spinnerTick % SPINNER.length] || '|';

    const stageStartMs = React.useMemo(() => {
        if (runnerState.stageStartedAtMs) return runnerState.stageStartedAtMs;
        const started = Date.parse(String(latestJob?.started_at || latestJob?.created_at || ''));
        return Number.isFinite(started) ? started : null;
    }, [runnerState.stageStartedAtMs, latestJob?.started_at, latestJob?.created_at]);

    const elapsedText = stageStartMs ? formatElapsed(nowMs - stageStartMs) : '';

    const compactLines = React.useMemo(() => {
        if (!latestJob && startingGenerate) {
            return [
                { level: 'info' as const, text: `>>> ${String(text('connector_job_starting') || '').trim()}` },
                { level: 'info' as const, text: '||| Queueing generate job...' },
            ];
        }

        if (!latestJob) {
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

        for (const event of runnerState.events) {
            if (event.level === 'success') lines.push({ level: 'success', text: `OK: ${event.text}` });
            else if (event.level === 'error') lines.push({ level: 'error', text: `ERR: ${event.text}` });
            else if (event.level === 'warn') lines.push({ level: 'warn', text: `WARN: ${event.text}` });
            else lines.push({ level: 'info', text: event.text });
        }

        if (runnerState.pushedUrl && !lines.some((line) => line.text.includes(runnerState.pushedUrl || ''))) {
            lines.push({ level: 'success', text: `LINK: ${runnerState.pushedUrl}` });
        }

        return lines.slice(0, 12);
    }, [
        elapsedText,
        isJobActive,
        latestJob,
        runnerState.currentMilestoneIndex,
        runnerState.currentStage,
        runnerState.events,
        runnerState.milestonesTotal,
        runnerState.pushedUrl,
        runnerState.repo,
        spinnerChar,
        startingGenerate,
        text,
        unansweredQuestions.length,
    ]);

    const verboseLines = React.useMemo(
        () =>
            logLines.map((message: any) => ({
                role: String(message.role || ''),
                text: String(message.content || ''),
            })),
        [logLines]
    );

    const showVerifyStatus = runnerVerbose || latestJob?.verify_status === 'fail';

    const missingGeneratePrereqs = React.useMemo(() => {
        const missing: string[] = [];
        if (!pickedIcon) missing.push(text('connector_missing_icon'));
        if (String(connectorForm.projectBrief || '').trim().length === 0) missing.push(text('connector_missing_client_spec'));
        const vars = (connectorForm.variables ?? {}) as any;
        if (String(vars?.home_screen_name || '').trim().length === 0) missing.push(text('connector_missing_home_screen_name'));

        const repoFullName =
            String((selectedApp as any)?.github_repo_full_name || '').trim() ||
            String((selectedApp as any)?.github_repo_url || '').trim() ||
            String(githubRepoUrl || '').trim();
        if (!repoFullName) missing.push(text('connector_missing_repo'));
        return missing;
    }, [connectorForm.projectBrief, connectorForm.variables, githubRepoUrl, pickedIcon, selectedApp, text]);

    const generateBlocked = missingGeneratePrereqs.length > 0;
    const generateBlockedMessage = React.useMemo(() => {
        if (!generateBlocked) return '';
        return String(text('connector_generate_blocked_missing') || '').replace('{items}', missingGeneratePrereqs.join(', '));
    }, [generateBlocked, missingGeneratePrereqs, text]);

    const qaDisabledMessage = getQaDisabledMessage(connectorJobState.qaDisabledReason, text);
    const screenshotsDisabledMessage = getScreenshotsDisabledMessage(connectorJobState.screenshotsDisabledReason, text);
    const screenshotsModeHint =
        captureMode === 'renders' ? text('connector_screenshots_ready_hint') : text('connector_screenshots_mode_warning');

    const runGenerate = async () => {
        if (isReadOnly) return;
        if (generateBlocked) {
            setLocalError(generateBlockedMessage || String(text('connector_generate_blocked_missing') || 'Cannot generate yet.'));
            return;
        }
        if (!session || !selectedApp) return;

        const willRevealPanels = !hasOperationalPanels;
        if (willRevealPanels) {
            setPanelsRevealed(true);
            setAnimateTerminalAccent(true);
        }
        if (!latestJob) setStartingGenerate(true);

        setBusy(true);
        setLocalError(null);
        try {
            const saved = await connectorForm.savePatch({
                project_brief: String(connectorForm.projectBrief || ''),
                base_branch: MAIN_BRANCH,
                variables: connectorForm.variables || {},
            });
            if (!saved) {
                setStartingGenerate(false);
                return;
            }
            const created = await createGenerateJob();
            if (created?.id) setSelectedJobId(String(created.id));
        } catch (e: any) {
            const msg = String(e?.message || e);
            setStartingGenerate(false);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const runQa = async () => {
        if (isReadOnly) return;
        if (!connectorJobState.qaSourceJob || !connectorJobState.canRunQa) {
            setLocalError(qaDisabledMessage || text('connector_qa_missing_source'));
            return;
        }
        setBusy(true);
        setLocalError(null);
        try {
            const created = await createQaJob({
                sourceJobId: String(connectorJobState.qaSourceJob.id),
                sourceRef: String(connectorJobState.qaSourceJob.result_commit_sha || ''),
            });
            if (created?.id) setSelectedJobId(String(created.id));
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const runScreenshots = async () => {
        if (isReadOnly) return;
        if (!connectorJobState.screenshotsSourceJob || !connectorJobState.canRunScreenshots) {
            setLocalError(screenshotsDisabledMessage || text('connector_screenshots_missing_qa'));
            return;
        }
        setBusy(true);
        setLocalError(null);
        try {
            const created = await createScreenshotsJob({
                sourceJobId: String(connectorJobState.screenshotsSourceJob.id),
                sourceRef: String(connectorJobState.screenshotsSourceJob.result_commit_sha || ''),
                captureMode,
            });
            if (created?.id) setSelectedJobId(String(created.id));
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const runFix = async () => {
        if (isReadOnly) return;
        setBusy(true);
        setLocalError(null);
        try {
            const created = await createFixJob(bugReport);
            if (created?.id) setSelectedJobId(String(created.id));
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
        if (isReadOnly || !latestJob?.id) return;
        setBusy(true);
        setLocalError(null);
        try {
            const created = await createContinueJob(String(latestJob.id));
            if (created?.id) setSelectedJobId(String(created.id));
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (jobId: string) => {
        if (isReadOnly) return;
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
        if (isReadOnly) return;
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

    const selectedArtifactJson = React.useMemo(() => {
        const qaReportId = String(groupedArtifacts?.qaReport?.id || '');
        const manifestId = String(groupedArtifacts?.screenshotManifest?.id || '');
        return {
            qaReport: qaReportId ? artifactJsonById[qaReportId] : null,
            screenshotManifest: manifestId ? artifactJsonById[manifestId] : null,
        };
    }, [artifactJsonById, groupedArtifacts]);

    const combinedError = localError || connectorForm.error || error || artifactsError;

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

            {combinedError && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {combinedError}
                </div>
            )}
            <ConnectorSaveConflictBanner connectorForm={connectorForm} text={text} />

            <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_messages')}</div>
                        {unansweredQuestions.length > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/90">
                                {text('connector_question')}
                            </span>
                        ) : null}
                    </div>

                    {unansweredQuestions.length > 0 && (
                        <div className="mt-3 grid gap-2">
                            {unansweredQuestions.map((question) => (
                                <React.Fragment key={question.id}>
                                    <QuestionCard
                                        question={question}
                                        onAnswer={answer}
                                        disabled={busy || isReadOnly}
                                        text={text}
                                    />
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    <motion.div
                        className="mt-4 rounded-2xl"
                        initial={false}
                        animate={
                            animateTerminalAccent && !prefersReducedMotion
                                ? {
                                      scale: [1, 1.012, 1],
                                      boxShadow: [
                                          '0 0 0 rgba(16,185,129,0)',
                                          '0 0 0 1px rgba(16,185,129,0.18), 0 0 42px rgba(16,185,129,0.18)',
                                          '0 0 0 rgba(16,185,129,0)',
                                      ],
                                  }
                                : {
                                      scale: 1,
                                      boxShadow: '0 0 0 rgba(16,185,129,0)',
                                  }
                        }
                        transition={
                            prefersReducedMotion
                                ? { duration: 0.12 }
                                : { duration: 0.56, times: [0, 0.38, 1], ease: PANEL_TRANSITION_EASE }
                        }
                    >
                        <MatrixTerminal
                            mode={!latestJob ? (startingGenerate ? 'compact' : 'idle') : runnerVerbose ? 'verbose' : 'compact'}
                            compactLines={!latestJob || !runnerVerbose ? compactLines : undefined}
                            verboseLines={latestJob && runnerVerbose ? verboseLines : undefined}
                            heightClass={hasOperationalPanels ? 'h-[260px]' : 'h-[320px]'}
                        />
                    </motion.div>

                    {showHeroGenerate ? (
                        <div className="mt-5 flex flex-col items-center gap-3 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),rgba(2,6,23,0.12)_58%,rgba(2,6,23,0)_100%)] px-5 py-6 text-center">
                            <button
                                type="button"
                                onClick={runGenerate}
                                disabled={isReadOnly || generateBlocked || busy || !session || !selectedApp}
                                className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full border border-indigo-300/45 bg-[linear-gradient(135deg,rgba(99,102,241,0.28),rgba(34,197,94,0.18))] px-8 py-3 text-sm font-semibold text-indigo-50 shadow-[0_18px_45px_-28px_rgba(99,102,241,0.8)] hover:border-indigo-200/60 hover:shadow-[0_22px_55px_-28px_rgba(99,102,241,0.95)] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                                {text('connector_generate')}
                            </button>
                            {generateBlocked ? (
                                <div className="text-[11px] font-semibold text-amber-100/90">{generateBlockedMessage}</div>
                            ) : (
                                <div className="text-[11px] text-indigo-200/45">
                                    {text('connector_runner_generate_hint')}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {hasOperationalPanels ? (
                    <motion.div key="runner-panels" className="grid gap-3" initial={false} animate={{ opacity: 1 }}>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <motion.div
                                {...panelMotionProps(0.16, Boolean(prefersReducedMotion))}
                                className="rounded-2xl border border-white/10 bg-slate-900/25 p-4"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs font-semibold text-indigo-100">{text('connector_actions')}</div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={runGenerate}
                                        disabled={isReadOnly || generateBlocked || busy || !session || !selectedApp}
                                        className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                    >
                                        {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                        {text('connector_generate')}
                                    </button>
                                    {canContinue ? (
                                        <button
                                            type="button"
                                            onClick={runContinue}
                                            disabled={isReadOnly || busy || !session || !selectedApp}
                                            className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-50/95 hover:border-amber-300/40 hover:bg-amber-500/15 disabled:opacity-60"
                                        >
                                            {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                            {text('connector_continue')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={runQa}
                                        disabled={isReadOnly || busy || !session || !selectedApp || !connectorJobState.canRunQa}
                                        className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                                    >
                                        {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                        {text('connector_qa')}
                                    </button>
                                    <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-2 py-1">
                                        <span className="px-2 text-[11px] font-semibold text-indigo-200/55">
                                            {text('connector_capture_mode')}
                                        </span>
                                        <select
                                            value={captureMode}
                                            onChange={(event) => setCaptureMode(event.target.value as DownstreamCaptureMode)}
                                            disabled={isReadOnly || busy}
                                            className="rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100/85 outline-none hover:border-indigo-400/35 disabled:opacity-60"
                                        >
                                            {CAPTURE_MODES.map((mode) => (
                                                <option key={mode} value={mode}>
                                                    {getCaptureModeLabel(mode, text)}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={runScreenshots}
                                            disabled={isReadOnly || busy || !session || !selectedApp || !connectorJobState.canRunScreenshots}
                                            className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                                        >
                                            {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                            {text('connector_screenshots')}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 grid gap-2 text-[11px] text-indigo-200/55">
                                    <div>{text('connector_runner_generate_hint')}</div>
                                    {generateBlocked ? (
                                        <div className="font-semibold text-amber-100/90">{generateBlockedMessage}</div>
                                    ) : null}
                                    {canContinue ? (
                                        <div className="text-indigo-200/45">{text('connector_continue_hint')}</div>
                                    ) : null}
                                    {!connectorJobState.canRunQa ? (
                                        <div className="font-semibold text-amber-100/90">{qaDisabledMessage}</div>
                                    ) : connectorJobState.qaSourceJob?.result_commit_sha ? (
                                        <div>
                                            {text('connector_qa_targets_sha')}{' '}
                                            <span className="font-semibold text-indigo-100">
                                                {connectorJobState.qaSourceJob.result_commit_sha}
                                            </span>
                                        </div>
                                    ) : null}
                                    {!connectorJobState.canRunScreenshots ? (
                                        <div className="font-semibold text-amber-100/90">{screenshotsDisabledMessage}</div>
                                    ) : connectorJobState.screenshotsSourceJob?.result_commit_sha ? (
                                        <div>
                                            {text('connector_screenshots_targets_sha')}{' '}
                                            <span className="font-semibold text-indigo-100">
                                                {connectorJobState.screenshotsSourceJob.result_commit_sha}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div
                                        className={
                                            captureMode === 'renders'
                                                ? 'text-indigo-200/45'
                                                : 'font-semibold text-amber-100/90'
                                        }
                                    >
                                        {screenshotsModeHint}
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                {...panelMotionProps(0.24, Boolean(prefersReducedMotion))}
                                className="rounded-2xl border border-white/10 bg-slate-900/25 p-4"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs font-semibold text-indigo-100">{text('connector_job_inspector')}</div>
                                    {selectedJob?.status ? (
                                        <span className={badge(String(selectedJob.status))}>{String(selectedJob.status)}</span>
                                    ) : null}
                                </div>

                                {!selectedJob ? (
                                    <div className="mt-3 text-xs text-indigo-200/50">{text('connector_no_jobs')}</div>
                                ) : (
                                    <div className="mt-3 grid gap-3 text-xs text-indigo-200/70">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div>
                                                {text('connector_job_kind')}{' '}
                                                <span className="font-semibold text-indigo-100">{String(selectedJob.kind)}</span>
                                            </div>
                                            <div>
                                                {text('connector_created_at')}{' '}
                                                <span className="font-semibold text-indigo-100">{formatDateTime(selectedJob.created_at)}</span>
                                            </div>
                                            <div>
                                                {text('connector_base_branch')}{' '}
                                                <span className="font-semibold text-indigo-100">{selectedJob.base_branch || 'main'}</span>
                                            </div>
                                            {selectedJob.result_commit_sha ? (
                                                <div>
                                                    {text('connector_result_commit_sha')}{' '}
                                                    <span className="font-semibold text-indigo-100">{selectedJob.result_commit_sha}</span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {(selectedJob.status === 'running' ||
                                            selectedJob.status === 'queued' ||
                                            selectedJob.status === 'waiting_for_user') && (
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => cancel(String(selectedJob.id))}
                                                    disabled={isReadOnly || busy}
                                                    className="ui-btn-fit ui-btn-fit-dense inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
                                                >
                                                    {text('cancel')}
                                                </button>
                                            </div>
                                        )}

                                        {selectedJob.pr_url ? (
                                            <a
                                                href={String(selectedJob.pr_url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="ui-btn-fit ui-btn-fit-dense inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                            >
                                                {text('connector_open_pr')}
                                                <ExternalLink size={14} />
                                            </a>
                                        ) : null}

                                        {showVerifyStatus && selectedJob.verify_status ? (
                                            <div>
                                                {text('connector_verify_status')}{' '}
                                                <span className="font-semibold text-indigo-100">{String(selectedJob.verify_status)}</span>
                                            </div>
                                        ) : null}

                                        {selectedJob.summary ? (
                                            <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/85 whitespace-pre-wrap">
                                                {String(selectedJob.summary)}
                                            </div>
                                        ) : null}

                                        {showVerifyTail && selectedJob.verify_tail ? (
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] text-indigo-100/80 whitespace-pre-wrap max-h-[220px] overflow-y-auto">
                                                {String(selectedJob.verify_tail)}
                                            </div>
                                        ) : null}

                                        <ConnectorArtifactSection
                                            job={selectedJob}
                                            text={text}
                                            groupedArtifacts={groupedArtifacts}
                                            artifactUrlsById={artifactUrlsById}
                                            artifactJson={selectedArtifactJson}
                                            loading={artifactsLoading}
                                        />

                                        <div className="border-t border-white/10 pt-3">
                                            <div className="text-[11px] font-semibold text-indigo-100">{text('connector_recent_jobs')}</div>
                                            <div className="mt-2 max-h-[220px] overflow-y-auto pr-1">
                                                <div className="grid gap-2">
                                                    {jobs.map((job: ConnectorJob) => {
                                                        const isSelected = String(job.id) === String(selectedJob?.id || '');
                                                        return (
                                                            <button
                                                                key={job.id}
                                                                type="button"
                                                                onClick={() => setSelectedJobId(String(job.id))}
                                                                className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2 text-left text-xs ${
                                                                    isSelected
                                                                        ? 'border-indigo-400/35 bg-indigo-500/10 text-indigo-100'
                                                                        : 'border-white/10 bg-slate-950/15 text-indigo-200/70 hover:border-indigo-400/25 hover:text-white'
                                                                }`}
                                                            >
                                                                <div className="min-w-0 truncate">
                                                                    <span className="font-semibold">{String(job.kind)}</span>{' '}
                                                                    <span className="text-indigo-200/45">
                                                                        ({formatDateTime(job.created_at)})
                                                                    </span>
                                                                </div>
                                                                <span className={badge(String(job.status))}>{String(job.status)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        <motion.div
                            {...panelMotionProps(0.32, Boolean(prefersReducedMotion))}
                            className="rounded-2xl border border-white/10 bg-slate-900/25 p-4"
                        >
                            <div className="text-[11px] font-semibold text-indigo-100">{text('connector_fix')}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                    value={bugReport}
                                    onChange={(event) => {
                                        if (isReadOnly) return;
                                        setBugReport(event.target.value);
                                    }}
                                    className="min-w-[220px] flex-1 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                                    placeholder={text('connector_fix_placeholder')}
                                    readOnly={isReadOnly}
                                />
                                <button
                                    type="button"
                                    onClick={runFix}
                                    disabled={isReadOnly || busy || !bugReport.trim() || !session || !selectedApp}
                                    className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                                >
                                    {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                    {text('connector_submit_fix')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </div>
        </section>
    );
}

function ConnectorArtifactSection(props: {
    job: ConnectorJob;
    text: (key: TranslationKey) => string;
    groupedArtifacts: any;
    artifactUrlsById: Record<string, string>;
    artifactJson: { qaReport: any; screenshotManifest: any };
    loading: boolean;
}) {
    const { job, text, groupedArtifacts, artifactUrlsById, artifactJson, loading } = props;

    const qaReportUrl = groupedArtifacts?.qaReport ? artifactUrlsById[String(groupedArtifacts.qaReport.id)] : '';
    const manifestUrl = groupedArtifacts?.screenshotManifest
        ? artifactUrlsById[String(groupedArtifacts.screenshotManifest.id)]
        : '';

    const shouldRenderVisualArtifacts =
        String(job.kind || '') === 'visual_qa' || String(job.kind || '') === 'screenshots';

    if (!shouldRenderVisualArtifacts) return null;

    return (
        <div className="grid gap-3">
            <div className="text-[11px] font-semibold text-indigo-100">{text('connector_artifacts')}</div>
            {loading ? (
                <div className="text-[11px] text-indigo-200/50">{text('loading')}</div>
            ) : null}

            {String(job.kind || '') === 'visual_qa' ? (
                <>
                    {groupedArtifacts?.qaReport ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/85">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold">{text('connector_qa_report')}</div>
                                {qaReportUrl ? (
                                    <a
                                        href={qaReportUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                    >
                                        {text('connector_open_artifact')}
                                        <ExternalLink size={14} />
                                    </a>
                                ) : null}
                            </div>
                            {artifactJson.qaReport ? (
                                <div className="mt-2 grid gap-1 text-indigo-200/70">
                                    <div>
                                        source_ref <span className="font-semibold text-indigo-100">{artifactJson.qaReport.source_ref || '-'}</span>
                                    </div>
                                    <div>
                                        failures <span className="font-semibold text-indigo-100">{Array.isArray(artifactJson.qaReport.failures) ? artifactJson.qaReport.failures.length : 0}</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {Array.isArray(groupedArtifacts?.qaEvidenceGroups) && groupedArtifacts.qaEvidenceGroups.length > 0 ? (
                        groupedArtifacts.qaEvidenceGroups.map((group: any) => (
                            <React.Fragment key={group.key}>
                                <ArtifactImageGroup
                                    group={group}
                                    urlsById={artifactUrlsById}
                                    title={`${text('connector_qa_evidence')} · ${group.variant} · ${group.theme} · ${group.viewport}`}
                                />
                            </React.Fragment>
                        ))
                    ) : !loading ? (
                        <div className="text-[11px] text-indigo-200/50">{text('connector_no_artifacts')}</div>
                    ) : null}
                </>
            ) : null}

            {String(job.kind || '') === 'screenshots' ? (
                <>
                    {groupedArtifacts?.screenshotManifest ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/85">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold">{text('connector_screenshot_manifest')}</div>
                                {manifestUrl ? (
                                    <a
                                        href={manifestUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                    >
                                        {text('connector_open_artifact')}
                                        <ExternalLink size={14} />
                                    </a>
                                ) : null}
                            </div>
                            {artifactJson.screenshotManifest ? (
                                <div className="mt-2 grid gap-1 text-indigo-200/70">
                                    <div>
                                        image_count{' '}
                                        <span className="font-semibold text-indigo-100">
                                            {Array.isArray(artifactJson.screenshotManifest.images)
                                                ? artifactJson.screenshotManifest.images.length
                                                : 0}
                                        </span>
                                    </div>
                                    <div>
                                        source_ref{' '}
                                        <span className="font-semibold text-indigo-100">
                                            {artifactJson.screenshotManifest.source_ref || '-'}
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {Array.isArray(groupedArtifacts?.screenshotGroups) && groupedArtifacts.screenshotGroups.length > 0 ? (
                        groupedArtifacts.screenshotGroups.map((group: any) => (
                            <React.Fragment key={group.key}>
                                <ArtifactImageGroup
                                    group={group}
                                    urlsById={artifactUrlsById}
                                    title={`${text('connector_screenshots')} · ${group.variant} · ${group.theme} · ${group.viewport}`}
                                />
                            </React.Fragment>
                        ))
                    ) : !loading ? (
                        <div className="text-[11px] text-indigo-200/50">{text('connector_no_artifacts')}</div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

function ArtifactImageGroup(props: {
    title: string;
    group: any;
    urlsById: Record<string, string>;
}) {
    const { title, group, urlsById } = props;
    const visibleItems = (Array.isArray(group?.items) ? group.items : []).filter((item: any) => Boolean(urlsById[String(item.id)]));
    if (!visibleItems.length) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
            <div className="text-[11px] font-semibold text-indigo-100">{title}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {visibleItems.map((item: any) => {
                    const url = urlsById[String(item.id)];
                    return (
                        <a
                            key={item.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-white/10 bg-slate-950/20 p-2 hover:border-indigo-400/25"
                        >
                            <img
                                src={url}
                                alt={String(item.targetId || item.id)}
                                className="h-36 w-full rounded-xl object-cover"
                            />
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-indigo-200/70">
                                <span className="truncate font-semibold text-indigo-100">{String(item.targetId || item.id)}</span>
                                <span className="shrink-0">{String(item.metadata?.status || '')}</span>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
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
                    {options.slice(0, 8).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setContent(option)}
                            disabled={disabled}
                            className="ui-btn-fit ui-btn-fit-dense rounded-full border border-amber-400/20 bg-black/10 px-3 py-1 text-[11px] font-semibold text-amber-50/90 hover:border-amber-300/40"
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    readOnly={disabled}
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
