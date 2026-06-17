import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem } from '../types/zefgen';
import {
    fetchConnectorAppConfig,
    saveConnectorAppConfigSnapshot,
    type ConnectorAppConfig,
    type SaveConnectorAppConfigResponse,
} from '../data/connector-app-config';
import {
    deleteConnectorSecret,
    fetchConnectorSecretMetas,
    upsertConnectorSecret,
    type ConnectorSecretMeta,
} from '../data/connector-secrets';
import {
    computeLegalLinksFingerprint,
    fetchCurrentConnectorLegalLinks,
    fetchLatestSucceededLegalLinksRun,
    invokeGenerateLegalLinks,
    type CurrentConnectorLegalLinks,
    type GenerateLegalLinksResponse,
} from '../data/connector-legal-links';
import {
    generateAppstoreDescription,
    type GenerateAppstoreDescriptionResponse,
} from '../data/appstore-description';
import {
    claimAppstoreReviewWebhookPublicSubdomain,
    ensureAppstoreReviewWebhook,
    fetchAppstoreReviewWebhook,
    updateAppstoreReviewWebhook,
} from '../data/appstore-review-webhooks';
import type { GenerationJobKind } from './use-generation-jobs';
import {
    buildManagedAppstoreReviewPublicPageUrl,
    extractManagedAppstoreReviewPublicSubdomain,
} from '../utils/appstore-review-webhook';

const APP_NAME_MAX_LENGTH = 30;
const APP_NAME_VARIABLE_KEYS = new Set(['appstore_name', 'app_new_name', 'home_screen_name']);
const APPSTORE_INITIAL_SUBTITLE_KEY = 'appstore_initial_subtitle';
const APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY = 'appstore_initial_subtitle_options';
const APPSTORE_INITIAL_KEYWORDS_KEY = 'appstore_initial_keywords';
const APPHUD_VARIABLE_KEY = 'apphud_api_key';
const LEGACY_APPHUD_VARIABLE_KEY = 'apphud_api_url';
const SYSTEM_OWNED_VARIABLE_KEYS = new Set([
    'company_name',
    'privacy_policy_url',
    'terms_of_use_url',
    'support_form_url',
]);
const AUTOSAVE_BASE_DELAY_MS = 900;
const AUTOSAVE_BACKOFF_BASE_MS = 1_000;
const AUTOSAVE_BACKOFF_MAX_MS = 30_000;
const DEFAULT_BASE_BRANCH = 'main';
const BOOTSTRAP_LEGAL_URL_PLACEHOLDER = 'https://google.com';

const clampVariableValue = (key: string, value: any) => {
    if (!APP_NAME_VARIABLE_KEYS.has(String(key || ''))) return value;
    const raw = typeof value === 'string' ? value : String(value ?? '');
    return raw.slice(0, APP_NAME_MAX_LENGTH);
};

const normalizeVariables = (raw: Record<string, any> | null | undefined): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw || {})) {
        if (key === APPHUD_VARIABLE_KEY || key === LEGACY_APPHUD_VARIABLE_KEY || SYSTEM_OWNED_VARIABLE_KEYS.has(key)) continue;
        out[key] = clampVariableValue(key, value);
    }
    const source = raw || {};
    if (
        Object.prototype.hasOwnProperty.call(source, APPHUD_VARIABLE_KEY) ||
        Object.prototype.hasOwnProperty.call(source, LEGACY_APPHUD_VARIABLE_KEY)
    ) {
        out[APPHUD_VARIABLE_KEY] = clampVariableValue(
            APPHUD_VARIABLE_KEY,
            source[APPHUD_VARIABLE_KEY] ?? source[LEGACY_APPHUD_VARIABLE_KEY]
        );
    }
    return out;
};

const hashVariables = (raw: Record<string, any> | null | undefined) => {
    const normalized = normalizeVariables(raw);
    const sortedEntries = Object.keys(normalized)
        .sort()
        .map((key) => [key, normalized[key]]);
    return JSON.stringify(sortedEntries);
};

const normalizeBaseBranch = (value: unknown) => {
    const raw = String(value ?? '').trim();
    return raw || DEFAULT_BASE_BRANCH;
};

