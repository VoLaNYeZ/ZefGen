import React from 'react';
import { AlertTriangle, RefreshCcw, RotateCw } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';

export function ConnectorSaveConflictBanner(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    text: (key: TranslationKey) => string;
}) {
    const { connectorForm, text } = props;

    if (!connectorForm.staleConflict) return null;

    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-50/90">
            <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                    <div className="font-semibold">{text('connector_save_conflict_title')}</div>
                    <div className="mt-1 text-amber-50/75">{text('connector_save_conflict_hint')}</div>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => void connectorForm.reloadAfterConflict()}
                    className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/20 px-3 py-1.5 font-semibold text-indigo-100/85 hover:border-indigo-300/40 hover:text-white"
                >
                    <RefreshCcw size={12} />
                    {text('refresh')}
                </button>
                <button
                    type="button"
                    onClick={() => void connectorForm.overwriteAfterConflict()}
                    className="ui-btn-fit ui-btn-fit-dense inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-50 hover:bg-amber-500/20"
                >
                    <RotateCw size={12} />
                    {text('connector_overwrite_anyway')}
                </button>
            </div>
        </div>
    );
}
