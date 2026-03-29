import React from 'react';
import { FileText } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type { AppIdea, AppIdeaCategory, AppItem, Brand, IdeaAppAssignment } from '../../types/zefgen';
import { buildCanonicalBrandIdMap } from '../../utils/no-brand';
import { normalizeLegacyRenderedSpec } from '../../utils/spec-text';
import { ConnectorAutosaveStatus } from './ConnectorAutosaveStatus';
import { ConnectorSaveConflictBanner } from './ConnectorSaveConflictBanner';

const formatIdeaPreview = (description: string) => {
    const normalized = normalizeLegacyRenderedSpec(description).replace(/\s+/g, ' ').trim();
    if (!normalized) return '—';
    const words = normalized.split(' ');
    const short = words.length <= 6 ? normalized : `${words.slice(0, 6).join(' ')}...`;
    return short.length > 48 ? `${short.slice(0, 47)}...` : short;
};

const normalize = (value: unknown) => String(value ?? '').trim();

const deriveHomeScreenName = (title: string) => {
    const normalized = normalize(title);
    if (!normalized) return '';
    const separatorMatch = normalized.match(/[:|·•]/);
    if (!separatorMatch || typeof separatorMatch.index !== 'number') return normalized;
    const prefix = normalized.slice(0, separatorMatch.index).trim();
    return prefix || normalized;
};

