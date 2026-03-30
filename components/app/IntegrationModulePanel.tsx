import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import { createConnectorJob, type ConnectorJob } from '../../data/connector-jobs';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import { useConnectorJobMessages } from '../../hooks/use-connector-messages';
import { MatrixTerminal } from './MatrixTerminal';
import { ConnectorSaveConflictBanner } from './ConnectorSaveConflictBanner';
import { buildIntegrationTerminalModel } from '../../utils/integration-terminal.js';
import {
    buildIntegrationRequirements,
    findLatestSuccessfulIntegrationForBranch,
} from '../../utils/connector-runner-state.js';

type Requirement = ReturnType<typeof buildIntegrationRequirements>[number];

const MAIN_BRANCH = 'main';

const statusBadgeClassName = (status: string) => {
    const base = 'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]';
    if (status === 'succeeded') return `${base} border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90`;
    if (status === 'failed') return `${base} border-rose-400/25 bg-rose-500/10 text-rose-100/90`;
    if (status === 'running') return `${base} border-indigo-400/25 bg-indigo-500/10 text-indigo-100/90`;
    if (status === 'waiting_for_user') return `${base} border-amber-400/25 bg-amber-500/10 text-amber-100/90`;
    if (status === 'queued') return `${base} border-indigo-400/10 bg-slate-950/20 text-indigo-200/60`;
    return `${base} border-white/10 bg-slate-950/20 text-indigo-200/60`;
};

const resolveRepoFullName = (selectedApp: AppItem | null, githubRepoUrl?: string | null) => {
    const direct = String((selectedApp as any)?.github_repo_full_name || '').trim();
    if (direct) return direct;

    const toRepoFullNameFromUrl = (url: string | null | undefined) => {
        let value = String(url || '').trim();
        if (!value) return '';
        value = value.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
        const match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
        return match ? `${match[1]}/${match[2]}` : '';
    };

    return (
        toRepoFullNameFromUrl((selectedApp as any)?.github_repo_url) ||
        toRepoFullNameFromUrl(githubRepoUrl) ||
        ''
    );
};

const requirementLabel = (requirement: Requirement, text: (key: TranslationKey) => string) => {
    if (requirement.key === 'apphud_api_key') return text('connector_apphud_api_key');
    if (requirement.key === 'firebase_plist_snippet') return text('connector_firebase_plist_snippet');
    if (requirement.key === 'domain') return text('connector_domain');
    if (requirement.key === 'bundle_id') return text('connector_bundle_id');
    if (requirement.key === 'privacy_policy_url') return text('connector_privacy_policy_url');
    if (requirement.key === 'terms_of_use_url') return text('connector_terms_of_use_url');
    if (requirement.key === 'support_form_url') return text('connector_support_form_url');
    if (requirement.key === 'id_purchases') return text('connector_id_purchases');
    return requirement.key;
};

const requirementTitle = (requirement: Requirement, text: (key: TranslationKey) => string) => {
    const statusText = requirement.ok
        ? text('connector_requirement_ready')
        : requirement.optional
          ? text('connector_requirement_optional')
          : text('connector_requirement_missing');
    return `${requirement.key} (${statusText})`;
};

const formatDateTime = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) return raw;
    return new Date(parsed).toLocaleString();
};

const getBlockedHint = (payload: {
    repoFullName: string;
    ready: boolean;
    text: (key: TranslationKey) => string;
}) => {
    if (!payload.repoFullName && !payload.ready) return payload.text('connector_integration_blocked_repo_setup');
    if (!payload.repoFullName) return payload.text('connector_integration_repo_missing_hint');
    return payload.text('connector_integration_blocked_hint');
};

