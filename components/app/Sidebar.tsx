import React from 'react';
import {
    DoorOpen,
    Plus,
    ArrowUpRight,
    Loader2,
    X,
} from 'lucide-react';
import { TranslationKey } from '../../i18n';
import {
    BreathingText,
    LetterSwapForward,
    LetterSwapPingPong,
    ScrambleHover,
    VariableFontCursorProximity,
    VariableFontHoverByRandomLetter,
} from '../fancy/text';
import type { Brand, BrandFormState } from '../../types/zefgen';

type SidebarProps = {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (value: boolean) => void;
    logoContainerRef: React.RefObject<HTMLDivElement>;
    logoVariantIndex: number;
    setLogoVariantIndex: React.Dispatch<React.SetStateAction<number>>;
    logoFontReady: boolean;
    logoWord: string;
    lang: 'en' | 'ru';
    setLang: (value: 'en' | 'ru') => void;
    sessionEmail: string;
    brands: Brand[];
    brandAppSummaryByBrandId: Record<
        string,
        {
            total: number;
            green: number;
            yellow: number;
            red: number;
        }
    >;
    selectedBrandId: string | null;
    brandIconUrls: Record<string, string>;
    brandFormOpen: boolean;
    brandForm: BrandFormState;
    brandFormError: string | null;
    brandFormLoading: boolean;
    editingBrandId: string | null;
    brandSlugPreview: string;
    dataLoading: boolean;
    isBusy: boolean;
    onBlockedAction: () => void;
    openBrandForm: (brand?: Brand) => void;
    submitBrandForm: (event: React.FormEvent) => void;
    setBrandForm: React.Dispatch<React.SetStateAction<BrandFormState>>;
    setBrandFormOpen: (value: boolean) => void;
    setSelectedBrandId: (value: string | null) => void;
    openLightbox: (
        src: string,
        alt: string,
        options?: { layers?: any[]; fullSrc?: string; overlayBaseWidth?: number; overlayBaseHeight?: number }
    ) => void;
    handleLogout: () => void;
    text: (key: TranslationKey) => string;
};

