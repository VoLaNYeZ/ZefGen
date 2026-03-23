import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { BellRing, Check, ChevronDown, Copy, Pencil, RefreshCcw, RotateCw, Save, Send, Upload } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type {
    AppItem,
    AppstoreConnectAppCandidate,
    AppstoreReviewWebhook,
    AppstoreReviewWebhookStatus,
} from '../../types/zefgen';
import {
    claimAppstoreReviewWebhookPublicSubdomain,
    ensureAppstoreReviewWebhook,
    fetchAppstoreReviewEvents,
    fetchAppstoreReviewWebhook,
    updateAppstoreReviewWebhook,
} from '../../data/appstore-review-webhooks';
import { fetchConnectorAppConfig } from '../../data/connector-app-config';
import { fetchConnectorSecretMetas, upsertConnectorSecret } from '../../data/connector-secrets';
import {
    fetchAppstoreReviewAppleApps,
    refreshAppstoreReviewSnapshot,
    fetchAppstoreReviewWebhookStatus,
    pingAppstoreReviewWebhook,
    syncAppstoreReviewWebhook,
} from '../../data/appstore-review-webhook-api';
import {
    APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY,
    APPSTORE_REVIEW_EVENT_TYPE,
    buildAppstoreReviewWebhookUrl,
    buildManagedAppstoreReviewPublicPageUrl,
    buildManagedAppstoreReviewWebhookUrl,
    buildAppstoreReviewWebhookReceiverPreview,
    buildSuggestedAppstoreReviewPublicSubdomain,
    extractManagedAppstoreReviewPublicSubdomain,
    formatAppstoreReviewState,
    generateAppstoreReviewWebhookSecret,
    generateAppstoreReviewWebhookToken,
    isManagedAppstoreReviewWebhookUrl,
} from '../../utils/appstore-review-webhook';
import {
    isTerminalAppstoreReviewState,
    shouldBackgroundRefreshAppstoreReviewState,
} from '../../lib/appstore-review-state.shared.js';
import type { WorkspaceSwitchGuard } from '../../types/workspace-switch';

const formatTimestamp = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString();
};

const STATUS_POLL_INTERVAL_MS = 3 * 60 * 1000;

const supportsBackgroundAppleRefresh = (config: AppstoreReviewWebhook | null) => {
    if (!config) return false;
    if (String(config.last_sync_status || '').trim().toLowerCase() !== 'connected') return false;
    if (!String(config.asc_app_id || '').trim()) return false;
    return true;
};

const deliveryKeyForConfig = (config: AppstoreReviewWebhook | null): TranslationKey => {
    if (!config) return 'appstore_review_webhook_waiting';
    switch (config.last_delivery_status) {
        case 'received':
            return 'appstore_review_webhook_live';
        case 'ignored':
            return 'appstore_review_webhook_ping';
        case 'invalid_signature':
            return 'appstore_review_webhook_invalid_signature';
        case 'error':
            return 'appstore_review_webhook_error';
        default:
            return 'appstore_review_webhook_waiting';
    }
};

const syncKeyForConfig = (config: AppstoreReviewWebhook | null): TranslationKey => {
    if (!config) return 'appstore_review_webhook_sync_idle';
    switch (config.last_sync_status) {
        case 'connected':
            return 'appstore_review_webhook_sync_connected';
        case 'error':
            return 'appstore_review_webhook_sync_error';
        default:
            return 'appstore_review_webhook_sync_idle';
    }
};

const stateTone = (value: string | null | undefined) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return 'border-white/10 bg-slate-950/30 text-indigo-100/80';
    if (['READY_FOR_SALE', 'ACCEPTED', 'PENDING_APPLE_RELEASE', 'PENDING_DEVELOPER_RELEASE'].includes(raw)) {
        return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    }
    if (['REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED', 'INVALID_BINARY', 'DEVELOPER_REMOVED_FROM_SALE', 'REMOVED_FROM_SALE'].includes(raw)) {
        return 'border-rose-400/35 bg-rose-500/10 text-rose-100';
    }
    if (['IN_REVIEW', 'WAITING_FOR_REVIEW'].includes(raw)) {
        return 'border-amber-400/35 bg-amber-500/10 text-amber-100';
    }
    return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
};

const syncSummaryTone = (value: string | null | undefined) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'connected') return 'border-emerald-400/20 bg-emerald-500/8';
    if (raw === 'error') return 'border-rose-400/25 bg-rose-500/8';
    return 'border-amber-400/20 bg-amber-500/8';
};

const deliverySummaryTone = (value: string | null | undefined) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'received') return 'border-emerald-400/20 bg-emerald-500/8';
    if (raw === 'ignored') return 'border-sky-400/20 bg-sky-500/8';
    if (raw === 'error' || raw === 'invalid_signature') return 'border-rose-400/25 bg-rose-500/8';
    return 'border-amber-400/20 bg-amber-500/8';
};

const stateSummaryTone = (value: string | null | undefined) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return 'border-white/8 bg-slate-950/25';
    if (['READY_FOR_SALE', 'ACCEPTED', 'PENDING_APPLE_RELEASE', 'PENDING_DEVELOPER_RELEASE'].includes(raw)) {
        return 'border-emerald-400/20 bg-emerald-500/8';
    }
    if (['REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED', 'INVALID_BINARY', 'DEVELOPER_REMOVED_FROM_SALE', 'REMOVED_FROM_SALE'].includes(raw)) {
        return 'border-rose-400/25 bg-rose-500/8';
    }
    if (['IN_REVIEW', 'WAITING_FOR_REVIEW'].includes(raw)) {
        return 'border-amber-400/20 bg-amber-500/8';
    }
    return 'border-sky-400/20 bg-sky-500/8';
};

const sameHost = (left: string, right: string) => {
    try {
        return new URL(left).host === new URL(right).host;
    } catch {
        return false;
    }
};

const APPLE_ISSUER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isDisallowedDirectSupabaseWebhookUrl = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    if (!raw || !supabaseUrl) return false;
    try {
        return new URL(raw).host === new URL(supabaseUrl).host;
    } catch {
        return false;
    }
};

const buildLocalCredentialIssues = (payload: {
    webhook: AppstoreReviewWebhook | null;
    privateKeyConfigured: boolean;
}) => {
    const issues: string[] = [];
    const keyMode = String(payload.webhook?.key_mode || '').trim().toLowerCase();
    if (!['team', 'individual'].includes(keyMode)) issues.push('Select key mode.');
    if (!String(payload.webhook?.key_id || '').trim()) issues.push('Enter key ID.');
    if (keyMode === 'team' && !String(payload.webhook?.issuer_id || '').trim()) issues.push('Enter issuer ID.');
    if (!payload.privateKeyConfigured) issues.push('Upload the .p8 private key.');
    return issues;
};

type BusyAction = 'create' | 'rotate' | 'save' | 'apps' | 'check' | 'sync' | 'ping' | null;

export type AppStoreReviewPanelSnapshot = {
    appId: string;
    status: AppstoreReviewWebhookStatus | null;
    appStoreNameHint: string;
    hasDraftChanges: boolean;
};

export const extractAppStoreNameHintFromConnectorConfig = (connectorConfig: any) =>
    String((connectorConfig as any)?.variables?.appstore_name || '').trim();

