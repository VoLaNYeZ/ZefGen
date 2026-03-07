import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { ExternalLink, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import { createConnectorJob, type ConnectorJob } from '../../data/connector-jobs';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
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
    if (requirement.source === 'secret') {
        return `${text('connector_secret_source')}: ${requirement.key} (${statusText})`;
    }
    return `${requirement.key} (${statusText})`;
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
    } = props;

    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);

    const repoFullName = React.useMemo(
        () => resolveRepoFullName(selectedApp, githubRepoUrl),
        [githubRepoUrl, selectedApp]
    );

    const requirements = React.useMemo(
        () =>
            buildIntegrationRequirements({
                variables: connectorForm.variables,
                secretMetas: connectorForm.secretMetas,
            }),
        [connectorForm.secretMetas, connectorForm.variables]
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

    const integrationDisabledReason = !repoFullName
        ? text('connector_missing_repo')
        : !ready
          ? text('connector_integration_missing_hint')
          : '';

    const runIntegration = async () => {
        if (isReadOnly) return;
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
            if (!saved) throw new Error(text('connector_base_branch_save_failed'));

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

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('integration_module_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('integration_module_subtitle')}</p>
                </div>
                <div
                    className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                        ready
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                    }`}
                    title={ready ? text('connector_requirement_ready') : text('connector_requirement_missing')}
                >
                    {ready ? text('connector_ready') : text('connector_missing')}
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

                    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-indigo-100">{text('connector_actions')}</div>
                            <button
                                type="button"
                                onClick={runIntegration}
                                disabled={isReadOnly || busy || !session || !selectedApp || !repoFullName || !ready}
                                title={integrationDisabledReason || undefined}
                                className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                            >
                                {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                                {text('connector_integration')}
                            </button>
                        </div>
                        <div className="mt-3 text-[11px] text-indigo-200/55">
                            {latestSuccessfulIntegration?.result_commit_sha
                                ? `${text('connector_integration_qa_hint')} ${latestSuccessfulIntegration.result_commit_sha}`
                                : text('connector_integration_subhint')}
                        </div>
                        {!ready ? (
                            <div className="mt-2 text-[11px] font-semibold text-amber-100/90">
                                {text('connector_integration_missing_hint')}
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                                {requirement.source === 'secret' ? (
                                    <span className="rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-100/60">
                                        {text('connector_secret_short')}
                                    </span>
                                ) : null}
                                {requirement.optional ? (
                                    <span className="rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-100/60">
                                        {text('optional')}
                                    </span>
                                ) : null}
                            </span>
                        ))}
                    </div>

                    {latestIntegrationJob ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-xs font-semibold text-indigo-100">{text('connector_latest_integration')}</div>
                                <span className={statusBadgeClassName(String(latestIntegrationJob.status || ''))}>
                                    {String(latestIntegrationJob.status || '')}
                                </span>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-indigo-200/70">
                                <div>
                                    {text('connector_base_branch')}{' '}
                                    <span className="font-semibold text-indigo-100">
                                        {String(latestIntegrationJob.base_branch || 'main')}
                                    </span>
                                </div>
                                {latestIntegrationJob.result_commit_sha ? (
                                    <div>
                                        {text('connector_result_commit_sha')}{' '}
                                        <span className="font-semibold text-indigo-100">{latestIntegrationJob.result_commit_sha}</span>
                                    </div>
                                ) : null}
                                {latestIntegrationJob.summary ? (
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3 text-[11px] text-indigo-100/85 whitespace-pre-wrap">
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