export const Sidebar = ({
    isSidebarOpen,
    setIsSidebarOpen,
    logoContainerRef,
    logoVariantIndex,
    setLogoVariantIndex,
    logoFontReady,
    logoWord,
    lang,
    setLang,
    sessionEmail,
    brands,
    brandAppSummaryByBrandId,
    selectedBrandId,
    brandIconUrls,
    brandFormOpen,
    brandForm,
    brandFormError,
    brandFormLoading,
    editingBrandId,
    brandSlugPreview,
    dataLoading,
    isBusy,
    onBlockedAction,
    openBrandForm,
    submitBrandForm,
    setBrandForm,
    setBrandFormOpen,
    setSelectedBrandId,
    openLightbox,
    handleLogout,
    text,
}: SidebarProps) => {
    const clampCount = (n: number) => {
        const v = Math.max(0, Math.floor(Number(n) || 0));
        if (v > 99) return '99+';
        return String(v);
    };

    const dotClass = (kind: 'green' | 'yellow' | 'red', value: number) => {
        const isZero = !(Number(value) > 0);
        const dim = isZero ? 'opacity-35' : 'opacity-95';
        if (kind === 'green') return `h-1.5 w-1.5 rounded-full ${dim} bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.40)]`;
        if (kind === 'yellow') return `h-1.5 w-1.5 rounded-full ${dim} bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.35)]`;
        return `h-1.5 w-1.5 rounded-full ${dim} bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.35)]`;
    };

    const countTextClass = (kind: 'green' | 'yellow' | 'red', value: number) => {
        const isZero = !(Number(value) > 0);
        const dim = isZero ? 'opacity-35' : 'opacity-95';
        if (kind === 'green') return `${dim} text-emerald-100/90`;
        if (kind === 'yellow') return `${dim} text-amber-50/90`;
        return `${dim} text-rose-50/90`;
    };

    return (
        <aside
            className={`
                fixed top-0 left-0 h-[100dvh] z-50 w-72 bg-slate-900 text-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col border-r border-indigo-900/40
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:h-screen md:z-40
            `}
        >
            <div className="relative p-6 border-b border-indigo-900/30">
                <div ref={logoContainerRef} className="relative w-full select-none">
                    <button
                        type="button"
                        onClick={() =>
                            setLogoVariantIndex((prev) => {
                                let next = prev;
                                while (next === prev) {
                                    next = Math.floor(Math.random() * 6);
                                }
                                return next;
                            })
                        }
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-xl bg-slate-900/30 flex items-center justify-center overflow-hidden"
                        aria-label="Change logo variant"
                    >
                        <img src="/genlogo.png" alt="ZefGen" className="h-full w-full object-contain" />
                    </button>
                    <div
                        className={`logo-wrap w-full text-center pl-16 pr-8 translate-y-px transition-opacity duration-300 ${
                            logoFontReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                        style={{ fontFamily: '"Roboto Flex Variable", "Roboto Flex", sans-serif' }}
                    >
                        {(() => {
                            const variants = [
                                <LetterSwapForward label={logoWord} className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" />,
                                <LetterSwapPingPong label={logoWord} staggerFrom="center" className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" />,
                                <VariableFontHoverByRandomLetter
                                    label={logoWord}
                                    className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                    fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                    toFontVariationSettings="'wght' 900, 'slnt' 0"
                                />,
                                <VariableFontCursorProximity
                                    label={logoWord}
                                    className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                    fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                    toFontVariationSettings="'wght' 900, 'slnt' -10"
                                    radius={180}
                                    falloff="gaussian"
                                    containerRef={logoContainerRef}
                                />,
                                <BreathingText
                                    className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                    fromFontVariationSettings="'wght' 260, 'slnt' 0"
                                    toFontVariationSettings="'wght' 820, 'slnt' -8"
                                >
                                    {logoWord}
                                </BreathingText>,
                                <ScrambleHover text={logoWord} className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" scrambleSpeed={45} maxIterations={8} />,
                            ];

                            return variants[logoVariantIndex] ?? variants[0];
                        })()}
                    </div>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden absolute right-4 top-4"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="p-5 flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brands')}</p>
                    <p className="text-sm text-indigo-100/80">{text('select_or_create')}</p>
                </div>
                <button
                    onClick={() => {
                        if (isBusy) {
                            onBlockedAction();
                            return;
                        }
                        openBrandForm();
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 border border-indigo-400/30 hover:bg-indigo-400/20"
                >
                    <Plus size={14} />
                    {text('new')}
                </button>
            </div>

            <div className="px-4 pb-4">
                {brandFormOpen && (
                    <form
                        onSubmit={submitBrandForm}
                        className="animate-shelf rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3"
                    >
                        <div>
                            <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_name')}</label>
                            <input
                                value={brandForm.name}
                                onChange={(event) => setBrandForm({ name: event.target.value })}
                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                placeholder="Adidas"
                            />
                        </div>
                        <div className="text-xs text-indigo-200/70">
                            {text('url_preview')}: /{brandSlugPreview || 'brand'}
                        </div>
                        {brandFormError && (
                            <p className="text-xs text-rose-300">{brandFormError}</p>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={brandFormLoading}
                                className="flex-1 rounded-xl bg-indigo-400/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-400/30"
                            >
                                {brandFormLoading ? text('saving') : editingBrandId ? text('update_brand') : text('create_brand')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setBrandFormOpen(false)}
                                className="rounded-xl border border-indigo-900/60 px-3 py-2 text-xs text-indigo-200/70 hover:text-white"
                            >
                                {text('cancel')}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6 space-y-2 scrollbar-thin scrollbar-thumb-indigo-900/40">
                {dataLoading && (
                    <div className="flex items-center gap-2 text-xs text-indigo-200/60 px-3">
                        <Loader2 className="animate-spin" size={14} />
                        {text('loading_brands')}
                    </div>
                )}
                {!dataLoading && !brands.length && (
                    <div className="rounded-2xl border border-dashed border-indigo-900/60 p-4 text-sm text-indigo-200/70">
                        {text('no_brands_yet')}
                    </div>
                )}
                {brands.map((brand) => {
                    const isActive = brand.id === selectedBrandId;
                    const iconUrl = brandIconUrls[brand.id];
                    const summary = brandAppSummaryByBrandId[brand.id] || { total: 0, green: 0, yellow: 0, red: 0 };
                    return (
                        <button
                            key={brand.id}
                            onClick={() => {
                                if (isBusy) {
                                    onBlockedAction();
                                    return;
                                }
                                setSelectedBrandId(brand.id);
                                if (window.innerWidth < 768) setIsSidebarOpen(false);
                            }}
                            className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 ${
                                isActive
                                    ? 'ring-indigo-400/40 bg-slate-900/80 shadow-[0_14px_30px_-25px_rgba(99,102,241,0.6)]'
                                    : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`h-9 w-9 overflow-hidden rounded-[12px] bg-slate-800/35 flex items-center justify-center text-[11px] text-indigo-200/70 ${
                                            iconUrl ? 'border border-transparent' : 'border border-indigo-400/20'
                                        }`}
                                    >
                                        {iconUrl ? (
                                            <img
                                                src={iconUrl}
                                                alt={text('icon_reference')}
                                                className="h-full w-full object-cover rounded-[12px] cursor-zoom-in"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openLightbox(iconUrl, text('icon_reference'));
                                                }}
                                            />
                                        ) : (
                                            <span>{brand.name.slice(0, 1).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{brand.name}</p>
                                        <p className="text-xs text-indigo-200/60">/{brand.slug}</p>
                                    </div>
                                </div>
                                <div
                                    className="flex items-center gap-2 shrink-0"
                                    title={`Apps: ${summary.total}\nAB tests: ${summary.green}\nReady (no A/B): ${summary.yellow}\nBanned: ${summary.red}`}
                                >
                                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-100/70 tabular-nums min-w-[22px]">
                                        {clampCount(summary.total)}
                                    </span>
                                    <div className="flex flex-col items-end justify-center gap-0.5">
                                        <div className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums">
                                            <span className={dotClass('green', summary.green)} />
                                            <span className={countTextClass('green', summary.green)}>{clampCount(summary.green)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums">
                                            <span className={dotClass('yellow', summary.yellow)} />
                                            <span className={countTextClass('yellow', summary.yellow)}>{clampCount(summary.yellow)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums">
                                            <span className={dotClass('red', summary.red)} />
                                            <span className={countTextClass('red', summary.red)}>{clampCount(summary.red)}</span>
                                        </div>
                                    </div>
                                    {isActive && <ArrowUpRight size={16} className="text-indigo-200" />}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="bg-slate-900 border-t border-slate-800/60 px-5 py-4 text-xs text-indigo-200/60 flex items-center justify-between gap-3">
                <span className="truncate">{sessionEmail}</span>
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center rounded-full border border-indigo-900/50 bg-slate-900/70 p-1 w-[86px]">
                        <span
                            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-indigo-500/30 transition-transform duration-200 ${
                                lang === 'ru' ? 'translate-x-full' : ''
                            }`}
                        />
                        <button
                            onClick={() => setLang('en')}
                            className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                                lang === 'en'
                                    ? 'text-indigo-100'
                                    : 'text-indigo-200/60 hover:text-indigo-100'
                            }`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLang('ru')}
                            className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                                lang === 'ru'
                                    ? 'text-indigo-100'
                                    : 'text-indigo-200/60 hover:text-indigo-100'
                            }`}
                        >
                            RU
                        </button>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center justify-center rounded-full border border-indigo-400/30 p-2 text-indigo-200/80 hover:text-white"
                        aria-label={text('sign_out')}
                        title={text('sign_out')}
                    >
                        <DoorOpen size={12} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
