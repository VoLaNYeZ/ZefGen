import React from 'react';
import { Check, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppIdea, AppIdeaCategory, AppItem, IdeaAppAssignment } from '../../types/zefgen';

type Draft = Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;

const normalize = (value: unknown) => String(value ?? '').trim();

export function IdeasPage(props: {
    ideas: AppIdea[];
    categories: AppIdeaCategory[];
    ideaAssignments: IdeaAppAssignment[];
    apps: AppItem[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    createIdea: (args: {
        row: Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;
    }) => Promise<AppIdea | null | undefined>;
    updateIdea: (args: {
        id: string;
        patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>>;
    }) => Promise<AppIdea | null | undefined>;
    deleteIdea: (args: { id: string }) => Promise<void>;
    reportError?: (message: string) => void;
    text: (key: TranslationKey) => string;
}) {
    const {
        ideas,
        categories,
        ideaAssignments,
        apps,
        loading,
        error,
        refresh,
        createIdea,
        updateIdea,
        deleteIdea,
        reportError,
        text,
    } = props;

    const [search, setSearch] = React.useState('');
    const [draftById, setDraftById] = React.useState<Record<string, Draft>>({});
    const [rowBusyById, setRowBusyById] = React.useState<Record<string, boolean>>({});
    const [rowErrorById, setRowErrorById] = React.useState<Record<string, string | null>>({});
    const [rowSavedById, setRowSavedById] = React.useState<Record<string, boolean>>({});
    const [newDraft, setNewDraft] = React.useState<{ category_id: string; description: string } | null>(null);
    const [newBusy, setNewBusy] = React.useState(false);
    const [newError, setNewError] = React.useState<string | null>(null);
    const [newRowScrollNonce, setNewRowScrollNonce] = React.useState(0);

    const saveTimersRef = React.useRef<Record<string, number>>({});

    React.useEffect(() => {
        return () => {
            Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
        };
    }, []);

    const categoryById = React.useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
    const appById = React.useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
    const appliedAppsByIdeaId = React.useMemo(() => {
        const map = new Map<
            string,
            Array<{
                appId: string;
                alias: string;
                name: string;
            }>
        >();
        for (const row of ideaAssignments) {
            const ideaId = normalize(row.idea_id);
            const appId = normalize(row.app_id);
            if (!ideaId || !appId) continue;
            const app = appById.get(appId);
            if (!app) continue;
            const bucket = map.get(ideaId) ?? [];
            bucket.push({
                appId,
                alias: String(app.alias || '').toUpperCase() || '—',
                name: String(app.name || ''),
            });
            map.set(ideaId, bucket);
        }
        for (const list of map.values()) {
            list.sort((a, b) => a.alias.localeCompare(b.alias, undefined, { numeric: true, sensitivity: 'base' }));
        }
        return map;
    }, [ideaAssignments, appById]);
    const ideaIndexById = React.useMemo(() => {
        const map = new Map<string, number>();
        ideas.forEach((idea, i) => map.set(idea.id, i + 1));
        return map;
    }, [ideas]);

    const setDraftField = React.useCallback((ideaId: string, patch: Partial<Draft>) => {
        setDraftById((prev) => ({ ...prev, [ideaId]: { ...(prev[ideaId] || {}), ...patch } }));
    }, []);

    const clearDraft = React.useCallback((ideaId: string) => {
        setDraftById((prev) => {
            const next = { ...prev };
            delete next[ideaId];
            return next;
        });
        setRowErrorById((prev) => {
            const next = { ...prev };
            delete next[ideaId];
            return next;
        });
    }, []);

    const markSaved = React.useCallback((ideaId: string) => {
        setRowSavedById((prev) => ({ ...prev, [ideaId]: true }));
        if (saveTimersRef.current[ideaId]) {
            window.clearTimeout(saveTimersRef.current[ideaId]);
        }
        saveTimersRef.current[ideaId] = window.setTimeout(() => {
            setRowSavedById((prev) => {
                const next = { ...prev };
                delete next[ideaId];
                return next;
            });
            delete saveTimersRef.current[ideaId];
        }, 1200);
    }, []);

    const isDirty = React.useCallback((idea: AppIdea, draft: Draft) => {
        const keys: Array<keyof Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>> = [
            'category_id',
            'description',
        ];
        return keys.some((key) => {
            if (!(key in draft)) return false;
            return normalize((idea as any)[key]) !== normalize((draft as any)[key]);
        });
    }, []);

    const onSaveRow = React.useCallback(
        async (idea: AppIdea) => {
            const draft = draftById[idea.id] || {};
            if (!isDirty(idea, draft)) return;

            const patch = {
                category_id: normalize(draft.category_id ?? idea.category_id),
                description: normalize(draft.description ?? idea.description),
            };

            if (!patch.category_id) {
                setRowErrorById((prev) => ({
                    ...prev,
                    [idea.id]: text('idea_picker_select_category'),
                }));
                return;
            }

            setRowBusyById((prev) => ({ ...prev, [idea.id]: true }));
            setRowErrorById((prev) => ({ ...prev, [idea.id]: null }));
            try {
                await updateIdea({ id: idea.id, patch });
                clearDraft(idea.id);
                markSaved(idea.id);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorById((prev) => ({ ...prev, [idea.id]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [idea.id]: false }));
            }
        },
        [clearDraft, draftById, isDirty, markSaved, reportError, text, updateIdea]
    );

    const onRemoveRow = React.useCallback(
        async (ideaId: string) => {
            setRowBusyById((prev) => ({ ...prev, [ideaId]: true }));
            setRowErrorById((prev) => ({ ...prev, [ideaId]: null }));
            try {
                await deleteIdea({ id: ideaId });
                clearDraft(ideaId);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorById((prev) => ({ ...prev, [ideaId]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [ideaId]: false }));
            }
        },
        [clearDraft, deleteIdea, reportError]
    );

    const openNewRow = React.useCallback(() => {
        setNewError(null);
        setNewDraft((prev) => {
            if (prev) return prev;
            return {
                category_id: categories[0]?.id || '',
                description: '',
            };
        });
        setNewRowScrollNonce((n) => n + 1);
    }, [categories]);

    React.useEffect(() => {
        if (!newDraft) return;
        if (!newRowScrollNonce) return;
        const raf1 = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const el = document.getElementById('idea-row-new');
                el?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            });
        });
        return () => window.cancelAnimationFrame(raf1);
    }, [newDraft, newRowScrollNonce]);

    const onSaveNew = React.useCallback(async () => {
        if (!newDraft) return;
        const categoryId = normalize(newDraft.category_id);
        if (!categoryId) {
            setNewError(text('idea_picker_select_category'));
            return;
        }
        setNewBusy(true);
        setNewError(null);
        try {
            const created = await createIdea({
                row: {
                    category_id: categoryId,
                    description: normalize(newDraft.description),
                },
            });
            setNewDraft(null);
            if (created?.id) markSaved(created.id);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setNewError(msg);
            reportError?.(msg);
        } finally {
            setNewBusy(false);
        }
    }, [createIdea, markSaved, newDraft, reportError, text]);

    const onExistingCellKeyDown = React.useCallback(
        (event: React.KeyboardEvent, idea: AppIdea) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                clearDraft(idea.id);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void onSaveRow(idea);
            }
        },
        [clearDraft, onSaveRow]
    );

    const onNewCellKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setNewDraft(null);
                setNewError(null);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void onSaveNew();
            }
        },
        [onSaveNew]
    );

    const visibleIdeas = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return ideas.filter((idea) => {
            if (!q) return true;
            const draft = draftById[idea.id] || {};
            const categoryId = normalize(draft.category_id ?? idea.category_id);
            const category = categoryById.get(categoryId);
            const description = normalize(draft.description ?? idea.description);
            const applied = appliedAppsByIdeaId.get(idea.id) || [];
            const appliedSearch = applied.map((item) => `${item.alias} ${item.name}`).join(' ');
            const hay = [category?.name, description, appliedSearch].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [ideas, search, draftById, categoryById, appliedAppsByIdeaId]);

    const anyBusy = loading || newBusy || Object.values(rowBusyById).some(Boolean);
    const searchInput =
        'h-9 w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60';
    const cellTextarea =
        'h-10 w-full resize-none bg-transparent px-3 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 disabled:opacity-60';
    const cellSelect =
        'h-10 w-full bg-transparent px-3 text-xs text-indigo-100/90 outline-none disabled:opacity-60';
    const cellBox =
        'min-w-0 focus-within:bg-slate-950/20 focus-within:ring-1 focus-within:ring-inset focus-within:ring-indigo-400/25';
    const gridStyle = React.useMemo<React.CSSProperties>(
        () => ({
            gridTemplateColumns: '48px 220px minmax(0,1fr) 220px 104px',
        }),
        []
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold text-white">{text('ideas_title')}</h2>
                    <p className="mt-2 text-sm text-indigo-200/60">{text('ideas_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={anyBusy}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                        {text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={openNewRow}
                        disabled={anyBusy}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
                    >
                        <Plus size={14} />
                        {text('ideas_new')}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {error}
                </div>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-slate-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="relative w-full sm:w-[420px]">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-200/45" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`${searchInput} pl-10`}
                            placeholder={text('ideas_search_placeholder')}
                        />
                    </div>
                    <div className="text-[11px] text-indigo-200/45">
                        {text('ideas_title')}: <span className="font-semibold text-indigo-100/80">{visibleIdeas.length}</span>
                    </div>
                </div>

                <div className="border-t border-white/10 overflow-x-auto">
                    <div className="min-w-[980px]">
                        <div
                            className="sticky top-0 z-10 grid divide-x divide-white/5 border-b border-white/10 bg-slate-950/50 backdrop-blur"
                            style={gridStyle}
                        >
                            <div className="flex items-center justify-center px-2 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                #
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('ideas_category')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('ideas_description')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('ideas_applied_to')}
                            </div>
                            <div className="flex items-center justify-center px-2 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('ideas_actions')}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            {visibleIdeas.map((idea) => {
                                const draft = draftById[idea.id] || {};
                                const dirty = isDirty(idea, draft);
                                const busy = Boolean(rowBusyById[idea.id]);
                                const saved = Boolean(rowSavedById[idea.id]);
                                const rowError = rowErrorById[idea.id];

                                const field = <K extends keyof Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>(
                                    key: K
                                ) => (key in draft ? (draft as any)[key] : (idea as any)[key]) as AppIdea[K];
                                const appliedApps = appliedAppsByIdeaId.get(idea.id) || [];
                                const appliedAliases = appliedApps.map((item) => item.alias);
                                const appliedSummary =
                                    appliedAliases.length > 3
                                        ? `${appliedAliases.slice(0, 3).join(', ')} +${appliedAliases.length - 3}`
                                        : appliedAliases.join(', ');
                                const appliedTooltip = appliedApps
                                    .map((item) => `${item.alias} · ${item.name}`)
                                    .join(' | ');

                                return (
                                    <div
                                        key={idea.id}
                                        className="grid divide-x divide-white/5 border-b border-white/5 bg-transparent transition-colors hover:bg-slate-950/15"
                                        style={gridStyle}
                                    >
                                        <div className="flex h-10 items-center justify-center px-2 text-[11px] font-semibold text-indigo-100/60">
                                            {ideaIndexById.get(idea.id) ?? '—'}
                                        </div>
                                        <div className={cellBox}>
                                            <select
                                                value={String(field('category_id') ?? '')}
                                                onChange={(e) => setDraftField(idea.id, { category_id: e.target.value })}
                                                onKeyDown={(e) => onExistingCellKeyDown(e, idea)}
                                                disabled={busy}
                                                className={cellSelect}
                                            >
                                                <option value="">{text('idea_picker_select_category')}</option>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {rowError ? <div className="px-3 pb-2 text-[10px] text-rose-200/90">{rowError}</div> : null}
                                        </div>
                                        <div className={cellBox}>
                                            <textarea
                                                value={String(field('description') ?? '')}
                                                onChange={(e) => setDraftField(idea.id, { description: e.target.value })}
                                                onKeyDown={(e) => onExistingCellKeyDown(e, idea)}
                                                disabled={busy}
                                                className={cellTextarea}
                                            />
                                        </div>
                                        <div
                                            className="flex h-10 min-w-0 items-center px-3 text-[11px] text-indigo-100/80"
                                            title={appliedTooltip || undefined}
                                        >
                                            <span className="truncate">{appliedSummary || '—'}</span>
                                        </div>
                                        <div className={`flex items-center justify-center gap-2 px-2 ${cellBox}`}>
                                            <button
                                                type="button"
                                                onClick={() => void onSaveRow(idea)}
                                                disabled={!dirty || busy}
                                                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-60 ${
                                                    dirty
                                                        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15'
                                                        : 'border-white/10 bg-slate-950/20 text-indigo-200/45'
                                                }`}
                                                title={text('save')}
                                            >
                                                {busy ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : saved ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Save size={14} />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                    const ok = window.confirm(text('ideas_confirm_delete'));
                                                    if (!ok) return;
                                                    void onRemoveRow(idea.id);
                                                }}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/60 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
                                                title={text('delete')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {newDraft ? (
                                <div
                                    id="idea-row-new"
                                    className="order-last grid divide-x divide-white/5 border-b border-white/5 bg-indigo-500/10"
                                    style={gridStyle}
                                >
                                    <div className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-indigo-100/70">
                                        +
                                    </div>
                                    <div className={cellBox}>
                                        <select
                                            value={newDraft.category_id}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, category_id: e.target.value } : prev))}
                                            onKeyDown={onNewCellKeyDown}
                                            disabled={newBusy}
                                            className={cellSelect}
                                        >
                                            <option value="">{text('idea_picker_select_category')}</option>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                        {newError ? <div className="px-3 pb-2 text-[10px] text-rose-200/90">{newError}</div> : null}
                                    </div>
                                    <div className={cellBox}>
                                        <textarea
                                            value={newDraft.description}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                                            onKeyDown={onNewCellKeyDown}
                                            disabled={newBusy}
                                            className={cellTextarea}
                                        />
                                    </div>
                                    <div className="flex h-10 min-w-0 items-center px-3 text-[11px] text-indigo-100/55">—</div>
                                    <div className={`flex items-center justify-center gap-2 px-2 ${cellBox}`}>
                                        <button
                                            type="button"
                                            onClick={onSaveNew}
                                            disabled={newBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                                            title={text('save')}
                                        >
                                            {newBusy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewDraft(null);
                                                setNewError(null);
                                            }}
                                            disabled={newBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/60 hover:border-indigo-400/35 hover:text-white disabled:opacity-60"
                                            title={text('cancel')}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {!loading && !newDraft && visibleIdeas.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-indigo-200/60">
                                    {text('ideas_empty')}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
