import React from 'react';
import { Check, Copy, ExternalLink, Github, Loader2, Trash2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { ConnectorJob } from '../../data/connector-jobs';
import type { AppItem } from '../../types/zefgen';
import {
    toEmappstore777RepoNameFromSourceName,
    toGithubRepoFullNameFromUrl,
} from '../../utils/client-github';
import { ConfirmIconButton } from './ConfirmIconButton';

const toRepoNamePreview = (appAlias: string, appName: string) => {
    const display = `[${appAlias}] ${appName}`.trim();
    const dashed = display.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+/g, '-');
    return dashed.replace(/-+$/g, '');
};

const toCloneUrl = (repoUrl: string) => {
    let url = String(repoUrl || '').trim();
    if (!url) return '';
    url = url.replace(/#.*$/g, '').replace(/\?.*$/g, '');
    url = url.replace(/\/+$/g, '');
    if (url.endsWith('.git')) return url;
    return `${url}.git`;
};

const statusBadgeClassName = (status: string | null | undefined) => {
    const base = 'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]';
    if (status === 'succeeded') return `${base} border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90`;
    if (status === 'failed') return `${base} border-rose-400/25 bg-rose-500/10 text-rose-100/90`;
    if (status === 'running') return `${base} border-indigo-400/25 bg-indigo-500/10 text-indigo-100/90`;
    if (status === 'waiting_for_user') return `${base} border-amber-400/25 bg-amber-500/10 text-amber-100/90`;
    if (status === 'queued') return `${base} border-indigo-400/10 bg-slate-950/20 text-indigo-200/60`;
    return `${base} border-white/10 bg-slate-950/20 text-indigo-200/60`;
};

export function DevFilesPanel(props: {
    selectedApp: AppItem | null;
    githubRepoUrl: string | null;
    clientGithubRepoUrl?: string | null;
    connectorJobs?: ConnectorJob[];
    isCreatingRepo: boolean;
    isDeletingRepo: boolean;
    isPublishingClientRepo?: boolean;
    onCreateRepo: () => void;
    onDeleteRepo: () => void | Promise<void>;
    onPublishClientRepo: () => void | Promise<void>;
    text: (key: TranslationKey) => string;
    isReadOnly?: boolean;
}) {
    const {
        selectedApp,
        githubRepoUrl,
        clientGithubRepoUrl,
        connectorJobs = [],
        isCreatingRepo,
        isDeletingRepo,
        isPublishingClientRepo = false,
        onCreateRepo,
        onDeleteRepo,
        onPublishClientRepo,
        text,
        isReadOnly = false,
    } = props;
    const [cloneCopied, setCloneCopied] = React.useState(false);
    const copiedTimerRef = React.useRef<number | null>(null);
    const hasAppName = React.useMemo(
        () => String(selectedApp?.name || '').trim().length > 0,
        [selectedApp?.name]
    );
    const createRepoBlockedReason = React.useMemo(() => {
        if (!selectedApp || hasAppName) return '';
        return text('github_repo_app_name_required');
    }, [hasAppName, selectedApp, text]);

    const repoNamePreview = React.useMemo(() => {
        if (!selectedApp) return '';
        return toRepoNamePreview(selectedApp.alias, selectedApp.name);
    }, [selectedApp]);

    const sourceRepoFullName = React.useMemo(() => {
        const direct = String((selectedApp as any)?.github_repo_full_name || '').trim();
        if (direct) return direct;
        const fromSelectedAppUrl = toGithubRepoFullNameFromUrl(String((selectedApp as any)?.github_repo_url || ''));
        if (fromSelectedAppUrl) return fromSelectedAppUrl;
        return toGithubRepoFullNameFromUrl(githubRepoUrl);
    }, [githubRepoUrl, selectedApp]);

    const sourceRepoName = React.useMemo(() => {
        if (!sourceRepoFullName) return repoNamePreview;
        const parts = sourceRepoFullName.split('/');
        return String(parts[1] || '').trim() || repoNamePreview;
    }, [repoNamePreview, sourceRepoFullName]);

    const clientRepoNamePreview = React.useMemo(
        () => toEmappstore777RepoNameFromSourceName(sourceRepoName || repoNamePreview),
        [repoNamePreview, sourceRepoName]
    );

    const cloneCommand = React.useMemo(() => {
        if (!githubRepoUrl) return '';
        const url = toCloneUrl(githubRepoUrl);
        if (!url) return '';
        return `git clone ${url}`;
    }, [githubRepoUrl]);

    const latestPublishJob = React.useMemo(
        () => connectorJobs.find((job) => String(job?.kind || '') === 'publish_client_repo') ?? null,
        [connectorJobs]
    );

    const latestPublishMessage = React.useMemo(
        () => String(latestPublishJob?.summary || latestPublishJob?.error || '').trim(),
        [latestPublishJob?.error, latestPublishJob?.summary]
    );

    const publishBlockedReason = React.useMemo(() => {
        if (!sourceRepoFullName && !githubRepoUrl) return text('publish_client_repo_missing_source');
        if (!clientRepoNamePreview) return text('publish_client_repo_failed_name');
        return '';
    }, [clientRepoNamePreview, githubRepoUrl, sourceRepoFullName, text]);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        };
    }, []);

    const copyClone = async () => {
        if (!cloneCommand) return;
        try {
            await navigator.clipboard.writeText(cloneCommand);
        } catch {
            const el = document.createElement('textarea');
            el.value = cloneCommand;
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '0';
            document.body.appendChild(el);
            el.focus();
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCloneCopied(true);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCloneCopied(false), 1200);
    };

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('dev_files_placeholder')}</p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('dev_files_subtitle')}</p>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 bg-slate-950/20 p-2 text-indigo-200/70">
                    <Github size={16} />
                </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                <div className="text-xs text-indigo-200/70">
                    Repo name preview:{' '}
                    <span className="font-semibold text-indigo-100">{repoNamePreview || '—'}</span>
                </div>

                {githubRepoUrl && (
                    <>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-indigo-200/60">{text('github_repo_created')}</span>
                            <a
                                href={githubRepoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                            >
                                {text('open_github_repo')}
                                <ExternalLink size={14} />
                            </a>
                            <ConfirmIconButton
                                label={text('delete_github_repo')}
                                question={text('confirm_delete_github_repo')}
                                confirmLabel={text('delete')}
                                cancelLabel={text('cancel')}
                                disabled={isDeletingRepo || isReadOnly}
                                onConfirm={onDeleteRepo}
                                className="ml-1"
                            >
                                <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-rose-400/40 hover:text-white">
                                    <Trash2 size={14} />
                                </span>
                            </ConfirmIconButton>
                        </div>
                        {cloneCommand && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-indigo-200/60">{text('clone_command')}</span>
                                <button
                                    type="button"
                                    onClick={copyClone}
                                    className="ui-btn-fit-ellipsis inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15"
                                    title={cloneCopied ? text('copied') : text('copy_clone_command')}
                                    aria-label={text('copy_clone_command')}
                                >
                                    <span className="truncate">{cloneCommand}</span>
                                    {cloneCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {selectedApp && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                        <div className="text-xs text-indigo-200/70">
                            emappstore777 repo name:{' '}
                            <span className="font-semibold text-indigo-100">{clientRepoNamePreview || '—'}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={onPublishClientRepo}
                                disabled={!selectedApp || !clientRepoNamePreview || Boolean(publishBlockedReason) || isPublishingClientRepo || isReadOnly}
                                title={publishBlockedReason || undefined}
                                className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                            >
                                {isPublishingClientRepo ? <Loader2 className="animate-spin" size={14} /> : <Github size={14} />}
                                {text('publish_client_github_repo')}
                            </button>
                            {clientGithubRepoUrl ? (
                                <>
                                    <span className="text-indigo-200/60">{text('client_github_repo_created')}</span>
                                    <a
                                        href={clientGithubRepoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                    >
                                        {text('open_client_github_repo')}
                                        <ExternalLink size={14} />
                                    </a>
                                </>
                            ) : null}
                            {latestPublishJob?.status ? (
                                <span className={statusBadgeClassName(String(latestPublishJob.status))}>
                                    {String(latestPublishJob.status)}
                                </span>
                            ) : null}
                        </div>
                        {publishBlockedReason ? (
                            <p className="mt-2 max-w-[420px] text-[11px] text-amber-200/80">{publishBlockedReason}</p>
                        ) : null}
                        {latestPublishJob ? (
                            <div className="mt-2 text-[11px] text-indigo-200/70">
                                <span className="font-semibold text-indigo-100">{text('publish_client_repo_latest')}</span>{' '}
                                {latestPublishMessage || String(latestPublishJob.status || '')}
                            </div>
                        ) : null}
                    </div>
                )}

                {!githubRepoUrl && (
                    <div className="mt-5 flex items-center justify-end">
                        <div className="grid justify-items-end gap-2">
                            {createRepoBlockedReason ? (
                                <p className="max-w-[280px] text-right text-[11px] text-amber-200/80">
                                    {createRepoBlockedReason}
                                </p>
                            ) : null}
                            <button
                                type="button"
                                onClick={onCreateRepo}
                                disabled={!selectedApp || !hasAppName || isCreatingRepo || isReadOnly}
                                title={createRepoBlockedReason || undefined}
                                className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                            >
                                {isCreatingRepo ? <Loader2 className="animate-spin" size={14} /> : <Github size={14} />}
                                {text('create_github_repo')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
