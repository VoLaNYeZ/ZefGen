import React from 'react';
import { Check, Copy, ExternalLink, Plus } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type { AppItem, AppstoreAccount } from '../../types/zefgen';

const DEFAULT_VARIABLES: Array<{ key: string; label: TranslationKey; placeholder?: string }> = [
    { key: 'appstore_name', label: 'connector_appstore_name' },
    { key: 'app_new_name', label: 'connector_app_new_name' },
    { key: 'home_screen_name', label: 'connector_home_screen_name' },
    { key: 'bundle_id', label: 'connector_bundle_id', placeholder: 'com.example.app' },
    { key: 'id_purchases', label: 'connector_id_purchases' },
    { key: 'apphud_api_url', label: 'connector_apphud_api_url', placeholder: 'https://api.apphud.com/...' },
    { key: 'privacy_policy_url', label: 'connector_privacy_policy_url', placeholder: 'https://...' },
    { key: 'terms_of_use_url', label: 'connector_terms_of_use_url', placeholder: 'https://...' },
    { key: 'support_form_url', label: 'connector_support_form_url', placeholder: 'https://...' },
    { key: 'domain', label: 'connector_domain', placeholder: 'https://...' },
    { key: 'firebase_plist_snippet', label: 'connector_firebase_plist_snippet' },
    { key: 'appstore_description', label: 'connector_appstore_description' },
];

export function ConnectorVariablesSecretsPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    selectedApp: AppItem | null;
    account: AppstoreAccount | null;
    onOpenAccountsForApp?: () => void;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, isEnabled, selectedApp, account, onOpenAccountsForApp, text } = props;

    const [secretKey, setSecretKey] = React.useState('');
    const [secretValue, setSecretValue] = React.useState('');
    const secretKeyInputRef = React.useRef<HTMLInputElement | null>(null);

    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
    const copiedTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        };
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

    const upsertSecret = async () => {
        const k = secretKey.trim();
        if (!k) return;
        if (!secretValue) return;
        await connectorForm.upsertSecret(k, secretValue);
        setSecretKey('');
        setSecretValue('');
    };

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
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={connectorForm.refresh}
                        disabled={!isEnabled || connectorForm.loading}
                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {connectorForm.loading ? text('loading') : text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => connectorForm.savePatch({ variables: connectorForm.variables })}
                        disabled={!isEnabled || connectorForm.saving}
                        className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                    >
                        {connectorForm.saving ? text('saving') : text('save')}
                    </button>
                </div>
            </div>

            {connectorForm.error && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {connectorForm.error}
                </div>
            )}

            <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold text-indigo-100">{text('accounts_account')}</div>
                            <div className="mt-1 text-[11px] text-indigo-200/45">{text('accounts_account_hint')}</div>
                        </div>
                        {account ? (
                            <span
                                className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                    account.usability
                                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                        : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                                }`}
                                title={account.usability ? text('accounts_usable') : text('accounts_disabled')}
                            >
                                {account.usability ? text('accounts_usable') : text('accounts_disabled')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onOpenAccountsForApp?.()}
                                className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/15"
                                title={text('accounts_open_accounts')}
                            >
                                <ExternalLink size={14} />
                                {text('accounts_open_accounts')}
                            </button>
                        )}
                    </div>

                    {!account ? (
                        <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-[11px] text-amber-50/90 flex items-center justify-between gap-3">
                            <span>{text('accounts_no_account_for_app')}</span>
                            <button
                                type="button"
                                onClick={() => onOpenAccountsForApp?.()}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/15"
                            >
                                <ExternalLink size={14} />
                                {text('accounts_open_accounts')}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {(
                                [
                                    { key: 'email', label: text('accounts_email'), value: account.email },
                                    { key: 'password', label: text('accounts_password'), value: account.password },
                                    { key: 'email_password', label: text('accounts_email_password'), value: account.email_password },
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

                    {account && !account.usability ? (
                        <div className="mt-3 text-[11px] text-rose-200/80">
                            {text('accounts_disabled_hint')}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_variables')}</div>
                    <div className="mt-3 grid gap-2">
                        {DEFAULT_VARIABLES.map((f) => (
                            <label key={f.key} className="grid gap-1">
                                <div className="text-[11px] text-indigo-200/60">{text(f.label)}</div>
                                {f.key === 'appstore_description' || f.key === 'firebase_plist_snippet' ? (
                                    <textarea
                                        value={String(connectorForm.variables?.[f.key] ?? '')}
                                        onChange={(e) => connectorForm.setVariable(f.key, e.target.value)}
                                        rows={f.key === 'firebase_plist_snippet' ? 6 : 3}
                                        disabled={!isEnabled}
                                        className={`w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60 ${
                                            f.key === 'firebase_plist_snippet' ? 'font-mono text-[11px]' : ''
                                        }`}
                                        placeholder={f.placeholder ? String(f.placeholder) : undefined}
                                    />
                                ) : (
                                    <input
                                        value={String(connectorForm.variables?.[f.key] ?? '')}
                                        onChange={(e) => connectorForm.setVariable(f.key, e.target.value)}
                                        disabled={!isEnabled}
                                        className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                                        placeholder={f.placeholder ? String(f.placeholder) : undefined}
                                    />
                                )}
                            </label>
                        ))}
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
                                if (!isEnabled || connectorForm.secretBusy) return;
                                if (!secretKey.trim()) setSecretKey('OPENAI_API_KEY');
                                requestAnimationFrame(() => {
                                    secretKeyInputRef.current?.scrollIntoView({
                                        block: 'center',
                                        behavior: 'smooth',
                                    });
                                    secretKeyInputRef.current?.focus();
                                });
                            }}
                            disabled={!isEnabled || connectorForm.secretBusy}
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
                            disabled={!isEnabled}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                            placeholder="OPENAI_API_KEY"
                        />
                        <input
                            value={secretValue}
                            onChange={(e) => setSecretValue(e.target.value)}
                            type="password"
                            disabled={!isEnabled}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                            placeholder={text('connector_secret_value_placeholder')}
                        />
                        <button
                            type="button"
                            onClick={upsertSecret}
                            disabled={!isEnabled || connectorForm.secretBusy || !secretKey.trim() || !secretValue}
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
                                    disabled={!isEnabled || connectorForm.secretBusy}
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
