import React from 'react';
import type { TranslationKey } from '../../i18n';

export function AutoReleaseModulePanel(props: {
    isEnabled: boolean;
    integrationReady: boolean;
    onNotImplemented?: () => void;
    text: (key: TranslationKey) => string;
}) {
    const { isEnabled, integrationReady, onNotImplemented, text } = props;

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('autorelease_module_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('autorelease_module_subtitle')}</p>
                </div>
            </div>

            {!isEnabled ? (
                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
            ) : (
                <div className="mt-5 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => onNotImplemented?.()}
                        disabled={!integrationReady}
                        className={`ui-btn-fit inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold ${
                            integrationReady
                                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15'
                                : 'border-white/10 bg-slate-950/20 text-indigo-200/40 cursor-not-allowed'
                        }`}
                        title={integrationReady ? undefined : 'Fill required setup data first.'}
                    >
                        {text('fastlane_integration')}
                    </button>
                </div>
            )}
        </section>
    );
}
