import React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { CountryOption } from '../../constants/countries';

const normalize = (value: string) => value.trim().toLowerCase();

const codeToFlag = (code: string) => {
    const cc = (code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    const A = 0x1f1e6;
    const base = 'A'.codePointAt(0) || 65;
    const first = A + (cc.codePointAt(0)! - base);
    const second = A + (cc.codePointAt(1)! - base);
    return String.fromCodePoint(first, second);
};

export function CountryMultiSelect(props: {
    value: string[];
    options: CountryOption[];
    disabled?: boolean;
    onChange: (next: string[]) => void;
    text: (key: TranslationKey) => string;
    buttonClassName?: string;
}) {
    const { value, options, disabled, onChange, text, buttonClassName } = props;
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const wrapRef = React.useRef<HTMLDivElement | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const valueSet = React.useMemo(() => new Set(value), [value]);

    const filtered = React.useMemo(() => {
        const q = normalize(query);
        if (!q) return options;
        return options.filter((c) => normalize(c.name).includes(q) || normalize(c.code).includes(q));
    }, [options, query]);

    const selectionLabel = React.useMemo(() => {
        if (!value.length) return text('select_countries');
        const byCode = new Map(options.map((c) => [c.code, c.name] as const));
        const names = value
            .map((code) => byCode.get(code) || code)
            .filter(Boolean);
        const head = names.slice(0, 2).join(', ');
        const rest = names.length - 2;
        return rest > 0 ? `${head} +${rest}` : head;
    }, [options, text, value]);

    React.useEffect(() => {
        if (!open) return;
        const onDown = (event: MouseEvent) => {
            const el = wrapRef.current;
            if (!el) return;
            if (el.contains(event.target as any)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        const id = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
    }, [open]);

    const toggleCode = (code: string) => {
        if (disabled) return;
        const next = new Set(valueSet);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        onChange(Array.from(next) as string[]);
    };

    const clearAll = () => {
        if (disabled) return;
        onChange([]);
    };

    const chooseAll = () => {
        if (disabled) return;
        onChange(options.map((c) => c.code));
    };

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                className={`w-full inline-flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-slate-900/30 px-4 py-3 text-left text-sm text-indigo-50 hover:border-indigo-400/35 ${buttonClassName ?? ''}`}
            >
                <span className={`min-w-0 truncate ${value.length ? 'text-indigo-50' : 'text-indigo-200/55'}`}>
                    {selectionLabel}
                </span>
                <span className="inline-flex items-center gap-2">
                    {value.length > 0 && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-200/70">
                            {value.length}
                        </span>
                    )}
                    <ChevronDown size={16} className={`text-indigo-200/70 transition ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {open && (
                <div className="absolute z-40 mt-2 w-[min(420px,calc(100vw-40px))] rounded-2xl border border-indigo-400/20 bg-slate-950/90 backdrop-blur p-3 shadow-[0_30px_80px_-55px_rgba(0,0,0,0.85)]">
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={clearAll}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                        >
                            {text('clear_all')}
                        </button>
                        <button
                            type="button"
                            onClick={chooseAll}
                            className="rounded-full border border-indigo-400/35 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/20"
                        >
                            {text('choose_all')}
                        </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/35 px-3 py-2">
                        <Search size={14} className="text-indigo-200/60" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={text('search_countries')}
                            className="w-full bg-transparent text-sm text-indigo-50 placeholder:text-indigo-200/40 outline-none"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="inline-flex items-center justify-center rounded-full p-1 text-indigo-200/70 hover:text-white"
                                aria-label={text('cancel')}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="mt-3 max-h-[320px] overflow-auto pr-1">
                        <div className="space-y-1">
                            {filtered.map((c) => {
                                const checked = valueSet.has(c.code);
                                const flag = codeToFlag(c.code);
                                return (
                                    <button
                                        key={c.code}
                                        type="button"
                                        onClick={() => toggleCode(c.code)}
                                        className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/5"
                                    >
                                        <span
                                            className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                                                checked
                                                    ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100'
                                                    : 'border-white/10 bg-slate-900/30 text-transparent'
                                            }`}
                                        >
                                            <Check size={14} />
                                        </span>
                                        <span className="w-5 text-center text-sm leading-none">{flag}</span>
                                        <span className="min-w-0 flex-1 truncate text-sm text-indigo-50">
                                            {c.name}
                                        </span>
                                        <span className="text-[10px] font-semibold text-indigo-200/50">
                                            {c.code}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
