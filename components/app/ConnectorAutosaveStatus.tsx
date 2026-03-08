import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, PencilLine } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';

const cn = (...values: Array<string | null | undefined | false>) => values.filter(Boolean).join(' ');

export function ConnectorAutosaveStatus(props: {
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    text: (key: TranslationKey) => string;
    className?: string;
}) {
    const { connectorForm, text, className } = props;

    if (connectorForm.saveState === 'idle') return null;

    const contentByState = {
        saving: {
            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
            label: text('saving'),
            tone: 'border-white/10 bg-slate-950/20 text-indigo-100/70',
        },
        saved: {
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            label: text('connector_autosave_saved'),
            tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100/85',
        },
        dirty: {
            icon: <PencilLine className="h-3.5 w-3.5" />,
            label: text('connector_autosave_unsaved'),
            tone: 'border-amber-300/20 bg-amber-500/10 text-amber-50/85',
        },
        error: {
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            label: text('connector_autosave_failed'),
            tone: 'border-rose-400/20 bg-rose-500/10 text-rose-100/90',
        },
    } as const;

    const content = contentByState[connectorForm.saveState];

    return (
        <span
            title={connectorForm.saveState === 'error' ? connectorForm.lastSaveError || undefined : undefined}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em]',
                content.tone,
                className
            )}
        >
            {content.icon}
            {content.label}
        </span>
    );
}
