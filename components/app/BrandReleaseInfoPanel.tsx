import React from 'react';
import { Check, Copy, Pencil, Save, X } from 'lucide-react';
import type { Brand } from '../../types/zefgen';
import type { TranslationKey } from '../../i18n';
import { CountryMultiSelect } from './CountryMultiSelect';
import { getOrderedCountriesEn } from '../../constants/countries';

const codeToFlag = (code: string) => {
    const cc = (code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    const A = 0x1f1e6;
    const base = 'A'.codePointAt(0) || 65;
    const first = A + (cc.codePointAt(0)! - base);
    const second = A + (cc.codePointAt(1)! - base);
    return String.fromCodePoint(first, second);
};

export function BrandReleaseInfoPanel(props: {
    selectedBrand: Brand;
    patchBrand: (brandId: string, patch: Partial<Brand>) => Promise<void>;
    reportError: (message: string) => void;
    text: (key: TranslationKey) => string;
}) {
    const { selectedBrand, patchBrand, reportError, text } = props;
    const brandId = selectedBrand.id;

    const orderedCountries = React.useMemo(() => getOrderedCountriesEn(), []);
    const countriesByCode = React.useMemo(() => {
        const map = new Map<string, string>();
        orderedCountries.forEach((c) => map.set(c.code, c.name));
        return map;
    }, [orderedCountries]);
    const [targetCountries, setTargetCountries] = React.useState<string[]>(
        (selectedBrand.target_countries || []).filter(Boolean)
    );
    const countriesSaveTimerRef = React.useRef<number | null>(null);
    const [countriesSaving, setCountriesSaving] = React.useState(false);

    const [keywordsEditing, setKeywordsEditing] = React.useState(false);
    const [keywordsDraft, setKeywordsDraft] = React.useState(selectedBrand.keywords || '');
    const [keywordsSaving, setKeywordsSaving] = React.useState(false);
    const [keywordsCopied, setKeywordsCopied] = React.useState(false);
    const keywordsCopiedTimerRef = React.useRef<number | null>(null);
    const ignoreKeywordsBlurRef = React.useRef(false);

    const [notesDraft, setNotesDraft] = React.useState(selectedBrand.release_strategy_notes || '');
    const [notesSaving, setNotesSaving] = React.useState(false);

    React.useEffect(() => {
        setTargetCountries((selectedBrand.target_countries || []).filter(Boolean));
        setKeywordsEditing(false);
        setKeywordsDraft(selectedBrand.keywords || '');
        setNotesDraft(selectedBrand.release_strategy_notes || '');
    }, [brandId, selectedBrand.target_countries, selectedBrand.keywords, selectedBrand.release_strategy_notes]);

    React.useEffect(() => {
        return () => {
            if (countriesSaveTimerRef.current) window.clearTimeout(countriesSaveTimerRef.current);
            if (keywordsCopiedTimerRef.current) window.clearTimeout(keywordsCopiedTimerRef.current);
        };
    }, []);

    const scheduleSaveTargetCountries = (next: string[]) => {
        setTargetCountries(next);
        if (countriesSaveTimerRef.current) window.clearTimeout(countriesSaveTimerRef.current);
        setCountriesSaving(true);
        countriesSaveTimerRef.current = window.setTimeout(async () => {
            try {
                await patchBrand(brandId, { target_countries: next });
            } catch (error: any) {
                reportError(error?.message || text('upload_failed'));
            } finally {
                setCountriesSaving(false);
            }
        }, 550);
    };

    const saveKeywords = async (value: string) => {
        const next = value.slice(0, 100);
        setKeywordsDraft(next);
        setKeywordsSaving(true);
        try {
            await patchBrand(brandId, { keywords: next });
        } catch (error: any) {
            reportError(error?.message || text('upload_failed'));
        } finally {
            setKeywordsSaving(false);
        }
    };

    const copyKeywords = async () => {
        const line = (selectedBrand.keywords || '').trim();
        if (!line) return;
        try {
            await navigator.clipboard.writeText(line);
            setKeywordsCopied(true);
            if (keywordsCopiedTimerRef.current) window.clearTimeout(keywordsCopiedTimerRef.current);
            keywordsCopiedTimerRef.current = window.setTimeout(() => setKeywordsCopied(false), 1200);
        } catch (error: any) {
            reportError(error?.message || text('download_failed'));
        }
    };

    const saveNotesIfChanged = async () => {
        const next = notesDraft;
        if ((selectedBrand.release_strategy_notes || '') === next) return;
        setNotesSaving(true);
        try {
            await patchBrand(brandId, {
                release_strategy_notes: next,
                release_strategy_updated_at: new Date().toISOString(),
            });
        } catch (error: any) {
            reportError(error?.message || text('upload_failed'));
        } finally {
            setNotesSaving(false);
        }
    };

    return (
        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_26px_70px_-60px_rgba(15,23,42,0.9)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_references')}</p>
                    <h3 className="text-xl font-semibold text-white">{text('release_info')}</h3>
                </div>
                <div className="text-[11px] text-indigo-200/60">{countriesSaving || keywordsSaving || notesSaving ? text('saving') : ''}</div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-4">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('target_countries')}</p>
                    <div className="mt-2">
                        <div className="w-full sm:max-w-[360px]">
                            <CountryMultiSelect
                                value={targetCountries}
                                options={orderedCountries}
                                disabled={countriesSaving}
                                onChange={scheduleSaveTargetCountries}
                                text={text}
                            />
                        </div>
                        {targetCountries.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {targetCountries.map((code) => {
                                    const name = countriesByCode.get(code) || code;
                                    const flag = codeToFlag(code);
                                    return (
                                        <span
                                            key={code}
                                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-50/95"
                                        >
                                            <span className="text-sm leading-none">{flag}</span>
                                            <span className="max-w-[240px] truncate">{name}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="min-w-0">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('keywords')}</p>
                            <span className="text-[10px] text-indigo-200/55">
                                {(keywordsEditing ? keywordsDraft : (selectedBrand.keywords || '')).length}/100
                            </span>
                        </div>
                        {keywordsEditing ? (
                            <div className="mt-2">
                                <textarea
                                    value={keywordsDraft}
                                    onChange={(e) => setKeywordsDraft(e.target.value.slice(0, 100))}
                                    onBlur={() => {
                                        if (ignoreKeywordsBlurRef.current) {
                                            ignoreKeywordsBlurRef.current = false;
                                            return;
                                        }
                                        const current = selectedBrand.keywords || '';
                                        if (keywordsDraft !== current) saveKeywords(keywordsDraft);
                                    }}
                                    maxLength={100}
                                    rows={2}
                                    className="w-full whitespace-pre-wrap break-words rounded-2xl border border-indigo-400/20 bg-slate-900/25 px-4 py-3 text-sm text-indigo-50 placeholder:text-indigo-200/40 outline-none focus:border-indigo-400/40"
                                    placeholder={text('keywords_hint')}
                                />
                            </div>
                        ) : (
                            <div className="mt-2 max-w-full whitespace-pre-wrap break-words overflow-hidden rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-sm text-indigo-50/90">
                                {(selectedBrand.keywords || '').trim() ? (
                                    selectedBrand.keywords
                                ) : (
                                    <span className="text-indigo-200/40">{text('keywords_hint')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        {!keywordsEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={copyKeywords}
                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                    aria-label={text('copy_keywords')}
                                    title={text('copy_keywords')}
                                >
                                    {keywordsCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setKeywordsDraft(selectedBrand.keywords || '');
                                        setKeywordsEditing(true);
                                    }}
                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                    aria-label={text('edit')}
                                    title={text('edit')}
                                >
                                    <Pencil size={14} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onMouseDown={() => {
                                        ignoreKeywordsBlurRef.current = true;
                                    }}
                                    onClick={async () => {
                                        await saveKeywords(keywordsDraft);
                                        setKeywordsEditing(false);
                                    }}
                                    disabled={keywordsSaving}
                                    className="inline-flex items-center justify-center rounded-full border border-indigo-400/35 bg-indigo-500/10 p-2 text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
                                    aria-label={text('save')}
                                    title={text('save')}
                                >
                                    <Save size={14} />
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={() => {
                                        ignoreKeywordsBlurRef.current = true;
                                    }}
                                    onClick={() => {
                                        setKeywordsDraft(selectedBrand.keywords || '');
                                        setKeywordsEditing(false);
                                    }}
                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                    aria-label={text('cancel')}
                                    title={text('cancel')}
                                >
                                    <X size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('release_strategy_notes')}</p>
                        <span className="text-[10px] text-indigo-200/55">{notesSaving ? text('saving') : ''}</span>
                    </div>
                    <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        onBlur={saveNotesIfChanged}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-indigo-400/20 bg-slate-900/25 px-4 py-3 text-sm text-indigo-50 placeholder:text-indigo-200/40 outline-none focus:border-indigo-400/40"
                        placeholder={text('release_strategy_notes_hint')}
                    />
                    <div className="mt-1.5 text-[10px] text-indigo-200/55">
                        {selectedBrand.release_strategy_updated_at ? (
                            `${text('last_updated')} ${new Date(selectedBrand.release_strategy_updated_at).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}`
                        ) : (
                            ''
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