export function IntegrationModulePanel(props: {
    session: Session | null;
    selectedApp: AppItem | null;
    githubRepoUrl?: string | null;
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    connectorJobs: ConnectorJob[];
    isEnabled: boolean;
    text: (key: TranslationKey) => string;
    refreshJobs?: () => Promise<void>;
    reportError?: (msg: string) => void;
    isReadOnly?: boolean;
    manualCopyText: string;
    showManualCopyAction?: boolean;
}) {
    const {
        session,
        selectedApp,
        githubRepoUrl,
        connectorForm,
        connectorJobs,
        isEnabled,
        text,
        refreshJobs,
        reportError,
        isReadOnly = false,
        manualCopyText,
        showManualCopyAction = false,
    } = props;

    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);
    const [manualCopyCopied, setManualCopyCopied] = React.useState(false);
    const [nowMs, setNowMs] = React.useState(() => Date.now());
    const copiedTimerRef = React.useRef<number | null>(null);

    const repoFullName = React.useMemo(
        () => resolveRepoFullName(selectedApp, githubRepoUrl),
        [githubRepoUrl, selectedApp]
    );

    const requirements = React.useMemo(
        () =>
            buildIntegrationRequirements({
                variables: connectorForm.variables,
                legalLinks: connectorForm.legalLinks,
                secretMetas: connectorForm.secretMetas,
            }),
        [connectorForm.legalLinks, connectorForm.secretMetas, connectorForm.variables]
    );

    const ready = React.useMemo(
        () => requirements.every((item) => item.optional || item.ok),
        [requirements]
    );

    const latestIntegrationJob = React.useMemo(() => {
        return (
            connectorJobs.find((job) => {
                if (String(job?.kind || '') !== 'integration') return false;
                return (String(job?.base_branch || '').trim() || MAIN_BRANCH) === MAIN_BRANCH;
            }) ?? null
        );
    }, [connectorJobs]);

    const latestSuccessfulIntegration = React.useMemo(
        () => findLatestSuccessfulIntegrationForBranch(connectorJobs, MAIN_BRANCH),
        [connectorJobs]
    );

    const isIntegrationActive =
        String(latestIntegrationJob?.status || '') === 'queued' ||
        String(latestIntegrationJob?.status || '') === 'running' ||
        String(latestIntegrationJob?.status || '') === 'waiting_for_user';

    const canLaunchIntegration = Boolean(repoFullName) && ready;
    const showBlockedState = !isIntegrationActive && !canLaunchIntegration;
    const showHeroState = !showBlockedState;
    const showCompletedSummary = Boolean(latestIntegrationJob) && !isIntegrationActive;

    const { messages, unansweredQuestions } = useConnectorJobMessages({
        session,
        jobId: isIntegrationActive ? latestIntegrationJob?.id || null : null,
        pollMs: 2500,
    });

    React.useEffect(() => {
        if (!isIntegrationActive) return;
        const nowTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => {
            window.clearInterval(nowTimer);
        };
    }, [isIntegrationActive, latestIntegrationJob?.id]);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        };
    }, []);

    const integrationTerminal = React.useMemo(
        () =>
            buildIntegrationTerminalModel({
                job: latestIntegrationJob,
                messages,
                unansweredQuestionCount: unansweredQuestions.length,
                nowMs,
                text,
            }),
        [latestIntegrationJob, messages, nowMs, text, unansweredQuestions.length]
    );

    const integrationDisabledReason = !repoFullName
        ? text('connector_missing_repo')
        : !ready
          ? text('connector_integration_missing_hint')
          : isIntegrationActive
            ? text('connector_integration_running_hint')
            : '';

    const runIntegration = async () => {
        if (isReadOnly || isIntegrationActive) return;
        if (!session || !selectedApp) return;
        if (!repoFullName) {
            const msg = text('connector_missing_repo');
            setLocalError(msg);
            reportError?.(msg);
            return;
        }
        if (!ready) {
            const msg = text('connector_integration_missing_hint');
            setLocalError(msg);
            return;
        }

        setBusy(true);
        setLocalError(null);
        try {
            const saved = await connectorForm.savePatch({
                base_branch: MAIN_BRANCH,
            });
            if (!saved) return;

            const { error } = await createConnectorJob({
                userId: session.user.id,
                appId: selectedApp.id,
                kind: 'integration',
                repoFullName,
                baseBranch: MAIN_BRANCH,
                input: {},
            });
            if (error) throw error;
            await refreshJobs?.();
        } catch (e: any) {
            const msg = String(e?.message || e);
            setLocalError(msg);
            reportError?.(msg);
        } finally {
            setBusy(false);
        }
    };

    const copyManualIntegration = async () => {
        try {
            await navigator.clipboard.writeText(manualCopyText);
        } catch {
            const el = document.createElement('textarea');
            el.value = manualCopyText;
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '0';
            document.body.appendChild(el);
            el.focus();
            el.select();
            try {
                document.execCommand('copy');
            } finally {
                document.body.removeChild(el);
            }
        }

        setManualCopyCopied(true);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setManualCopyCopied(false), 1200);
    };

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('integration_module_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('integration_module_subtitle')}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {showManualCopyAction ? (
                        <button
                            type="button"
                            onClick={() => void copyManualIntegration()}
                            data-testid="manual-integration-copy-button"
                            className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-indigo-100/90 hover:border-indigo-300/40 hover:bg-slate-950/45"
                            title={manualCopyCopied ? text('copied') : 'Copy for manual'}
                            aria-label="Copy for manual"
                        >
                            <span>Copy for manual</span>
                            {manualCopyCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                        </button>
                    ) : null}
                    <div
                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                            canLaunchIntegration
                                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                        }`}
                        title={canLaunchIntegration ? text('connector_requirement_ready') : text('connector_requirement_missing')}
                    >
                        {canLaunchIntegration ? text('connector_ready') : text('connector_missing')}
                    </div>
                </div>
            </div>

            {!isEnabled ? (
                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            ) : (
                <div className="mt-5 grid gap-3">
                    {(localError || connectorForm.error) && (
                        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                            {localError || connectorForm.error}
                        </div>
                    )}
                    <ConnectorSaveConflictBanner connectorForm={connectorForm} text={text} />

                    {showBlockedState ? (
                        <div className="rounded-[24px] border border-white/10 bg-slate-950/20 px-5 py-5">
                            <div className="text-sm font-semibold text-indigo-100">
                                {text('connector_integration_blocked_title')}
                            </div>
                            <div className="mt-2 text-[11px] text-indigo-200/55">
                                {getBlockedHint({
                                    repoFullName,
                                    ready,
                                    text,
                                })}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {requirements.map((requirement) => (
                                    <span
                                        key={`${requirement.source}:${requirement.key}`}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                            requirement.optional
                                                ? requirement.ok
                                                    ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
                                                    : 'border-white/10 bg-slate-950/20 text-indigo-200/60'
                                                : requirement.ok
                                                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                                  : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                                        }`}
                                        title={requirementTitle(requirement, text)}
                                    >
                                        {requirementLabel(requirement, text)}
                                        {requirement.optional ? (
                                            <span className="rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-100/60">
                                                {text('optional')}
                                            </span>
                                        ) : null}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {showHeroState ? (
                        <div className="rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),rgba(2,6,23,0.12)_58%,rgba(2,6,23,0)_100%)] px-5 py-6 text-center">
                            <div className="text-base font-semibold text-indigo-50">
                                {isIntegrationActive
                                    ? text('connector_integration_active_title')
                                    : text('connector_integration_ready_title')}
                            </div>
                            <div className="mt-2 text-[11px] text-indigo-200/55">
                                {latestSuccessfulIntegration?.result_commit_sha
                                    ? `${text('connector_integration_ready_proof')} ${text('connector_integration_qa_hint')} ${latestSuccessfulIntegration.result_commit_sha}`
                                    : text('connector_integration_ready_proof')}
                            </div>
                            <div className="mt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={runIntegration}
                                    disabled={
                                        isReadOnly ||
                                        busy ||
                                        isIntegrationActive ||
                                        !session ||
                                        !selectedApp ||
                                        !canLaunchIntegration
                                    }
                                    title={integrationDisabledReason || undefined}
                                    className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full border border-indigo-300/45 bg-[linear-gradient(135deg,rgba(99,102,241,0.28),rgba(34,197,94,0.18))] px-8 py-3 text-sm font-semibold text-indigo-50 shadow-[0_18px_45px_-28px_rgba(99,102,241,0.8)] hover:border-indigo-200/60 hover:shadow-[0_22px_55px_-28px_rgba(99,102,241,0.95)] disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                    {busy || isIntegrationActive ? <Loader2 className="animate-spin" size={16} /> : null}
                                    {text('connector_integration')}
                                </button>
                            </div>

                            {isIntegrationActive ? (
                                <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-3 text-left">
                                    <div className="mb-3 px-1">
                                        <div className="text-sm font-semibold text-indigo-50">
                                            {integrationTerminal.headline}
                                        </div>
                                        <div className="mt-1 text-[11px] text-indigo-200/60">
                                            {integrationTerminal.detail}
                                        </div>
                                    </div>
                                    <MatrixTerminal
                                        title={text('connector_integration_live_status')}
                                        mode="compact"
                                        compactLines={integrationTerminal.timelineLines}
                                        heightClass="h-[160px]"
                                    />
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {showCompletedSummary && latestIntegrationJob ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-xs font-semibold text-indigo-100">
                                    {text('connector_latest_integration')}
                                </div>
                                <span className={statusBadgeClassName(String(latestIntegrationJob.status || ''))}>
                                    {String(latestIntegrationJob.status || '')}
                                </span>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-indigo-200/70">
                                <div
                                    className={`rounded-2xl border p-3 text-[11px] ${
                                        String(latestIntegrationJob.status || '') === 'failed'
                                            ? 'border-rose-400/20 bg-rose-500/10 text-rose-50/90'
                                            : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50/90'
                                    }`}
                                >
                                    <div className="font-semibold">
                                        {String(latestIntegrationJob.status || '') === 'failed'
                                            ? integrationTerminal.translatedError || integrationTerminal.headline
                                            : integrationTerminal.headline}
                                    </div>
                                    <div className="mt-1 text-[11px] opacity-85">
                                        {String(latestIntegrationJob.status || '') === 'failed'
                                            ? text('connector_integration_failure_secondary')
                                            : integrationTerminal.detail}
                                    </div>
                                </div>
                                {latestIntegrationJob.created_at ? (
                                    <div>
                                        {text('connector_created_at')}{' '}
                                        <span className="font-semibold text-indigo-100">
                                            {formatDateTime(latestIntegrationJob.created_at)}
                                        </span>
                                    </div>
                                ) : null}
                                {latestIntegrationJob.result_commit_sha ? (
                                    <div>
                                        {text('connector_result_commit_sha')}{' '}
                                        <span className="font-semibold text-indigo-100">
                                            {latestIntegrationJob.result_commit_sha}
                                        </span>
                                    </div>
                                ) : null}
                                {latestIntegrationJob.summary ? (
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/70 whitespace-pre-wrap">
                                        {String(latestIntegrationJob.summary)}
                                    </div>
                                ) : null}
                                {latestIntegrationJob.pr_url ? (
                                    <a
                                        href={String(latestIntegrationJob.pr_url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ui-btn-fit ui-btn-fit-dense inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                    >
                                        {text('connector_open_pr')}
                                        <ExternalLink size={14} />
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </section>
    );
}
