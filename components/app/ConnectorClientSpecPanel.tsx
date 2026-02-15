import React from 'react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';

export function ConnectorClientSpecPanel(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    isEnabled: boolean;
    ideaMode: 'autonmode';
    setIdeaMode: (value: 'autonmode') => void;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, isEnabled, ideaMode, setIdeaMode, text } = props;

    return (
        <div className="space-y-4">
            <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            Idea picker (placeholder)
                        </p>
                        <p className="mt-2 text-sm text-indigo-200/60">
                            This will be replaced with a real idea workflow.
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <select
                        value={ideaMode}
                        onChange={(e) => setIdeaMode((e.target.value as any) || 'autonmode')}
                        disabled={!isEnabled}
                        className="ui-btn-fit rounded-full border border-indigo-400/25 bg-slate-950/20 px-4 py-2 text-xs font-semibold text-indigo-100 outline-none hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        <option value="autonmode">autonmode</option>
                    </select>
                </div>
            </section>

            <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('connector_project_brief')}
                        </p>
                        <p className="mt-2 text-sm text-indigo-200/60">{text('connector_project_brief_hint')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70">
                            iOS
                        </span>
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
                            onClick={() => connectorForm.savePatch({ project_brief: connectorForm.projectBrief })}
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

                <div className="mt-4">
                    <textarea
                        value={connectorForm.projectBrief}
                        onChange={(e) => connectorForm.setProjectBrief(e.target.value)}
                        rows={10}
                        disabled={!isEnabled}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60"
                        placeholder={text('connector_project_brief_placeholder')}
                    />
                </div>
            </section>
        </div>
    );
}