const getAppstoreInitialSubtitleOptions = (raw: Record<string, any> | null | undefined) => {
    const source = (raw || {}) as Record<string, any>;
    const value = source[APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY];
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const isUsableLegalUrl = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    if (raw.replace(/\/+$/g, '') === BOOTSTRAP_LEGAL_URL_PLACEHOLDER) return false;
    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

type QueueJobsApi = {
    createJob: (payload: { title: string; kind: GenerationJobKind; progressTotal?: number }) => string;
    setJobProgress: (id: string, progress: { current: number; total: number }) => void;
    setJobMessage: (id: string, message: string | undefined) => void;
    finishJob: (id: string, payload: { status: 'success' | 'error' | 'canceled'; message?: string }) => void;
};

type SavePatchSource = 'manual' | 'autosave' | 'flush';
type SavePatchOptions = {
    source?: SavePatchSource;
    reportError?: boolean;
};

type RefreshOptions = {
    mode?: ConnectorConfigLoadingMode;
    preserveConflict?: boolean;
    forceConfigOverwrite?: boolean;
};

type RequestContext = {
    appId: string;
    appContextVersion: number;
};

export type ConnectorLegalLinksState = {
    id: string | null;
    fingerprint: string | null;
    privacy_policy_url: string;
    terms_of_use_url: string;
    support_form_url: string;
    updated_at: string | null;
    created_at: string | null;
};

type ConnectorEditableSnapshot = {
    projectBrief: string;
    ideaId: string | null;
    baseBranch: string;
    variables: Record<string, any>;
};

type ConnectorSaveConflictState = {
    pendingSnapshot: ConnectorEditableSnapshot;
    serverRow: ConnectorAppConfig | null;
};

type LegalLinksPrecheckResult = {
    requiresConfirm: boolean;
    fingerprint: string | null;
    latestFingerprint: string | null;
};

type RegenerateAppstoreDescriptionOptions = {
    silentOnShortSpec?: boolean;
    persistGenerated?: boolean;
    companyName?: string;
    reportError?: boolean;
    metadataOnly?: boolean;
};

export type ConnectorConfigFormSnapshot = {
    appId: string;
    projectBrief: string;
    ideaId: string | null;
    baseBranch: string;
    variables: Record<string, any>;
    configUpdatedAt: string | null;
    legalLinks: ConnectorLegalLinksState;
    secretMetas: ConnectorSecretMeta[];
    publicWebpageUrl: string;
    publicPagePublishedAt: string | null;
};

export type ConnectorConfigLoadingMode = 'idle' | 'initial' | 'switch' | 'background';
export type ConnectorConfigSaveState = 'idle' | 'saving' | 'saved' | 'dirty' | 'error';

const emptyLegalLinks = (): ConnectorLegalLinksState => ({
    id: null,
    fingerprint: null,
    privacy_policy_url: '',
    terms_of_use_url: '',
    support_form_url: '',
    updated_at: null,
    created_at: null,
});

const toLegalLinksState = (raw: CurrentConnectorLegalLinks | null | undefined): ConnectorLegalLinksState => ({
    id: String(raw?.id || '').trim() || null,
    fingerprint: String(raw?.fingerprint || '').trim() || null,
    privacy_policy_url: String(raw?.privacy_policy_url || '').trim(),
    terms_of_use_url: String(raw?.terms_of_use_url || '').trim(),
    support_form_url: String(raw?.support_form_url || '').trim(),
    updated_at: String(raw?.updated_at || '').trim() || null,
    created_at: String(raw?.created_at || '').trim() || null,
});

const normalizeIdeaId = (value: unknown) => String(value || '').trim() || null;

export const useConnectorConfigForm = (payload: {
    session: Session | null;
    selectedApp: AppItem | null;
    hydrationSnapshot?: ConnectorConfigFormSnapshot | null;
    reportError?: (msg: string) => void;
    queueJobs?: QueueJobsApi;
}) => {
    const { session, selectedApp, reportError, queueJobs } = payload;

    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [secretBusy, setSecretBusy] = React.useState(false);
    const [generateLinksBusy, setGenerateLinksBusy] = React.useState(false);
    const [generateDescriptionBusy, setGenerateDescriptionBusy] = React.useState(false);
    const [publishWebpageBusy, setPublishWebpageBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [lastSaveAt, setLastSaveAt] = React.useState<number | null>(null);
    const [lastSaveError, setLastSaveError] = React.useState<string | null>(null);

    const [projectBrief, setProjectBriefState] = React.useState('');
    const [ideaId, setIdeaIdState] = React.useState<string | null>(null);
    const [baseBranch, setBaseBranchState] = React.useState(DEFAULT_BASE_BRANCH);
    const [variables, setVariablesState] = React.useState<Record<string, any>>({});
    const [configUpdatedAt, setConfigUpdatedAt] = React.useState<string | null>(null);
    const [legalLinks, setLegalLinks] = React.useState<ConnectorLegalLinksState>(() => emptyLegalLinks());
    const [secretMetas, setSecretMetas] = React.useState<any[]>([]);
    const [publicWebpageUrl, setPublicWebpageUrl] = React.useState('');
    const [publicPagePublishedAt, setPublicPagePublishedAt] = React.useState<string | null>(null);
    const [staleConflict, setStaleConflict] = React.useState<ConnectorSaveConflictState | null>(null);
    const autosaveTimerRef = React.useRef<number | null>(null);
    const lastSavedVariablesHashRef = React.useRef<string>('');
    const lastSavedProjectBriefRef = React.useRef<string>('');
    const lastSavedBaseBranchRef = React.useRef(DEFAULT_BASE_BRANCH);
    const autosaveFailureCountRef = React.useRef(0);
    const autosaveBlockedUntilRef = React.useRef(0);
    const pendingLegalLinksConfirmRef = React.useRef<{ appId: string; jobId: string } | null>(null);
    const queueJobsRef = React.useRef(queueJobs);
    const activeAppIdRef = React.useRef<string>('');
    const appContextVersionRef = React.useRef(0);
    const projectBriefRef = React.useRef('');
    const ideaIdRef = React.useRef<string | null>(null);
    const baseBranchRef = React.useRef(DEFAULT_BASE_BRANCH);
    const variablesRef = React.useRef<Record<string, any>>({});
    const isDirtyRef = React.useRef(false);
    const hydrationSnapshotRef = React.useRef<ConnectorConfigFormSnapshot | null>(payload.hydrationSnapshot ?? null);
    const legalLinksRef = React.useRef<ConnectorLegalLinksState>(emptyLegalLinks());
    const configUpdatedAtRef = React.useRef<string | null>(null);
    const staleConflictRef = React.useRef<ConnectorSaveConflictState | null>(null);

    const setProjectBrief = React.useCallback((next: React.SetStateAction<string>) => {
        setProjectBriefState((prev) => {
            const resolved = String(typeof next === 'function' ? next(prev) : next ?? '');
            projectBriefRef.current = resolved;
            return resolved;
        });
    }, []);

    const setIdeaId = React.useCallback((next: React.SetStateAction<string | null>) => {
        setIdeaIdState((prev) => {
            const resolved = normalizeIdeaId(typeof next === 'function' ? next(prev) : next);
            ideaIdRef.current = resolved;
            return resolved;
        });
    }, []);

    const setVariables = React.useCallback((next: React.SetStateAction<Record<string, any>>) => {
        setVariablesState((prev) => {
            const resolved = normalizeVariables(typeof next === 'function' ? next(prev) : next);
            variablesRef.current = resolved;
            return resolved;
        });
    }, []);

    React.useEffect(() => {
        queueJobsRef.current = queueJobs;
    }, [queueJobs]);

    React.useEffect(() => {
        hydrationSnapshotRef.current = payload.hydrationSnapshot ?? null;
    }, [payload.hydrationSnapshot]);

    React.useEffect(() => {
        projectBriefRef.current = String(projectBrief || '');
    }, [projectBrief]);

    React.useEffect(() => {
        ideaIdRef.current = normalizeIdeaId(ideaId);
    }, [ideaId]);

    React.useEffect(() => {
        baseBranchRef.current = normalizeBaseBranch(baseBranch);
    }, [baseBranch]);

    React.useEffect(() => {
        variablesRef.current = normalizeVariables(variables);
    }, [variables]);

    React.useEffect(() => {
        legalLinksRef.current = legalLinks;
    }, [legalLinks]);

    React.useEffect(() => {
        configUpdatedAtRef.current = configUpdatedAt;
    }, [configUpdatedAt]);

    React.useEffect(() => {
        staleConflictRef.current = staleConflict;
    }, [staleConflict]);

    const getRequestContext = React.useCallback((): RequestContext => {
        return {
            appId: activeAppIdRef.current,
            appContextVersion: appContextVersionRef.current,
        };
    }, []);

    const isCurrentRequestContext = React.useCallback((ctx: RequestContext) => {
        return (
            Boolean(ctx.appId) &&
            ctx.appId === activeAppIdRef.current &&
            ctx.appContextVersion === appContextVersionRef.current
        );
    }, []);

    const applyWebhookPageState = React.useCallback((webhook: any) => {
        const resolvedSubdomain =
            String(webhook?.public_subdomain || '').trim() ||
            extractManagedAppstoreReviewPublicSubdomain(webhook?.public_webhook_url);
        setPublicWebpageUrl(
            resolvedSubdomain
                ? buildManagedAppstoreReviewPublicPageUrl({
                      publicSubdomain: resolvedSubdomain,
                  })
                : ''
        );
        setPublicPagePublishedAt(String(webhook?.public_page_published_at || '').trim() || null);
    }, []);

    const clearAutosaveTimer = React.useCallback(() => {
        if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
    }, []);

    const resetAutosaveBackoff = React.useCallback(() => {
        autosaveFailureCountRef.current = 0;
        autosaveBlockedUntilRef.current = 0;
    }, []);

    const registerAutosaveFailure = React.useCallback(() => {
        autosaveFailureCountRef.current += 1;
        const exp = Math.max(0, autosaveFailureCountRef.current - 1);
        const backoffMs = Math.min(AUTOSAVE_BACKOFF_MAX_MS, AUTOSAVE_BACKOFF_BASE_MS * 2 ** exp);
        autosaveBlockedUntilRef.current = Date.now() + backoffMs;
    }, []);

    const buildSnapshot = React.useCallback(
        (appId: string): ConnectorConfigFormSnapshot => ({
            appId,
            projectBrief: String(projectBrief || ''),
            ideaId: String(ideaId || '').trim() || null,
            baseBranch: normalizeBaseBranch(baseBranch),
            variables: normalizeVariables(variablesRef.current),
            configUpdatedAt: String(configUpdatedAtRef.current || '').trim() || null,
            legalLinks: { ...legalLinksRef.current },
            secretMetas: Array.isArray(secretMetas) ? [...secretMetas] : [],
            publicWebpageUrl: String(publicWebpageUrl || ''),
            publicPagePublishedAt: String(publicPagePublishedAt || '').trim() || null,
        }),
        [baseBranch, ideaId, projectBrief, publicPagePublishedAt, publicWebpageUrl, secretMetas]
    );

    const applySnapshot = React.useCallback(
        (snapshot: ConnectorConfigFormSnapshot | null | undefined, mode: Exclude<ConnectorConfigLoadingMode, 'idle'> = 'switch') => {
            const activeAppId = String(activeAppIdRef.current || '').trim();
            if (!activeAppId) return;
            const safeSnapshot =
                snapshot && String(snapshot.appId || '').trim() === activeAppId
                    ? snapshot
                    : {
                          appId: activeAppId,
                          projectBrief: '',
                          ideaId: null,
                          baseBranch: DEFAULT_BASE_BRANCH,
                          variables: {},
                          configUpdatedAt: null,
                          legalLinks: emptyLegalLinks(),
                          secretMetas: [],
                          publicWebpageUrl: '',
                          publicPagePublishedAt: null,
                      };

            const normalizedBrief = String(safeSnapshot.projectBrief || '');
            const normalizedIdeaId = String(safeSnapshot.ideaId || '').trim() || null;
            const normalizedBaseBranch = normalizeBaseBranch(safeSnapshot.baseBranch);
            const normalizedVariables = normalizeVariables(safeSnapshot.variables || {});

            setProjectBrief(normalizedBrief);
            setIdeaId(normalizedIdeaId);
            setBaseBranchState(normalizedBaseBranch);
            setVariables(normalizedVariables);
            setConfigUpdatedAt(String(safeSnapshot.configUpdatedAt || '').trim() || null);
            setLegalLinks(toLegalLinksState(safeSnapshot.legalLinks));
            setSecretMetas(Array.isArray(safeSnapshot.secretMetas) ? [...safeSnapshot.secretMetas] : []);
            setPublicWebpageUrl(String(safeSnapshot.publicWebpageUrl || ''));
            setPublicPagePublishedAt(String(safeSnapshot.publicPagePublishedAt || '').trim() || null);
            lastSavedProjectBriefRef.current = normalizedBrief;
            lastSavedBaseBranchRef.current = normalizedBaseBranch;
            lastSavedVariablesHashRef.current = hashVariables(normalizedVariables);
            isDirtyRef.current = false;
            resetAutosaveBackoff();
            setStaleConflict(null);
            setLastSaveAt(safeSnapshot.configUpdatedAt ? Date.now() : null);
            setLastSaveError(null);
            setLoading(false);
        },
        [resetAutosaveBackoff, setVariables]
    );

    React.useLayoutEffect(() => {
        const pending = pendingLegalLinksConfirmRef.current;
        if (pending) {
            queueJobsRef.current?.finishJob(pending.jobId, {
                status: 'canceled',
                message: 'Canceled (switched app)',
            });
            pendingLegalLinksConfirmRef.current = null;
        }
        activeAppIdRef.current = String(selectedApp?.id || '');
        appContextVersionRef.current += 1;
        clearAutosaveTimer();
        resetAutosaveBackoff();
        setLoading(Boolean(selectedApp?.id));
        setSaving(false);
        setSecretBusy(false);
        setGenerateLinksBusy(false);
        setGenerateDescriptionBusy(false);
        setPublishWebpageBusy(false);
        setError(null);
        setStaleConflict(null);
        if (!selectedApp?.id) {
            setProjectBrief('');
            setIdeaId(null);
            setBaseBranchState(DEFAULT_BASE_BRANCH);
            setVariables({});
            setConfigUpdatedAt(null);
            setLegalLinks(emptyLegalLinks());
            setSecretMetas([]);
            setPublicWebpageUrl('');
            setPublicPagePublishedAt(null);
            lastSavedVariablesHashRef.current = hashVariables({});
            lastSavedProjectBriefRef.current = '';
            lastSavedBaseBranchRef.current = DEFAULT_BASE_BRANCH;
            isDirtyRef.current = false;
            setLastSaveAt(null);
            setLastSaveError(null);
            setLoading(false);
            return;
        }

        const matchingHydrationSnapshot =
            hydrationSnapshotRef.current &&
            String(hydrationSnapshotRef.current.appId || '') === String(selectedApp?.id || '')
                ? hydrationSnapshotRef.current
                : null;
        if (matchingHydrationSnapshot) {
            applySnapshot(matchingHydrationSnapshot, 'switch');
            return;
        }

        setProjectBrief('');
        setIdeaId(null);
        setBaseBranchState(DEFAULT_BASE_BRANCH);
        setVariables({});
        setConfigUpdatedAt(null);
        setLegalLinks(emptyLegalLinks());
        setSecretMetas([]);
        setPublicWebpageUrl('');
        setPublicPagePublishedAt(null);
        lastSavedVariablesHashRef.current = hashVariables({});
        lastSavedProjectBriefRef.current = '';
        lastSavedBaseBranchRef.current = DEFAULT_BASE_BRANCH;
        setLoading(true);
    }, [
        applySnapshot,
        clearAutosaveTimer,
        resetAutosaveBackoff,
        selectedApp?.id,
        session?.user?.id,
    ]);

    const refresh = React.useCallback(async (options?: RefreshOptions) => {
        if (!session || !selectedApp) return;
        const requestContext = getRequestContext();
        if (!isCurrentRequestContext(requestContext)) return;
        const mode = options?.mode ?? 'initial';
        const isBackground = mode === 'background';
        const preserveConflict = options?.preserveConflict === true && Boolean(staleConflictRef.current);
        if (!isBackground) {
            setLoading(true);
            setError(null);
        }
        try {
            const cfg = await fetchConnectorAppConfig({ userId: session.user.id, appId: selectedApp.id });
            if (cfg.error) throw cfg.error;
            if (!isCurrentRequestContext(requestContext)) return;

            const allowConfigOverwrite =
                options?.forceConfigOverwrite === true || (!preserveConflict && !isDirtyRef.current);
            if (cfg.data) {
                if (allowConfigOverwrite) {
                    const normalizedBrief = String((cfg.data as any).project_brief || '');
                    setProjectBrief(normalizedBrief);
                    lastSavedProjectBriefRef.current = normalizedBrief;
                    setIdeaId(String((cfg.data as any).idea_id || '').trim() || null);
                    const normalizedBaseBranch = normalizeBaseBranch((cfg.data as any).base_branch);
                    setBaseBranchState(normalizedBaseBranch);
                    lastSavedBaseBranchRef.current = normalizedBaseBranch;
                    const normalizedVars = normalizeVariables((cfg.data as any).variables || {});
                    setVariables(normalizedVars);
                    lastSavedVariablesHashRef.current = hashVariables(normalizedVars);
                    setConfigUpdatedAt(String((cfg.data as any).updated_at || '').trim() || null);
                    resetAutosaveBackoff();
                }
            } else if (allowConfigOverwrite) {
                // Missing config should remain a read-only empty state until the user explicitly saves.
                setProjectBrief('');
                lastSavedProjectBriefRef.current = '';
                setIdeaId(null);
                setBaseBranchState(DEFAULT_BASE_BRANCH);
                lastSavedBaseBranchRef.current = DEFAULT_BASE_BRANCH;
                setVariables({});
                lastSavedVariablesHashRef.current = hashVariables({});
                setConfigUpdatedAt(null);
                resetAutosaveBackoff();
            }

            if (!isBackground) {
                setLoading(false);
            }

            const [secrets, webhook, currentLegalLinks] = await Promise.all([
                fetchConnectorSecretMetas({ userId: session.user.id, appId: selectedApp.id }),
                fetchAppstoreReviewWebhook({ userId: session.user.id, appId: selectedApp.id }),
                fetchCurrentConnectorLegalLinks({ appId: selectedApp.id }),
            ]);
            if (secrets.error) throw secrets.error;
            if (webhook.error) throw webhook.error;
            if (currentLegalLinks.error) throw currentLegalLinks.error;
            if (!isCurrentRequestContext(requestContext)) return;
            setSecretMetas(secrets.data || []);
            applyWebhookPageState(webhook.data || null);
            setLegalLinks(toLegalLinksState((currentLegalLinks.data as CurrentConnectorLegalLinks | null) || null));
            if (!preserveConflict) {
                setStaleConflict(null);
                setLastSaveAt(cfg.data ? Date.now() : null);
                setLastSaveError(null);
            }
        } catch (e: any) {
            if (!isCurrentRequestContext(requestContext)) return;
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            if (isCurrentRequestContext(requestContext)) {
                setLoading(false);
            }
        }
    }, [
        getRequestContext,
        isCurrentRequestContext,
        applyWebhookPageState,
        reportError,
        resetAutosaveBackoff,
        selectedApp,
        session,
    ]);

    React.useEffect(() => {
        const hasHydrationSnapshot =
            Boolean(hydrationSnapshotRef.current) &&
            String(hydrationSnapshotRef.current?.appId || '') === String(selectedApp?.id || '');
        void refresh({
            mode: hasHydrationSnapshot ? 'background' : 'initial',
        });
    }, [refresh, selectedApp?.id]);

    const buildEditableSnapshot = React.useCallback(
        (patch?: { project_brief?: string; idea_id?: string | null; base_branch?: string; variables?: Record<string, any> }): ConnectorEditableSnapshot => {
            const nextProjectBrief = Object.prototype.hasOwnProperty.call(patch || {}, 'project_brief')
                ? String(patch?.project_brief ?? '')
                : String(projectBrief || '');
            const nextIdeaId = Object.prototype.hasOwnProperty.call(patch || {}, 'idea_id')
                ? (String(patch?.idea_id || '').trim() || null)
                : (String(ideaId || '').trim() || null);
            const nextBaseBranch = Object.prototype.hasOwnProperty.call(patch || {}, 'base_branch')
                ? normalizeBaseBranch(patch?.base_branch)
                : normalizeBaseBranch(baseBranch);
            const nextVariables = Object.prototype.hasOwnProperty.call(patch || {}, 'variables')
                ? normalizeVariables(patch?.variables || {})
                : normalizeVariables(variablesRef.current);
            return {
                projectBrief: nextProjectBrief,
                ideaId: nextIdeaId,
                baseBranch: nextBaseBranch,
                variables: nextVariables,
            };
        },
        [baseBranch, ideaId, projectBrief]
    );

    const applySavedConfigRow = React.useCallback(
        (
            row: ConnectorAppConfig | null | undefined,
            options?: {
                pendingSnapshot?: ConnectorEditableSnapshot;
            }
        ) => {
            if (!row) return;
            const normalizedBrief = String((row as any).project_brief || '');
            const normalizedIdeaId = normalizeIdeaId((row as any).idea_id);
            const normalizedBaseBranch = normalizeBaseBranch((row as any).base_branch);
            const normalizedVars = normalizeVariables((row as any).variables || {});
            const pendingSnapshot = options?.pendingSnapshot;
            const pendingBrief = pendingSnapshot ? String(pendingSnapshot.projectBrief || '') : normalizedBrief;
            const pendingIdeaId = pendingSnapshot ? normalizeIdeaId(pendingSnapshot.ideaId) : normalizedIdeaId;
            const pendingBaseBranch = pendingSnapshot
                ? normalizeBaseBranch(pendingSnapshot.baseBranch)
                : normalizedBaseBranch;
            const pendingVars = pendingSnapshot ? normalizeVariables(pendingSnapshot.variables || {}) : normalizedVars;

            if (String(projectBriefRef.current || '') === pendingBrief) {
                setProjectBrief(normalizedBrief);
            }
            if (normalizeIdeaId(ideaIdRef.current) === pendingIdeaId) {
                setIdeaId(normalizedIdeaId);
            }
            if (normalizeBaseBranch(baseBranchRef.current) === pendingBaseBranch) {
                setBaseBranchState(normalizedBaseBranch);
                baseBranchRef.current = normalizedBaseBranch;
            }
            if (hashVariables(variablesRef.current) === hashVariables(pendingVars)) {
                setVariables(normalizedVars);
            }
            setConfigUpdatedAt(String((row as any).updated_at || '').trim() || null);
            lastSavedProjectBriefRef.current = normalizedBrief;
            lastSavedBaseBranchRef.current = normalizedBaseBranch;
            lastSavedVariablesHashRef.current = hashVariables(normalizedVars);
        },
        [setIdeaId, setProjectBrief, setVariables]
    );

    const savePatch = React.useCallback(
        async (
            patch: { project_brief?: string; idea_id?: string | null; base_branch?: string; variables?: Record<string, any> },
            options?: SavePatchOptions & { forceOverwrite?: boolean; pendingSnapshot?: ConnectorEditableSnapshot }
        ) => {
            if (!session || !selectedApp) return false;
            const source = options?.source || 'manual';
            const shouldReport = options?.reportError !== false;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return false;

            setSaving(true);
            setLastSaveError(null);
            if (source !== 'autosave') {
                setError(null);
            }

            try {
                const nextSnapshot = options?.pendingSnapshot ?? buildEditableSnapshot(patch);
                const resp = await saveConnectorAppConfigSnapshot({
                    appId: selectedApp.id,
                    expectedUpdatedAt: configUpdatedAtRef.current,
                    projectBrief: nextSnapshot.projectBrief,
                    ideaId: nextSnapshot.ideaId,
                    baseBranch: nextSnapshot.baseBranch,
                    variables: nextSnapshot.variables,
                    forceOverwrite: options?.forceOverwrite === true,
                });
                if (resp.error) throw resp.error;
                if (!isCurrentRequestContext(requestContext)) return false;

                const data = (resp.data as SaveConnectorAppConfigResponse | null) || null;
                if (!data) {
                    throw new Error('Missing response from connector_save_app_config.');
                }
                if (data.status === 'conflict') {
                    const conflictState: ConnectorSaveConflictState = {
                        pendingSnapshot: nextSnapshot,
                        serverRow: data.row || null,
                    };
                    setStaleConflict(conflictState);
                    const conflictMessage = 'This setup was updated elsewhere. Refresh or overwrite to continue.';
                    if (source === 'autosave') {
                        autosaveBlockedUntilRef.current = Number.MAX_SAFE_INTEGER;
                    }
                    setLastSaveError(conflictMessage);
                    if (shouldReport && source !== 'autosave') {
                        setError(conflictMessage);
                        reportError?.(conflictMessage);
                    }
                    return false;
                }

                applySavedConfigRow(data.row || null, {
                    pendingSnapshot: nextSnapshot,
                });
                setStaleConflict(null);

                resetAutosaveBackoff();
                setLastSaveAt(Date.now());
                setLastSaveError(null);
                return true;
            } catch (e: any) {
                const msg = String(e?.message || e);
                if (source === 'autosave') {
                    registerAutosaveFailure();
                }
                if (isCurrentRequestContext(requestContext)) {
                    setLastSaveError(msg);
                }
                if (isCurrentRequestContext(requestContext) && shouldReport) {
                    setError(msg);
                    reportError?.(msg);
                }
                return false;
            } finally {
                if (isCurrentRequestContext(requestContext)) {
                    setSaving(false);
                }
            }
        },
        [
            applySavedConfigRow,
            buildEditableSnapshot,
            getRequestContext,
            isCurrentRequestContext,
            registerAutosaveFailure,
            reportError,
            resetAutosaveBackoff,
            selectedApp,
            session,
        ]
    );

    React.useEffect(() => {
        return () => {
            clearAutosaveTimer();
        };
    }, [clearAutosaveTimer]);

    const isDirty = React.useMemo(() => {
        const normalizedVars = normalizeVariables(variables);
        const currentHash = hashVariables(normalizedVars);
        const currentProjectBrief = String(projectBrief || '');
        const currentBaseBranch = normalizeBaseBranch(baseBranch);
        return (
            currentHash !== lastSavedVariablesHashRef.current ||
            currentProjectBrief !== lastSavedProjectBriefRef.current ||
            currentBaseBranch !== lastSavedBaseBranchRef.current
        );
    }, [baseBranch, projectBrief, variables]);

    const isProjectBriefDirty = React.useMemo(() => {
        const currentProjectBrief = String(projectBrief || '');
        return currentProjectBrief !== lastSavedProjectBriefRef.current;
    }, [projectBrief]);

    React.useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    const saveState = React.useMemo<ConnectorConfigSaveState>(() => {
        if (!selectedApp?.id) return 'idle';
        if (saving) return 'saving';
        if (staleConflict) return 'error';
        if (lastSaveError && isDirty) return 'error';
        if (isDirty) return 'dirty';
        if (configUpdatedAt && lastSaveAt) return 'saved';
        return 'idle';
    }, [configUpdatedAt, isDirty, lastSaveAt, lastSaveError, saving, selectedApp?.id, staleConflict]);

    React.useEffect(() => {
        if (!session || !selectedApp) return;
        if (loading || saving || secretBusy || generateLinksBusy || generateDescriptionBusy || publishWebpageBusy || staleConflictRef.current)
            return;

        const normalizedVars = normalizeVariables(variables);
        const currentHash = hashVariables(normalizedVars);
        const currentProjectBrief = String(projectBrief || '');
        const currentBaseBranch = normalizeBaseBranch(baseBranch);
        const variablesChanged = currentHash !== lastSavedVariablesHashRef.current;
        const projectBriefChanged = currentProjectBrief !== lastSavedProjectBriefRef.current;
        const baseBranchChanged = currentBaseBranch !== lastSavedBaseBranchRef.current;
        if (!variablesChanged && !projectBriefChanged && !baseBranchChanged) return;

        clearAutosaveTimer();

        const now = Date.now();
        const blockedMs = Math.max(0, autosaveBlockedUntilRef.current - now);
        const delayMs = Math.max(AUTOSAVE_BASE_DELAY_MS, blockedMs);
        autosaveTimerRef.current = window.setTimeout(() => {
            const autosavePatch: { project_brief?: string; base_branch?: string; variables?: Record<string, any> } = {};
            if (variablesChanged) autosavePatch.variables = normalizedVars;
            if (projectBriefChanged) autosavePatch.project_brief = currentProjectBrief;
            if (baseBranchChanged) autosavePatch.base_branch = currentBaseBranch;
            void savePatch(
                autosavePatch,
                {
                    source: 'autosave',
                }
            );
        }, delayMs);

        return () => {
            clearAutosaveTimer();
        };
    }, [
        clearAutosaveTimer,
        generateLinksBusy,
        generateDescriptionBusy,
        publishWebpageBusy,
        loading,
        savePatch,
        saving,
        secretBusy,
        staleConflict,
        selectedApp?.id,
        session?.user?.id,
        baseBranch,
        projectBrief,
        variables,
    ]);

    const setVariable = React.useCallback((k: string, v: any) => {
        setVariables((prev) => ({ ...prev, [k]: clampVariableValue(k, v) }));
    }, []);

    const setBaseBranch = React.useCallback((value: string) => {
        baseBranchRef.current = normalizeBaseBranch(value);
        setBaseBranchState(String(value ?? ''));
    }, []);

    const saveMergedVariablesPatch = React.useCallback(
        async (partialVariables: Record<string, any>, options?: SavePatchOptions) => {
            const nextVariables = normalizeVariables({
                ...variablesRef.current,
                ...(partialVariables || {}),
            });
            setVariables(nextVariables);
            return savePatch({ variables: nextVariables }, options);
        },
        [savePatch, setVariables]
    );

    const precheckLegalLinksRegeneration = React.useCallback(
        async (payload: { companyName: string; appStoreName: string; accountEmail: string }): Promise<LegalLinksPrecheckResult | null> => {
            if (!session || !selectedApp) return null;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return null;

            const companyName = String(payload.companyName || '').trim();
            const appStoreName = String(payload.appStoreName || '').trim();
            const accountEmail = String(payload.accountEmail || '').trim();
            if (!companyName || !appStoreName || !accountEmail) {
                return {
                    requiresConfirm: false,
                    fingerprint: null,
                    latestFingerprint: null,
                };
            }

            try {
                const fingerprint = await computeLegalLinksFingerprint({
                    companyName,
                    appStoreName,
                    accountEmail,
                });
                if (!isCurrentRequestContext(requestContext)) return null;

                const latest = await fetchLatestSucceededLegalLinksRun({
                    userId: session.user.id,
                    appId: selectedApp.id,
                });
                if (latest.error) throw latest.error;
                if (!isCurrentRequestContext(requestContext)) return null;

                const latestFingerprint = String((latest.data as any)?.fingerprint || '').trim();
                return {
                    requiresConfirm: Boolean(latestFingerprint && latestFingerprint === fingerprint),
                    fingerprint,
                    latestFingerprint: latestFingerprint || null,
                };
            } catch (e: any) {
                if (!isCurrentRequestContext(requestContext)) return null;
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
                return null;
            }
        },
        [getRequestContext, isCurrentRequestContext, reportError, selectedApp, session]
    );

    const regenerateAppstoreDescription = React.useCallback(
        async (
            options?: RegenerateAppstoreDescriptionOptions
        ): Promise<GenerateAppstoreDescriptionResponse | null> => {
            if (!session || !selectedApp) return null;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return null;
            const shouldReportError = options?.reportError !== false;

            setGenerateDescriptionBusy(true);
            if (shouldReportError) {
                setError(null);
            }
            try {
                const currentVariables = normalizeVariables(variablesRef.current);
                const existingDescription = String(currentVariables.appstore_description || '').trim();
                const existingInitialSubtitle = String(currentVariables[APPSTORE_INITIAL_SUBTITLE_KEY] || '').trim();
                const existingInitialSubtitleOptions = getAppstoreInitialSubtitleOptions(currentVariables);
                const existingInitialKeywords = String(currentVariables[APPSTORE_INITIAL_KEYWORDS_KEY] || '').trim();
                const shouldGenerateDescription = options?.metadataOnly !== true;
                const shouldGenerateSubtitleOptions = !existingInitialSubtitle && existingInitialSubtitleOptions.length === 0;
                const shouldGenerateKeywords = !existingInitialKeywords;

                if (!shouldGenerateDescription && !existingDescription) {
                    const msg = 'App Store description is required before retrying subtitle or keywords.';
                    if (shouldReportError) {
                        setError(msg);
                        reportError?.(msg);
                    }
                    return {
                        status: 'error',
                        error: msg,
                    };
                }

                if (!shouldGenerateDescription && !shouldGenerateSubtitleOptions && !shouldGenerateKeywords) {
                    return {
                        status: 'generated',
                        text: existingDescription,
                        subtitleOptions: [],
                        keywords: '',
                        promptKey: 'metadata_only',
                        model: '',
                        descriptionStatus: 'reused',
                        metadataStatus: 'skipped',
                        metadataError: null,
                    };
                }

                const response = await generateAppstoreDescription({
                    clientSpec: String(projectBrief || '').trim(),
                    appStoreName: String(currentVariables?.appstore_name || '').trim(),
                    companyName: String(options?.companyName || '').trim(),
                    generateDescription: shouldGenerateDescription,
                    existingDescription: shouldGenerateDescription ? undefined : existingDescription,
                    generateSubtitleOptions: shouldGenerateSubtitleOptions,
                    generateKeywords: shouldGenerateKeywords,
                    accessTokenHint: String(session.access_token || ''),
                });
                if (!isCurrentRequestContext(requestContext)) return response;

                if (response.status === 'generated') {
                    const shouldPersistGenerated = options?.persistGenerated !== false;
                    if (shouldPersistGenerated) {
                        const currentVariables = normalizeVariables(variablesRef.current);
                        const generatedText = String(response.text || '').trim();
                        const generatedKeywords = String(response.keywords || '').trim();
                        const generatedSubtitleOptions = Array.isArray(response.subtitleOptions)
                            ? response.subtitleOptions.map((item) => String(item || '').trim()).filter(Boolean)
                            : [];
                        const nextVariablesPatch: Record<string, any> = {};

                        if (response.descriptionStatus === 'generated' && generatedText) {
                            nextVariablesPatch.appstore_description = generatedText;
                        }

                        if (response.metadataStatus === 'generated') {
                            const existingInitialKeywords = String(
                                currentVariables[APPSTORE_INITIAL_KEYWORDS_KEY] || ''
                            ).trim();
                            if (!existingInitialKeywords && generatedKeywords) {
                                nextVariablesPatch[APPSTORE_INITIAL_KEYWORDS_KEY] = generatedKeywords;
                            }

                            const existingInitialSubtitle = String(
                                currentVariables[APPSTORE_INITIAL_SUBTITLE_KEY] || ''
                            ).trim();
                            const existingInitialSubtitleOptions = getAppstoreInitialSubtitleOptions(currentVariables);
                            if (
                                !existingInitialSubtitle &&
                                existingInitialSubtitleOptions.length === 0 &&
                                generatedSubtitleOptions.length > 0
                            ) {
                                nextVariablesPatch[APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY] = generatedSubtitleOptions;
                            }
                        }

                        if (Object.keys(nextVariablesPatch).length > 0) {
                            const saved = await saveMergedVariablesPatch(nextVariablesPatch, {
                                source: 'manual',
                                reportError: false,
                            });
                            if (!saved) {
                                throw new Error('Failed to save generated App Store description.');
                            }
                        }
                    }
                } else if (response.status === 'skipped_short_spec') {
                    if (!options?.silentOnShortSpec) {
                        const msg =
                            String(response.reason || '').trim() ||
                            'Client spec is too short to generate App Store description.';
                        if (shouldReportError) {
                            setError(msg);
                            reportError?.(msg);
                        }
                    }
                } else {
                    const msg = String(response.error || '').trim() || 'Failed to generate App Store description.';
                    if (shouldReportError) {
                        setError(msg);
                        reportError?.(msg);
                    }
                }
                return response;
            } catch (e: any) {
                if (!isCurrentRequestContext(requestContext)) return null;
                const msg = String(e?.message || e);
                if (shouldReportError) {
                    setError(msg);
                    reportError?.(msg);
                }
                return {
                    status: 'error',
                    error: msg,
                };
            } finally {
                if (isCurrentRequestContext(requestContext)) {
                    setGenerateDescriptionBusy(false);
                }
            }
        },
        [
            getRequestContext,
            isCurrentRequestContext,
            projectBrief,
            reportError,
            savePatch,
            selectedApp,
            session,
            saveMergedVariablesPatch,
        ]
    );

    const generateLegalLinks = React.useCallback(
        async (confirmRegenerate?: boolean): Promise<GenerateLegalLinksResponse | null> => {
            if (!session || !selectedApp) return null;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return null;

            const pendingConfirmJob = pendingLegalLinksConfirmRef.current;
            const hasPendingConfirmJob = Boolean(
                pendingConfirmJob && pendingConfirmJob.appId === selectedApp.id && pendingConfirmJob.jobId
            );
            const appLabel =
                String(selectedApp.alias || '').trim() ||
                String(selectedApp.name || '').trim() ||
                String(selectedApp.id || '').trim().slice(0, 8);
            const queueJobId =
                hasPendingConfirmJob && pendingConfirmJob
                    ? pendingConfirmJob.jobId
                    : queueJobs?.createJob({
                          title: `Legal links: ${appLabel}`,
                          kind: 'connector_generate',
                          progressTotal: 4,
                      });

            if (queueJobId && !hasPendingConfirmJob) {
                queueJobs?.setJobMessage(queueJobId, 'Preparing…');
                queueJobs?.setJobProgress(queueJobId, { current: 1, total: 4 });
            }

            setGenerateLinksBusy(true);
            setError(null);
            try {
                const normalizedVars = normalizeVariables(variables);
                const currentHash = hashVariables(normalizedVars);
                if (currentHash !== lastSavedVariablesHashRef.current) {
                    if (queueJobId) {
                        queueJobs?.setJobMessage(queueJobId, 'Saving setup data…');
                        queueJobs?.setJobProgress(queueJobId, { current: 1, total: 4 });
                    }
                    const flushed = await savePatch(
                        { variables: normalizedVars },
                        { source: 'flush', reportError: false }
                    );
                    if (!flushed) {
                        throw new Error('Failed to save setup data before generating legal links.');
                    }
                } else if (queueJobId) {
                    queueJobs?.setJobMessage(queueJobId, 'Preparing…');
                    queueJobs?.setJobProgress(queueJobId, {
                        current: hasPendingConfirmJob ? 2 : 1,
                        total: 4,
                    });
                }

                if (queueJobId) {
                    queueJobs?.setJobMessage(
                        queueJobId,
                        confirmRegenerate ? 'Regenerating legal links…' : 'Generating legal links…'
                    );
                    queueJobs?.setJobProgress(queueJobId, { current: 2, total: 4 });
                }

                const resp = await invokeGenerateLegalLinks({
                    appId: selectedApp.id,
                    confirmRegenerate: confirmRegenerate === true,
                    // Keep hint from current UI session to survive edge cases where
                    // getSession() is temporarily stale during token rotation.
                    accessTokenHint: String(session.access_token || ''),
                });
                if (resp.error) {
                    let detailed = '';
                    const context = (resp.error as any)?.context;
                    if (context && typeof (context as any).json === 'function') {
                        try {
                            const body = await (context as any).json();
                            detailed = String(body?.error || body?.message || '').trim();
                        } catch {
                            // ignore JSON parse errors
                        }
                    }
                    if (!detailed && context && typeof (context as any).text === 'function') {
                        try {
                            const textBody = String(await (context as any).text());
                            detailed = textBody.trim();
                        } catch {
                            // ignore text parse errors
                        }
                    }
                    const statusCode =
                        context && typeof (context as any).status === 'number'
                            ? ` (HTTP ${(context as any).status})`
                            : '';
                    throw new Error(detailed || `${String(resp.error.message || 'Function request failed.')}${statusCode}`);
                }
                const data = resp.data as GenerateLegalLinksResponse | null;
                if (!data || (data.status !== 'generated' && data.status !== 'confirm_required')) {
                    throw new Error('Unexpected response from generate-legal-links.');
                }
                if (!isCurrentRequestContext(requestContext)) {
                    if (queueJobId) {
                        queueJobs?.setJobProgress(queueJobId, {
                            current: data.status === 'generated' ? 4 : 3,
                            total: 4,
                        });
                        queueJobs?.finishJob(queueJobId, {
                            status: 'success',
                            message: data.status === 'generated' ? 'Done (switched app)' : 'Waiting for confirmation',
                        });
                    }
                    if (pendingLegalLinksConfirmRef.current?.jobId === queueJobId) {
                        pendingLegalLinksConfirmRef.current = null;
                    }
                    return data;
                }

                if (data.status === 'generated') {
                    if (queueJobId) {
                        queueJobs?.setJobMessage(queueJobId, 'Saving generated links…');
                        queueJobs?.setJobProgress(queueJobId, { current: 3, total: 4 });
                    }
                    await refresh({ mode: 'background', preserveConflict: true });
                    if (isCurrentRequestContext(requestContext)) {
                        // Apply the function response locally as the immediate source of truth.
                        // This keeps the UI stable even if the follow-up refresh lags behind.
                        setLegalLinks((prev) =>
                            toLegalLinksState({
                                id: String(data.runId || prev.id || '').trim(),
                                fingerprint: String(data.fingerprint || prev.fingerprint || '').trim(),
                                privacy_policy_url: String(data.urls?.privacy_policy_url || '').trim(),
                                terms_of_use_url: String(data.urls?.terms_of_use_url || '').trim(),
                                support_form_url: String(data.urls?.support_form_url || '').trim(),
                                updated_at: new Date().toISOString(),
                                created_at: prev.created_at,
                            })
                        );
                    }
                    if (queueJobId) {
                        queueJobs?.setJobProgress(queueJobId, { current: 4, total: 4 });
                        queueJobs?.finishJob(queueJobId, { status: 'success', message: 'Done' });
                    }
                    if (pendingLegalLinksConfirmRef.current?.jobId === queueJobId) {
                        pendingLegalLinksConfirmRef.current = null;
                    }
                } else if (queueJobId) {
                    queueJobs?.setJobProgress(queueJobId, { current: 3, total: 4 });
                    queueJobs?.setJobMessage(queueJobId, 'Waiting for confirmation');
                    pendingLegalLinksConfirmRef.current = {
                        appId: selectedApp.id,
                        jobId: queueJobId,
                    };
                }
                return data;
            } catch (e: any) {
                const msg = String(e?.message || e);
                if (isCurrentRequestContext(requestContext)) {
                    setError(msg);
                    reportError?.(msg);
                }
                if (queueJobId) {
                    queueJobs?.finishJob(queueJobId, { status: 'error', message: msg.slice(0, 200) });
                }
                if (pendingLegalLinksConfirmRef.current?.jobId === queueJobId) {
                    pendingLegalLinksConfirmRef.current = null;
                }
                return null;
            } finally {
                if (isCurrentRequestContext(requestContext)) {
                    setGenerateLinksBusy(false);
                }
            }
        },
        [
            getRequestContext,
            isCurrentRequestContext,
            queueJobs,
            refresh,
            reportError,
            savePatch,
            selectedApp,
            session,
            variables,
        ]
    );

    const cancelPendingLegalLinksGeneration = React.useCallback(
        (reason?: string) => {
            const pending = pendingLegalLinksConfirmRef.current;
            if (!pending) return false;
            queueJobsRef.current?.finishJob(pending.jobId, {
                status: 'canceled',
                message: String(reason || 'Canceled'),
            });
            pendingLegalLinksConfirmRef.current = null;
            return true;
        },
        []
    );

    const publishAppstoreReviewPublicPage = React.useCallback(async (options?: { hasPickedIcon?: boolean }) => {
        if (!session || !selectedApp) return null;
        const requestContext = getRequestContext();
        if (!isCurrentRequestContext(requestContext)) return null;

        setPublishWebpageBusy(true);
        setError(null);
        try {
            const normalizedVars = normalizeVariables(variablesRef.current);
            const appStoreName = String(normalizedVars?.appstore_name || '').trim();
            const description = String(normalizedVars?.appstore_description || '').trim();
            const currentLegalLinks = legalLinksRef.current;
            const privacyPolicyUrl = String(currentLegalLinks?.privacy_policy_url || '').trim();
            const termsOfUseUrl = String(currentLegalLinks?.terms_of_use_url || '').trim();
            const supportFormUrl = String(currentLegalLinks?.support_form_url || '').trim();

            if (!appStoreName) {
                throw new Error("Fill App's App Store name first.");
            }
            if (!description) {
                throw new Error('Generate or enter the App Store description first.');
            }
            if (!options?.hasPickedIcon) {
                throw new Error('Pick an icon first.');
            }
            if (!isUsableLegalUrl(privacyPolicyUrl)) {
                throw new Error('Generate or enter the Privacy Policy link first.');
            }
            if (!isUsableLegalUrl(termsOfUseUrl)) {
                throw new Error('Generate or enter the Terms of Use link first.');
            }
            if (!isUsableLegalUrl(supportFormUrl)) {
                throw new Error('Generate or enter the Support link first.');
            }

            const currentHash = hashVariables(normalizedVars);
            if (currentHash !== lastSavedVariablesHashRef.current) {
                const flushed = await savePatch(
                    { variables: normalizedVars },
                    { source: 'flush', reportError: false }
                );
                if (!flushed) {
                    throw new Error('Failed to save setup data before publishing the webpage.');
                }
            }

            const ensured = await ensureAppstoreReviewWebhook({
                userId: session.user.id,
                appId: selectedApp.id,
            });
            if (ensured.error) throw ensured.error;

            let publicSubdomain =
                String((ensured.data as any)?.public_subdomain || '').trim() ||
                extractManagedAppstoreReviewPublicSubdomain((ensured.data as any)?.public_webhook_url);
            if (!publicSubdomain) {
                const claimed = await claimAppstoreReviewWebhookPublicSubdomain({ appId: selectedApp.id });
                if (claimed.error) throw claimed.error;
                publicSubdomain = String(claimed.data || '').trim();
            }
            if (!publicSubdomain) {
                throw new Error('Could not allocate a public subdomain for this app.');
            }

            const publicWebpageUrl = buildManagedAppstoreReviewPublicPageUrl({
                publicSubdomain,
            });
            if (!publicWebpageUrl) {
                throw new Error('Public webhook root domain is not configured in this environment.');
            }

            const publishedAt = new Date().toISOString();
            const updated = await updateAppstoreReviewWebhook({
                userId: session.user.id,
                appId: selectedApp.id,
                patch: {
                    public_page_published_at: publishedAt,
                    public_subdomain: publicSubdomain,
                },
            });
            if (updated.error) throw updated.error;

            if (!isCurrentRequestContext(requestContext)) return null;
            applyWebhookPageState((updated.data as any) || null);
            return {
                publicWebpageUrl,
                publishedAt,
                error: null,
            };
        } catch (e: any) {
            if (!isCurrentRequestContext(requestContext)) return null;
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
            return {
                publicWebpageUrl: '',
                publishedAt: null,
                error: msg,
            };
        } finally {
            if (isCurrentRequestContext(requestContext)) {
                setPublishWebpageBusy(false);
            }
        }
    }, [
        applyWebhookPageState,
        getRequestContext,
        isCurrentRequestContext,
        reportError,
        savePatch,
        selectedApp,
        session,
    ]);

    const upsertSecret = React.useCallback(
        async (key: string, value: string) => {
            if (!session || !selectedApp) return;
            const k = String(key || '').trim();
            if (!k) return;
            if (!value) return;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return;

            setSecretBusy(true);
            setError(null);
            try {
                const resp = await upsertConnectorSecret({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    key: k,
                    value,
                });
                if (resp.error) throw resp.error;
                if (!isCurrentRequestContext(requestContext)) return;
                    await refresh({ mode: 'background', preserveConflict: true });
            } catch (e: any) {
                if (!isCurrentRequestContext(requestContext)) return;
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
            } finally {
                if (isCurrentRequestContext(requestContext)) {
                    setSecretBusy(false);
                }
            }
        },
        [getRequestContext, isCurrentRequestContext, refresh, reportError, selectedApp, session]
    );

    const removeSecret = React.useCallback(
        async (key: string) => {
            if (!session || !selectedApp) return;
            const k = String(key || '').trim();
            if (!k) return;
            const requestContext = getRequestContext();
            if (!isCurrentRequestContext(requestContext)) return;

            setSecretBusy(true);
            setError(null);
            try {
                const resp = await deleteConnectorSecret({ userId: session.user.id, appId: selectedApp.id, key: k });
                if (resp.error) throw resp.error;
                if (!isCurrentRequestContext(requestContext)) return;
                    await refresh({ mode: 'background', preserveConflict: true });
            } catch (e: any) {
                if (!isCurrentRequestContext(requestContext)) return;
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
            } finally {
                if (isCurrentRequestContext(requestContext)) {
                    setSecretBusy(false);
                }
            }
        },
        [getRequestContext, isCurrentRequestContext, refresh, reportError, selectedApp, session]
    );

    const flushPending = React.useCallback(async () => {
        if (!session || !selectedApp) return true;
        clearAutosaveTimer();
        if (!isDirtyRef.current) return true;

        const normalizedVars = normalizeVariables(variablesRef.current);
        const currentProjectBrief = String(projectBrief || '');
        const currentBaseBranch = normalizeBaseBranch(baseBranch);
        const patch: { project_brief?: string; base_branch?: string; variables?: Record<string, any> } = {};
        if (hashVariables(normalizedVars) !== lastSavedVariablesHashRef.current) {
            patch.variables = normalizedVars;
        }
        if (currentProjectBrief !== lastSavedProjectBriefRef.current) {
            patch.project_brief = currentProjectBrief;
        }
        if (currentBaseBranch !== lastSavedBaseBranchRef.current) {
            patch.base_branch = currentBaseBranch;
        }
        if (!Object.keys(patch).length) return true;
        return await savePatch(patch, { source: 'flush' });
    }, [baseBranch, clearAutosaveTimer, projectBrief, savePatch, selectedApp, session]);

    const reloadAfterConflict = React.useCallback(async () => {
        autosaveBlockedUntilRef.current = 0;
        await refresh({ mode: 'initial', forceConfigOverwrite: true });
    }, [refresh]);

    const overwriteAfterConflict = React.useCallback(async () => {
        const conflict = staleConflictRef.current;
        if (!conflict) return false;
        autosaveBlockedUntilRef.current = 0;
        return await savePatch(
            {
                project_brief: conflict.pendingSnapshot.projectBrief,
                idea_id: conflict.pendingSnapshot.ideaId,
                base_branch: conflict.pendingSnapshot.baseBranch,
                variables: conflict.pendingSnapshot.variables,
            },
            {
                source: 'manual',
                forceOverwrite: true,
                pendingSnapshot: conflict.pendingSnapshot,
            }
        );
    }, [savePatch]);

    return {
        loading,
        saving,
        secretBusy,
        generateLinksBusy,
        generateDescriptionBusy,
        publishWebpageBusy,
        error,
        saveState,
        lastSaveError,
        staleConflict,
        projectBrief,
        setProjectBrief,
        ideaId,
        setIdeaId,
        baseBranch,
        setBaseBranch,
        variables,
        setVariables,
        setVariable,
        isDirty,
        isProjectBriefDirty,
        configUpdatedAt,
        legalLinks,
        buildSnapshot,
        flushPending,
        saveMergedVariablesPatch,
        secretMetas,
        refresh,
        reloadAfterConflict,
        overwriteAfterConflict,
        savePatch,
        precheckLegalLinksRegeneration,
        regenerateAppstoreDescription,
        generateLegalLinks,
        cancelPendingLegalLinksGeneration,
        publicWebpageUrl,
        publicPagePublishedAt,
        publishAppstoreReviewPublicPage,
        upsertSecret,
        removeSecret,
    };
};
