import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { Check, Loader2, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorJobMessages } from '../../hooks/use-connector-messages';
import { useIdeaGenerationJobs } from '../../hooks/use-idea-generation-jobs';
import type {
    AppIdea,
    AppIdeaCategory,
    AppItem,
    Brand,
    IdeaAppAssignment,
    IdeaCreativityTier,
    IdeaStatus,
} from '../../types/zefgen';
import { buildCanonicalBrandIdMap, getVisibleBrandOptions, isNoBrand } from '../../utils/no-brand';
import { normalizeLegacyRenderedSpec } from '../../utils/spec-text';

type Draft = Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;
type NewDraft = {
    brand_id: string;
    category_id: string;
    title: string;
    description: string;
};

type QuestionOptionView = {
    id: string;
    categoryId: string | null;
    slug: string | null;
    label: string;
    reason: string | null;
    confidence: number | null;
};

type IdeaGeneratorPrefs = {
    scope_brand_id?: string;
    selected_category_ids_by_brand?: Record<string, string[]>;
    guidance_by_brand?: Record<string, string>;
    table_scope_brand_id?: string;
};

const DEFAULT_REQUESTED_COUNT = 3;
const CREATIVITY_PERCENTAGES: Record<IdeaCreativityTier, number> = {
    safe: 0.4,
    balanced: 0.3,
    wild: 0.3,
};
const CREATIVITY_TIER_ORDER: IdeaCreativityTier[] = ['safe', 'balanced', 'wild'];
const IDEA_EXAMPLE_ROOT = 'Ideas_example';
const TABLE_SCOPE_ALL = '__all__';
const DEFAULT_SUGGESTED_CATEGORY_SLUGS = ['lifestyle', 'productivity', 'utilities'] as const;

const normalizeInline = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeBlock = (value: unknown) => String(value ?? '').replace(/\r\n/g, '\n').trim();

const normalizeNames = (value: unknown) => {
    if (!Array.isArray(value)) return [] as string[];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const entry of value) {
        const name = normalizeInline(entry);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        list.push(name);
    }
    return list;
};

const toggleListValue = (list: string[], id: string) => {
    const next = new Set(list);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    return Array.from(next);
};

const arraysEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
};

const normalizeIdeaGenerationCount = (value: unknown) =>
    Math.max(DEFAULT_REQUESTED_COUNT, Math.min(20, Number.parseInt(String(value ?? ''), 10) || DEFAULT_REQUESTED_COUNT));

const buildCreativityMix = (count: number): Record<IdeaCreativityTier, number> => {
    const normalizedCount = normalizeIdeaGenerationCount(count);
    const buckets = CREATIVITY_TIER_ORDER.map((tier, index) => {
        const exact = normalizedCount * CREATIVITY_PERCENTAGES[tier];
        const base = Math.floor(exact);
        return {
            tier,
            index,
            base,
            remainder: exact - base,
        };
    });

    const allocated = buckets.reduce((sum, bucket) => sum + bucket.base, 0);
    const remaining = normalizedCount - allocated;
    const rankedBuckets = [...buckets].sort((left, right) => right.remainder - left.remainder || left.index - right.index);

    const result = { safe: 0, balanced: 0, wild: 0 } as Record<IdeaCreativityTier, number>;
    for (const bucket of buckets) {
        result[bucket.tier] = bucket.base;
    }
    for (let index = 0; index < remaining; index += 1) {
        const target = rankedBuckets[index % rankedBuckets.length];
        result[target.tier] += 1;
    }

    return result;
};

const buildIdeaGenerationConfirmationAnswer = (payload: {
    selectedCategoryIds: string[];
    categoryById: Map<string, AppIdeaCategory>;
    guidance?: string;
}) => {
    const normalizedGuidance = normalizeBlock(payload.guidance);
    const answer: Record<string, unknown> = {
        action: 'confirm_categories',
        confirmed_category_ids: payload.selectedCategoryIds,
        confirmed_category_slugs: payload.selectedCategoryIds
            .map((categoryId) => payload.categoryById.get(categoryId)?.slug || null)
            .filter(Boolean),
    };

    if (normalizedGuidance) {
        answer.user_guidance = normalizedGuidance;
    }

    return JSON.stringify(answer, null, 2);
};

const getIdeaGeneratorPrefsStorageKey = (userId: string | null | undefined) => {
    const normalizedUserId = normalizeInline(userId);
    return normalizedUserId ? `zefgen.ideaGenerator.v2.${normalizedUserId}` : null;
};

const readIdeaGeneratorPrefs = (storageKey: string | null): IdeaGeneratorPrefs => {
    if (!storageKey || typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as IdeaGeneratorPrefs | null;
        if (!parsed || typeof parsed !== 'object') return {};

        const selectedByBrandRaw = parsed.selected_category_ids_by_brand;
        const selectedByBrand: Record<string, string[]> = {};
        if (selectedByBrandRaw && typeof selectedByBrandRaw === 'object') {
            for (const [brandId, value] of Object.entries(selectedByBrandRaw)) {
                const normalizedBrandId = normalizeInline(brandId);
                if (!normalizedBrandId || !Array.isArray(value)) continue;
                selectedByBrand[normalizedBrandId] = value
                    .map((entry) => normalizeInline(entry))
                    .filter(Boolean);
            }
        }

        const guidanceByBrandRaw = parsed.guidance_by_brand;
        const guidanceByBrand: Record<string, string> = {};
        if (guidanceByBrandRaw && typeof guidanceByBrandRaw === 'object') {
            for (const [brandId, value] of Object.entries(guidanceByBrandRaw)) {
                const normalizedBrandId = normalizeInline(brandId);
                if (!normalizedBrandId) continue;
                const normalizedGuidance = normalizeBlock(value);
                if (!normalizedGuidance) continue;
                guidanceByBrand[normalizedBrandId] = normalizedGuidance;
            }
        }

        return {
            scope_brand_id: normalizeInline(parsed.scope_brand_id),
            selected_category_ids_by_brand: selectedByBrand,
            guidance_by_brand: guidanceByBrand,
            table_scope_brand_id: normalizeInline(parsed.table_scope_brand_id) || TABLE_SCOPE_ALL,
        };
    } catch {
        return {};
    }
};

const writeIdeaGeneratorPrefs = (storageKey: string | null, prefs: IdeaGeneratorPrefs) => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
        // ignore write failures
    }
};

const effectiveStatus = (idea: AppIdea, appliedCount: number): IdeaStatus => {
    const status = (idea.status || 'generated') as IdeaStatus;
    if (appliedCount > 0 && status === 'generated') return 'used';
    return status;
};

const getBrandLabel = (brand: Brand | null | undefined, text: (key: TranslationKey) => string) => {
    if (!brand) return text('no_brand_selected');
    return isNoBrand(brand) ? text('no_brand_label') : String(brand.name || '').trim() || text('no_brand_label');
};

const tokenize = (value: string) =>
    String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

