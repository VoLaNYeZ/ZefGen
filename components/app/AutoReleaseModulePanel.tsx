import React from 'react';
import { Check, Copy } from 'lucide-react';
import type { TranslationKey } from '../../i18n';

export function AutoReleaseModulePanel(props: {
    isEnabled: boolean;
    integrationReady: boolean;
    manualCopyText: string;
    onNotImplemented?: () => void;
    showManualCopyAction?: boolean;
    text: (key: TranslationKey) => string;
}) {
    const {
        isEnabled,
        integrationReady,
        manualCopyText,
        onNotImplemented,
        showManualCopyAction = false,
        text,
    } = props;
    const [manualCopyCopied, setManualCopyCopied] = React.useState(false);
    const copiedTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        };
    }, []);

    const copyManualIntegration = async () => {
        try {
            await navigator.clipboard.writeText(manualCopyText);
        } catch {
            const el = document.createElement('textarea');
            el.value = manualCopyText;
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

        setManualCopyCopied(true);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setManualCopyCopied(false), 1200);
    };

    return (
        <section className="rounded-[28px] bg-slate-900 ring-1 ring-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                        {text('autorelease_module_title')}
                    </p>
                    <p className="mt-3 text-sm text-indigo-200/60">{text('autorelease_module_subtitle')}</p>
                </div>
                {showManualCopyAction ? (
                    <button
                        type="button"
                        onClick={() => void copyManualIntegration()}
                        data-testid="manual-integration-copy-button"
                        className="ui-btn-fit inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-indigo-100/90 hover:border-indigo-300/40 hover:bg-slate-950/45"
                        title={manualCopyCopied ? text('copied') : 'Copy for manual'}
                        aria-label="Copy for manual"
                    >
                        <span>Copy for manual</span>
                        {manualCopyCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    </button>
                ) : null}
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
