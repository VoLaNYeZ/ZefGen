import React from 'react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type { AppIdea, AppIdeaCategory, IdeaAppAssignment } from '../../types/zefgen';
import { ConnectorAutosaveStatus } from './ConnectorAutosaveStatus';
import { ConnectorSaveConflictBanner } from './ConnectorSaveConflictBanner';

const formatIdeaPreview = (description: string) => {
    const normalized = String(description || '').replace(/\s+/g, ' ').trim();
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

export function ConnectorClientSpecPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    ideas: AppIdea[];
    ideaCategories: AppIdeaCategory[];
    ideaAssignments: IdeaAppAssignment[];
    selectedAppId: string | null;
    onOpenIdeas?: () => void;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, isEnabled, ideas, ideaCategories, ideaAssignments, selectedAppId, onOpenIdeas, text } = props;

    const [selectedCategoryId, setSelectedCategoryId] = React.useState('');
    const [selectedIdeaId, setSelectedIdeaId] = React.useState('');
    const [ideaApplyBusy, setIdeaApplyBusy] = React.useState(false);

    const ideasById = React.useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
    const ideaCategoryById = React.useMemo(
        () => new Map(ideaCategories.map((category) => [category.id, category])),
        [ideaCategories]
    );
    const assignedAppIdsByIdeaId = React.useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const row of ideaAssignments || []) {
            const ideaId = normalize(row.idea_id);
            const appId = normalize(row.app_id);
            if (!ideaId || !appId) continue;
            const bucket = map.get(ideaId) ?? new Set<string>();
            bucket.add(appId);
            map.set(ideaId, bucket);
        }
        return map;
    }, [ideaAssignments]);
    const ideaIndexById = React.useMemo(() => {
        const map = new Map<string, number>();
        ideas.forEach((idea, i) => map.set(idea.id, i + 1));
        return map;
    }, [ideas]);
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
        return ideas.filter((idea) => {
            if (idea.id === pinnedIdeaId) return true;
            return !isTakenByAnotherApp(idea);
        });
    }, [connectorForm.ideaId, ideas, isTakenByAnotherApp, selectedIdeaId]);
    const availableCategories = React.useMemo(() => {
        const ids = new Set(availableIdeas.map((idea) => idea.category_id));
        return ideaCategories.filter((category) => ids.has(category.id));
    }, [availableIdeas, ideaCategories]);

    React.useEffect(() => {
        if (connectorForm.loading) {
            setSelectedCategoryId('');
            setSelectedIdeaId('');
            return;
        }
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
    }, [connectorForm.ideaId, connectorForm.loading, ideasById]);

    const ideasForSelectedCategory = React.useMemo(() => {
        if (!selectedCategoryId) return [];
        return availableIdeas.filter((idea) => idea.category_id === selectedCategoryId);
    }, [availableIdeas, selectedCategoryId]);

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
        const ideaDescription = String(idea.description || '');
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
            await connectorForm.savePatch({
                project_brief: ideaDescription,
                idea_id: idea.id,
                ...(ideaTitle ? { variables: nextVariables } : {}),
            });
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

                {ideas.length === 0 ? (
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
                                    const preview = formatIdeaPreview(idea.description);
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
                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70">
                            iOS
                        </span>
                        <ConnectorAutosaveStatus connectorForm={connectorForm} text={text} />
                        <button
                            type="button"
                            onClick={connectorForm.refresh}
                            disabled={!isEnabled || connectorForm.loading}
                            className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                        >
                            {connectorForm.loading ? text('loading') : text('refresh')}
                        </button>
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
                        value={connectorForm.projectBrief}
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