const buildSuggestedCategoryIds = (payload: {
    brand: Brand | null;
    categories: AppIdeaCategory[];
    ideas: AppIdea[];
}) => {
    const { brand, categories, ideas } = payload;
    const categoryList = Array.isArray(categories) ? categories : [];
    const ideaList = Array.isArray(ideas) ? ideas : [];
    if (!categoryList.length) return [] as string[];

    const brandTokens = new Set(
        tokenize(
            [brand?.name, brand?.keywords, brand?.release_strategy_notes, isNoBrand(brand) ? 'utility local offline ai tools' : '']
                .filter(Boolean)
                .join(' ')
        )
    );

    const scopedIdeas = brand ? ideaList.filter((idea) => idea.brand_id === brand.id) : [];

    const scored = categoryList.map((category, index) => {
        const categoryTokens = tokenize(`${category.slug} ${category.name}`);
        let score = 0;
        for (const token of categoryTokens) {
            if (brandTokens.has(token)) score += 5;
        }

        const scopedMatches = scopedIdeas.filter((idea) => idea.category_id === category.id);
        const generatedScopedMatches = scopedMatches.filter((idea) => idea.idea_source === 'generated');
        const globalGeneratedMatches = ideaList.filter(
            (idea) => idea.category_id === category.id && idea.idea_source === 'generated'
        );

        score += scopedMatches.length * 3;
        score += generatedScopedMatches.length * 2;
        score += Math.min(globalGeneratedMatches.length, 3);

        return {
            id: category.id,
            score,
            index,
        };
    });

    const categoriesBySlug = new Map(
        categoryList.map((category) => [normalizeInline(category.slug).toLowerCase(), category.id] as const)
    );
    const defaultIds = DEFAULT_SUGGESTED_CATEGORY_SLUGS
        .map((slug) => categoriesBySlug.get(slug) || null)
        .filter((value): value is string => Boolean(value));

    const ranked = scored
        .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
        .filter((item) => !defaultIds.includes(item.id))
        .map((item) => item.id);

    const combined = [...defaultIds, ...ranked];
    if (combined.length) return combined.slice(0, 4);
    return categoryList.slice(0, 4).map((category) => category.id);
};

