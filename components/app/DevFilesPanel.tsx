import React from 'react';
import { Check, Copy, ExternalLink, Github, Loader2, Trash2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
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

export function DevFilesPanel(props: {
    selectedApp: AppItem | null;
    githubRepoUrl: string | null;
    isCreatingRepo: boolean;
    isDeletingRepo: boolean;
    onCreateRepo: () => void;
    onDeleteRepo: () => void | Promise<void>;
    text: (key: TranslationKey) => string;
}) {
    const { selectedApp, githubRepoUrl, isCreatingRepo, isDeletingRepo, onCreateRepo, onDeleteRepo, text } = props;
    const [cloneCopied, setCloneCopied] = React.useState(false);
    const copiedTimerRef = React.useRef<number | null>(null);

    const repoNamePreview = React.useMemo(() => {
        if (!selectedApp) return '';
        return toRepoNamePreview(selectedApp.alias, selectedApp.name);
    }, [selectedApp]);

    const cloneCommand = React.useMemo(() => {
        if (!githubRepoUrl) return '';
        const url = toCloneUrl(githubRepoUrl);
        if (!url) return '';
        return `git clone ${url}`;
    }, [githubRepoUrl]);

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
                                className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-500/15"
                            >
                                {text('open_github_repo')}
                                <ExternalLink size={14} />
                            </a>
                            <ConfirmIconButton
                                label={text('delete_github_repo')}
                                question={text('confirm_delete_github_repo')}
                                confirmLabel={text('delete')}
                                cancelLabel={text('cancel')}
                                disabled={isDeletingRepo}
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
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15"
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

                {!githubRepoUrl && (
                    <div className="mt-5 flex items-center justify-end">
                        <button
                            type="button"
                            onClick={onCreateRepo}
                            disabled={!selectedApp || isCreatingRepo}
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                        >
                            {isCreatingRepo ? <Loader2 className="animate-spin" size={14} /> : <Github size={14} />}
                            {text('create_github_repo')}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
