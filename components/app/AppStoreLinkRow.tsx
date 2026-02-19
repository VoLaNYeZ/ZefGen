import React from 'react';
import { Check, Copy, Pencil, Save, Store } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import {
    buildCanonicalAppStoreUrl,
    buildGeoAppStoreUrls,
    parseAppStoreInput,
} from '../../utils/appstore';

const codeToFlag = (code: string) => {
    const cc = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    const A = 0x1f1e6;
    const base = 'A'.codePointAt(0) || 65;
    const first = A + (cc.codePointAt(0)! - base);
    const second = A + (cc.codePointAt(1)! - base);
    return String.fromCodePoint(first, second);
};

export function AppStoreLinkRow(props: {
    selectedApp: AppItem | null;
    targetCountries: string[];
    onSaveCanonicalUrl: (canonicalUrl: string) => Promise<void>;
    text: (key: TranslationKey) => string;
    reportError: (message: string) => void;
}) {
    const { selectedApp, targetCountries, onSaveCanonicalUrl, text, reportError } = props;
    const storedCanonicalUrl = String(selectedApp?.appstore_url || '').trim();
    const [isEditing, setIsEditing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [draft, setDraft] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [validationError, setValidationError] = React.useState<string | null>(null);
    const copiedTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        };
    }, []);

    React.useEffect(() => {
        if (!selectedApp) {
            setDraft('');
            setIsEditing(false);
            setSaving(false);
            setCopied(false);
            setValidationError(null);
            return;
        }
        setDraft(storedCanonicalUrl);
        setIsEditing(!storedCanonicalUrl);
        setSaving(false);
        setCopied(false);
        setValidationError(null);
    }, [selectedApp?.id, storedCanonicalUrl, selectedApp]);

    const parsedStored = React.useMemo(
        () => parseAppStoreInput(storedCanonicalUrl),
        [storedCanonicalUrl]
    );
    const geoLinks = React.useMemo(() => {
        if (!parsedStored) return [];
        return buildGeoAppStoreUrls(parsedStored.appId, targetCountries || []);
    }, [parsedStored, targetCountries]);

    const handleSave = async () => {
        if (!selectedApp) return;
        const parsed = parseAppStoreInput(draft);
        if (!parsed) {
            setValidationError(text('appstore_link_invalid'));
            return;
        }

        const canonicalUrl = buildCanonicalAppStoreUrl(parsed.appId, parsed.countryCode);
        if (canonicalUrl === storedCanonicalUrl && storedCanonicalUrl) {
            setDraft(canonicalUrl);
            setValidationError(null);
            setIsEditing(false);
            return;
        }

        setSaving(true);
        setValidationError(null);
        try {
            await onSaveCanonicalUrl(canonicalUrl);
            setDraft(canonicalUrl);
            setIsEditing(false);
        } catch (error: any) {
            reportError(String(error?.message || text('upload_failed')));
        } finally {
            setSaving(false);
        }
    };

    const handleCopyLink = async () => {
        if (!storedCanonicalUrl) return;
        try {
            await navigator.clipboard.writeText(storedCanonicalUrl);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = storedCanonicalUrl;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand('copy');
            } finally {
                document.body.removeChild(textarea);
            }
        }
        setCopied(true);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    };

    if (!selectedApp) return null;

    return (
        <section className="rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-100">
                        <Store size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                            {text('appstore_link_title')}
                        </p>
                        {isEditing || !storedCanonicalUrl ? (
                            <form
                                className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSave();
                                }}
                            >
                                <input
                                    value={draft}
                                    onChange={(event) => {
                                        setDraft(event.target.value);
                                        if (validationError) setValidationError(null);
                                    }}
                                    placeholder={text('appstore_link_placeholder')}
                                    className="w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-indigo-200/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                />
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                >
                                    <Save size={13} />
                                    {saving ? text('saving') : text('appstore_link_set')}
                                </button>
                            </form>
                        ) : (
                            <>
                                <div className="mt-2 flex min-w-0 items-center gap-1.5">
                                    <a
                                        href={storedCanonicalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-0 max-w-[520px] truncate text-xs font-medium text-indigo-100 hover:text-white underline underline-offset-4"
                                        title={storedCanonicalUrl}
                                    >
                                        {storedCanonicalUrl}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyLink()}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-950/20 text-indigo-100/75 hover:border-indigo-400/40 hover:text-white"
                                        aria-label={text('copy')}
                                        title={copied ? text('success') : text('copy')}
                                    >
                                        {copied ? <Check size={13} /> : <Copy size={13} />}
                                    </button>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] text-indigo-200/70">{text('appstore_link_in_store')}</span>
                                    {geoLinks.map((entry) => (
                                        <a
                                            key={entry.code}
                                            href={entry.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/30 px-2 py-1 text-[11px] text-indigo-100/90 hover:border-indigo-400/40 hover:text-white"
                                            title={`${entry.code}: ${entry.url}`}
                                        >
                                            <span className="text-sm leading-none">{codeToFlag(entry.code)}</span>
                                        </a>
                                    ))}
                                </div>
                            </>
                        )}
                        {validationError ? (
                            <p className="mt-2 text-xs text-rose-300/95">{validationError}</p>
                        ) : null}
                    </div>
                </div>
                {!isEditing && storedCanonicalUrl ? (
                    <button
                        type="button"
                        onClick={() => {
                            setDraft(storedCanonicalUrl);
                            setValidationError(null);
                            setIsEditing(true);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/20 text-indigo-100/70 hover:border-indigo-400/40 hover:text-white"
                        aria-label={text('edit')}
                        title={text('edit')}
                    >
                        <Pencil size={14} />
                    </button>
                ) : null}
            </div>
        </section>
    );
}