export const buildFallbackAppstoreReviewWebhookStatus = (payload: {
    webhook: AppstoreReviewWebhook | null;
    events: AppstoreReviewWebhookStatus['events'];
    connectorConfig: any;
    secretMetas: any[];
    text: (key: TranslationKey) => string;
}): AppstoreReviewWebhookStatus => {
    const webhook = payload.webhook;
    const bundleIdFallback = String((payload.connectorConfig as any)?.variables?.bundle_id || '').trim() || null;
    const appStoreNameFallback = extractAppStoreNameHintFromConnectorConfig(payload.connectorConfig) || null;
    const privateKeyConfiguredFallback = Boolean(
        (payload.secretMetas || []).some(
            (meta: any) => String(meta?.key || '').trim() === APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY
        )
    );
    const resolvedPublicSubdomainFallback =
        String(webhook?.public_subdomain || '').trim() ||
        extractManagedAppstoreReviewPublicSubdomain(webhook?.public_webhook_url) ||
        '';
    const defaultPublicWebhookUrlFallback = webhook
        ? buildAppstoreReviewWebhookUrl(webhook.public_token, resolvedPublicSubdomainFallback)
        : '';
    const explicitPublicWebhookUrlFallback =
        String(webhook?.public_webhook_url || '').trim() &&
        !isManagedAppstoreReviewWebhookUrl(webhook?.public_webhook_url) &&
        !isDisallowedDirectSupabaseWebhookUrl(webhook?.public_webhook_url)
            ? String(webhook?.public_webhook_url || '').trim()
            : '';
    const effectivePublicWebhookUrlFallback = explicitPublicWebhookUrlFallback || defaultPublicWebhookUrlFallback;
    const effectivePublicPageUrlFallback = buildManagedAppstoreReviewPublicPageUrl({
        publicSubdomain: resolvedPublicSubdomainFallback,
    });
    const webhookReadinessIssuesFallback: string[] = [];
    if (!resolvedPublicSubdomainFallback && !appStoreNameFallback) {
        webhookReadinessIssuesFallback.push(payload.text('appstore_review_webhook_appstore_name_required'));
    }
    if (String(webhook?.public_webhook_url || '').trim() && isDisallowedDirectSupabaseWebhookUrl(webhook?.public_webhook_url)) {
        webhookReadinessIssuesFallback.push(
            'Direct Supabase webhook URLs are not allowed here. Use appshelp.cc or a custom public proxy URL.'
        );
    }
    if (webhook && !effectivePublicWebhookUrlFallback && !webhookReadinessIssuesFallback.length) {
        webhookReadinessIssuesFallback.push('Public webhook URL is not ready yet for this app.');
    }

    return {
        webhook:
            webhook && resolvedPublicSubdomainFallback && !String(webhook.public_subdomain || '').trim()
                ? { ...webhook, public_subdomain: resolvedPublicSubdomainFallback }
                : webhook,
        events: Array.isArray(payload.events) ? [...payload.events] : [],
        bundle_id: bundleIdFallback,
        private_key_configured: privateKeyConfiguredFallback,
        effective_public_webhook_url: effectivePublicWebhookUrlFallback,
        effective_public_page_url: effectivePublicPageUrlFallback,
        credential_issues: buildLocalCredentialIssues({
            webhook,
            privateKeyConfigured: privateKeyConfiguredFallback,
        }),
        webhook_readiness_issues: webhookReadinessIssuesFallback,
    };
};

