import React from 'react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';

type Requirement = { key: string; label: string; ok: boolean; title?: string };

const isFilled = (value: any) => {
    const s = String(value ?? '').trim();
    if (!s) return false;
    // Historic placeholder used by default config bootstrap.
    if (s === 'https://google.com') return false;
    return true;
};

export function IntegrationModulePanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, isEnabled, text } = props;

    const requirements: Requirement[] = React.useMemo(() => {
        const vars = (connectorForm.variables ?? {}) as any;
        const secretKeys = new Set(
            (connectorForm.secretMetas || []).map((m: any) => String(m?.key || '').toUpperCase())
        );

        return [
            {
                key: 'APPHUD_API_KEY',
                label: text('connector_apphud_api_key'),
                ok: secretKeys.has('APPHUD_API_KEY'),
                title: 'Secret: APPHUD_API_KEY',
            },
            {
                key: 'id_purchases',
                label: text('connector_id_purchases'),
                ok: isFilled(vars.id_purchases),
                title: 'Setup data: id_purchases',
            },
            {
                key: 'domain',
                label: text('connector_domain'),
                ok: isFilled(vars.domain),
                title: 'Setup data: domain',
            },
            {
                key: 'bundle_id',
                label: text('connector_bundle_id'),
                ok: isFilled(vars.bundle_id),
                title: 'Setup data: bundle_id',
            },
            {
                key: 'privacy_policy_url',
                label: text('connector_privacy_policy_url'),
                ok: isFilled(vars.privacy_policy_url),
                title: 'Setup data: privacy_policy_url',
            },
            {
                key: 'terms_of_use_url',
                label: text('connector_terms_of_use_url'),
                ok: isFilled(vars.terms_of_use_url),
                title: 'Setup data: terms_of_use_url',
            },
            {
                key: 'support_form_url',
                label: text('connector_support_form_url'),
                ok: isFilled(vars.support_form_url),
                title: 'Setup data: support_form_url',
            },
            {
                key: 'firebase_plist_snippet',
                label: text('connector_firebase_plist_snippet'),
                ok: isFilled(vars.firebase_plist_snippet),
                title: 'Setup data: firebase_plist_snippet',
            },
        ];
    }, [connectorForm.variables, connectorForm.secretMetas, text]);

    const ready = React.useMemo(() => requirements.every((r) => r.ok), [requirements]);

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('integration_module_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('integration_module_subtitle')}</p>
                </div>
                <div
                    className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                        ready
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                    }`}
                    title={ready ? 'Ready' : 'Missing setup'}
                >
                    {ready ? 'Ready' : 'Missing'}
                </div>
            </div>

            {!isEnabled ? (
                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            ) : (
                <div className="mt-5 flex flex-wrap gap-2">
                    {requirements.map((r) => (
                        <span
                            key={r.key}
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                r.ok
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-rose-400/25 bg-rose-500/10 text-rose-50/90'
                            }`}
                            title={
                                r.title ? `${r.title}${r.ok ? ' (OK)' : ' (Missing)'}` : r.ok ? 'OK' : 'Missing'
                            }
                        >
                            {r.label}
                        </span>
                    ))}
                </div>
            )}
        </section>
    );
}