export function IdeasPage(props: {
    session: Session | null;
    ideas: AppIdea[];
    categories: AppIdeaCategory[];
    ideaAssignments: IdeaAppAssignment[];
    apps: AppItem[];
    brands: Brand[];
    selectedBrand: Brand | null;
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
    onOpenApp?: (appId: string) => void;
    reportError?: (message: string) => void;
    text: (key: TranslationKey) => string;
}) {
    const {
        session,
        ideas,
        categories,
        ideaAssignments,
        apps,
        brands,
        selectedBrand,
        loading,
        error,
        refresh,
        createIdea,
        updateIdea,
        deleteIdea,
        onOpenApp,
        reportError,
        text,
    } = props;
    const ideaList = Array.isArray(ideas) ? ideas : [];
    const categoryList = Array.isArray(categories) ? categories : [];
    const ideaAssignmentList = Array.isArray(ideaAssignments) ? ideaAssignments : [];
    const appList = Array.isArray(apps) ? apps : [];
    const brandList = Array.isArray(brands) ? brands : [];

    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const [draftById, setDraftById] = React.useState<Record<string, Draft>>({});
    const [rowBusyById, setRowBusyById] = React.useState<Record<string, boolean>>({});
    const [rowErrorById, setRowErrorById] = React.useState<Record<string, string | null>>({});
    const [rowSavedById, setRowSavedById] = React.useState<Record<string, boolean>>({});
    const [newDraft, setNewDraft] = React.useState<NewDraft | null>(null);
    const [newBusy, setNewBusy] = React.useState(false);
    const [newError, setNewError] = React.useState<string | null>(null);
    const [newRowScrollNonce, setNewRowScrollNonce] = React.useState(0);
    const [generatorBrandId, setGeneratorBrandId] = React.useState('');
    const [requestedCount, setRequestedCount] = React.useState(String(DEFAULT_REQUESTED_COUNT));
    const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
    const [generatorGuidance, setGeneratorGuidance] = React.useState('');
    const [tableScopeBrandId, setTableScopeBrandId] = React.useState<string>(TABLE_SCOPE_ALL);
    const [prefsHydrated, setPrefsHydrated] = React.useState(false);
    const [questionAnswer, setQuestionAnswer] = React.useState('');
    const [answerBusy, setAnswerBusy] = React.useState(false);
    const saveTimersRef = React.useRef<Record<string, number>>({});
    const lastGeneratorBrandIdRef = React.useRef<string>('');
    const lastQuestionIdRef = React.useRef<string>('');
    const persistedGeneratorBrandIdRef = React.useRef<string>('');
    const persistedCategoryIdsByBrandRef = React.useRef<Record<string, string[]>>({});
    const persistedGuidanceByBrandRef = React.useRef<Record<string, string>>({});
    const persistedTableScopeBrandIdRef = React.useRef<string>(TABLE_SCOPE_ALL);
    const persistedGeneratorBrandAppliedRef = React.useRef(false);
    const persistedTableScopeAppliedRef = React.useRef(false);
    const ideaGeneratorPrefsStorageKey = React.useMemo(
        () => getIdeaGeneratorPrefsStorageKey(session?.user?.id || null),
        [session?.user?.id]
    );

    React.useEffect(() => {
        return () => {
            for (const timer of Object.values(saveTimersRef.current) as number[]) {
                window.clearTimeout(timer);
            }
        };
    }, []);

    const visibleScopeBrands = React.useMemo(() => getVisibleBrandOptions(brandList), [brandList]);
    const canonicalBrandIdById = React.useMemo(() => buildCanonicalBrandIdMap(brandList), [brandList]);
    const canonicalSelectedBrandId = selectedBrand?.id ? canonicalBrandIdById.get(selectedBrand.id) ?? selectedBrand.id : null;

    React.useEffect(() => {
        setPrefsHydrated(false);
        persistedGeneratorBrandAppliedRef.current = false;
        persistedTableScopeAppliedRef.current = false;
        if (!ideaGeneratorPrefsStorageKey) {
            persistedGeneratorBrandIdRef.current = '';
            persistedCategoryIdsByBrandRef.current = {};
            persistedGuidanceByBrandRef.current = {};
            persistedTableScopeBrandIdRef.current = TABLE_SCOPE_ALL;
            return;
        }
        const prefs = readIdeaGeneratorPrefs(ideaGeneratorPrefsStorageKey);
        persistedGeneratorBrandIdRef.current = normalizeInline(prefs.scope_brand_id);
        persistedCategoryIdsByBrandRef.current = prefs.selected_category_ids_by_brand || {};
        persistedGuidanceByBrandRef.current = prefs.guidance_by_brand || {};
        persistedTableScopeBrandIdRef.current = normalizeInline(prefs.table_scope_brand_id) || TABLE_SCOPE_ALL;
        setPrefsHydrated(true);
    }, [ideaGeneratorPrefsStorageKey]);

    React.useEffect(() => {
        if (!visibleScopeBrands.length) {
            setGeneratorBrandId('');
            return;
        }
        setGeneratorBrandId((prev) => {
            const persistedBrandId = persistedGeneratorBrandIdRef.current;
            const hasPersistedBrandId = persistedBrandId && visibleScopeBrands.some((brand) => brand.id === persistedBrandId);

            if (prefsHydrated && !persistedGeneratorBrandAppliedRef.current) {
                if (hasPersistedBrandId) {
                    persistedGeneratorBrandAppliedRef.current = true;
                    return persistedBrandId;
                }
                if (!persistedBrandId) {
                    persistedGeneratorBrandAppliedRef.current = true;
                }
            }

            if (prev && visibleScopeBrands.some((brand) => brand.id === prev)) return prev;
            if (hasPersistedBrandId) {
                return persistedBrandId;
            }
            return canonicalSelectedBrandId || visibleScopeBrands[0]?.id || '';
        });
    }, [canonicalSelectedBrandId, prefsHydrated, visibleScopeBrands]);

    React.useEffect(() => {
        if (!visibleScopeBrands.length) {
            setTableScopeBrandId(TABLE_SCOPE_ALL);
            return;
        }
        setTableScopeBrandId((prev) => {
            const persistedTableScopeBrandId = persistedTableScopeBrandIdRef.current;
            const hasPersistedTableScope =
                persistedTableScopeBrandId === TABLE_SCOPE_ALL ||
                visibleScopeBrands.some((brand) => brand.id === persistedTableScopeBrandId);

            if (prefsHydrated && !persistedTableScopeAppliedRef.current) {
                if (hasPersistedTableScope) {
                    persistedTableScopeAppliedRef.current = true;
                    return persistedTableScopeBrandId;
                }
                if (!persistedTableScopeBrandId) {
                    persistedTableScopeAppliedRef.current = true;
                }
            }

            if (prev !== TABLE_SCOPE_ALL && visibleScopeBrands.some((brand) => brand.id === prev)) return prev;
            if (hasPersistedTableScope) {
                return persistedTableScopeBrandId;
            }
            return TABLE_SCOPE_ALL;
        });
    }, [prefsHydrated, visibleScopeBrands]);

    const brandById = React.useMemo(() => new Map(brandList.map((brand) => [brand.id, brand])), [brandList]);
    const scopeBrandById = React.useMemo(() => new Map(visibleScopeBrands.map((brand) => [brand.id, brand])), [visibleScopeBrands]);
    const categoryById = React.useMemo(() => new Map(categoryList.map((category) => [category.id, category])), [categoryList]);
    const validCategoryIds = React.useMemo(() => new Set(categoryList.map((category) => category.id)), [categoryList]);
    const appById = React.useMemo(() => new Map(appList.map((app) => [app.id, app])), [appList]);
    const currentGeneratorBrand = React.useMemo(
        () => visibleScopeBrands.find((brand) => brand.id === generatorBrandId) || null,
        [generatorBrandId, visibleScopeBrands]
    );
    const safeSelectedCategoryIds = React.useMemo(
        () => (Array.isArray(selectedCategoryIds) ? selectedCategoryIds.filter(Boolean) : []),
        [selectedCategoryIds]
    );
    const normalizedRequestedCount = React.useMemo(() => normalizeIdeaGenerationCount(requestedCount), [requestedCount]);
    const creativityMix = React.useMemo(() => buildCreativityMix(normalizedRequestedCount), [normalizedRequestedCount]);

    const suggestedCategoryIds = React.useMemo(
        () => buildSuggestedCategoryIds({ brand: currentGeneratorBrand, categories: categoryList, ideas: ideaList }),
        [categoryList, currentGeneratorBrand, ideaList]
    );

    React.useEffect(() => {
        if (!generatorBrandId) {
            setSelectedCategoryIds([]);
            setGeneratorGuidance('');
            lastGeneratorBrandIdRef.current = '';
            return;
        }
        if (lastGeneratorBrandIdRef.current !== generatorBrandId) {
            const persistedForBrandRaw = persistedCategoryIdsByBrandRef.current?.[generatorBrandId];
            const persistedForBrand = (Array.isArray(persistedForBrandRaw) ? persistedForBrandRaw : []).filter((categoryId) =>
                validCategoryIds.has(categoryId)
            );
            const persistedGuidance = normalizeBlock(persistedGuidanceByBrandRef.current?.[generatorBrandId] || '');
            setSelectedCategoryIds(persistedForBrand.length ? persistedForBrand : suggestedCategoryIds);
            setGeneratorGuidance(persistedGuidance);
            lastGeneratorBrandIdRef.current = generatorBrandId;
            return;
        }
        setSelectedCategoryIds((prev) => (Array.isArray(prev) ? prev : []).filter((categoryId) => validCategoryIds.has(categoryId)));
    }, [generatorBrandId, suggestedCategoryIds, validCategoryIds]);

    React.useEffect(() => {
        if (!ideaGeneratorPrefsStorageKey || !prefsHydrated) return;

        if (!generatorBrandId) {
            persistedGeneratorBrandIdRef.current = '';
            persistedTableScopeBrandIdRef.current = tableScopeBrandId || TABLE_SCOPE_ALL;
            writeIdeaGeneratorPrefs(ideaGeneratorPrefsStorageKey, {
                scope_brand_id: '',
                selected_category_ids_by_brand: persistedCategoryIdsByBrandRef.current,
                guidance_by_brand: persistedGuidanceByBrandRef.current,
                table_scope_brand_id: tableScopeBrandId || TABLE_SCOPE_ALL,
            });
            return;
        }

        const normalizedSelectedCategoryIds = safeSelectedCategoryIds.filter((categoryId) => validCategoryIds.has(categoryId));
        const normalizedGeneratorGuidance = normalizeBlock(generatorGuidance);
        persistedGeneratorBrandIdRef.current = generatorBrandId;
        persistedTableScopeBrandIdRef.current = tableScopeBrandId || TABLE_SCOPE_ALL;
        persistedCategoryIdsByBrandRef.current = {
            ...persistedCategoryIdsByBrandRef.current,
            [generatorBrandId]: normalizedSelectedCategoryIds,
        };
        if (normalizedGeneratorGuidance) {
            persistedGuidanceByBrandRef.current = {
                ...persistedGuidanceByBrandRef.current,
                [generatorBrandId]: normalizedGeneratorGuidance,
            };
        } else {
            const nextGuidanceByBrand = { ...persistedGuidanceByBrandRef.current };
            delete nextGuidanceByBrand[generatorBrandId];
            persistedGuidanceByBrandRef.current = nextGuidanceByBrand;
        }

        writeIdeaGeneratorPrefs(ideaGeneratorPrefsStorageKey, {
            scope_brand_id: generatorBrandId,
            selected_category_ids_by_brand: persistedCategoryIdsByBrandRef.current,
            guidance_by_brand: persistedGuidanceByBrandRef.current,
            table_scope_brand_id: tableScopeBrandId || TABLE_SCOPE_ALL,
        });
    }, [
        generatorBrandId,
        generatorGuidance,
        ideaGeneratorPrefsStorageKey,
        prefsHydrated,
        safeSelectedCategoryIds,
        tableScopeBrandId,
        validCategoryIds,
    ]);

    const handleGeneratorScopeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextBrandId = event.target.value;
        setGeneratorBrandId(nextBrandId);
        setTableScopeBrandId(nextBrandId || TABLE_SCOPE_ALL);
    };

    const appliedAppsByIdeaId = React.useMemo(() => {
        const map = new Map<
            string,
            Array<{
                appId: string;
                alias: string;
                name: string;
            }>
        >();

        for (const row of ideaAssignmentList) {
            const ideaId = normalizeInline(row.idea_id);
            const appId = normalizeInline(row.app_id);
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

        for (const bucket of map.values()) {
            bucket.sort((left, right) =>
                `${left.alias} ${left.name}`.localeCompare(`${right.alias} ${right.name}`, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                })
            );
        }

        return map;
    }, [appById, ideaAssignmentList]);

    const ideaIndexById = React.useMemo(() => {
        const ordered = [...ideaList].sort((left, right) => {
            const leftTs = Date.parse(String(left.created_at || left.updated_at || 0)) || 0;
            const rightTs = Date.parse(String(right.created_at || right.updated_at || 0)) || 0;
            return rightTs - leftTs;
        });
        const map = new Map<string, number>();
        ordered.forEach((idea, index) => map.set(idea.id, index + 1));
        return map;
    }, [ideaList]);

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
        const baseNames = normalizeNames(idea.alternate_names);
        const draftNames = Object.prototype.hasOwnProperty.call(draft, 'alternate_names')
            ? normalizeNames(draft.alternate_names)
            : baseNames;

        if (Object.prototype.hasOwnProperty.call(draft, 'category_id')) {
            if (normalizeInline(draft.category_id) !== normalizeInline(idea.category_id)) return true;
        }
        if (Object.prototype.hasOwnProperty.call(draft, 'title')) {
            if (normalizeInline(draft.title) !== normalizeInline(idea.title)) return true;
        }
        if (Object.prototype.hasOwnProperty.call(draft, 'description')) {
            if (normalizeBlock(draft.description) !== normalizeBlock(idea.description)) return true;
        }
        if (Object.prototype.hasOwnProperty.call(draft, 'client_spec_current')) {
            if (normalizeBlock(draft.client_spec_current) !== normalizeBlock(idea.client_spec_current || idea.description)) return true;
        }
        if (Object.prototype.hasOwnProperty.call(draft, 'status')) {
            if (normalizeInline(draft.status) !== normalizeInline(idea.status || 'generated')) return true;
        }
        if (Object.prototype.hasOwnProperty.call(draft, 'alternate_names')) {
            if (!arraysEqual(draftNames, baseNames)) return true;
        }

        return false;
    }, []);

    const {
        latestJob,
        loading: generationJobsLoading,
        creating: createGenerationBusy,
        error: generationJobsError,
        refresh: refreshGenerationJobs,
        createJob: createIdeaGenerationJob,
        cancelJob: cancelIdeaGenerationJob,
    } = useIdeaGenerationJobs({
        session,
        brandId: generatorBrandId || null,
        pollMs: 2500,
        idlePollMs: 15_000,
        onDataError: reportError,
    });

    const { unansweredQuestions, answerQuestion } = useConnectorJobMessages({
        session,
        jobId: latestJob?.status === 'waiting_for_user' ? latestJob.id : null,
        pollMs: 2500,
    });

    const latestQuestion = (Array.isArray(unansweredQuestions) ? unansweredQuestions : [])[0] || null;
    const questionOptions = React.useMemo<QuestionOptionView[]>(() => {
        const options = latestQuestion?.options;
        if (!Array.isArray(options)) return [];

        return options
            .map((option) => {
                if (typeof option === 'string') {
                    const label = normalizeInline(option);
                    if (!label) return null;
                    const matchedCategory = categoryList.find(
                        (category) =>
                            normalizeInline(category.name).toLowerCase() === label.toLowerCase() ||
                            normalizeInline(category.slug).toLowerCase() === label.toLowerCase()
                    );
                    return {
                        id: matchedCategory?.id || label,
                        categoryId: matchedCategory?.id || null,
                        slug: matchedCategory?.slug || null,
                        label,
                        reason: null,
                        confidence: null,
                    } satisfies QuestionOptionView;
                }

                const categoryId = normalizeInline((option as any)?.id || '');
                const slug = normalizeInline((option as any)?.slug || '') || null;
                const label = normalizeInline((option as any)?.label || (option as any)?.name || slug || categoryId);
                if (!label) return null;
                const matchedCategory =
                    categoryList.find((category) => category.id === categoryId) ||
                    (slug ? categoryList.find((category) => normalizeInline(category.slug).toLowerCase() === slug.toLowerCase()) : null) ||
                    categoryList.find((category) => normalizeInline(category.name).toLowerCase() === label.toLowerCase());

                const rawConfidence = Number((option as any)?.confidence);

                return {
                    id: categoryId || slug || label,
                    categoryId: matchedCategory?.id || (categoryId || null),
                    slug: slug || matchedCategory?.slug || null,
                    label,
                    reason: normalizeBlock((option as any)?.reason || '') || null,
                    confidence: Number.isFinite(rawConfidence) ? rawConfidence : null,
                } satisfies QuestionOptionView;
            })
            .filter(Boolean) as QuestionOptionView[];
    }, [categoryList, latestQuestion?.options]);

    React.useEffect(() => {
        if (!latestQuestion?.id || latestQuestion.id === lastQuestionIdRef.current) return;
        lastQuestionIdRef.current = latestQuestion.id;
        const nextSelected = questionOptions
            .map((option) => option.categoryId)
            .filter((value): value is string => Boolean(value));
        if (nextSelected.length) {
            setSelectedCategoryIds(nextSelected);
        }
    }, [latestQuestion?.id, questionOptions]);

    const visibleIdeas = React.useMemo(() => {
        const query = normalizeInline(deferredSearch).toLowerCase();
        return ideaList.filter((idea) => {
            if (!query) return true;
            const draft = draftById[idea.id] || {};
            const displayBrandId = canonicalBrandIdById.get(idea.brand_id) ?? idea.brand_id;
            const brand = scopeBrandById.get(displayBrandId) || brandById.get(idea.brand_id);
            const category = categoryById.get(String(draft.category_id || idea.category_id));
            const applied = appliedAppsByIdeaId.get(idea.id) || [];
            const haystack = [
                getBrandLabel(brand, text),
                category?.name,
                draft.title ?? idea.title,
                draft.description ?? idea.description,
                draft.client_spec_current ?? idea.client_spec_current ?? idea.description,
                effectiveStatus(idea, applied.length),
                ...normalizeNames(Object.prototype.hasOwnProperty.call(draft, 'alternate_names') ? draft.alternate_names : idea.alternate_names),
                ...applied.map((app) => `${app.alias} ${app.name}`),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [appliedAppsByIdeaId, brandById, canonicalBrandIdById, categoryById, deferredSearch, draftById, ideaList, scopeBrandById, text]);

    const tableFilteredIdeas = React.useMemo(() => {
        if (tableScopeBrandId === TABLE_SCOPE_ALL) return visibleIdeas;
        return visibleIdeas.filter((idea) => (canonicalBrandIdById.get(idea.brand_id) ?? idea.brand_id) === tableScopeBrandId);
    }, [canonicalBrandIdById, tableScopeBrandId, visibleIdeas]);

    const visibleIdeasByBrandId = React.useMemo(() => {
        const map = new Map<string, AppIdea[]>();
        for (const idea of tableFilteredIdeas) {
            const displayBrandId = canonicalBrandIdById.get(idea.brand_id) ?? idea.brand_id;
            const bucket = map.get(displayBrandId) ?? [];
            bucket.push(idea);
            map.set(displayBrandId, bucket);
        }
        for (const bucket of map.values()) {
            bucket.sort((left, right) => {
                const leftTs = Date.parse(String(left.updated_at || left.created_at || 0)) || 0;
                const rightTs = Date.parse(String(right.updated_at || right.created_at || 0)) || 0;
                return rightTs - leftTs;
            });
        }
        return map;
    }, [canonicalBrandIdById, tableFilteredIdeas]);

    const orderedBrands = React.useMemo(() => {
        const listed = [...visibleScopeBrands];
        const knownIds = new Set(listed.map((brand) => brand.id));
        for (const idea of tableFilteredIdeas) {
            const displayBrandId = canonicalBrandIdById.get(idea.brand_id) ?? idea.brand_id;
            if (knownIds.has(displayBrandId)) continue;
            listed.push({
                id: displayBrandId,
                name: text('ideas_unknown_brand'),
                slug: displayBrandId,
            } as Brand);
            knownIds.add(displayBrandId);
        }
        return listed;
    }, [canonicalBrandIdById, tableFilteredIdeas, text, visibleScopeBrands]);

    const visibleBrandSections = React.useMemo(
        () =>
            orderedBrands.filter((brand) => {
                if (tableScopeBrandId !== TABLE_SCOPE_ALL && brand.id !== tableScopeBrandId) return false;
                const count = visibleIdeasByBrandId.get(brand.id)?.length || 0;
                if (count > 0) return true;
                if (tableScopeBrandId !== TABLE_SCOPE_ALL && brand.id === tableScopeBrandId) return true;
                if (newDraft?.brand_id === brand.id) return true;
                return brand.id === generatorBrandId;
            }),
        [generatorBrandId, newDraft?.brand_id, orderedBrands, tableScopeBrandId, visibleIdeasByBrandId]
    );

    const anyBusy = loading || newBusy || createGenerationBusy || Object.values(rowBusyById).some(Boolean);
    const gridStyle = React.useMemo<React.CSSProperties>(
        () => ({
            gridTemplateColumns: '48px 170px 240px 240px minmax(300px,1fr) 120px 210px 104px',
        }),
        []
    );

    React.useEffect(() => {
        if (!newDraft || !newRowScrollNonce) return;
        const raf1 = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const el = document.getElementById('idea-row-new');
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        });
        return () => window.cancelAnimationFrame(raf1);
    }, [newDraft, newRowScrollNonce]);

    const openNewRow = React.useCallback(
        (brandId?: string) => {
            const resolvedBrandId = brandId || generatorBrandId || canonicalSelectedBrandId || visibleScopeBrands[0]?.id || '';
            if (!resolvedBrandId) {
                setNewError(text('ideas_generator_pick_scope_first'));
                return;
            }
            setNewError(null);
            setNewDraft({
                brand_id: resolvedBrandId,
                category_id: categoryList[0]?.id || '',
                title: '',
                description: '',
            });
            setNewRowScrollNonce((value) => value + 1);
        },
        [canonicalSelectedBrandId, categoryList, generatorBrandId, text, visibleScopeBrands]
    );

    const onSaveNew = React.useCallback(async () => {
        if (!newDraft) return;
        const categoryId = normalizeInline(newDraft.category_id);
        const brandId = normalizeInline(newDraft.brand_id);
        if (!brandId) {
            setNewError(text('ideas_generator_pick_scope_first'));
            return;
        }
        if (!categoryId) {
            setNewError(text('idea_picker_select_category'));
            return;
        }
        setNewBusy(true);
        setNewError(null);
        try {
            const summary = normalizeBlock(newDraft.description);
            const created = await createIdea({
                row: {
                    brand_id: brandId,
                    category_id: categoryId,
                    idea_source: 'manual',
                    status: 'generated',
                    title: normalizeInline(newDraft.title),
                    description: summary,
                    client_spec_current: summary,
                },
            });
            setNewDraft(null);
            if (created?.id) {
                markSaved(created.id);
            }
        } catch (saveError: any) {
            const message = String(saveError?.message || saveError);
            setNewError(message);
            reportError?.(message);
        } finally {
            setNewBusy(false);
        }
    }, [createIdea, markSaved, newDraft, reportError, text]);

    const onSaveRow = React.useCallback(
        async (idea: AppIdea) => {
            const draft = draftById[idea.id] || {};
            const appliedApps = appliedAppsByIdeaId.get(idea.id) || [];
            if (!isDirty(idea, draft)) return;

            const categoryId = normalizeInline(draft.category_id ?? idea.category_id);
            if (!categoryId) {
                setRowErrorById((prev) => ({
                    ...prev,
                    [idea.id]: text('idea_picker_select_category'),
                }));
                return;
            }

            const currentSpec = normalizeBlock(draft.client_spec_current ?? idea.client_spec_current ?? idea.description);
            const alternateNames = normalizeNames(
                Object.prototype.hasOwnProperty.call(draft, 'alternate_names') ? draft.alternate_names : idea.alternate_names
            );

            const nextStatus = normalizeInline(
                draft.status ?? effectiveStatus(idea, appliedApps.length) ?? idea.status ?? 'generated'
            ) as IdeaStatus;

            const patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>> = {
                category_id: categoryId,
                title: normalizeInline(draft.title ?? idea.title),
                description: normalizeBlock(draft.description ?? idea.description),
                client_spec_current: currentSpec,
                status: nextStatus,
                alternate_names: alternateNames,
            };

            if (normalizeBlock(idea.client_spec_current || idea.description) !== currentSpec) {
                patch.spec_revision_index = Math.max(1, Number(idea.spec_revision_index || 1)) + 1;
                patch.edited_after_generation = true;
            }

            setRowBusyById((prev) => ({ ...prev, [idea.id]: true }));
            setRowErrorById((prev) => ({ ...prev, [idea.id]: null }));

            try {
                await updateIdea({ id: idea.id, patch });
                clearDraft(idea.id);
                markSaved(idea.id);
            } catch (saveError: any) {
                const message = String(saveError?.message || saveError);
                setRowErrorById((prev) => ({ ...prev, [idea.id]: message }));
                reportError?.(message);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [idea.id]: false }));
            }
        },
        [appliedAppsByIdeaId, clearDraft, draftById, isDirty, markSaved, reportError, text, updateIdea]
    );

    const onRemoveRow = React.useCallback(
        async (ideaId: string) => {
            setRowBusyById((prev) => ({ ...prev, [ideaId]: true }));
            setRowErrorById((prev) => ({ ...prev, [ideaId]: null }));
            try {
                await deleteIdea({ id: ideaId });
                clearDraft(ideaId);
            } catch (removeError: any) {
                const message = String(removeError?.message || removeError);
                setRowErrorById((prev) => ({ ...prev, [ideaId]: message }));
                reportError?.(message);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [ideaId]: false }));
            }
        },
        [clearDraft, deleteIdea, reportError]
    );

    const onQueueGeneration = React.useCallback(async () => {
        if (!currentGeneratorBrand) {
            const message = text('ideas_generator_pick_scope_first');
            reportError?.(message);
            return;
        }
        const count = normalizedRequestedCount;
        const confirmedCategoryIds = safeSelectedCategoryIds.filter((categoryId) =>
            categoryList.some((category) => category.id === categoryId)
        );
        if (!confirmedCategoryIds.length) {
            const message = text('ideas_generator_select_categories');
            reportError?.(message);
            return;
        }

        const confirmedCategories = confirmedCategoryIds
            .map((categoryId) => categoryById.get(categoryId))
            .filter(Boolean)
            .map((category) => ({
                id: category!.id,
                slug: category!.slug,
                name: category!.name,
            }));
        const normalizedGeneratorGuidance = normalizeBlock(generatorGuidance);

        try {
            await createIdeaGenerationJob({
                brand_id: currentGeneratorBrand.id,
                count,
                creativity_mix: creativityMix,
                suggested_category_ids: [],
                confirmed_category_ids: confirmedCategoryIds,
                category_confirmation_required: false,
                example_corpus_root: IDEA_EXAMPLE_ROOT,
                constraints: {
                    no_premium: true,
                    naming_stage: 'after_spec',
                    brand_initial: isNoBrand(currentGeneratorBrand)
                        ? null
                        : normalizeInline(currentGeneratorBrand.name).charAt(0).toUpperCase() || null,
                },
                context_hints: {
                    scope_name: getBrandLabel(currentGeneratorBrand, text),
                    scope_is_no_brand: isNoBrand(currentGeneratorBrand),
                    prior_generated_count: ideaList.filter(
                        (idea) => idea.brand_id === currentGeneratorBrand.id && idea.idea_source === 'generated'
                    ).length,
                    selected_categories: confirmedCategories,
                },
                ...(normalizedGeneratorGuidance ? { user_guidance: normalizedGeneratorGuidance } : {}),
            });
        } catch {
            // Error is already surfaced by the hook.
        }
    }, [
        categoryList,
        categoryById,
        createIdeaGenerationJob,
        creativityMix,
        currentGeneratorBrand,
        generatorGuidance,
        ideaList,
        normalizedRequestedCount,
        reportError,
        safeSelectedCategoryIds,
        text,
    ]);

    const onAnswerLatestQuestion = React.useCallback(
        async (content?: string) => {
            if (!latestQuestion) return;
            const answer = normalizeBlock(content ?? questionAnswer);
            if (!answer) return;
            setAnswerBusy(true);
            try {
                await answerQuestion(latestQuestion.id, answer);
                setQuestionAnswer('');
            } catch (questionError: any) {
                const message = String(questionError?.message || questionError);
                reportError?.(message);
            } finally {
                setAnswerBusy(false);
            }
        },
        [answerQuestion, latestQuestion, questionAnswer, reportError]
    );

    const searchInput =
        'h-9 w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60';
    const fieldBase =
        'w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60';
    const cellInput = 'min-h-[40px] w-full bg-transparent px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 disabled:opacity-60';
    const cellTextarea = 'min-h-[88px] w-full resize-y bg-transparent px-3 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 disabled:opacity-60';
    const cellSelect = 'h-10 w-full bg-transparent px-3 text-xs text-indigo-100/90 outline-none disabled:opacity-60';
    const cellBox = 'min-w-0 border-r border-white/5 focus-within:bg-slate-950/20 focus-within:ring-1 focus-within:ring-inset focus-within:ring-indigo-400/25';

    return (
        <div data-testid="ideas-page-root" className="space-y-6">
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
                        onClick={() => openNewRow()}
                        disabled={anyBusy}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                    >
                        <Plus size={14} />
                        {text('ideas_new')}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
            ) : null}

            <section className="overflow-hidden rounded-[28px] border border-indigo-400/20 bg-[linear-gradient(135deg,rgba(79,70,229,0.18),rgba(15,23,42,0.18))]">
                <div className="border-b border-white/10 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/25 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-100/80">
                                <Sparkles size={12} />
                                {text('ideas_generator_title')}
                            </div>
                            <h3 className="mt-3 text-xl font-semibold text-white">{text('ideas_generator_heading')}</h3>
                            <p className="mt-2 max-w-3xl text-sm text-indigo-100/70">{text('ideas_generator_subtitle')}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-right text-xs text-indigo-100/70">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-indigo-200/45">{text('ideas_generator_mix')}</div>
                            <div className="mt-2 font-semibold text-indigo-100" data-testid="ideas-generator-mix-value">
                                {creativityMix.safe} / {creativityMix.balanced} / {creativityMix.wild}
                            </div>
                            <div className="mt-1 text-[11px] text-indigo-200/55">{text('ideas_generator_mix_caption')}</div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                            <label className="grid gap-1">
                                <span className="text-[11px] text-indigo-200/55">{text('ideas_generator_scope')}</span>
                                <select
                                    data-testid="ideas-generator-scope-select"
                                    value={generatorBrandId}
                                    onChange={handleGeneratorScopeChange}
                                    className={`${fieldBase} h-10`}
                                >
                                    <option value="">{text('ideas_generator_pick_scope')}</option>
                                    {visibleScopeBrands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>
                                            {getBrandLabel(brand, text)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                <span className="text-[11px] text-indigo-200/55">{text('ideas_generator_count')}</span>
                                <input
                                    data-testid="ideas-generator-count-input"
                                    value={requestedCount}
                                    onChange={(event) => setRequestedCount(event.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                                    onBlur={() => setRequestedCount(String(normalizeIdeaGenerationCount(requestedCount)))}
                                    className={`${fieldBase} h-10`}
                                    inputMode="numeric"
                                    min={DEFAULT_REQUESTED_COUNT}
                                />
                            </label>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-100/75">
                                        {text('ideas_generator_suggested_categories')}
                                    </div>
                                    <p className="mt-1 text-xs text-indigo-200/55">{text('ideas_generator_corpus_hint')}</p>
                                </div>
                                <button
                                    type="button"
                                    data-testid="ideas-generator-reset-categories"
                                    onClick={() => setSelectedCategoryIds(suggestedCategoryIds)}
                                    className="inline-flex h-8 items-center rounded-full border border-white/10 bg-slate-950/20 px-3 text-[11px] font-semibold text-indigo-100/80 hover:border-indigo-300/35"
                                >
                                    {text('ideas_generator_reset_categories')}
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {categoryList.map((category) => {
                                    const selected = safeSelectedCategoryIds.includes(category.id);
                                    const suggested = suggestedCategoryIds.includes(category.id);
                                    return (
                                        <button
                                            key={category.id}
                                            type="button"
                                            data-testid={`ideas-generator-category-${normalizeInline(category.slug).toLowerCase() || category.id}`}
                                            data-selected={selected ? 'true' : 'false'}
                                            data-suggested={suggested ? 'true' : 'false'}
                                            onClick={() =>
                                                setSelectedCategoryIds((prev) => toggleListValue(Array.isArray(prev) ? prev : [], category.id))
                                            }
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                                selected
                                                    ? 'border-indigo-300/40 bg-indigo-500/20 text-indigo-50'
                                                    : 'border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-300/30'
                                            }`}
                                        >
                                            <span>{category.name}</span>
                                            {suggested ? (
                                                <span className="rounded-full border border-indigo-300/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-indigo-100/70">
                                                    {text('ideas_generator_suggested_short')}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <label className="grid gap-1">
                            <span className="text-[11px] text-indigo-200/55">{text('ideas_generator_guidance')}</span>
                            <textarea
                                data-testid="ideas-generator-guidance"
                                value={generatorGuidance}
                                onChange={(event) => setGeneratorGuidance(event.target.value)}
                                placeholder={text('ideas_generator_guidance_placeholder')}
                                className={`${fieldBase} min-h-[96px] resize-y py-3`}
                            />
                            <span className="text-[11px] text-indigo-200/45">{text('ideas_generator_guidance_hint')}</span>
                        </label>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void onQueueGeneration()}
                                disabled={!generatorBrandId || createGenerationBusy || safeSelectedCategoryIds.length === 0}
                                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-indigo-300/35 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-50 hover:bg-indigo-500/25 disabled:opacity-60"
                            >
                                {createGenerationBusy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                {text('ideas_generator_run')}
                            </button>
                            <div className="text-xs text-indigo-100/70">
                                {text('ideas_generator_ready_for')}{' '}
                                <span className="font-semibold text-white">{getBrandLabel(currentGeneratorBrand, text)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-100/75">
                                    {text('ideas_generator_latest_run')}
                                </div>
                                <p className="mt-1 text-xs text-indigo-200/55">{text('ideas_generator_latest_run_hint')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void refreshGenerationJobs()}
                                disabled={generationJobsLoading}
                                className="inline-flex h-8 items-center rounded-full border border-white/10 bg-slate-950/20 px-3 text-[11px] font-semibold text-indigo-100/80 hover:border-indigo-300/35 disabled:opacity-60"
                            >
                                {generationJobsLoading ? <Loader2 className="animate-spin" size={12} /> : text('refresh')}
                            </button>
                        </div>

                        {generationJobsError ? (
                            <div className="mt-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-100">
                                {generationJobsError}
                            </div>
                        ) : null}

                        {latestJob ? (
                            <div className="mt-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full border border-indigo-300/25 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-100/85">
                                        {String(latestJob.status || 'queued')}
                                    </span>
                                    <span className="text-[11px] text-indigo-200/55">
                                        {new Date(String(latestJob.created_at || latestJob.updated_at || Date.now())).toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-sm text-indigo-100/85">
                                    {latestJob.summary || text('ideas_generator_latest_run_empty')}
                                </div>
                                {latestJob.error ? (
                                    <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-100">
                                        {latestJob.error}
                                    </div>
                                ) : null}
                                {(latestJob.status === 'queued' || latestJob.status === 'running' || latestJob.status === 'waiting_for_user') ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void cancelIdeaGenerationJob(latestJob.id)}
                                            className="inline-flex h-8 items-center rounded-full border border-white/10 bg-slate-950/20 px-3 text-[11px] font-semibold text-indigo-100/80 hover:border-rose-300/35"
                                        >
                                            {text('ideas_generator_cancel')}
                                        </button>
                                        <span className="text-[11px] text-indigo-200/55">{text('ideas_generator_runner_active')}</span>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/15 p-4 text-sm text-indigo-200/60">
                                {text('ideas_generator_no_runs')}
                            </div>
                        )}

                        {latestQuestion ? (
                            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-50/90">
                                    {text('ideas_generator_runner_question')}
                                </div>
                                <p className="mt-2 text-sm text-amber-50/85">{latestQuestion.content}</p>
                                {questionOptions.length ? (
                                    <div className="mt-3 grid gap-2">
                                        {questionOptions.map((option) => {
                                            const selected = option.categoryId ? safeSelectedCategoryIds.includes(option.categoryId) : false;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (option.categoryId) {
                                                            setSelectedCategoryIds((prev) =>
                                                                toggleListValue(Array.isArray(prev) ? prev : [], option.categoryId!)
                                                            );
                                                            return;
                                                        }
                                                        void onAnswerLatestQuestion(option.label);
                                                    }}
                                                    disabled={answerBusy}
                                                    className={`rounded-2xl border px-3 py-3 text-left text-xs transition disabled:opacity-60 ${
                                                        selected
                                                            ? 'border-amber-100/45 bg-amber-500/15 text-amber-50'
                                                            : 'border-amber-200/25 bg-slate-950/15 text-amber-50/90 hover:border-amber-100/40'
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-semibold">{option.label}</span>
                                                        {option.confidence !== null ? (
                                                            <span className="rounded-full border border-amber-100/20 bg-slate-950/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-50/75">
                                                                {Math.round(option.confidence * 100)}%
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {option.reason ? (
                                                        <div className="mt-1 text-[11px] text-amber-50/70">{option.reason}</div>
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                                <textarea
                                    value={questionAnswer}
                                    onChange={(event) => setQuestionAnswer(event.target.value)}
                                    placeholder={text('ideas_generator_runner_answer_placeholder')}
                                    className="mt-3 min-h-[88px] w-full rounded-2xl border border-amber-200/20 bg-slate-950/20 px-3 py-3 text-sm text-amber-50/90 outline-none placeholder:text-amber-50/35 focus:border-amber-200/40"
                                />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void onAnswerLatestQuestion(
                                                buildIdeaGenerationConfirmationAnswer({
                                                    selectedCategoryIds: safeSelectedCategoryIds,
                                                    categoryById,
                                                    guidance: questionAnswer,
                                                })
                                            )
                                        }
                                        disabled={answerBusy || safeSelectedCategoryIds.length === 0}
                                        className="inline-flex h-9 items-center rounded-full border border-amber-200/25 bg-slate-950/20 px-3 text-xs font-semibold text-amber-50/90 hover:border-amber-100/40 disabled:opacity-60"
                                    >
                                        {text('ideas_generator_use_selected_categories')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void onAnswerLatestQuestion()}
                                        disabled={answerBusy || !normalizeBlock(questionAnswer)}
                                        className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-200/30 bg-amber-500/15 px-3 text-xs font-semibold text-amber-50 hover:bg-amber-500/20 disabled:opacity-60"
                                    >
                                        {answerBusy ? <Loader2 className="animate-spin" size={14} /> : null}
                                        {text('ideas_generator_send_answer')}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="flex w-full flex-1 flex-wrap items-end gap-3">
                        <div className="relative min-w-[260px] flex-1 sm:max-w-[420px]">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-200/45" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className={`${searchInput} pl-10`}
                                placeholder={text('ideas_search_placeholder')}
                            />
                        </div>
                        <label className="grid min-w-[220px] gap-1">
                            <span className="text-[11px] text-indigo-200/55">{text('ideas_table_scope')}</span>
                            <select
                                data-testid="ideas-table-scope-select"
                                value={tableScopeBrandId}
                                onChange={(event) => setTableScopeBrandId(event.target.value || TABLE_SCOPE_ALL)}
                                className={`${fieldBase} h-9`}
                            >
                                <option value={TABLE_SCOPE_ALL}>{text('ideas_table_scope_all')}</option>
                                {visibleScopeBrands.map((brand) => (
                                    <option key={brand.id} value={brand.id}>
                                        {getBrandLabel(brand, text)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="text-[11px] text-indigo-200/45">
                        {text('ideas_title')}:{' '}
                        <span className="font-semibold text-indigo-100/80">{tableFilteredIdeas.length}</span>
                    </div>
                </div>
            </section>

            {visibleBrandSections.map((brand) => {
                const sectionIdeas = visibleIdeasByBrandId.get(brand.id) || [];
                const showNewRow = newDraft?.brand_id === brand.id;

                return (
                    <section key={brand.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/10">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-200/55">
                                    {isNoBrand(brand) ? text('ideas_no_brand_group') : text('ideas_brand_group')}
                                </div>
                                <h3 className="mt-1 text-lg font-semibold text-white">{getBrandLabel(brand, text)}</h3>
                                <p className="mt-1 text-xs text-indigo-200/55">
                                    {text('ideas_group_count')} {sectionIdeas.length}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => openNewRow(brand.id)}
                                disabled={anyBusy}
                                aria-label={`${text('ideas_new')} ${getBrandLabel(brand, text)}`}
                                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs font-semibold text-indigo-100 hover:border-indigo-300/35 disabled:opacity-60"
                            >
                                <Plus size={14} />
                                {text('ideas_new')}
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="min-w-[1600px]">
                                <div
                                    className="grid border-b border-white/10 bg-slate-950/45 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-200/55"
                                    style={gridStyle}
                                >
                                    <div className="px-2 py-3 text-center">#</div>
                                    <div className="px-3 py-3">{text('ideas_category')}</div>
                                    <div className="px-3 py-3">{text('ideas_name')}</div>
                                    <div className="px-3 py-3">{text('ideas_description')}</div>
                                    <div className="px-3 py-3">{text('ideas_client_spec')}</div>
                                    <div className="px-3 py-3">{text('ideas_status')}</div>
                                    <div className="px-3 py-3">{text('ideas_applied_to')}</div>
                                    <div className="px-2 py-3 text-center">{text('ideas_actions')}</div>
                                </div>

                                {showNewRow && newDraft ? (
                                    <div
                                        id="idea-row-new"
                                        className="grid border-b border-white/10 bg-indigo-500/5"
                                        style={gridStyle}
                                    >
                                        <div className="flex items-center justify-center px-2 text-[11px] font-semibold text-indigo-100/60">+</div>
                                        <div className={cellBox}>
                                            <select
                                                value={newDraft.category_id}
                                                onChange={(event) =>
                                                    setNewDraft((prev) => (prev ? { ...prev, category_id: event.target.value } : prev))
                                                }
                                                className={cellSelect}
                                                disabled={newBusy}
                                            >
                                                <option value="">{text('idea_picker_select_category')}</option>
                                                {categoryList.map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={cellBox}>
                                            <input
                                                value={newDraft.title}
                                                onChange={(event) =>
                                                    setNewDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                                                }
                                                className={cellInput}
                                                disabled={newBusy}
                                                placeholder={text('ideas_name')}
                                            />
                                            <div className="px-3 pb-3 text-[10px] text-indigo-200/50">
                                                {text('ideas_new_manual_hint')}
                                            </div>
                                        </div>
                                        <div className={cellBox}>
                                            <textarea
                                                value={newDraft.description}
                                                onChange={(event) =>
                                                    setNewDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                                                }
                                                className={cellTextarea}
                                                disabled={newBusy}
                                                placeholder={text('ideas_description')}
                                            />
                                            {newError ? <div className="px-3 pb-3 text-[10px] text-rose-200/90">{newError}</div> : null}
                                        </div>
                                        <div className={cellBox}>
                                            <div className="px-3 py-3 text-xs text-indigo-200/55">{text('ideas_new_spec_after_save')}</div>
                                        </div>
                                        <div className={cellBox}>
                                            <div className="flex h-full items-start px-3 py-3 text-xs text-indigo-100/80">
                                                {text('ideas_status_generated')}
                                            </div>
                                        </div>
                                        <div className={cellBox}>
                                            <div className="px-3 py-3 text-xs text-indigo-200/55">—</div>
                                        </div>
                                        <div className="flex items-center justify-center gap-2 px-2">
                                            <button
                                                type="button"
                                                onClick={() => void onSaveNew()}
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
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/60 hover:border-white/20 hover:text-white disabled:opacity-60"
                                                title={text('ideas_cancel')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {sectionIdeas.length === 0 ? (
                                    <div className="px-4 py-8 text-sm text-indigo-200/55">{text('ideas_empty_group')}</div>
                                ) : null}

                                {sectionIdeas.map((idea) => {
                                    const draft = draftById[idea.id] || {};
                                    const busy = Boolean(rowBusyById[idea.id]);
                                    const saved = Boolean(rowSavedById[idea.id]);
                                    const rowError = rowErrorById[idea.id];
                                    const appliedApps = appliedAppsByIdeaId.get(idea.id) || [];
                                    const resolvedStatus = Object.prototype.hasOwnProperty.call(draft, 'status')
                                        ? ((draft.status || 'generated') as IdeaStatus)
                                        : effectiveStatus(idea, appliedApps.length);
                                    const alternateNames = normalizeNames(
                                        Object.prototype.hasOwnProperty.call(draft, 'alternate_names') ? draft.alternate_names : idea.alternate_names
                                    );

                                    return (
                                        <div key={idea.id} className="grid border-b border-white/5 hover:bg-slate-950/10" style={gridStyle}>
                                            <div className="flex items-start justify-center px-2 py-4 text-[11px] font-semibold text-indigo-100/60">
                                                {ideaIndexById.get(idea.id) ?? '—'}
                                            </div>
                                            <div className={cellBox}>
                                                <select
                                                    value={String(draft.category_id ?? idea.category_id ?? '')}
                                                    onChange={(event) => setDraftField(idea.id, { category_id: event.target.value })}
                                                    disabled={busy}
                                                    className={cellSelect}
                                                >
                                                    <option value="">{text('idea_picker_select_category')}</option>
                                                    {categoryList.map((category) => (
                                                        <option key={category.id} value={category.id}>
                                                            {category.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {rowError ? <div className="px-3 pb-3 text-[10px] text-rose-200/90">{rowError}</div> : null}
                                            </div>
                                            <div className={cellBox}>
                                                <input
                                                    value={String(draft.title ?? idea.title ?? '')}
                                                    onChange={(event) => setDraftField(idea.id, { title: event.target.value })}
                                                    disabled={busy}
                                                    className={cellInput}
                                                />
                                                <div className="px-3 pb-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-indigo-200/60">
                                                            {idea.idea_source || 'manual'}
                                                        </span>
                                                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-indigo-200/60">
                                                            {text('ideas_family_short')} {String(idea.version_index || 1)}
                                                        </span>
                                                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-indigo-200/60">
                                                            {text('ideas_revision_short')} {String(idea.spec_revision_index || 1)}
                                                        </span>
                                                    </div>
                                                    {alternateNames.length ? (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {alternateNames.map((altName) => (
                                                                <button
                                                                    key={altName}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setDraftField(idea.id, {
                                                                            title: altName,
                                                                            alternate_names: [
                                                                                ...normalizeNames(idea.alternate_names).filter(
                                                                                    (name) => name.toLowerCase() !== altName.toLowerCase()
                                                                                ),
                                                                                normalizeInline(idea.title),
                                                                            ],
                                                                        })
                                                                    }
                                                                    className="inline-flex items-center rounded-full border border-indigo-300/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-100/85 hover:border-indigo-200/35"
                                                                >
                                                                    {altName}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 text-[10px] text-indigo-200/40">{text('ideas_no_alternate_names')}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={cellBox}>
                                                <textarea
                                                    value={String(draft.description ?? idea.description ?? '')}
                                                    onChange={(event) => setDraftField(idea.id, { description: event.target.value })}
                                                    disabled={busy}
                                                    className={cellTextarea}
                                                />
                                            </div>
                                            <div className={cellBox}>
                                                <textarea
                                                    value={
                                                        Object.prototype.hasOwnProperty.call(draft, 'client_spec_current')
                                                            ? String(draft.client_spec_current ?? '')
                                                            : normalizeLegacyRenderedSpec(
                                                                  String(idea.client_spec_current ?? idea.description ?? '')
                                                              )
                                                    }
                                                    onChange={(event) => setDraftField(idea.id, { client_spec_current: event.target.value })}
                                                    disabled={busy}
                                                    className={cellTextarea}
                                                />
                                                <div className="px-3 pb-3 text-[10px] text-indigo-200/45">{text('ideas_client_spec_hint')}</div>
                                            </div>
                                            <div className={cellBox}>
                                                <select
                                                    value={resolvedStatus}
                                                    onChange={(event) => setDraftField(idea.id, { status: event.target.value as IdeaStatus })}
                                                    disabled={busy}
                                                    className={cellSelect}
                                                >
                                                    <option value="generated">{text('ideas_status_generated')}</option>
                                                    <option value="used">{text('ideas_status_used')}</option>
                                                    <option value="superseded">{text('ideas_status_superseded')}</option>
                                                    <option value="removed">{text('ideas_status_removed')}</option>
                                                </select>
                                            </div>
                                            <div className={cellBox}>
                                                <div className="px-3 py-3 text-xs text-indigo-100/80">
                                                    {appliedApps.length === 0 ? (
                                                        <span className="text-indigo-200/50">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {appliedApps.map((app) =>
                                                                onOpenApp ? (
                                                                    <button
                                                                        key={app.appId}
                                                                        type="button"
                                                                        onClick={() => onOpenApp(app.appId)}
                                                                        className="rounded-full border border-white/10 bg-slate-950/20 px-2 py-1 text-[11px] text-indigo-100/90 hover:border-indigo-300/35"
                                                                        title={`${app.alias} · ${app.name}`}
                                                                    >
                                                                        {app.name || app.alias}
                                                                    </button>
                                                                ) : (
                                                                    <span
                                                                        key={app.appId}
                                                                        className="rounded-full border border-white/10 bg-slate-950/20 px-2 py-1 text-[11px] text-indigo-100/90"
                                                                    >
                                                                        {app.name || app.alias}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start justify-center gap-2 px-2 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => void onSaveRow(idea)}
                                                    disabled={!isDirty(idea, draft) || busy}
                                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-60 ${
                                                        isDirty(idea, draft)
                                                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15'
                                                            : 'border-white/10 bg-slate-950/20 text-indigo-200/45'
                                                    }`}
                                                    title={text('save')}
                                                >
                                                    {busy ? <Loader2 className="animate-spin" size={14} /> : saved ? <Check size={14} /> : <Save size={14} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        const confirmed = window.confirm(text('ideas_confirm_delete'));
                                                        if (!confirmed) return;
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
                            </div>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
