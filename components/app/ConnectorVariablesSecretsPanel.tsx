import React from 'react';
import { Check, Copy, ExternalLink, FileText, LifeBuoy, Loader2, Plus, Shield } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type { AppItem, AppstoreAccount } from '../../types/zefgen';
import { isAvailableAppstoreAccount } from '../../utils/appstore-account-selection';
import { ConnectorAutosaveStatus } from './ConnectorAutosaveStatus';
import { ConnectorSaveConflictBanner } from './ConnectorSaveConflictBanner';

const DEFAULT_VARIABLES: Array<{ key: string; label: TranslationKey; placeholder?: string }> = [
    { key: 'appstore_name', label: 'connector_appstore_name' },
    { key: 'home_screen_name', label: 'connector_home_screen_name' },
    { key: 'bundle_id', label: 'connector_bundle_id', placeholder: 'com.example.app' },
    { key: 'domain', label: 'connector_domain', placeholder: 'https://...' },
    { key: 'apphud_api_key', label: 'connector_apphud_api_key', placeholder: 'apphud_key_live_xxxxx' },
    { key: 'firebase_plist_snippet', label: 'connector_firebase_plist_snippet' },
    { key: 'appstore_description', label: 'connector_appstore_description' },
    { key: 'id_purchases', label: 'connector_id_purchases' },
];

const APP_NAME_MAX_LENGTH = 30;
const APPSTORE_DESCRIPTION_MIN_SPEC_LENGTH = 100;
const APPSTORE_DESCRIPTION_MAX_LENGTH = 4000;
const APPSTORE_INITIAL_SUBTITLE_MAX_LENGTH = 30;
const APPSTORE_INITIAL_KEYWORDS_MAX_LENGTH = 100;
const APPSTORE_INITIAL_SUBTITLE_KEY = 'appstore_initial_subtitle';
const APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY = 'appstore_initial_subtitle_options';
const APPSTORE_INITIAL_KEYWORDS_KEY = 'appstore_initial_keywords';
const APP_NAME_VARIABLE_KEYS = new Set(['appstore_name', 'app_new_name', 'home_screen_name']);
const WIDE_VARIABLE_KEYS = new Set(['appstore_description', 'firebase_plist_snippet']);
const OPTIONAL_VARIABLE_KEYS = new Set(['id_purchases']);
const BOOTSTRAP_LEGAL_URL_PLACEHOLDER = 'https://google.com';

