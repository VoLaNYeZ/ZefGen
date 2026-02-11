import React from 'react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';

const DEFAULT_VARIABLES: Array<{ key: string; label: TranslationKey; placeholder?: string }> = [
    { key: 'bundle_id', label: 'connector_bundle_id', placeholder: 'com.example.app' },
    { key: 'company_name', label: 'connector_company_name' },
    { key: 'id_purchases', label: 'connector_id_purchases' },
    { key: 'apphud_api_url', label: 'connector_apphud_api_url', placeholder: 'https://api.apphud.com/...' },
    { key: 'privacy_policy_url', label: 'connector_privacy_policy_url', placeholder: 'https://...' },
    { key: 'terms_of_use_url', label: 'connector_terms_of_use_url', placeholder: 'https://...' },
    { key: 'support_form_url', label: 'connector_support_form_url', placeholder: 'https://...' },
    { key: 'domain', label: 'connector_domain', placeholder: 'example.com' },
    { key: 'appstore_description', label: 'connector_appstore_description' },
];

export function ConnectorVariablesSecretsPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, isEnabled, text } = props;

    const [secretKey, setSecretKey] = React.useState('');
    const [secretValue, setSecretValue] = React.useState('');

    const upsertSecret = async () => {
        const k = secretKey.trim();
        if (!k) return;
        if (!secretValue) return;
        await connectorForm.upsertSecret(k, secretValue);
        setSecretKey('');
        setSecretValue('');
    };

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
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {connectorForm.loading ? text('loading') : text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => connectorForm.savePatch({ variables: connectorForm.variables })}
                        disabled={!isEnabled || connectorForm.saving}
                        className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
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
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_variables')}</div>
                    <div className="mt-3 grid gap-2">
                        {DEFAULT_VARIABLES.map((f) => (
                            <label key={f.key} className="grid gap-1">
                                <div className="text-[11px] text-indigo-200/60">{text(f.label)}</div>
                                {f.key === 'appstore_description' ? (
                                    <textarea
                                        value={String(connectorForm.variables?.[f.key] ?? '')}
                                        onChange={(e) => connectorForm.setVariable(f.key, e.target.value)}
                                        rows={3}
                                        disabled={!isEnabled}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
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
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_secrets')}</div>
                    <div className="mt-1 text-[11px] text-indigo-200/45">{text('connector_secrets_hint')}</div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <input
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            disabled={!isEnabled}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                            placeholder="APPHUD_API_KEY"
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
                            className="inline-flex items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
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
                                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
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

