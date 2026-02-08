import React from 'react';
import { ExternalLink, Github, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';

const toRepoNamePreview = (appAlias: string, appName: string) => {
    const display = `[${appAlias}] ${appName}`.trim();
    const dashed = display.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+/g, '-');
    return dashed.replace(/-+$/g, '');
};

export function DevFilesPanel(props: {
    selectedApp: AppItem | null;
    githubRepoUrl: string | null;
    isCreatingRepo: boolean;
    onCreateRepo: () => void;
    text: (key: TranslationKey) => string;
}) {
    const { selectedApp, githubRepoUrl, isCreatingRepo, onCreateRepo, text } = props;

    const repoNamePreview = React.useMemo(() => {
        if (!selectedApp) return '';
        return toRepoNamePreview(selectedApp.alias, selectedApp.name);
    }, [selectedApp]);

    return (
        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6 mx-6">
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
                    </div>
                )}

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
            </div>
        </section>
    );
}