const getInitialSubtitleOptions = (raw: Record<string, any> | null | undefined) => {
    const value = (raw || {})[APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY];
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

export function ConnectorVariablesSecretsPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    isReadOnly?: boolean;
    selectedApp: AppItem | null;
    account: AppstoreAccount | null;
    allAccounts: AppstoreAccount[];
    onPickAccount?: (modeOrId: null | string) => Promise<void>;
    onOpenAccountsForApp?: () => void;
    text: (key: TranslationKey) => string;
}) {
    const {
        connectorForm,
        isEnabled,
        isReadOnly = false,
        selectedApp,
        account,
        allAccounts,
        onPickAccount,
        onOpenAccountsForApp,
        text,
    } =
        props;
    const canEdit = isEnabled && !isReadOnly;

    const [secretKey, setSecretKey] = React.useState('');
    const [secretValue, setSecretValue] = React.useState('');
    const secretKeyInputRef = React.useRef<HTMLInputElement | null>(null);
    const [generateNotice, setGenerateNotice] = React.useState<string | null>(null);
    const [actionHint, setActionHint] = React.useState<{ target: 'generate' | 'webpage'; message: string } | null>(null);
    const actionHintTimerRef = React.useRef<number | null>(null);

    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
    const copiedTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
            if (actionHintTimerRef.current) window.clearTimeout(actionHintTimerRef.current);
        };
    }, []);

    React.useEffect(() => {
        setGenerateNotice(null);
        setActionHint(null);
    }, [selectedApp?.id]);

    const showActionHint = React.useCallback((target: 'generate' | 'webpage', message: string) => {
        if (actionHintTimerRef.current) window.clearTimeout(actionHintTimerRef.current);
        setActionHint({ target, message });
        actionHintTimerRef.current = window.setTimeout(() => {
            setActionHint((current) => (current?.target === target && current.message === message ? null : current));
            actionHintTimerRef.current = null;
        }, 2400);
    }, []);

    const copyValue = async (key: string, value: string) => {
        const v = String(value ?? '');
        if (!v) return;
        try {
            await navigator.clipboard.writeText(v);
        } catch {
            const el = document.createElement('textarea');
            el.value = v;
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '0';
            document.body.appendChild(el);
            el.focus();
            el.select();
            try {
                document.execCommand('copy');
            } finally {
                document.body.removeChild(el);
            }
        }
        setCopiedKey(key);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1200);
    };

    const [pickBusy, setPickBusy] = React.useState(false);

    const accountIndexById = React.useMemo(() => {
        const map = new Map<string, number>();
        allAccounts.forEach((a, i) => map.set(a.id, i + 1));
        return map;
    }, [allAccounts]);

    const pickerOptions = React.useMemo(() => {
        if (!selectedApp) return [];
        return allAccounts.filter((accountOption) => {
            if (accountOption.id === account?.id) return true;
            return isAvailableAppstoreAccount(accountOption);
        });
    }, [account?.id, allAccounts, selectedApp]);

    const pickerValue = React.useMemo(() => {
        return account?.id || 'unassigned';
    }, [account?.id]);

    const resolvedCompanyName = React.useMemo(() => {
        return String(account?.company_name || '').trim();
    }, [account?.company_name]);

    const resolvedAppStoreName = React.useMemo(() => {
        return String((connectorForm.variables as any)?.appstore_name || '').trim();
    }, [connectorForm.variables]);

    const resolvedAppStoreDescription = React.useMemo(() => {
        return String((connectorForm.variables as any)?.appstore_description || '').trim();
    }, [connectorForm.variables]);

    const resolvedInitialSubtitle = React.useMemo(() => {
        return String((connectorForm.variables as any)?.[APPSTORE_INITIAL_SUBTITLE_KEY] || '').trim();
    }, [connectorForm.variables]);

    const resolvedInitialSubtitleOptions = React.useMemo(() => {
        return getInitialSubtitleOptions(connectorForm.variables);
    }, [connectorForm.variables]);

    const resolvedInitialKeywords = React.useMemo(() => {
        return String((connectorForm.variables as any)?.[APPSTORE_INITIAL_KEYWORDS_KEY] || '');
    }, [connectorForm.variables]);

    const resolvedAccountEmail = React.useMemo(() => {
        return String(account?.email || '').trim();
    }, [account?.email]);

    const accountCopyLine = React.useMemo(() => {
        const alias = String(selectedApp?.alias || '')
            .trim()
            .toUpperCase();
        const name = String(selectedApp?.name || '').trim();
        const email = resolvedAccountEmail;
        if (!alias || !name || !email) return '';
        return `[${alias}] ${name} [iOS] ${email}`;
    }, [resolvedAccountEmail, selectedApp?.alias, selectedApp?.name]);

    const missingGenerateInputs = React.useMemo(() => {
        const missing: string[] = [];
        if (!resolvedCompanyName) missing.push(text('connector_company_name'));
        if (!resolvedAppStoreName) missing.push(text('connector_appstore_name'));
        if (!resolvedAccountEmail) missing.push(text('accounts_email'));
        return missing;
    }, [resolvedCompanyName, resolvedAppStoreName, resolvedAccountEmail, text]);

    const generateBlocked = missingGenerateInputs.length > 0;

    const legalLinks = React.useMemo(
        () =>
            [
                {
                    key: 'privacy_policy_url',
                    shortLabel: text('connector_legal_privacy_short'),
                    fullLabel: text('connector_privacy_policy_url'),
                    Icon: Shield,
                },
                {
                    key: 'terms_of_use_url',
                    shortLabel: text('connector_legal_terms_short'),
                    fullLabel: text('connector_terms_of_use_url'),
                    Icon: FileText,
                },
                {
                    key: 'support_form_url',
                    shortLabel: text('connector_legal_support_short'),
                    fullLabel: text('connector_support_form_url'),
                    Icon: LifeBuoy,
                },
            ] as const,
        [text]
    );

    const hasGeneratedLegalLinks = React.useMemo(
        () =>
            legalLinks.some((link) => {
                const rawUrl = String((connectorForm.legalLinks as any)?.[link.key] ?? '').trim();
                return isUsableLegalUrl(rawUrl);
            }),
        [connectorForm.legalLinks, legalLinks]
    );
    const hasCompleteLegalLinks = React.useMemo(
        () =>
            legalLinks.every((link) => {
                const rawUrl = String((connectorForm.legalLinks as any)?.[link.key] ?? '').trim();
                return isUsableLegalUrl(rawUrl);
            }),
        [connectorForm.legalLinks, legalLinks]
    );
    const generateButtonLabelKey: TranslationKey = hasGeneratedLegalLinks
        ? 'connector_regenerate_links'
        : 'connector_generate_links';
    const generateButtonTitle = generateBlocked
        ? String(text('connector_generate_blocked_missing') || '').replace('{items}', missingGenerateInputs.join(', '))
        : text('connector_generate_links_hint');
    const generateButtonInlineReason = generateBlocked ? generateButtonTitle : '';

    const projectBriefLength = React.useMemo(
        () => String(connectorForm.projectBrief || '').trim().length,
        [connectorForm.projectBrief]
    );
    const appstoreDescriptionRegenerateBlocked = projectBriefLength < APPSTORE_DESCRIPTION_MIN_SPEC_LENGTH;
    const appstoreDescriptionRegenerateTitle = appstoreDescriptionRegenerateBlocked
        ? text('connector_appstore_desc_short_spec_hint')
        : text('connector_appstore_desc_regenerate');
    const webpageMissingInputs = React.useMemo(() => {
        const missing: string[] = [];
        if (!resolvedAppStoreName) missing.push(text('connector_appstore_name'));
        if (!resolvedAppStoreDescription) missing.push(text('connector_appstore_description'));
        if (!hasCompleteLegalLinks) {
            legalLinks.forEach((link) => {
                const rawUrl = String((connectorForm.legalLinks as any)?.[link.key] ?? '').trim();
                if (!isUsableLegalUrl(rawUrl)) missing.push(link.fullLabel);
            });
        }
        return missing;
    }, [
        connectorForm.legalLinks,
        hasCompleteLegalLinks,
        legalLinks,
        resolvedAppStoreDescription,
        resolvedAppStoreName,
        text,
    ]);
    const webpagePublished = Boolean(connectorForm.publicPagePublishedAt && connectorForm.publicWebpageUrl);
    const webpageGenerateBlocked = webpageMissingInputs.length > 0;
    const webpageButtonLabelKey: TranslationKey = webpagePublished
        ? 'connector_open_webpage'
        : 'connector_generate_webpage';
    const webpageButtonTitle = webpagePublished
        ? text('connector_open_webpage_hint')
        : webpageGenerateBlocked
          ? String(text('connector_generate_blocked_missing') || '').replace('{items}', webpageMissingInputs.join(', '))
          : text('connector_generate_webpage_hint');
    const webpageButtonInlineReason = !webpagePublished && webpageGenerateBlocked ? webpageButtonTitle : '';

    const compactVariables = React.useMemo(
        () => DEFAULT_VARIABLES.filter((f) => !WIDE_VARIABLE_KEYS.has(f.key)),
        []
    );
    const wideVariables = React.useMemo(
        () => DEFAULT_VARIABLES.filter((f) => WIDE_VARIABLE_KEYS.has(f.key)),
        []
    );

    const handlePickChange = async (raw: string) => {
        if (!selectedApp) return;
        if (!onPickAccount) return;
        if (pickBusy) return;

        const next: null | string = raw === 'unassigned' ? null : raw;
        if ((account && next === account.id) || (!account && next === null)) return;

        setPickBusy(true);
        try {
            await onPickAccount(next);
        } finally {
            setPickBusy(false);
        }
    };

    const upsertSecret = async () => {
        const k = secretKey.trim();
        if (!k) return;
        if (!secretValue) return;
        await connectorForm.upsertSecret(k, secretValue);
        setSecretKey('');
        setSecretValue('');
    };

    const chooseInitialSubtitle = React.useCallback(
        async (subtitle: string) => {
            const nextSubtitle = String(subtitle || '').slice(0, APPSTORE_INITIAL_SUBTITLE_MAX_LENGTH).trim();
            if (!nextSubtitle) return;
            await connectorForm.saveMergedVariablesPatch(
                {
                    [APPSTORE_INITIAL_SUBTITLE_KEY]: nextSubtitle,
                    [APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY]: [],
                },
                { source: 'manual' }
            );
        },
        [connectorForm]
    );

    const handleGenerateLinks = React.useCallback(async () => {
        if (!canEdit) return;
        if (connectorForm.generateLinksBusy) return;
        if (connectorForm.generateDescriptionBusy) {
            showActionHint('generate', text('connector_appstore_desc_busy'));
            return;
        }
        if (connectorForm.staleConflict) {
            showActionHint('generate', text('connector_action_blocked_conflict'));
            return;
        }
        if (generateBlocked) {
            showActionHint('generate', generateButtonTitle);
            return;
        }
        setActionHint(null);
        setGenerateNotice(null);

        const precheck = await connectorForm.precheckLegalLinksRegeneration({
            companyName: resolvedCompanyName,
            appStoreName: resolvedAppStoreName,
            accountEmail: resolvedAccountEmail,
        });
        if (!precheck) return;

        const shouldRegenerate = precheck.requiresConfirm
            ? window.confirm(text('connector_generate_links_confirm_regenerate'))
            : false;
        if (precheck.requiresConfirm && !shouldRegenerate) return;

        const first = await connectorForm.generateLegalLinks(shouldRegenerate);
        if (!first) return;

        // Race-safe fallback: backend still guards with confirm_required.
        if (first.status === 'confirm_required') {
            const confirm = window.confirm(text('connector_generate_links_confirm_regenerate'));
            if (!confirm) {
                connectorForm.cancelPendingLegalLinksGeneration('Canceled');
                return;
            }

            const second = await connectorForm.generateLegalLinks(true);
            if (!second || second.status !== 'generated') return;
            setGenerateNotice(text('connector_generate_links_success'));
            return;
        }

        setGenerateNotice(text('connector_generate_links_success'));
    }, [
        connectorForm,
        canEdit,
        generateBlocked,
        generateButtonTitle,
        resolvedAccountEmail,
        resolvedAppStoreName,
        resolvedCompanyName,
        showActionHint,
        text,
    ]);

    const handleRegenerateDescriptionOnly = async () => {
        if (!canEdit || connectorForm.generateDescriptionBusy || appstoreDescriptionRegenerateBlocked) return;
        setGenerateNotice(null);
        const result = await connectorForm.regenerateAppstoreDescription({
            companyName: resolvedCompanyName,
        });
        if (!result) return;
        if (result.status === 'generated') {
            setGenerateNotice(text('connector_appstore_desc_generated'));
            return;
        }
        if (result.status === 'skipped_short_spec') {
            setGenerateNotice(text('connector_appstore_desc_skipped_short_spec'));
            return;
        }
        setGenerateNotice(text('connector_appstore_desc_failed'));
    };

    const handleGenerateWebpage = React.useCallback(async () => {
        if (!canEdit) return;
        if (connectorForm.publishWebpageBusy) return;
        if (webpagePublished && connectorForm.publicWebpageUrl) {
            window.open(connectorForm.publicWebpageUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        if (connectorForm.staleConflict) {
            showActionHint('webpage', text('connector_action_blocked_conflict'));
            return;
        }
        if (webpageGenerateBlocked) {
            showActionHint('webpage', webpageButtonTitle);
            return;
        }
        setActionHint(null);
        setGenerateNotice(text('connector_webpage_publishing_busy'));
        const result = await connectorForm.publishAppstoreReviewPublicPage();
        if (result?.error) {
            setGenerateNotice(result.error);
            return;
        }
        if (!result?.publicWebpageUrl) {
            setGenerateNotice(text('connector_webpage_publish_failed'));
            return;
        }
        setGenerateNotice(text('connector_webpage_published'));
    }, [
        connectorForm,
        canEdit,
        showActionHint,
        text,
        webpageButtonTitle,
        webpageGenerateBlocked,
        webpagePublished,
    ]);

    if (!isEnabled) {
        return (
            <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('connector_config_title')}
                        </p>
                        <p className="mt-3 text-sm text-indigo-200/60">{text('connector_config_subtitle')}</p>
                    </div>
                </div>
                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            </section>
        );
    }

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('connector_config_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('connector_config_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-start justify-end gap-2">
                    <div className="flex flex-col items-end gap-1">
                        <span title={generateButtonTitle} className="inline-flex">
                            <button
                                type="button"
                                onClick={() => void handleGenerateLinks()}
                                disabled={
                                    connectorForm.generateLinksBusy ||
                                    connectorForm.generateDescriptionBusy
                                }
                                title={generateButtonTitle}
                                className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                            >
                                {connectorForm.generateLinksBusy ? text('loading') : text(generateButtonLabelKey)}
                            </button>
                        </span>
                        {generateButtonInlineReason || actionHint?.target === 'generate' ? (
                            <div aria-live="polite" className="max-w-[220px] text-right text-[10px] leading-4 text-amber-100/85">
                                {generateButtonInlineReason || actionHint?.message}
                            </div>
                        ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span title={webpageButtonTitle} className="inline-flex">
                            <button
                                type="button"
                                onClick={() => void handleGenerateWebpage()}
                                disabled={!webpagePublished && connectorForm.publishWebpageBusy}
                                title={webpageButtonTitle}
                                className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                            >
                                {connectorForm.publishWebpageBusy
                                    ? text('loading')
                                    : text(webpageButtonLabelKey)}
                            </button>
                        </span>
                        {webpageButtonInlineReason || actionHint?.target === 'webpage' ? (
                            <div aria-live="polite" className="max-w-[220px] text-right text-[10px] leading-4 text-amber-100/85">
                                {webpageButtonInlineReason || actionHint?.message}
                            </div>
                        ) : null}
                    </div>
                    <ConnectorAutosaveStatus connectorForm={connectorForm} text={text} />
                </div>
            </div>

            {connectorForm.error && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {connectorForm.error}
                </div>
            )}
            <ConnectorSaveConflictBanner connectorForm={connectorForm} text={text} />
            {generateNotice && (
                <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100/90">
                    {generateNotice}
                </div>
            )}
            {connectorForm.publicWebpageUrl && connectorForm.publicPagePublishedAt ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 p-3">
                    <div className="flex items-center gap-2">
                        <a
                            href={connectorForm.publicWebpageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full truncate rounded-full border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-cyan-100/90 underline-offset-4 outline-none transition hover:border-cyan-400/40 hover:text-cyan-50 hover:underline"
                            title={connectorForm.publicWebpageUrl}
                        >
                            {connectorForm.publicWebpageUrl}
                        </a>
                        <button
                            type="button"
                            onClick={() => void copyValue('webpage.url', connectorForm.publicWebpageUrl)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white"
                            title={text('copy')}
                        >
                            {copiedKey === 'webpage.url' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => window.open(connectorForm.publicWebpageUrl, '_blank', 'noopener,noreferrer')}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white"
                            title={text('connector_open_webpage')}
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="mt-5 grid gap-3">
                {accountCopyLine ? (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
                        <div className="flex items-center gap-2">
                            <input
                                value={accountCopyLine}
                                readOnly
                                className="w-full rounded-full border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-indigo-100/90 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => void copyValue('account.copy_line', accountCopyLine)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white"
                                title={text('copy')}
                            >
                                {copiedKey === 'account.copy_line' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold text-indigo-100">{text('accounts_account')}</div>
                            <div className="mt-1 text-[11px] text-indigo-200/45">{text('accounts_account_hint')}</div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="relative">
                                <select
                                    aria-label={text('accounts_account')}
                                    value={pickerValue}
                                    onChange={(e) => void handlePickChange(e.target.value)}
                                    disabled={!canEdit || !selectedApp || !onPickAccount || pickBusy}
                                    className="h-9 rounded-full border border-white/10 bg-slate-950/20 pl-4 pr-9 text-[11px] font-semibold text-indigo-100/85 outline-none hover:border-indigo-400/35 disabled:opacity-60"
                                    title={text('accounts_account')}
                                >
                                    <option value="unassigned">{text('accounts_unassigned')}</option>
                                    {pickerOptions.map((a) => {
                                        const n = accountIndexById.get(a.id) ?? null;
                                        const nLabel = n ? `#${n}` : '#—';
                                        const email = String(a.email || '').trim();
                                        const label = email ? `${nLabel} · ${email}` : nLabel;
                                        return (
                                            <option key={a.id} value={a.id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                    {account && !pickerOptions.some((a) => a.id === account.id) ? (
                                        <option value={account.id}>
                                            {`${accountIndexById.get(account.id) ? `#${accountIndexById.get(account.id)}` : '#—'}${
                                                account.email ? ` · ${account.email}` : ''
                                            }`}
                                        </option>
                                    ) : null}
                                </select>
                                {pickBusy ? (
                                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-indigo-100/70">
                                        <Loader2 size={14} className="animate-spin" />
                                    </div>
                                ) : null}
                            </div>

                            {account ? (
                                <span
                                    className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                        account.was_used_before
                                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100/95'
                                            : account.usability
                                              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                              : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                                    }`}
                                    title={
                                        account.was_used_before
                                            ? text('accounts_used_before')
                                            : account.usability
                                              ? text('accounts_usable')
                                              : text('accounts_disabled')
                                    }
                                >
                                    {account.was_used_before
                                        ? text('accounts_used_before')
                                        : account.usability
                                          ? text('accounts_usable')
                                          : text('accounts_disabled')}
                                </span>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => onOpenAccountsForApp?.()}
                                aria-label={text('accounts_open_accounts')}
                                className="ui-btn-fit ui-btn-fit-dense inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:text-white disabled:opacity-60"
                                title={text('accounts_open_accounts')}
                                disabled={!isEnabled}
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>
                    </div>

                    {!account ? (
                        <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-[11px] text-amber-50/90 flex items-center justify-between gap-3">
                            <span>{text('accounts_no_account_for_app')}</span>
                        </div>
                    ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {(
                                [
                                    { key: 'email', label: text('accounts_email'), value: account.email },
                                    { key: 'password', label: text('accounts_password'), value: account.password },
                                    { key: 'number', label: text('accounts_number'), value: account.number },
                                    { key: 'geo', label: text('accounts_geo'), value: account.geo },
                                    { key: 'company_name', label: text('accounts_company_name'), value: account.company_name },
                                    { key: 'proxy', label: text('accounts_proxy'), value: account.proxy },
                                ] as Array<{ key: string; label: string; value: string }>
                            ).map((f) => (
                                <label key={f.key} className="grid gap-1">
                                    <div className="text-[11px] text-indigo-200/60">{f.label}</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={String(f.value ?? '')}
                                            readOnly
                                            className="w-full rounded-full border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-indigo-100/90 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => copyValue(`account.${f.key}`, String(f.value ?? ''))}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white"
                                            title={text('copy')}
                                        >
                                            {copiedKey === `account.${f.key}` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    {account && (account.was_used_before || !account.usability) ? (
                        <div
                            className={`mt-3 text-[11px] ${
                                account.was_used_before ? 'text-amber-100/85' : 'text-rose-200/80'
                            }`}
                        >
                            {account.was_used_before ? text('accounts_used_before_hint') : text('accounts_disabled_hint')}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_variables')}</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {compactVariables.map((f) => (
                            <label
                                key={f.key}
                                className="grid gap-1"
                            >
                                <div className={`${OPTIONAL_VARIABLE_KEYS.has(f.key) ? 'text-[11px] text-indigo-200/55' : 'text-[11px] text-indigo-200/60'}`}>
                                    {text(f.label)}
                                </div>
                                <input
                                    data-testid={`connector-variable-input-${f.key}`}
                                    value={String(connectorForm.variables?.[f.key] ?? '')}
                                    onChange={(e) =>
                                        connectorForm.setVariable(
                                            f.key,
                                            APP_NAME_VARIABLE_KEYS.has(f.key)
                                                ? e.target.value.slice(0, APP_NAME_MAX_LENGTH)
                                                : e.target.value
                                        )
                                    }
                                    maxLength={APP_NAME_VARIABLE_KEYS.has(f.key) ? APP_NAME_MAX_LENGTH : undefined}
                                    disabled={!canEdit}
                                    className={`w-full rounded-full px-4 py-2 text-xs outline-none placeholder:text-indigo-200/30 disabled:opacity-60 ${
                                        OPTIONAL_VARIABLE_KEYS.has(f.key)
                                            ? 'border border-white/8 bg-slate-950/16 text-indigo-100/78 placeholder:italic placeholder:text-indigo-200/28 focus:border-indigo-300/24'
                                            : 'border border-white/10 bg-slate-950/20 text-indigo-100/90 focus:border-indigo-400/40'
                                    }`}
                                    placeholder={
                                        OPTIONAL_VARIABLE_KEYS.has(f.key)
                                            ? text('optional')
                                            : f.placeholder
                                              ? String(f.placeholder)
                                              : undefined
                                    }
                                />
                            </label>
                        ))}

                        <label className="grid gap-1">
                            <div className="text-[11px] text-indigo-200/60">{text('connector_generated_webpage')}</div>
                            <div className="flex items-center gap-2">
                                {connectorForm.publicWebpageUrl ? (
                                    <a
                                        href={connectorForm.publicWebpageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full truncate rounded-full border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-cyan-100/90 underline-offset-4 outline-none transition hover:border-cyan-400/40 hover:text-cyan-50 hover:underline"
                                        title={connectorForm.publicWebpageUrl}
                                    >
                                        {connectorForm.publicWebpageUrl}
                                    </a>
                                ) : (
                                    <input
                                        value=""
                                        readOnly
                                        className="w-full rounded-full border border-white/10 bg-slate-950/15 px-4 py-2 text-xs text-indigo-100/70 outline-none"
                                        placeholder={text('connector_generated_webpage_placeholder')}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => void copyValue('webpage.compact', String(connectorForm.publicWebpageUrl || ''))}
                                    disabled={!connectorForm.publicWebpageUrl}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                    title={text('copy')}
                                >
                                    {copiedKey === 'webpage.compact' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </label>

                        <div className="grid gap-1">
                            <div className="text-[11px] text-indigo-200/60">{text('connector_legal_links')}</div>
                            <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                                {legalLinks.map((link) => {
                                    const rawUrl = String((connectorForm.legalLinks as any)?.[link.key] ?? '').trim();
                                    const usable = isUsableLegalUrl(rawUrl);
                                    const hint = usable
                                        ? `${text('connector_legal_link_open_hint')}: ${link.fullLabel}`
                                        : text('connector_legal_link_pending_hint');
                                    const Icon = link.Icon;

                                    if (usable) {
                                        return (
                                            <div key={link.key} className="relative min-w-0 flex-1">
                                                <a
                                                    href={rawUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={hint}
                                                    aria-label={link.fullLabel}
                                                    className="ui-btn-fit ui-btn-fit-dense inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-2 pr-2 sm:pr-7 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20"
                                                >
                                                    <Icon size={13} />
                                                    <span className="hidden sm:inline truncate">{link.shortLabel}</span>
                                                    <span className="sr-only sm:hidden">{link.shortLabel}</span>
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyValue(`legal.${link.key}`, rawUrl)}
                                                    className="hidden sm:inline-flex absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-slate-950/35 text-indigo-100/70 hover:border-indigo-300/40 hover:text-white"
                                                    title={text('copy')}
                                                    aria-label={text('copy')}
                                                >
                                                    {copiedKey === `legal.${link.key}` ? <Check size={11} /> : <Copy size={11} />}
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={link.key}
                                            type="button"
                                            disabled
                                            title={hint}
                                            aria-label={link.fullLabel}
                                            className="ui-btn-fit ui-btn-fit-dense inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-slate-950/15 px-2 py-2 text-[11px] font-semibold text-indigo-200/45 disabled:opacity-80"
                                        >
                                            <Icon size={13} />
                                            <span className="hidden sm:inline truncate">{link.shortLabel}</span>
                                            <span className="sr-only sm:hidden">{link.shortLabel}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {wideVariables.map((f) => {
                            const value = String(connectorForm.variables?.[f.key] ?? '');
                            const isAppstoreDescription = f.key === 'appstore_description';
                            const appstoreDescriptionLength = isAppstoreDescription ? value.length : 0;
                            const initialSubtitleLength = isAppstoreDescription ? resolvedInitialSubtitle.length : 0;
                            const initialKeywordsLength = isAppstoreDescription ? resolvedInitialKeywords.length : 0;
                            const hasPendingInitialSubtitleOptions =
                                isAppstoreDescription && !resolvedInitialSubtitle && resolvedInitialSubtitleOptions.length > 0;
                            return (
                                <label key={f.key} className="grid gap-1 sm:col-span-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[11px] text-indigo-200/60">{text(f.label)}</div>
                                        {isAppstoreDescription ? (
                                            <div className="flex items-center gap-1.5">
                                                <span title={appstoreDescriptionRegenerateTitle} className="inline-flex">
                                                    <button
                                                        type="button"
                                                        data-testid="connector-appstore-description-regenerate"
                                                        aria-label={text('connector_appstore_desc_regenerate')}
                                                        onClick={() => void handleRegenerateDescriptionOnly()}
                                                        disabled={
                                                            !canEdit ||
                                                            connectorForm.generateDescriptionBusy ||
                                                            connectorForm.generateLinksBusy ||
                                                            appstoreDescriptionRegenerateBlocked
                                                        }
                                                        title={appstoreDescriptionRegenerateTitle}
                                                        className="ui-btn-fit ui-btn-fit-dense inline-flex min-w-[150px] items-center justify-center gap-1.5 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                                    >
                                                        {connectorForm.generateDescriptionBusy ? (
                                                            <>
                                                                <Loader2 size={12} className="animate-spin" />
                                                                <span>{text('connector_appstore_desc_busy')}</span>
                                                            </>
                                                        ) : (
                                                            text('connector_appstore_desc_regenerate')
                                                        )}
                                                    </button>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyValue('variable.appstore_description', value)}
                                                    disabled={!value}
                                                    className="ui-btn-fit ui-btn-fit-dense inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                                                    title={text('connector_appstore_desc_copy')}
                                                >
                                                    {copiedKey === 'variable.appstore_description' ? (
                                                        <Check size={13} />
                                                    ) : (
                                                        <Copy size={13} />
                                                    )}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                    {isAppstoreDescription && connectorForm.generateDescriptionBusy ? (
                                        <div className="mt-0.5">
                                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-100/75">
                                                <Loader2 size={10} className="animate-spin" />
                                                <span>{text('connector_appstore_desc_busy')}</span>
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className="relative">
                                        <textarea
                                            data-testid={`connector-variable-textarea-${f.key}`}
                                            value={value}
                                            onChange={(e) =>
                                                connectorForm.setVariable(
                                                    f.key,
                                                    isAppstoreDescription
                                                        ? e.target.value.slice(0, APPSTORE_DESCRIPTION_MAX_LENGTH)
                                                        : e.target.value
                                                )
                                            }
                                            rows={4}
                                            maxLength={isAppstoreDescription ? APPSTORE_DESCRIPTION_MAX_LENGTH : undefined}
                                            disabled={!canEdit}
                                            className={`w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60 ${
                                                f.key === 'firebase_plist_snippet' ? 'font-mono text-[11px]' : ''
                                            }`}
                                            placeholder={f.placeholder ? String(f.placeholder) : undefined}
                                        />
                                        {isAppstoreDescription && connectorForm.generateDescriptionBusy ? (
                                            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-indigo-300/20 bg-gradient-to-r from-transparent via-indigo-300/10 to-transparent animate-pulse" />
                                        ) : null}
                                    </div>
                                    {isAppstoreDescription ? (
                                        <div className="text-right text-[10px] text-indigo-200/55">
                                            {appstoreDescriptionLength}/{APPSTORE_DESCRIPTION_MAX_LENGTH}
                                        </div>
                                    ) : null}
                                    {isAppstoreDescription ? (
                                        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/15 p-3 sm:p-4">
                                            <div className="grid gap-3">
                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[11px] text-indigo-200/60">
                                                            {text('connector_appstore_initial_subtitle')}
                                                        </div>
                                                        <span className="text-[10px] text-indigo-200/55">
                                                            {initialSubtitleLength}/{APPSTORE_INITIAL_SUBTITLE_MAX_LENGTH}
                                                        </span>
                                                    </div>
                                                    {hasPendingInitialSubtitleOptions ? (
                                                        <div className="grid gap-2">
                                                            <div className="text-[10px] text-indigo-200/45">
                                                                {text('connector_appstore_initial_subtitle_choose')}
                                                            </div>
                                                            <div className="grid gap-2">
                                                                {resolvedInitialSubtitleOptions.map((option, index) => (
                                                                    <button
                                                                        key={`${option}-${index}`}
                                                                        type="button"
                                                                        data-testid={`connector-appstore-initial-subtitle-option-${index + 1}`}
                                                                        onClick={() => void chooseInitialSubtitle(option)}
                                                                        disabled={!canEdit || connectorForm.saving}
                                                                        className="w-full rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-left text-xs text-indigo-50/95 hover:bg-indigo-500/15 disabled:opacity-60"
                                                                    >
                                                                        {option}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    <input
                                                        data-testid="connector-variable-input-appstore_initial_subtitle"
                                                        value={resolvedInitialSubtitle}
                                                        onChange={(e) => {
                                                            const nextSubtitle = e.target.value.slice(
                                                                0,
                                                                APPSTORE_INITIAL_SUBTITLE_MAX_LENGTH
                                                            );
                                                            if (resolvedInitialSubtitleOptions.length > 0) {
                                                                connectorForm.setVariables((prev) => ({
                                                                    ...prev,
                                                                    [APPSTORE_INITIAL_SUBTITLE_KEY]: nextSubtitle,
                                                                    [APPSTORE_INITIAL_SUBTITLE_OPTIONS_KEY]: [],
                                                                }));
                                                                return;
                                                            }
                                                            connectorForm.setVariable(
                                                                APPSTORE_INITIAL_SUBTITLE_KEY,
                                                                nextSubtitle
                                                            );
                                                        }}
                                                        maxLength={APPSTORE_INITIAL_SUBTITLE_MAX_LENGTH}
                                                        disabled={!canEdit}
                                                        className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                                                        placeholder={text('connector_appstore_initial_subtitle_hint')}
                                                    />
                                                </div>

                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[11px] text-indigo-200/60">
                                                            {text('connector_appstore_initial_keywords')}
                                                        </div>
                                                        <span className="text-[10px] text-indigo-200/55">
                                                            {initialKeywordsLength}/{APPSTORE_INITIAL_KEYWORDS_MAX_LENGTH}
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        data-testid="connector-variable-textarea-appstore_initial_keywords"
                                                        value={resolvedInitialKeywords}
                                                        onChange={(e) =>
                                                            connectorForm.setVariable(
                                                                APPSTORE_INITIAL_KEYWORDS_KEY,
                                                                e.target.value.slice(0, APPSTORE_INITIAL_KEYWORDS_MAX_LENGTH)
                                                            )
                                                        }
                                                        maxLength={APPSTORE_INITIAL_KEYWORDS_MAX_LENGTH}
                                                        rows={2}
                                                        disabled={!canEdit}
                                                        className="w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                                                        placeholder={text('connector_appstore_initial_keywords_hint')}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </label>
                            );
                        })}

                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold text-indigo-100">{text('connector_secrets')}</div>
                            <div className="mt-1 text-[11px] text-indigo-200/45">{text('connector_secrets_hint')}</div>
                        </div>
                        <button
                            type="button"
                            title="Add secret"
                            aria-label="Add secret"
                            onClick={() => {
                                if (!canEdit || connectorForm.secretBusy) return;
                                if (!secretKey.trim()) setSecretKey('OPENAI_API_KEY');
                                requestAnimationFrame(() => {
                                    secretKeyInputRef.current?.scrollIntoView({
                                        block: 'center',
                                        behavior: 'smooth',
                                    });
                                    secretKeyInputRef.current?.focus();
                                });
                            }}
                            disabled={!canEdit || connectorForm.secretBusy}
                            className="ui-btn-fit ui-btn-fit-dense inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/40 hover:text-white disabled:opacity-60"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <input
                            ref={secretKeyInputRef}
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            disabled={!canEdit}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                            placeholder="OPENAI_API_KEY"
                        />
                        <input
                            value={secretValue}
                            onChange={(e) => setSecretValue(e.target.value)}
                            type="password"
                            disabled={!canEdit}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                            placeholder={text('connector_secret_value_placeholder')}
                        />
                        <button
                            type="button"
                            onClick={upsertSecret}
                            disabled={!canEdit || connectorForm.secretBusy || !secretKey.trim() || !secretValue}
                            className="ui-btn-fit inline-flex items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                            {text('connector_set_secret')}
                        </button>
                    </div>

                    <div className="mt-4 grid gap-2">
                        {!connectorForm.secretMetas.length && (
                            <div className="text-xs text-indigo-200/50">{text('connector_no_secrets')}</div>
                        )}
                        {connectorForm.secretMetas.map((m) => (
                            <div
                                key={m.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-2"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold text-indigo-100">{m.key}</div>
                                    <div className="mt-0.5 text-[11px] text-indigo-200/45">
                                        {text('connector_secret_set_at')} {String(m.updated_at || m.created_at || '')}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => connectorForm.removeSecret(String(m.key || ''))}
                                    disabled={!canEdit || connectorForm.secretBusy}
                                    className="ui-btn-fit ui-btn-fit-dense inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
                                >
                                    {text('delete')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
