import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import { fetchConnectorAppConfig, upsertConnectorAppConfig } from '../../data/connector-app-config';
import { deleteConnectorSecret, fetchConnectorSecretMetas, upsertConnectorSecret } from '../../data/connector-secrets';

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

export function ConnectorConfigPanel(props: {
    session: Session | null;
    selectedApp: AppItem | null;
    text: (key: TranslationKey) => string;
    reportError?: (msg: string) => void;
}) {
    const { session, selectedApp, text, reportError } = props;

    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [projectKind, setProjectKind] = React.useState<'ios' | 'web' | 'other'>('ios');
    const [projectBrief, setProjectBrief] = React.useState('');
    const [variables, setVariables] = React.useState<Record<string, any>>({});

    const [secretMetas, setSecretMetas] = React.useState<any[]>([]);
    const [secretKey, setSecretKey] = React.useState('');
    const [secretValue, setSecretValue] = React.useState('');
    const [secretBusy, setSecretBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!session || !selectedApp) return;
        setLoading(true);
        setError(null);
        try {
            const cfg = await fetchConnectorAppConfig({ userId: session.user.id, appId: selectedApp.id });
            if (cfg.error) {
                throw cfg.error;
            }
            if (cfg.data) {
                setProjectKind((cfg.data as any).project_kind || 'ios');
                setProjectBrief((cfg.data as any).project_brief || '');
                setVariables((cfg.data as any).variables || {});
            } else {
                // First use: create a default row (keeps UI consistent).
                const created = await upsertConnectorAppConfig({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    patch: {
                        project_kind: 'ios',
                        project_brief: '',
                        variables: {},
                        verify_command: null,
                    },
                });
                if (created.error) throw created.error;
                setProjectKind((created.data as any)?.project_kind || 'ios');
                setProjectBrief((created.data as any)?.project_brief || '');
                setVariables((created.data as any)?.variables || {});
            }

            const secrets = await fetchConnectorSecretMetas({ userId: session.user.id, appId: selectedApp.id });
            if (secrets.error) throw secrets.error;
            setSecretMetas(secrets.data || []);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            setLoading(false);
        }
    }, [session, selectedApp, reportError]);

    React.useEffect(() => {
        load();
    }, [load]);

    const save = async () => {
        if (!session || !selectedApp) return;
        setSaving(true);
        setError(null);
        try {
            const resp = await upsertConnectorAppConfig({
                userId: session.user.id,
                appId: selectedApp.id,
                patch: {
                    project_kind: projectKind,
                    project_brief: projectBrief,
                    variables,
                } as any,
            });
            if (resp.error) throw resp.error;
        } catch (e: any) {
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            setSaving(false);
        }
    };

    const setVariable = (k: string, v: any) => {
        setVariables((prev) => ({ ...prev, [k]: v }));
    };

    const upsertSecret = async () => {
        if (!session || !selectedApp) return;
        const k = secretKey.trim();
        if (!k) return;
        if (!secretValue) return;
        setSecretBusy(true);
        setError(null);
        try {
            const resp = await upsertConnectorSecret({
                userId: session.user.id,
                appId: selectedApp.id,
                key: k,
                value: secretValue,
            });
            if (resp.error) throw resp.error;
            setSecretKey('');
            setSecretValue('');
            await load();
        } catch (e: any) {
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            setSecretBusy(false);
        }
    };

    const removeSecret = async (k: string) => {
        if (!session || !selectedApp) return;
        setSecretBusy(true);
        setError(null);
        try {
            const resp = await deleteConnectorSecret({ userId: session.user.id, appId: selectedApp.id, key: k });
            if (resp.error) throw resp.error;
            await load();
        } catch (e: any) {
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            setSecretBusy(false);
        }
    };

    return (
        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6 mx-6">
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
                        onClick={load}
                        disabled={!session || !selectedApp || loading}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {loading ? text('loading') : text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={!session || !selectedApp || saving}
                        className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                    >
                        {saving ? text('saving') : text('save')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {error}
                </div>
            )}

            <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_project_kind')}</div>
                        <select
                            value={projectKind}
                            onChange={(e) => setProjectKind((e.target.value as any) || 'ios')}
                            className="rounded-full border border-indigo-400/25 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 outline-none hover:border-indigo-400/40"
                        >
                            <option value="ios">{text('connector_kind_ios')}</option>
                            <option value="web">{text('connector_kind_web')}</option>
                            <option value="other">{text('connector_kind_other')}</option>
                        </select>
                    </div>
                    <div className="mt-4">
                        <div className="text-xs font-semibold text-indigo-100">{text('connector_project_brief')}</div>
                        <textarea
                            value={projectBrief}
                            onChange={(e) => setProjectBrief(e.target.value)}
                            rows={10}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                            placeholder={text('connector_project_brief_placeholder')}
                        />
                        <div className="mt-1 text-[11px] text-indigo-200/45">{text('connector_project_brief_hint')}</div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_variables')}</div>
                    <div className="mt-3 grid gap-2">
                        {DEFAULT_VARIABLES.map((f) => (
                            <label key={f.key} className="grid gap-1">
                                <div className="text-[11px] text-indigo-200/60">{text(f.label)}</div>
                                {f.key === 'appstore_description' ? (
                                    <textarea
                                        value={String(variables?.[f.key] ?? '')}
                                        onChange={(e) => setVariable(f.key, e.target.value)}
                                        rows={3}
                                        className="w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                                        placeholder={f.placeholder ? String(f.placeholder) : undefined}
                                    />
                                ) : (
                                    <input
                                        value={String(variables?.[f.key] ?? '')}
                                        onChange={(e) => setVariable(f.key, e.target.value)}
                                        className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                                        placeholder={f.placeholder ? String(f.placeholder) : undefined}
                                    />
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/25 p-4">
                    <div className="text-xs font-semibold text-indigo-100">{text('connector_secrets')}</div>
                    <div className="mt-1 text-[11px] text-indigo-200/45">{text('connector_secrets_hint')}</div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <input
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                            placeholder="APPHUD_API_KEY"
                        />
                        <input
                            value={secretValue}
                            onChange={(e) => setSecretValue(e.target.value)}
                            type="password"
                            className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-2 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40"
                            placeholder={text('connector_secret_value_placeholder')}
                        />
                        <button
                            type="button"
                            onClick={upsertSecret}
                            disabled={secretBusy || !secretKey.trim() || !secretValue}
                            className="inline-flex items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                            {text('connector_set_secret')}
                        </button>
                    </div>

                    <div className="mt-4 grid gap-2">
                        {!secretMetas.length && (
                            <div className="text-xs text-indigo-200/50">{text('connector_no_secrets')}</div>
                        )}
                        {secretMetas.map((m) => (
                            <div
                                key={m.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/15 px-4 py-2"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold text-indigo-100">{m.key}</div>
                                    <div className="mt-0.5 text-[11px] text-indigo-200/45">
                                        {text('connector_secret_set_at')} {String(m.updated_at || m.created_at || '')}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeSecret(String(m.key || ''))}
                                    disabled={secretBusy}
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