const buildSpecReaderDocument = () => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Client spec</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --bg-accent: #ece5d8;
        --panel: rgba(255, 252, 247, 0.94);
        --text: #1f2937;
        --border: rgba(148, 163, 184, 0.24);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      body {
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.7), transparent 42%),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-accent) 100%);
        color: var(--text);
        font-family: "SF Pro Text", "Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .shell {
        min-height: 100vh;
      }

      .content {
        width: min(100%, 1040px);
        margin: 0 auto;
        padding-inline: 24px;
      }

      .content {
        padding-top: 32px;
        padding-bottom: 40px;
      }

      .paper {
        border: 1px solid var(--border);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: 0 22px 60px -40px rgba(15, 23, 42, 0.35);
        padding: 32px;
      }

      .spec {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: inherit;
        font-size: 15px;
        line-height: 1.85;
      }

      @media (max-width: 720px) {
        .content {
          padding-inline: 16px;
        }

        .paper {
          border-radius: 22px;
          padding: 22px 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="content">
        <article class="paper">
          <pre class="spec" id="spec-reader-content"></pre>
        </article>
      </main>
    </div>
  </body>
</html>`;

export function ConnectorClientSpecPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    ideas: AppIdea[];
    ideaCategories: AppIdeaCategory[];
    ideaAssignments: IdeaAppAssignment[];
    selectedAppId: string | null;
    selectedBrandId: string | null;
    brands: Brand[];
    onPatchApp?: (appId: string, patch: Partial<AppItem>) => Promise<AppItem | null>;
    onOpenIdeas?: () => void;
    reportError?: (message: string) => void;
    text: (key: TranslationKey) => string;
}) {
    const {
        connectorForm,
        isEnabled,
        ideas,
        ideaCategories,
        ideaAssignments,
        selectedAppId,
        selectedBrandId,
        brands,
        onPatchApp,
        onOpenIdeas,
        reportError,
        text,
    } = props;
    const ideaList = React.useMemo(() => (Array.isArray(ideas) ? ideas : []), [ideas]);
    const ideaCategoryList = React.useMemo(() => (Array.isArray(ideaCategories) ? ideaCategories : []), [ideaCategories]);
    const ideaAssignmentList = React.useMemo(() => (Array.isArray(ideaAssignments) ? ideaAssignments : []), [ideaAssignments]);
    const brandList = React.useMemo(() => (Array.isArray(brands) ? brands : []), [brands]);

    const [selectedCategoryId, setSelectedCategoryId] = React.useState('');
    const [selectedIdeaId, setSelectedIdeaId] = React.useState('');
    const [ideaApplyBusy, setIdeaApplyBusy] = React.useState(false);
    const projectBrief = String(connectorForm.projectBrief || '');
    const displayProjectBrief = React.useMemo(
        () => (connectorForm.isProjectBriefDirty ? projectBrief : normalizeLegacyRenderedSpec(projectBrief)),
        [connectorForm.isProjectBriefDirty, projectBrief]
    );
    const hasProjectBrief = normalize(displayProjectBrief).length > 0;
    const specReaderWindowRef = React.useRef<Window | null>(null);

    const ideasById = React.useMemo(() => new Map(ideaList.map((idea) => [idea.id, idea])), [ideaList]);
    const canonicalBrandIdById = React.useMemo(() => buildCanonicalBrandIdMap(brandList), [brandList]);
    const effectiveSelectedBrandId = React.useMemo(
        () => (selectedBrandId ? canonicalBrandIdById.get(selectedBrandId) ?? selectedBrandId : null),
        [canonicalBrandIdById, selectedBrandId]
    );
    const ideaCategoryById = React.useMemo(
        () => new Map(ideaCategoryList.map((category) => [category.id, category])),
        [ideaCategoryList]
    );
    const assignedAppIdsByIdeaId = React.useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const row of ideaAssignmentList) {
            const ideaId = normalize(row.idea_id);
            const appId = normalize(row.app_id);
            if (!ideaId || !appId) continue;
            const bucket = map.get(ideaId) ?? new Set<string>();
            bucket.add(appId);
            map.set(ideaId, bucket);
        }
        return map;
    }, [ideaAssignmentList]);
    const ideaIndexById = React.useMemo(() => {
        const map = new Map<string, number>();
        ideaList.forEach((idea, i) => map.set(idea.id, i + 1));
        return map;
    }, [ideaList]);
    const isTakenByAnotherApp = React.useCallback(
        (idea: AppIdea) => {
            const assigned = assignedAppIdsByIdeaId.get(idea.id);
            if (!assigned || assigned.size === 0) return false;
            const currentAppId = normalize(selectedAppId);
            for (const assignedAppId of assigned) {
                if (!currentAppId || assignedAppId !== currentAppId) return true;
            }
            return false;
        },
        [assignedAppIdsByIdeaId, selectedAppId]
    );
    const availableIdeas = React.useMemo(() => {
        const pinnedIdeaId = normalize(connectorForm.ideaId || selectedIdeaId || '');
        return ideaList.filter((idea) => {
            if (idea.id === pinnedIdeaId) return true;
            const ideaBrandId = canonicalBrandIdById.get(idea.brand_id) ?? idea.brand_id;
            if (effectiveSelectedBrandId && normalize(ideaBrandId) !== normalize(effectiveSelectedBrandId)) return false;
            const status = normalize((idea as any).status || 'generated');
            if (status === 'removed' || status === 'superseded') return false;
            return !isTakenByAnotherApp(idea);
        });
    }, [canonicalBrandIdById, connectorForm.ideaId, effectiveSelectedBrandId, ideaList, isTakenByAnotherApp, selectedIdeaId]);
    const availableCategories = React.useMemo(() => {
        const ids = new Set(availableIdeas.map((idea) => idea.category_id));
        return ideaCategoryList.filter((category) => ids.has(category.id));
    }, [availableIdeas, ideaCategoryList]);

    React.useEffect(() => {
        setSelectedCategoryId('');
        setSelectedIdeaId('');
    }, [selectedAppId]);

    React.useEffect(() => {
        const persistedIdeaId = String(connectorForm.ideaId || '').trim();
        if (!persistedIdeaId) {
            setSelectedIdeaId('');
            return;
        }
        const persistedIdea = ideasById.get(persistedIdeaId);
        if (!persistedIdea) {
            setSelectedIdeaId('');
            return;
        }
        setSelectedIdeaId(persistedIdea.id);
        setSelectedCategoryId(persistedIdea.category_id);
    }, [connectorForm.ideaId, ideasById]);

    const ideasForSelectedCategory = React.useMemo(() => {
        if (!selectedCategoryId) return [];
        return availableIdeas.filter((idea) => idea.category_id === selectedCategoryId);
    }, [availableIdeas, selectedCategoryId]);

    const syncSpecReaderWindow = React.useCallback(
        (targetWindow: Window | null) => {
            if (!targetWindow || targetWindow.closed) return;
            const doc = targetWindow.document;
            if (!doc.getElementById('spec-reader-content')) {
                doc.open();
                doc.write(buildSpecReaderDocument());
                doc.close();
            }

            targetWindow.document.title = text('connector_project_brief');
            const contentNode = doc.getElementById('spec-reader-content');

            if (contentNode) {
                contentNode.textContent = displayProjectBrief;
            }
        },
        [displayProjectBrief, text]
    );

    React.useEffect(() => {
        const targetWindow = specReaderWindowRef.current;
        if (!targetWindow || targetWindow.closed) return;
        syncSpecReaderWindow(targetWindow);
    }, [syncSpecReaderWindow]);

    React.useEffect(() => {
        return () => {
            const targetWindow = specReaderWindowRef.current;
            if (targetWindow && !targetWindow.closed) targetWindow.close();
        };
    }, []);

    const openSpecReaderWindow = React.useCallback(() => {
        if (!hasProjectBrief) return;
        const existingWindow = specReaderWindowRef.current;
        if (existingWindow && !existingWindow.closed) {
            syncSpecReaderWindow(existingWindow);
            existingWindow.focus();
            return;
        }

        const nextWindow = window.open(
            '',
            'zefgen-client-spec-reader',
            'popup=yes,width=980,height=860,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
        );
        if (!nextWindow) return;
        specReaderWindowRef.current = nextWindow;
        syncSpecReaderWindow(nextWindow);
        nextWindow.focus();
    }, [hasProjectBrief, syncSpecReaderWindow]);

    React.useEffect(() => {
        if (!selectedCategoryId) return;
        if (availableCategories.some((category) => category.id === selectedCategoryId)) return;
        const selectedIdea = selectedIdeaId ? ideasById.get(selectedIdeaId) : null;
        if (selectedIdea && availableIdeas.some((idea) => idea.id === selectedIdea.id)) {
            setSelectedCategoryId(selectedIdea.category_id);
            return;
        }
        setSelectedCategoryId(availableCategories[0]?.id || '');
    }, [availableCategories, availableIdeas, ideasById, selectedCategoryId, selectedIdeaId]);

    const onChangeCategory = (nextCategoryId: string) => {
        setSelectedCategoryId(nextCategoryId);
        if (!nextCategoryId) {
            setSelectedIdeaId('');
            return;
        }
        const selectedIdea = selectedIdeaId ? ideasById.get(selectedIdeaId) : null;
        if (selectedIdea && selectedIdea.category_id !== nextCategoryId) {
            setSelectedIdeaId('');
        }
    };

    const onChangeIdea = async (nextIdeaId: string) => {
        if (ideaApplyBusy) return;
        setSelectedIdeaId(nextIdeaId);

        if (!nextIdeaId) {
            connectorForm.setIdeaId(null);
            await connectorForm.savePatch({ idea_id: null });
            return;
        }

        const idea = ideasById.get(nextIdeaId);
        if (!idea) return;
        setIdeaApplyBusy(true);
        const ideaDescription = normalizeLegacyRenderedSpec(String(idea.client_spec_current || idea.description || ''));
        const ideaTitle = normalize((idea as any).title);
        const nextVariables = { ...(connectorForm.variables || {}) } as Record<string, any>;
        if (ideaTitle) {
            nextVariables.appstore_name = ideaTitle;
            nextVariables.home_screen_name = deriveHomeScreenName(ideaTitle);
            connectorForm.setVariables(nextVariables);
        }
        connectorForm.setProjectBrief(ideaDescription);
        connectorForm.setIdeaId(idea.id);
        try {
            const saved = await connectorForm.savePatch({
                project_brief: ideaDescription,
                idea_id: idea.id,
                ...(ideaTitle ? { variables: nextVariables } : {}),
            });
            if (!saved) return;
            if (ideaTitle && selectedAppId && onPatchApp) {
                const patched = await onPatchApp(selectedAppId, { name: ideaTitle });
                if (!patched) {
                    reportError?.(text('upload_failed'));
                }
            }
        } catch (error: any) {
            reportError?.(String(error?.message || text('upload_failed')));
        } finally {
            setIdeaApplyBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('idea_picker_title')}
                        </p>
                    </div>
                </div>

                {ideaList.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-slate-950/20 p-4">
                        <p className="text-sm text-indigo-200/70">{text('idea_picker_no_ideas')}</p>
                        {onOpenIdeas ? (
                            <button
                                type="button"
                                onClick={onOpenIdeas}
                                className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                            >
                                {text('idea_picker_open_ideas')}
                            </button>
                        ) : null}
                    </div>
                ) : availableIdeas.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-slate-950/20 p-4">
                        <p className="text-sm text-indigo-200/70">{text('idea_picker_no_available')}</p>
                        {onOpenIdeas ? (
                            <button
                                type="button"
                                onClick={onOpenIdeas}
                                className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                            >
                                {text('idea_picker_open_ideas')}
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="grid min-w-0 gap-1">
                            <span className="text-[11px] text-indigo-200/55">{text('idea_picker_category')}</span>
                            <select
                                value={selectedCategoryId}
                                onChange={(e) => onChangeCategory(e.target.value)}
                                disabled={!isEnabled || ideaApplyBusy || availableCategories.length === 0}
                                className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none focus:border-indigo-400/40 disabled:opacity-60"
                            >
                                <option value="">{text('idea_picker_select_category')}</option>
                                {availableCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="grid min-w-0 gap-1">
                            <span className="text-[11px] text-indigo-200/55">{text('idea_picker_idea')}</span>
                            <select
                                value={selectedIdeaId}
                                onChange={(e) => void onChangeIdea(e.target.value)}
                                disabled={!isEnabled || !selectedCategoryId || ideaApplyBusy}
                                className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none focus:border-indigo-400/40 disabled:opacity-60"
                            >
                                <option value="">
                                    {selectedCategoryId ? text('idea_picker_select_idea') : text('idea_picker_select_category')}
                                </option>
                                {ideasForSelectedCategory.map((idea) => {
                                    const n = ideaIndexById.get(idea.id) ?? null;
                                    const category = ideaCategoryById.get(idea.category_id);
                                    const categoryName = category?.name || '';
                                    const title = normalize((idea as any).title);
                                    const preview = formatIdeaPreview(String(idea.client_spec_current || idea.description || ''));
                                    const label = title
                                        ? `#${n ?? '—'} · ${title.length > 36 ? `${title.slice(0, 35)}...` : title}`
                                        : `#${n ?? '—'} · ${preview}`;
                                    return (
                                        <option key={idea.id} value={idea.id} title={`${label}${categoryName ? ` · ${categoryName}` : ''}`}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    </div>
                )}
            </section>

            <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('connector_project_brief')}
                        </p>
                        <p className="mt-2 text-sm text-indigo-200/60">{text('connector_project_brief_hint')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={openSpecReaderWindow}
                            disabled={!hasProjectBrief}
                            data-testid="client-spec-reader-open-button"
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-950/20 disabled:text-indigo-200/35"
                        >
                            <FileText size={13} />
                            {text('connector_project_brief_reader_open')}
                        </button>
                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70">
                            iOS
                        </span>
                        <ConnectorAutosaveStatus connectorForm={connectorForm} text={text} />
                    </div>
                </div>

                {connectorForm.error && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                        {connectorForm.error}
                    </div>
                )}
                <ConnectorSaveConflictBanner connectorForm={connectorForm} text={text} />

                <div className="mt-4">
                    <textarea
                        value={displayProjectBrief}
                        onChange={(e) => connectorForm.setProjectBrief(e.target.value)}
                        rows={10}
                        disabled={!isEnabled}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                        placeholder={text('connector_project_brief_placeholder')}
                    />
                </div>
            </section>
        </div>
    );
}