export function AppStoreReviewWebhookRow(props: {
    selectedApp: AppItem | null;
    session: Session | null;
    text: (key: TranslationKey) => string;
    reportError: (message: string) => void;
    isReadOnly?: boolean;
    hydrationSnapshot?: AppStoreReviewPanelSnapshot | null;
    onSnapshotChange?: (snapshot: AppStoreReviewPanelSnapshot | null) => void;
    onSwitchGuardChange?: (guard: WorkspaceSwitchGuard | null) => void;
}) {
    const {
        selectedApp,
        session,
        text,
        reportError,
        isReadOnly = false,
        hydrationSnapshot = null,
        onSnapshotChange,
        onSwitchGuardChange,
    } = props;
    const [loading, setLoading] = React.useState(false);
    const [busyAction, setBusyAction] = React.useState<BusyAction>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<AppstoreReviewWebhookStatus | null>(null);
    const [appleCandidates, setAppleCandidates] = React.useState<AppstoreConnectAppCandidate[]>([]);
    const [appleCandidatesLoaded, setAppleCandidatesLoaded] = React.useState(false);
    const [copiedKey, setCopiedKey] = React.useState<'endpoint' | 'secret' | null>(null);
    const [keyModeDraft, setKeyModeDraft] = React.useState<'team' | 'individual'>('team');
    const [keyIdDraft, setKeyIdDraft] = React.useState('');
    const [issuerIdDraft, setIssuerIdDraft] = React.useState('');
    const [publicSubdomainDraft, setPublicSubdomainDraft] = React.useState('');
    const [privateKeyDraft, setPrivateKeyDraft] = React.useState('');
    const [selectedAppleAppId, setSelectedAppleAppId] = React.useState('');
    const [hasAppleDraftChanges, setHasAppleDraftChangesState] = React.useState(false);
    const [isPrivateKeyDragActive, setIsPrivateKeyDragActive] = React.useState(false);
    const [checkingAppleSnapshot, setCheckingAppleSnapshot] = React.useState(false);
    const [serverStatusWarning, setServerStatusWarning] = React.useState<string | null>(null);
    const [appStoreNameHint, setAppStoreNameHint] = React.useState('');
    const [expanded, setExpanded] = React.useState(false);
    const [quickSetupEditing, setQuickSetupEditing] = React.useState(false);
    const requestIdRef = React.useRef(0);
    const copiedTimerRef = React.useRef<number | null>(null);
    const pingRefreshTimersRef = React.useRef<number[]>([]);
    const appleSnapshotRequestInFlightRef = React.useRef(false);
    const activeAppKeyRef = React.useRef('');
    const hydratedAppIdRef = React.useRef('');
    const privateKeyInputRef = React.useRef<HTMLInputElement | null>(null);
    const hydrationSnapshotRef = React.useRef<AppStoreReviewPanelSnapshot | null>(hydrationSnapshot);
    const hasAppleDraftChangesRef = React.useRef(false);

    const markAppleDraftDirty = React.useCallback(() => {
        hasAppleDraftChangesRef.current = true;
        setHasAppleDraftChangesState(true);
    }, []);

    const clearAppleDraftDirty = React.useCallback(() => {
        hasAppleDraftChangesRef.current = false;
        setHasAppleDraftChangesState(false);
    }, []);

    const appId = String(selectedApp?.id || '').trim();
    const userId = String(session?.user?.id || '').trim();
    const config = status?.webhook || null;
    const events = status?.events || [];
    const bundleId = String(status?.bundle_id || '').trim();
    const suggestedPublicSubdomain = React.useMemo(
        () => buildSuggestedAppstoreReviewPublicSubdomain(String(appStoreNameHint || '')),
        [appStoreNameHint]
    );
    const legacyExplicitWebhookUrl = React.useMemo(() => {
        const raw = String(config?.public_webhook_url || '').trim();
        if (!raw) return '';
        return isManagedAppstoreReviewWebhookUrl(raw) ? '' : raw;
    }, [config?.public_webhook_url]);
    const effectivePublicSubdomain =
        String(publicSubdomainDraft || '').trim() ||
        String(config?.public_subdomain || '').trim() ||
        extractManagedAppstoreReviewPublicSubdomain(config?.public_webhook_url) ||
        suggestedPublicSubdomain;
    const managedPublicWebhookUrl =
        config?.public_token && effectivePublicSubdomain
            ? buildManagedAppstoreReviewWebhookUrl({
                  publicToken: config.public_token,
                  publicSubdomain: effectivePublicSubdomain,
              })
            : '';
    const effectivePublicWebhookUrl =
        legacyExplicitWebhookUrl ||
        managedPublicWebhookUrl ||
        String(status?.effective_public_webhook_url || '').trim();
    const webhookReadinessIssues = status?.webhook_readiness_issues || [];
    const privateKeyConfigured = Boolean(status?.private_key_configured);
    const latestStateLabel = formatAppstoreReviewState(config?.latest_review_state);
    const latestPrevStateLabel = formatAppstoreReviewState(config?.latest_previous_state);
    const lastDeliveryLabel = text(deliveryKeyForConfig(config));
    const lastSyncLabel = text(syncKeyForConfig(config));
    const credentialIssues = status?.credential_issues || [];
    const hasAppleAppSelection = Boolean(String(selectedAppleAppId || config?.asc_app_id || '').trim());
    const normalizedIssuerIdDraft = String(issuerIdDraft || '').trim();
    const teamIssuerIdInvalid =
        keyModeDraft === 'team' &&
        Boolean(normalizedIssuerIdDraft) &&
        !APPLE_ISSUER_ID_PATTERN.test(normalizedIssuerIdDraft);
    const hasRequiredIssuer = keyModeDraft === 'individual' || Boolean(normalizedIssuerIdDraft);
    const quickSetupConfigured =
        Boolean(config) &&
        Boolean(String(keyIdDraft || '').trim()) &&
        hasRequiredIssuer &&
        privateKeyConfigured &&
        hasAppleAppSelection;
    const showQuickSetupEditor = !quickSetupConfigured || quickSetupEditing || hasAppleDraftChanges;
    const selectedAppleAppSummary = String(
        config?.asc_app_name || config?.asc_bundle_id || selectedAppleAppId || config?.asc_app_id || ''
    ).trim();
    const lastSyncAtLabel = formatTimestamp(config?.last_sync_at);
    const lastSnapshotAtLabel = formatTimestamp(config?.last_snapshot_at);
    const lastDeliveryAtLabel = formatTimestamp(config?.last_delivery_at);
    const latestEventAtLabel = formatTimestamp(config?.latest_event_at);
    const latestStateSummary = latestStateLabel
        ? latestPrevStateLabel
            ? `${latestPrevStateLabel} -> ${latestStateLabel}`
            : latestStateLabel
        : text('appstore_review_webhook_no_state');
    const backgroundAppleRefreshConfigured = supportsBackgroundAppleRefresh(config);
    const backgroundAppleRefreshActive =
        backgroundAppleRefreshConfigured && shouldBackgroundRefreshAppstoreReviewState(config?.latest_review_state);
    const backgroundAppleRefreshStopped =
        backgroundAppleRefreshConfigured && isTerminalAppstoreReviewState(config?.latest_review_state);
    const canCheckAppleNow = backgroundAppleRefreshConfigured && !credentialIssues.length;
    const draftGuardReason = React.useMemo(() => {
        if (!hasAppleDraftChanges) return null;
        if (keyModeDraft === 'team') {
            if (!normalizedIssuerIdDraft) return text('appstore_review_webhook_save_before_switch');
            if (!APPLE_ISSUER_ID_PATTERN.test(normalizedIssuerIdDraft)) {
                return text('appstore_review_webhook_issuer_id_invalid');
            }
        }

        const storedManagedSubdomain =
            String(config?.public_subdomain || '').trim() ||
            extractManagedAppstoreReviewPublicSubdomain(config?.public_webhook_url) ||
            '';
        if (!legacyExplicitWebhookUrl && !String(publicSubdomainDraft || '').trim() && !storedManagedSubdomain) {
            if (!String(appStoreNameHint || '').trim()) {
                return text('appstore_review_webhook_appstore_name_required');
            }
        }

        return null;
    }, [
        appStoreNameHint,
        config?.public_subdomain,
        config?.public_webhook_url,
        hasAppleDraftChanges,
        keyModeDraft,
        legacyExplicitWebhookUrl,
        normalizedIssuerIdDraft,
        publicSubdomainDraft,
        text,
    ]);
    const headerStatusLabel = !config
        ? ''
        : latestStateLabel
          ? latestStateLabel
          : config.last_sync_status === 'connected'
            ? lastSyncLabel
            : lastDeliveryLabel;
    const headerStatusTone = !config
        ? ''
        : config.last_sync_error || config.last_error
          ? 'border-rose-400/35 bg-rose-500/10 text-rose-100'
          : latestStateLabel
            ? stateTone(config.latest_review_state)
            : config.last_sync_status === 'connected'
              ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
              : 'border-amber-400/35 bg-amber-500/10 text-amber-100';
    const receiverSummaryLabel = config
        ? text('appstore_review_webhook_receiver_ready')
        : text('appstore_review_webhook_receiver_missing');
    const receiverSummaryTone = config
        ? 'border-emerald-400/20 bg-emerald-500/8'
        : 'border-amber-400/20 bg-amber-500/8';
    const appleLinkSummary = !config
        ? text('appstore_review_webhook_sync_idle')
        : config.last_sync_error
          ? text('appstore_review_webhook_sync_error')
          : config.last_sync_status === 'connected'
            ? text('appstore_review_webhook_sync_connected')
            : !hasAppleAppSelection
              ? text('appstore_review_webhook_apple_app_placeholder')
              : text('appstore_review_webhook_sync_idle');
    const reviewSummaryLabel = latestStateLabel ? latestStateSummary : lastDeliveryLabel;
    const reviewSummaryMeta =
        lastSnapshotAtLabel ||
        latestEventAtLabel ||
        lastDeliveryAtLabel ||
        text('appstore_review_webhook_no_snapshot');
    const receiverPreviewLabel =
        buildAppstoreReviewWebhookReceiverPreview(effectivePublicWebhookUrl) ||
        text('appstore_review_webhook_public_url_missing');
    const lastStatusRefreshSummary = checkingAppleSnapshot
        ? text('appstore_review_webhook_checking_apple')
        : lastSnapshotAtLabel
          ? `${latestStateLabel || lastSyncLabel} · ${lastSnapshotAtLabel}`
          : text('appstore_review_webhook_no_snapshot');
    const nextActionText = !config
        ? text('appstore_review_webhook_setup_hint')
        : config.last_sync_error || config.last_error
          ? text('appstore_review_webhook_next_fix_error')
          : !bundleId
            ? text('appstore_review_webhook_bundle_missing_hint')
            : credentialIssues.length
              ? credentialIssues.join(' ')
              : !hasAppleAppSelection
                ? text('appstore_review_webhook_next_load_apps')
                : config.last_sync_status !== 'connected'
                  ? text('appstore_review_webhook_next_sync')
                  : backgroundAppleRefreshStopped
                    ? text('appstore_review_webhook_next_terminal')
                  : !String(config.last_delivery_at || '').trim()
                    ? text('appstore_review_webhook_next_wait_delivery')
                    : !latestStateLabel
                      ? text('appstore_review_webhook_next_wait_state')
                      : text('appstore_review_webhook_next_live');
    const setupBadges = config ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/35 px-2 py-1 text-[10px] font-semibold text-indigo-100/75">
                {text('appstore_review_webhook_sync_title')}: {lastSyncLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/35 px-2 py-1 text-[10px] font-semibold text-indigo-100/75">
                {text('connector_bundle_id')}: {bundleId || text('appstore_review_webhook_bundle_missing')}
            </span>
            <span
                className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    privateKeyConfigured
                        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                        : 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                }`}
            >
                {privateKeyConfigured
                    ? text('appstore_review_webhook_private_key_stored')
                    : text('appstore_review_webhook_private_key_missing')}
            </span>
        </div>
    ) : null;
    const statusOverview = config ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className={`rounded-2xl border p-3 ${receiverSummaryTone}`}>
                <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                    {text('appstore_review_webhook_step1_title')}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{receiverSummaryLabel}</p>
                <p
                    className="mt-1 truncate text-[11px] text-indigo-200/55"
                    title={effectivePublicWebhookUrl || receiverPreviewLabel}
                >
                    {receiverPreviewLabel}
                </p>
            </div>
            <div className={`rounded-2xl border p-3 ${syncSummaryTone(config.last_sync_status)}`}>
                <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                    {text('appstore_review_webhook_step4_title')}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{appleLinkSummary}</p>
                <p className="mt-1 text-[11px] text-indigo-200/55">
                    {lastSyncAtLabel || selectedAppleAppSummary || text('appstore_review_webhook_no_sync_yet')}
                </p>
            </div>
            <div className={`rounded-2xl border p-3 ${stateSummaryTone(config.latest_review_state)}`}>
                <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                    {text('appstore_review_webhook_latest_state')}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{reviewSummaryLabel}</p>
                <p className="mt-1 text-[11px] text-indigo-200/55">{reviewSummaryMeta}</p>
            </div>
        </div>
    ) : null;
    const workflowOverview = config ? (
        <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/25 p-3">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                {text('appstore_review_webhook_now_title')}
            </p>
            <p className="mt-2 text-sm font-semibold text-white">{nextActionText}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-slate-950/30 px-3 py-2">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                        {text('appstore_review_webhook_last_checked')}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-100/85">{lastStatusRefreshSummary}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${deliverySummaryTone(config.last_delivery_status)}`}>
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                        {text('appstore_review_webhook_last_delivery')}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-100/85">
                        {lastDeliveryAtLabel ? `${lastDeliveryLabel} · ${lastDeliveryAtLabel}` : lastDeliveryLabel}
                    </p>
                </div>
            </div>
            {backgroundAppleRefreshConfigured ? (
                <p className="mt-3 text-[11px] text-indigo-200/60">
                    {text(
                        backgroundAppleRefreshActive
                            ? 'appstore_review_webhook_auto_checking'
                            : 'appstore_review_webhook_auto_checking_stopped'
                    )}
                </p>
            ) : null}
        </div>
    ) : null;

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
            pingRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            pingRefreshTimersRef.current = [];
        };
    }, []);

    React.useEffect(() => {
        if (hasAppleDraftChanges) {
            setQuickSetupEditing(true);
        }
    }, [hasAppleDraftChanges]);

    React.useEffect(() => {
        hydrationSnapshotRef.current = hydrationSnapshot ?? null;
    }, [hydrationSnapshot]);

    React.useEffect(() => {
        if (!appId || !userId) return;
        let cancelled = false;

        void (async () => {
            try {
                const connectorConfigRes = await fetchConnectorAppConfig({ userId, appId });
                if (cancelled) return;
                if (connectorConfigRes.error) throw connectorConfigRes.error;
                setAppStoreNameHint(String((connectorConfigRes.data as any)?.variables?.appstore_name || '').trim());
            } catch {
                if (!cancelled) setAppStoreNameHint('');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [appId, userId]);

    React.useEffect(() => {
        if (hasAppleDraftChanges) return;
        if (String(config?.public_subdomain || '').trim()) return;
        if (legacyExplicitWebhookUrl) return;
        if (!suggestedPublicSubdomain) return;
        setPublicSubdomainDraft((current) => String(current || '').trim() || suggestedPublicSubdomain);
    }, [config?.public_subdomain, hasAppleDraftChanges, legacyExplicitWebhookUrl, suggestedPublicSubdomain]);

    const hydrateDraftsFromStatus = React.useCallback(
        (
            nextStatus: AppstoreReviewWebhookStatus | null,
            force = false,
            options?: {
                appStoreNameHint?: string;
            }
        ) => {
            if (!force && hasAppleDraftChangesRef.current) return;
            const webhook = nextStatus?.webhook;
            const effectiveAppStoreNameHint = String(options?.appStoreNameHint ?? appStoreNameHint ?? '').trim();
            setKeyModeDraft(webhook?.key_mode === 'individual' ? 'individual' : 'team');
            setKeyIdDraft(String(webhook?.key_id || ''));
            setIssuerIdDraft(String(webhook?.issuer_id || ''));
            setPublicSubdomainDraft(
                String(webhook?.public_subdomain || '').trim() ||
                    extractManagedAppstoreReviewPublicSubdomain(webhook?.public_webhook_url) ||
                    buildSuggestedAppstoreReviewPublicSubdomain(effectiveAppStoreNameHint)
            );
            setSelectedAppleAppId(String(webhook?.asc_app_id || ''));
            if (force) setPrivateKeyDraft('');
            clearAppleDraftDirty();
        },
        [appStoreNameHint, clearAppleDraftDirty]
    );

    React.useLayoutEffect(() => {
        activeAppKeyRef.current = appId && userId ? `${userId}:${appId}` : '';
        hydratedAppIdRef.current = '';
        requestIdRef.current += 1;
        setExpanded(false);
        setQuickSetupEditing(false);
        if (!appId || !userId) {
            setLoading(false);
            setBusyAction(null);
            setNotice(null);
            setStatus(null);
            setAppleCandidates([]);
            setAppleCandidatesLoaded(false);
            setCopiedKey(null);
            setKeyModeDraft('team');
            setKeyIdDraft('');
            setIssuerIdDraft('');
            setPublicSubdomainDraft('');
            setPrivateKeyDraft('');
            setSelectedAppleAppId('');
            clearAppleDraftDirty();
            setIsPrivateKeyDragActive(false);
            setCheckingAppleSnapshot(false);
            setServerStatusWarning(null);
            setAppStoreNameHint('');
            return;
        }

        const matchingHydrationSnapshot =
            hydrationSnapshotRef.current && String(hydrationSnapshotRef.current.appId || '').trim() === appId
                ? hydrationSnapshotRef.current
                : null;
        if (matchingHydrationSnapshot) {
            const nextAppStoreNameHint = String(matchingHydrationSnapshot.appStoreNameHint || '').trim();
            setLoading(false);
            setBusyAction(null);
            setNotice(null);
            setStatus(matchingHydrationSnapshot.status || null);
            setAppleCandidates([]);
            setAppleCandidatesLoaded(false);
            setCopiedKey(null);
            setIsPrivateKeyDragActive(false);
            setCheckingAppleSnapshot(false);
            setServerStatusWarning(null);
            setAppStoreNameHint(nextAppStoreNameHint);
            hydrateDraftsFromStatus(matchingHydrationSnapshot.status, true, {
                appStoreNameHint: nextAppStoreNameHint,
            });
            hydratedAppIdRef.current = appId;
            return;
        }

        setLoading(true);
        setBusyAction(null);
        setNotice(null);
        setStatus(null);
        setAppleCandidates([]);
        setAppleCandidatesLoaded(false);
        setCopiedKey(null);
        setKeyModeDraft('team');
        setKeyIdDraft('');
        setIssuerIdDraft('');
        setPublicSubdomainDraft('');
        setPrivateKeyDraft('');
        setSelectedAppleAppId('');
        clearAppleDraftDirty();
        setIsPrivateKeyDragActive(false);
        setCheckingAppleSnapshot(false);
        setServerStatusWarning(null);
        setAppStoreNameHint('');
    }, [appId, userId]);

    React.useEffect(() => {
        if (!onSnapshotChange) return;
        if (!appId) {
            onSnapshotChange(null);
            return;
        }
        onSnapshotChange({
            appId,
            status,
            appStoreNameHint: String(appStoreNameHint || '').trim(),
            hasDraftChanges: hasAppleDraftChanges,
        });
    }, [appId, appStoreNameHint, hasAppleDraftChanges, onSnapshotChange, status]);

    const loadFallbackStatus = React.useCallback(async () => {
        const [webhookRes, eventsRes, connectorConfigRes, secretMetasRes] = await Promise.all([
            fetchAppstoreReviewWebhook({ userId, appId }),
            fetchAppstoreReviewEvents({ userId, appId, limit: 6 }),
            fetchConnectorAppConfig({ userId, appId }),
            fetchConnectorSecretMetas({ userId, appId }),
        ]);

        if (webhookRes.error) throw webhookRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (connectorConfigRes.error) throw connectorConfigRes.error;
        if (secretMetasRes.error) throw secretMetasRes.error;

        return buildFallbackAppstoreReviewWebhookStatus({
            webhook: (webhookRes.data as unknown as AppstoreReviewWebhook) || null,
            events: ((eventsRes.data || []) as unknown as AppstoreReviewWebhookStatus['events']) || [],
            connectorConfig: connectorConfigRes.data || null,
            secretMetas: Array.isArray(secretMetasRes.data) ? secretMetasRes.data : [],
            text,
        });
    }, [appId, text, userId]);

    const refresh = React.useCallback(
        async (options?: { silent?: boolean; forceDraftHydrate?: boolean; reportErrors?: boolean }) => {
            if (!appId || !userId) {
                setStatus(null);
                setLoading(false);
                return;
            }

            const appKey = `${userId}:${appId}`;
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            if (!options?.silent) setLoading(true);
            try {
                const nextStatus = await fetchAppstoreReviewWebhookStatus({ appId });
                if (requestIdRef.current !== requestId) return;
                setServerStatusWarning(null);
                setStatus(nextStatus);
                const shouldForceHydrate =
                    !hasAppleDraftChangesRef.current &&
                    (options?.forceDraftHydrate === true || hydratedAppIdRef.current !== appId);
                hydrateDraftsFromStatus(nextStatus, shouldForceHydrate);
                hydratedAppIdRef.current = appId;
            } catch (error: any) {
                try {
                    const fallbackStatus = await loadFallbackStatus();
                    if (requestIdRef.current !== requestId) return;
                    setServerStatusWarning(String(error?.message || '').trim() || null);
                    setStatus(fallbackStatus);
                    const shouldForceHydrate =
                        !hasAppleDraftChangesRef.current &&
                        (options?.forceDraftHydrate === true || hydratedAppIdRef.current !== appId);
                    hydrateDraftsFromStatus(fallbackStatus, shouldForceHydrate);
                    hydratedAppIdRef.current = appId;
                } catch (fallbackError: any) {
                    if (requestIdRef.current !== requestId) return;
                    if (options?.reportErrors !== false) {
                        reportError(String(fallbackError?.message || error?.message || text('upload_failed')));
                    }
                }
            } finally {
                if (activeAppKeyRef.current === appKey) setLoading(false);
            }
        },
        [appId, hydrateDraftsFromStatus, loadFallbackStatus, reportError, text, userId]
    );

    React.useEffect(() => {
        const hasHydrationSnapshot =
            Boolean(hydrationSnapshotRef.current) && String(hydrationSnapshotRef.current?.appId || '').trim() === appId;
        void refresh({
            forceDraftHydrate: true,
            silent: hasHydrationSnapshot,
        });
    }, [appId, refresh]);

    React.useEffect(() => {
        if (!appId || !userId) return undefined;
        const intervalId = window.setInterval(() => {
            void refresh({ silent: true, reportErrors: false });
        }, STATUS_POLL_INTERVAL_MS);
        return () => window.clearInterval(intervalId);
    }, [appId, refresh, userId]);

    const runAppleSnapshotCheck = React.useCallback(
        async (options?: { reportErrors?: boolean }) => {
            if (!config || appleSnapshotRequestInFlightRef.current) return;
            const publicSubdomain =
                String(config.public_subdomain || '').trim() ||
                extractManagedAppstoreReviewPublicSubdomain(config.public_webhook_url) ||
                String(publicSubdomainDraft || '').trim();
            if (!publicSubdomain) return;

            appleSnapshotRequestInFlightRef.current = true;
            setCheckingAppleSnapshot(true);
            try {
                await refreshAppstoreReviewSnapshot({ publicSubdomain });
                await refresh({ silent: true, forceDraftHydrate: false, reportErrors: false });
            } catch (error: any) {
                if (options?.reportErrors) {
                    reportError(String(error?.message || text('upload_failed')));
                }
            } finally {
                appleSnapshotRequestInFlightRef.current = false;
                setCheckingAppleSnapshot(false);
            }
        },
        [config, publicSubdomainDraft, refresh, reportError, text]
    );

    const copyValue = React.useCallback(async (key: 'endpoint' | 'secret', value: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand('copy');
            } finally {
                document.body.removeChild(textarea);
            }
        }
        setCopiedKey(key);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1200);
    }, []);

    const acceptPrivateKeyText = React.useCallback(
        (rawValue: string) => {
            const nextValue = String(rawValue || '').replace(/\r/g, '');
            if (!nextValue.trim()) {
                throw new Error(text('appstore_review_webhook_private_key_invalid'));
            }
            setPrivateKeyDraft(nextValue);
            markAppleDraftDirty();
            setNotice(text('appstore_review_webhook_private_key_loaded'));
        },
        [markAppleDraftDirty, text]
    );

    const loadPrivateKeyFile = React.useCallback(
        async (file: File) => {
            const fileText = await file.text();
            acceptPrivateKeyText(fileText);
        },
        [acceptPrivateKeyText]
    );

    const handlePrivateKeyFilePick = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file || isReadOnly) return;
            try {
                await loadPrivateKeyFile(file);
            } catch (error: any) {
                reportError(String(error?.message || text('upload_failed')));
            }
        },
        [isReadOnly, loadPrivateKeyFile, reportError, text]
    );

    const handlePrivateKeyDrop = React.useCallback(
        async (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (isReadOnly) return;
            setIsPrivateKeyDragActive(false);
            try {
                const file = event.dataTransfer.files?.[0];
                if (file) {
                    await loadPrivateKeyFile(file);
                    return;
                }
                const droppedText = String(event.dataTransfer.getData('text') || '');
                acceptPrivateKeyText(droppedText);
            } catch (error: any) {
                reportError(String(error?.message || text('upload_failed')));
            }
        },
        [acceptPrivateKeyText, isReadOnly, loadPrivateKeyFile, reportError, text]
    );

    const persistAppleDrafts = React.useCallback(
        async (options?: { showNotice?: boolean; refreshAfter?: boolean }) => {
            if (!appId || !userId || isReadOnly) return null;

            let workingConfig = config;
            if (!workingConfig) {
                const created = await ensureAppstoreReviewWebhook({ userId, appId });
                if (created.error) throw created.error;
                workingConfig = (created.data as unknown as AppstoreReviewWebhook) || null;
            }
            if (!workingConfig) throw new Error(text('upload_failed'));

            const normalizedKeyMode = keyModeDraft === 'individual' ? 'individual' : 'team';
            const normalizedIssuerId = normalizedKeyMode === 'team' ? normalizedIssuerIdDraft : '';
            const normalizedSelectedAppleAppId = String(selectedAppleAppId || '').trim();
            const selectedAppleApp = appleCandidates.find((candidate) => candidate.id === normalizedSelectedAppleAppId);
            const preservedLegacyExplicitUrl =
                String(workingConfig.public_webhook_url || '').trim() &&
                !isManagedAppstoreReviewWebhookUrl(workingConfig.public_webhook_url) &&
                !isDisallowedDirectSupabaseWebhookUrl(workingConfig.public_webhook_url)
                    ? String(workingConfig.public_webhook_url || '').trim()
                    : null;
            const managedUrlSubdomain = extractManagedAppstoreReviewPublicSubdomain(workingConfig.public_webhook_url);
            let claimedPublicSubdomain =
                String(workingConfig.public_subdomain || '').trim() ||
                managedUrlSubdomain ||
                '';

            if (normalizedKeyMode === 'team' && !normalizedIssuerId) {
                throw new Error('Issuer ID is required for team keys.');
            }
            if (normalizedKeyMode === 'team' && !APPLE_ISSUER_ID_PATTERN.test(normalizedIssuerId)) {
                throw new Error(text('appstore_review_webhook_issuer_id_invalid'));
            }

            if (!preservedLegacyExplicitUrl) {
                if (!claimedPublicSubdomain && !String(publicSubdomainDraft || '').trim() && !String(appStoreNameHint || '').trim()) {
                    throw new Error(text('appstore_review_webhook_appstore_name_required'));
                }
                const claimed = await claimAppstoreReviewWebhookPublicSubdomain({
                    appId,
                    requested: String(publicSubdomainDraft || '').trim() || null,
                });
                if (claimed.error) throw claimed.error;
                claimedPublicSubdomain = String(claimed.data || '').trim();
                if (!claimedPublicSubdomain) {
                    throw new Error(text('appstore_review_webhook_public_subdomain_failed'));
                }
                setPublicSubdomainDraft(claimedPublicSubdomain);
            }

            const updated = await updateAppstoreReviewWebhook({
                userId,
                appId,
                patch: {
                    public_subdomain: claimedPublicSubdomain || null,
                    key_mode: normalizedKeyMode,
                    key_id: String(keyIdDraft || '').trim() || null,
                    issuer_id: normalizedKeyMode === 'team' ? normalizedIssuerId || null : null,
                    public_webhook_url: preservedLegacyExplicitUrl,
                    asc_app_id: normalizedSelectedAppleAppId || null,
                    asc_app_name: normalizedSelectedAppleAppId
                        ? selectedAppleApp?.name || workingConfig.asc_app_name || null
                        : null,
                    asc_bundle_id: normalizedSelectedAppleAppId
                        ? selectedAppleApp?.bundle_id || workingConfig.asc_bundle_id || null
                        : null,
                    last_sync_status: 'idle',
                    last_sync_error: null,
                },
            });
            if (updated.error) throw updated.error;

            const trimmedPrivateKey = String(privateKeyDraft || '').trim();
            if (trimmedPrivateKey) {
                const secretResult = await upsertConnectorSecret({
                    userId,
                    appId,
                    key: APPSTORE_CONNECT_PRIVATE_KEY_SECRET_KEY,
                    value: trimmedPrivateKey,
                });
                if (secretResult.error) throw secretResult.error;
            }

            clearAppleDraftDirty();
            setPrivateKeyDraft('');
            setQuickSetupEditing(false);

            if (options?.refreshAfter !== false) {
                await refresh({ forceDraftHydrate: true });
            }
            if (options?.showNotice) {
                setNotice(text('appstore_review_webhook_apple_saved'));
            }
            return (updated.data as unknown as AppstoreReviewWebhook) || null;
        },
        [
            appId,
            appStoreNameHint,
            appleCandidates,
            config,
            isReadOnly,
            issuerIdDraft,
            keyIdDraft,
            keyModeDraft,
            privateKeyDraft,
            publicSubdomainDraft,
            refresh,
            selectedAppleAppId,
            text,
            userId,
            clearAppleDraftDirty,
        ]
    );

    const flushPending = React.useCallback(async () => {
        if (isReadOnly || !appId || !userId) return true;
        if (!hasAppleDraftChangesRef.current) return true;

        setExpanded(true);
        setQuickSetupEditing(true);
        if (draftGuardReason) return false;

        setBusyAction('save');
        setNotice(null);
        try {
            await persistAppleDrafts();
            setExpanded(false);
            return true;
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
            return false;
        } finally {
            setBusyAction(null);
        }
    }, [appId, draftGuardReason, isReadOnly, persistAppleDrafts, reportError, text, userId]);

    React.useEffect(() => {
        if (!onSwitchGuardChange) return;
        onSwitchGuardChange({
            isDirty: hasAppleDraftChanges,
            blockReason: draftGuardReason,
            flushPending,
        });
        return () => onSwitchGuardChange(null);
    }, [draftGuardReason, flushPending, hasAppleDraftChanges, onSwitchGuardChange]);

    const resolveBridgeSubdomain = React.useCallback(
        (webhook: AppstoreReviewWebhook | null) => {
            const resolved =
                String(webhook?.public_subdomain || '').trim() ||
                extractManagedAppstoreReviewPublicSubdomain(webhook?.public_webhook_url) ||
                String(publicSubdomainDraft || '').trim();
            if (!resolved) {
                throw new Error(text('appstore_review_webhook_appstore_name_required'));
            }
            return resolved;
        },
        [publicSubdomainDraft, text]
    );

    const handleCreate = async () => {
        if (!appId || !userId || isReadOnly) return;
        setBusyAction('create');
        setNotice(null);
        try {
            const result = await ensureAppstoreReviewWebhook({ userId, appId });
            if (result.error) throw result.error;
            setNotice(text('appstore_review_webhook_created'));
            await refresh({ forceDraftHydrate: true });
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setBusyAction(null);
        }
    };

    const handleRotate = async () => {
        if (!appId || !userId || !config || isReadOnly) return;
        const confirmed = window.confirm(text('appstore_review_webhook_rotate_confirm'));
        if (!confirmed) return;

        setBusyAction('rotate');
        setNotice(null);
        try {
            const result = await updateAppstoreReviewWebhook({
                userId,
                appId,
                patch: {
                    public_token: generateAppstoreReviewWebhookToken(),
                    secret: generateAppstoreReviewWebhookSecret(),
                    last_delivery_status: 'idle',
                    last_error: null,
                    last_sync_status: 'idle',
                    last_sync_error: null,
                },
            });
            if (result.error) throw result.error;
            setNotice(text('appstore_review_webhook_rotated'));
            await refresh({ forceDraftHydrate: true });
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setBusyAction(null);
        }
    };

    const handleSaveAppleConfig = async () => {
        if (!appId || !userId || isReadOnly) return;
        setBusyAction('save');
        setNotice(null);
        try {
            await persistAppleDrafts({ showNotice: true });
            setExpanded(false);
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setBusyAction(null);
        }
    };

    const handleLoadAppleApps = async () => {
        if (!appId || !userId || isReadOnly) return;
        setBusyAction('apps');
        setNotice(null);
        try {
            const savedWebhook = await persistAppleDrafts({ refreshAfter: false });
            const result = await fetchAppstoreReviewAppleApps({
                publicSubdomain: resolveBridgeSubdomain(savedWebhook),
            });
            setAppleCandidates(Array.isArray(result.candidates) ? result.candidates : []);
            setAppleCandidatesLoaded(true);
            setNotice(
                result.auto_bound_app_id
                    ? text('appstore_review_webhook_apple_app_auto_bound')
                    : text('appstore_review_webhook_apple_apps_loaded')
            );
            await refresh({ forceDraftHydrate: true });
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setBusyAction(null);
        }
    };

    const handleCheckAppleNow = async () => {
        if (!appId || !userId || isReadOnly || !canCheckAppleNow) return;
        setBusyAction('check');
        setNotice(null);
        try {
            await runAppleSnapshotCheck({ reportErrors: true });
            setNotice(text('appstore_review_webhook_checked_apple'));
        } finally {
            setBusyAction(null);
        }
    };

    const handleSync = async () => {
        if (!appId || !userId || isReadOnly) return;
        setBusyAction('sync');
        setNotice(null);
        try {
            const savedWebhook = await persistAppleDrafts({ refreshAfter: false });
            await syncAppstoreReviewWebhook({
                publicSubdomain: resolveBridgeSubdomain(savedWebhook),
            });
            setNotice(text('appstore_review_webhook_synced'));
            await refresh({ forceDraftHydrate: true });
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
            await refresh({ silent: true, forceDraftHydrate: true, reportErrors: false });
        } finally {
            setBusyAction(null);
        }
    };

    const handlePing = async () => {
        if (!appId || !userId || isReadOnly) return;
        setBusyAction('ping');
        setNotice(null);
        try {
            await pingAppstoreReviewWebhook({
                publicSubdomain: resolveBridgeSubdomain(config),
            });
            setNotice(text('appstore_review_webhook_ping_sent'));
            void refresh({ silent: true, forceDraftHydrate: true, reportErrors: false });
            pingRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            pingRefreshTimersRef.current = [2500, 7000, 15000].map((delayMs) =>
                window.setTimeout(() => {
                    void refresh({ silent: true, forceDraftHydrate: true, reportErrors: false });
                }, delayMs)
            );
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setBusyAction(null);
        }
    };

    const appOptions = React.useMemo(() => {
        const seen = new Set<string>();
        const next: AppstoreConnectAppCandidate[] = [];
        appleCandidates.forEach((candidate) => {
            if (!candidate?.id || seen.has(candidate.id)) return;
            seen.add(candidate.id);
            next.push(candidate);
        });
        if (config?.asc_app_id && !seen.has(config.asc_app_id)) {
            next.unshift({
                id: config.asc_app_id,
                name: String(config.asc_app_name || '').trim(),
                bundle_id: String(config.asc_bundle_id || '').trim(),
                sku: '',
                bundle_match: Boolean(
                    bundleId && String(config.asc_bundle_id || '').trim().toLowerCase() === bundleId.toLowerCase()
                ),
            });
        }
        return next;
    }, [appleCandidates, bundleId, config?.asc_app_id, config?.asc_app_name, config?.asc_bundle_id]);

    if (!selectedApp) return null;

    return (
        <section className="rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-100">
                        <BellRing size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                                {text('appstore_review_webhook_title')}
                            </p>
                            {config && headerStatusLabel ? (
                                <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${headerStatusTone}`}
                                >
                                    {headerStatusLabel}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-2 text-xs text-indigo-200/60">{text('appstore_review_webhook_subtitle')}</p>
                        {!expanded ? (
                            loading ? (
                                <p className="mt-3 text-xs text-indigo-200/60">{text('loading')}</p>
                            ) : !config ? (
                                <p className="mt-3 text-xs text-indigo-200/60">{text('appstore_review_webhook_setup_hint')}</p>
                            ) : (
                                <>
                                    {setupBadges}
                                    {statusOverview}
                                    {!bundleId ? (
                                        <p className="mt-3 text-xs text-amber-100/90">
                                            {text('appstore_review_webhook_bundle_missing_hint')}
                                        </p>
                                    ) : null}
                                    {webhookReadinessIssues.length ? (
                                        <p className="mt-2 text-xs text-amber-100/90">{webhookReadinessIssues.join(' ')}</p>
                                    ) : null}
                                    {credentialIssues.length ? (
                                        <p className="mt-3 text-xs text-indigo-200/55">{credentialIssues.join(' ')}</p>
                                    ) : null}
                                    {config.last_sync_error ? (
                                        <p className="mt-2 text-xs text-rose-300/95">{config.last_sync_error}</p>
                                    ) : null}
                                    {config.last_error ? (
                                        <p className="mt-2 text-xs text-rose-300/95">{config.last_error}</p>
                                    ) : null}
                                </>
                            )
                        ) : null}
                        {serverStatusWarning ? (
                            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                                <p className="text-xs text-amber-100/90">
                                    {text('appstore_review_webhook_server_warning')} {serverStatusWarning}
                                </p>
                            </div>
                        ) : null}

                        {expanded ? !config ? (
                            <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                                <p className="text-xs text-indigo-100/85">{text('appstore_review_webhook_setup_hint')}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleCreate()}
                                        disabled={busyAction !== null || loading || isReadOnly}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                    >
                                        {busyAction === 'create' ? text('saving') : text('appstore_review_webhook_create')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_quick_setup_title')}
                                            </p>
                                            <p className="mt-1 text-xs text-indigo-200/55">
                                                {text('appstore_review_webhook_quick_setup_hint')}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleCheckAppleNow()}
                                            disabled={loading || busyAction !== null || !canCheckAppleNow}
                                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-4 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                        >
                                            <RefreshCcw size={13} />
                                            {busyAction === 'check'
                                                ? text('loading')
                                                : text('appstore_review_webhook_check_apple_button')}
                                        </button>
                                    </div>

                                    {setupBadges}
                                    {statusOverview}

                                    {!bundleId ? (
                                        <p className="mt-3 text-xs text-amber-100/90">
                                            {text('appstore_review_webhook_bundle_missing_hint')}
                                        </p>
                                    ) : null}
                                    {webhookReadinessIssues.length ? (
                                        <p className="mt-2 text-xs text-amber-100/90">{webhookReadinessIssues.join(' ')}</p>
                                    ) : null}
                                    {credentialIssues.length ? (
                                        <p className="mt-3 text-xs text-indigo-200/55">{credentialIssues.join(' ')}</p>
                                    ) : null}
                                    {config.last_sync_error ? (
                                        <p className="mt-2 text-xs text-rose-300/95">{config.last_sync_error}</p>
                                    ) : null}
                                    {config.last_error ? (
                                        <p className="mt-2 text-xs text-rose-300/95">{config.last_error}</p>
                                    ) : null}

                                    {showQuickSetupEditor ? (
                                        <>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <label className="block">
                                            <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_key_id')}
                                            </span>
                                            <input
                                                value={keyIdDraft}
                                                onChange={(event) => {
                                                    if (isReadOnly) return;
                                                    setKeyIdDraft(event.target.value);
                                                    markAppleDraftDirty();
                                                }}
                                                readOnly={isReadOnly}
                                                placeholder="2X9R4HXF34"
                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-indigo-200/35 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_issuer_id')}
                                            </span>
                                            <input
                                                value={issuerIdDraft}
                                                onChange={(event) => {
                                                    if (isReadOnly) return;
                                                    setIssuerIdDraft(event.target.value);
                                                    markAppleDraftDirty();
                                                }}
                                                readOnly={isReadOnly || keyModeDraft === 'individual'}
                                                placeholder={
                                                    keyModeDraft === 'individual'
                                                        ? text('appstore_review_webhook_issuer_id_not_needed')
                                                        : '57246542-96fe-1a63-e053-0824d011072a'
                                                }
                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-indigo-200/35 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            />
                                            {keyModeDraft === 'team' ? (
                                                <p
                                                    className={`mt-2 text-[11px] ${
                                                        teamIssuerIdInvalid ? 'text-rose-300/95' : 'text-indigo-200/55'
                                                    }`}
                                                >
                                                    {text(
                                                        teamIssuerIdInvalid
                                                            ? 'appstore_review_webhook_issuer_id_invalid'
                                                            : 'appstore_review_webhook_issuer_id_hint'
                                                    )}
                                                </p>
                                            ) : null}
                                        </label>
                                    </div>

                                    <label className="mt-3 block">
                                        <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                            {text('appstore_review_webhook_private_key')}
                                        </span>
                                        <input
                                            ref={privateKeyInputRef}
                                            type="file"
                                            accept=".p8,text/plain"
                                            onChange={handlePrivateKeyFilePick}
                                            className="hidden"
                                        />
                                        <div
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                if (isReadOnly) return;
                                                setIsPrivateKeyDragActive(true);
                                            }}
                                            onDragEnter={(event) => {
                                                event.preventDefault();
                                                if (isReadOnly) return;
                                                setIsPrivateKeyDragActive(true);
                                            }}
                                            onDragLeave={(event) => {
                                                event.preventDefault();
                                                if (isReadOnly) return;
                                                const nextTarget = event.relatedTarget;
                                                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                                                setIsPrivateKeyDragActive(false);
                                            }}
                                            onDrop={(event) => void handlePrivateKeyDrop(event)}
                                            className={`mt-2 rounded-2xl border border-dashed p-4 transition ${
                                                isPrivateKeyDragActive
                                                    ? 'border-indigo-300/60 bg-indigo-500/10'
                                                    : 'border-white/10 bg-slate-950/35'
                                            }`}
                                        >
                                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-100">
                                                        <Upload size={16} />
                                                    </div>
                                                    <p className="mt-2 text-xs font-semibold text-indigo-100/90">
                                                        {text('appstore_review_webhook_private_key_drop_title')}
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-indigo-200/55">
                                                        {text('appstore_review_webhook_private_key_drop_hint')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => privateKeyInputRef.current?.click()}
                                                    disabled={isReadOnly}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-3 py-2 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                                >
                                                    <Upload size={13} />
                                                    {text('appstore_review_webhook_private_key_pick')}
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={privateKeyDraft}
                                            onChange={(event) => {
                                                if (isReadOnly) return;
                                                setPrivateKeyDraft(event.target.value);
                                                markAppleDraftDirty();
                                            }}
                                            readOnly={isReadOnly}
                                            placeholder={text('appstore_review_webhook_private_key_placeholder')}
                                            rows={4}
                                            className="mt-2 w-full rounded-2xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-indigo-200/35 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                        />
                                        <p className="mt-2 text-[11px] text-indigo-200/45">
                                            {privateKeyConfigured
                                                ? text('appstore_review_webhook_private_key_replace_hint')
                                                : text('appstore_review_webhook_private_key_hint')}
                                        </p>
                                    </label>

                                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <label className="block">
                                            <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_apple_app')}
                                            </span>
                                            <select
                                                value={selectedAppleAppId}
                                                onChange={(event) => {
                                                    if (isReadOnly) return;
                                                    setSelectedAppleAppId(event.target.value);
                                                    markAppleDraftDirty();
                                                }}
                                                disabled={isReadOnly || !appOptions.length}
                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                            >
                                                <option value="">{text('appstore_review_webhook_apple_app_placeholder')}</option>
                                                {appOptions.map((candidate) => (
                                                    <option key={candidate.id} value={candidate.id}>
                                                        {candidate.name || candidate.bundle_id || candidate.id}
                                                        {candidate.bundle_id ? ` • ${candidate.bundle_id}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => void handleLoadAppleApps()}
                                            disabled={busyAction !== null || isReadOnly}
                                            className="inline-flex h-10 items-center justify-center gap-1.5 self-end rounded-full border border-white/10 bg-slate-950/20 px-4 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                        >
                                            <RefreshCcw size={13} />
                                            {busyAction === 'apps'
                                                ? text('loading')
                                                : text('appstore_review_webhook_load_apps')}
                                        </button>
                                    </div>

                                    {appleCandidatesLoaded && !appleCandidates.length ? (
                                        <p className="mt-2 text-xs text-indigo-200/55">
                                            {text('appstore_review_webhook_no_apps_found')}
                                        </p>
                                    ) : null}
                                        </>
                                    ) : (
                                        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/20 p-3">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2">
                                                        <div className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                                                            {text('appstore_review_webhook_key_id')}
                                                        </div>
                                                        <div className="mt-1 truncate text-xs text-indigo-100/90">{keyIdDraft || '—'}</div>
                                                    </div>
                                                    <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2">
                                                        <div className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                                                            {text('appstore_review_webhook_key_mode')}
                                                        </div>
                                                        <div className="mt-1 truncate text-xs text-indigo-100/90">
                                                            {text(
                                                                keyModeDraft === 'individual'
                                                                    ? 'appstore_review_webhook_key_mode_individual'
                                                                    : 'appstore_review_webhook_key_mode_team'
                                                            )}
                                                            {keyModeDraft === 'team' && issuerIdDraft ? ` · ${issuerIdDraft}` : ''}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2">
                                                        <div className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                                                            {text('appstore_review_webhook_private_key')}
                                                        </div>
                                                        <div className="mt-1 truncate text-xs text-indigo-100/90">
                                                            {text('appstore_review_webhook_private_key_stored')}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2">
                                                        <div className="text-[10px] font-semibold tracking-[0.08em] text-indigo-200/55">
                                                            {text('appstore_review_webhook_apple_app')}
                                                        </div>
                                                        <div className="mt-1 truncate text-xs text-indigo-100/90">
                                                            {selectedAppleAppSummary || '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickSetupEditing(true)}
                                                    disabled={isReadOnly}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-3 py-2 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                                    title={text('edit')}
                                                >
                                                    <Pencil size={13} />
                                                    {text('edit')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {showQuickSetupEditor ? (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleSaveAppleConfig()}
                                                disabled={busyAction !== null || isReadOnly}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                            >
                                                <Save size={13} />
                                                {busyAction === 'save'
                                                    ? text('saving')
                                                    : text('appstore_review_webhook_save_apple')}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                <details className="mt-3 rounded-2xl border border-white/8 bg-slate-950/20 p-3">
                                    <summary className="cursor-pointer list-none text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                        {text('appstore_review_webhook_advanced')}
                                    </summary>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handleSync()}
                                            disabled={busyAction !== null || isReadOnly}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                                        >
                                            <RefreshCcw size={13} />
                                            {busyAction === 'sync'
                                                ? text('loading')
                                                : text('appstore_review_webhook_sync_button')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handlePing()}
                                            disabled={busyAction !== null || isReadOnly}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-3 py-2 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                        >
                                            <Send size={13} />
                                            {busyAction === 'ping'
                                                ? text('loading')
                                                : text('appstore_review_webhook_send_test')}
                                        </button>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <label className="block">
                                            <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_key_mode')}
                                            </span>
                                            <select
                                                value={keyModeDraft}
                                                onChange={(event) => {
                                                    if (isReadOnly) return;
                                                    const nextValue = event.target.value === 'individual' ? 'individual' : 'team';
                                                    setKeyModeDraft(nextValue);
                                                    if (nextValue === 'individual') setIssuerIdDraft('');
                                                    markAppleDraftDirty();
                                                }}
                                                disabled={isReadOnly}
                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            >
                                                <option value="team">{text('appstore_review_webhook_key_mode_team')}</option>
                                                <option value="individual">{text('appstore_review_webhook_key_mode_individual')}</option>
                                            </select>
                                        </label>

                                        <label className="block">
                                            <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                {text('appstore_review_webhook_public_subdomain')}
                                            </span>
                                            <input
                                                value={publicSubdomainDraft}
                                                readOnly
                                                placeholder={suggestedPublicSubdomain || text('appstore_review_webhook_public_subdomain_placeholder')}
                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white/85 placeholder:text-indigo-200/35 outline-none"
                                            />
                                            <p className="mt-2 text-[11px] text-indigo-200/45">
                                                {text('appstore_review_webhook_public_subdomain_hint')}
                                            </p>
                                        </label>
                                    </div>

                                    {legacyExplicitWebhookUrl ? (
                                        <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3">
                                            <p className="text-xs text-sky-100/90">
                                                {text('appstore_review_webhook_legacy_override_active')}
                                            </p>
                                            <code className="mt-2 block break-all text-[11px] text-sky-100/85">
                                                {legacyExplicitWebhookUrl}
                                            </code>
                                        </div>
                                    ) : null}

                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                    {text('appstore_review_webhook_public_url')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyValue('endpoint', effectivePublicWebhookUrl)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-950/20 text-indigo-100/75 hover:border-indigo-400/40 hover:text-white"
                                                    aria-label={text('copy')}
                                                    title={copiedKey === 'endpoint' ? text('success') : text('copy')}
                                                >
                                                    {copiedKey === 'endpoint' ? <Check size={13} /> : <Copy size={13} />}
                                                </button>
                                            </div>
                                            <code className="mt-2 block break-all text-[11px] text-indigo-100/90">
                                                {effectivePublicWebhookUrl || text('appstore_review_webhook_public_url_missing')}
                                            </code>
                                        </div>

                                        <div className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                    {text('appstore_review_webhook_secret')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyValue('secret', config.secret)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-950/20 text-indigo-100/75 hover:border-indigo-400/40 hover:text-white"
                                                        aria-label={text('copy')}
                                                        title={copiedKey === 'secret' ? text('success') : text('copy')}
                                                    >
                                                        {copiedKey === 'secret' ? <Check size={13} /> : <Copy size={13} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleRotate()}
                                                        disabled={busyAction !== null || isReadOnly}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-950/20 text-indigo-100/75 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                                        aria-label={text('appstore_review_webhook_rotate')}
                                                        title={text('appstore_review_webhook_rotate')}
                                                    >
                                                        <RotateCw size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                            <code className="mt-2 block break-all text-[11px] text-indigo-100/90">{config.secret}</code>
                                        </div>
                                    </div>

                                    {workflowOverview}

                                    <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                    {text('appstore_review_webhook_event_type')}
                                                </p>
                                                <code className="mt-2 inline-flex rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-[11px] text-indigo-100/85">
                                                    {APPSTORE_REVIEW_EVENT_TYPE}
                                                </code>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                    {text('appstore_review_webhook_last_delivery')}
                                                </p>
                                                <p className="mt-2 text-xs text-indigo-100/90">{lastDeliveryLabel}</p>
                                                {config.last_delivery_at ? (
                                                    <p className="mt-1 text-[11px] text-indigo-200/55">
                                                        {formatTimestamp(config.last_delivery_at)}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                                    {text('appstore_review_webhook_latest_state')}
                                                </p>
                                                {latestStateLabel ? (
                                                    <>
                                                        <p className="mt-2 text-xs text-indigo-100/90">
                                                            {latestPrevStateLabel ? `${latestPrevStateLabel} -> ${latestStateLabel}` : latestStateLabel}
                                                        </p>
                                                        {config.latest_event_at ? (
                                                            <p className="mt-1 text-[11px] text-indigo-200/55">
                                                                {formatTimestamp(config.latest_event_at)}
                                                            </p>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <p className="mt-2 text-xs text-indigo-200/55">
                                                        {text('appstore_review_webhook_no_state')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </details>

                                {events.length ? (
                                    <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-indigo-200/70">
                                            {text('appstore_review_webhook_event_stream')}
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            {events.map((event) => {
                                                const nextLabel = formatAppstoreReviewState(event.state_to);
                                                const prevLabel = formatAppstoreReviewState(event.state_from);
                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-slate-950/35 px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span
                                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateTone(event.state_to || event.state_from)}`}
                                                                >
                                                                    {nextLabel || event.event_type}
                                                                </span>
                                                                {prevLabel && nextLabel ? (
                                                                    <span className="text-[11px] text-indigo-200/60">
                                                                        {prevLabel}
                                                                        {' -> '}
                                                                        {nextLabel}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <p className="mt-1 text-[11px] text-indigo-200/50">
                                                                {event.payload_type || event.event_type}
                                                            </p>
                                                        </div>
                                                        <span className="text-[11px] text-indigo-200/55">
                                                            {formatTimestamp(event.event_at)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {notice ? <p className="mt-3 text-xs text-emerald-300/95">{notice}</p> : null}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100/85 hover:border-indigo-400/40 hover:text-white"
                    title={expanded ? text('appstore_review_webhook_hide_setup') : text('appstore_review_webhook_open_setup')}
                >
                    <span>{expanded ? text('appstore_review_webhook_hide_setup') : text('appstore_review_webhook_open_setup')}</span>
                    <ChevronDown size={13} className={`transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </section>
    );
}
