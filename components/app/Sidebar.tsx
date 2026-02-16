import React from 'react';
import {
    DoorOpen,
    Plus,
    ArrowUpRight,
    Loader2,
    X,
    Users,
    Lightbulb,
    GripVertical,
} from 'lucide-react';
import { TranslationKey } from '../../i18n';
import type { AppPage } from '../../utils/routes';
import { SortableList } from './dnd/sortable-list';
import { useSortableTile } from './dnd/sortable-grid';
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
    activePage: AppPage;
    onSelectAccounts: () => void;
    onSelectIdeas: () => void;
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
            active: number;
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
    brandsLoading: boolean;
    isBusy: boolean;
    onBlockedAction: () => void;
    reorderBrands: (sourceId: string, targetId: string) => void;
    openBrandForm: (brand?: Brand) => void;
    submitBrandForm: (event: React.FormEvent) => void;
    setBrandForm: React.Dispatch<React.SetStateAction<BrandFormState>>;
    closeBrandForm: () => void;
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
    activePage,
    onSelectAccounts,
    onSelectIdeas,
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
    brandsLoading,
    isBusy,
    onBlockedAction,
    reorderBrands,
    openBrandForm,
    submitBrandForm,
    setBrandForm,
    closeBrandForm,
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

    const brandListRef = React.useRef<HTMLDivElement | null>(null);
    const brandRowRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const [activeBrandRect, setActiveBrandRect] = React.useState<{ top: number; height: number } | null>(null);
    const [brandListDragActiveId, setBrandListDragActiveId] = React.useState<string | null>(null);
    const brandListLastDragAtRef = React.useRef<number>(0);
    const isBrandReorderMode = brandFormOpen && Boolean(editingBrandId);

    const updateActiveBrandHighlight = React.useCallback(() => {
        const container = brandListRef.current;
        const activeBrandId = selectedBrandId;
        if (!container || !activeBrandId) {
            setActiveBrandRect(null);
            return;
        }

        const activeRow = brandRowRefs.current[activeBrandId];
        if (!activeRow) {
            setActiveBrandRect(null);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const rowRect = activeRow.getBoundingClientRect();
        setActiveBrandRect({
            top: rowRect.top - containerRect.top + container.scrollTop,
            height: rowRect.height,
        });
    }, [selectedBrandId]);

    const setBrandRowRef = React.useCallback(
        (brandId: string, el: HTMLButtonElement | null) => {
            brandRowRefs.current[brandId] = el;
            if (el && brandId === selectedBrandId) {
                requestAnimationFrame(updateActiveBrandHighlight);
            }
        },
        [selectedBrandId, updateActiveBrandHighlight]
    );

    React.useLayoutEffect(() => {
        updateActiveBrandHighlight();
        const container = brandListRef.current;
        if (!container) return;

        const handleRecalc = () => {
            requestAnimationFrame(updateActiveBrandHighlight);
        };

        container.addEventListener('scroll', handleRecalc, { passive: true });
        window.addEventListener('resize', handleRecalc);

        const resizeObserver = new ResizeObserver(() => {
            handleRecalc();
        });
        resizeObserver.observe(container);

        Object.values(brandRowRefs.current).forEach((row) => {
            if (row) resizeObserver.observe(row);
        });

        return () => {
            container.removeEventListener('scroll', handleRecalc);
            window.removeEventListener('resize', handleRecalc);
            resizeObserver.disconnect();
        };
    }, [brands, selectedBrandId, updateActiveBrandHighlight, brandsLoading, isSidebarOpen]);

    React.useEffect(() => {
        const container = brandListRef.current;
        if (!container) return;
        if (brandListDragActiveId) return;

        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateActiveBrandHighlight);
        };

        const observer = new MutationObserver(() => schedule());
        observer.observe(container, { childList: true });
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, [brandListDragActiveId, updateActiveBrandHighlight]);

    const brandById = React.useMemo(() => {
        const map = new Map<string, Brand>();
        brands.forEach((b) => map.set(b.id, b));
        return map;
    }, [brands]);

    const isAccountsActive = activePage === 'accounts';
    const isIdeasActive = activePage === 'ideas';

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
                                const baseBag = [0, 1, 2, 3, 4, 4, 4, 5]; // Slight bias towards BreathingText (index 4).
                                const bag = baseBag.filter((v) => v !== prev);
                                return bag[Math.floor(Math.random() * bag.length)] ?? ((prev + 1) % 6);
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

            {brandFormOpen ? (
                <div className="px-4 pb-4">
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
                                onClick={() => closeBrandForm()}
                                className="rounded-xl border border-indigo-900/60 px-3 py-2 text-xs text-indigo-200/70 hover:text-white"
                            >
                                {text('cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            <div className="relative flex-1 min-h-0">
                <div
                    ref={brandListRef}
                    className="relative h-full min-h-0 overflow-y-auto px-3 pt-1 pb-6 space-y-2 scrollbar-thin scrollbar-thumb-indigo-900/40"
                >
                    {activeBrandRect && !brandListDragActiveId ? (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 right-3 top-0 rounded-2xl border border-indigo-400/30 bg-indigo-500/15 transition-[transform,height] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                                transform: `translateY(${activeBrandRect.top}px)`,
                                height: `${activeBrandRect.height}px`,
                            }}
                        />
                    ) : null}

                    {!brandsLoading && !brands.length && (
                        <div className="rounded-2xl border border-dashed border-indigo-900/60 p-4 text-sm text-indigo-200/70">
                            {text('no_brands_yet')}
                        </div>
                    )}

                    {isBrandReorderMode ? (
                        <SortableList
                            ids={brands.map((b) => b.id)}
                            disabled={isBusy}
                            onActiveIdChange={setBrandListDragActiveId}
                            onCommitMove={({ activeId, toIndex }) => {
                                const targetId = brands[toIndex]?.id;
                                if (!targetId) return;
                                brandListLastDragAtRef.current = Date.now();
                                reorderBrands(activeId, targetId);
                            }}
                        >
                            {(orderedIds, activeId) => (
                                <>
                                    {orderedIds.map((brandId) => {
                                        const brand = brandById.get(brandId);
                                        if (!brand) return null;
                                        const iconUrl = brandIconUrls[brand.id];
                                        const summary =
                                            brandAppSummaryByBrandId[brand.id] || { total: 0, active: 0, green: 0, yellow: 0, red: 0 };
                                        return (
                                            <SortableBrandRow
                                                key={brand.id}
                                                brand={brand}
                                                iconUrl={iconUrl}
                                                summary={summary}
                                                isActive={brand.id === selectedBrandId}
                                                isBusy={isBusy}
                                                isDragging={Boolean(activeId)}
                                                showDragIndicator={isBrandReorderMode}
                                                onBlockedAction={onBlockedAction}
                                                onSelect={() => {
                                                    if (Date.now() - brandListLastDragAtRef.current < 250) return;
                                                    setSelectedBrandId(brand.id);
                                                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                                                }}
                                                onOpenLightbox={() => iconUrl && openLightbox(iconUrl, text('icon_reference'))}
                                                clampCount={clampCount}
                                                dotClass={dotClass}
                                                countTextClass={countTextClass}
                                                setRowRef={(el) => setBrandRowRef(brand.id, el)}
                                                text={text}
                                            />
                                        );
                                    })}
                                </>
                            )}
                        </SortableList>
                    ) : (
                        brands.map((brand) => {
                            const isActive = brand.id === selectedBrandId;
                            const iconUrl = brandIconUrls[brand.id];
                            const summary =
                                brandAppSummaryByBrandId[brand.id] || { total: 0, active: 0, green: 0, yellow: 0, red: 0 };
                            return (
                                <PlainBrandRow
                                    key={brand.id}
                                    brand={brand}
                                    iconUrl={iconUrl}
                                    summary={summary}
                                    isActive={isActive}
                                    isBusy={isBusy}
                                    onBlockedAction={onBlockedAction}
                                    onSelect={() => {
                                        setSelectedBrandId(brand.id);
                                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                                    }}
                                    onOpenLightbox={() => iconUrl && openLightbox(iconUrl, text('icon_reference'))}
                                    clampCount={clampCount}
                                    dotClass={dotClass}
                                    countTextClass={countTextClass}
                                    setRowRef={(el) => setBrandRowRef(brand.id, el)}
                                    text={text}
                                />
                            );
                        })
                    )}
                </div>

                {brandsLoading ? (
                    <div
                        className="pointer-events-none absolute left-5 bottom-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/35 text-indigo-100/75 backdrop-blur"
                        title={text('loading_brands')}
                        aria-label={text('loading_brands')}
                    >
                        <Loader2 className="animate-spin" size={14} />
                    </div>
                ) : null}
            </div>

            <div className="bg-slate-900 border-t border-slate-800/60 px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onSelectAccounts()}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                            isAccountsActive
                                ? 'border-indigo-400/45 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_-30px_rgba(99,102,241,0.75)]'
                                : 'border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:bg-slate-950/30'
                        }`}
                        aria-label={text('accounts')}
                        title={text('accounts')}
                    >
                        <Users size={13} className="text-indigo-200/70" />
                        <span>{text('accounts')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onSelectIdeas()}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                            isIdeasActive
                                ? 'border-indigo-400/45 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_-30px_rgba(99,102,241,0.75)]'
                                : 'border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:bg-slate-950/30'
                        }`}
                        aria-label={text('ideas')}
                        title={text('ideas')}
                    >
                        <Lightbulb size={13} className="text-indigo-200/70" />
                        <span>{text('ideas')}</span>
                    </button>
                </div>
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

function PlainBrandRow({
    brand,
    iconUrl,
    summary,
    isActive,
    isBusy,
    onBlockedAction,
    onSelect,
    onOpenLightbox,
    clampCount,
    dotClass,
    countTextClass,
    setRowRef,
    text,
}: {
    brand: Brand;
    iconUrl: string | undefined;
    summary: { total: number; active: number; green: number; yellow: number; red: number };
    isActive: boolean;
    isBusy: boolean;
    onBlockedAction: () => void;
    onSelect: () => void;
    onOpenLightbox: () => void;
    clampCount: (n: number) => string;
    dotClass: (kind: 'green' | 'yellow' | 'red', value: number) => string;
    countTextClass: (kind: 'green' | 'yellow' | 'red', value: number) => string;
    setRowRef: (el: HTMLButtonElement | null) => void;
    text: (key: TranslationKey) => string;
}) {
    return (
        <button
            ref={setRowRef}
            onClick={() => {
                if (isBusy) {
                    onBlockedAction();
                    return;
                }
                onSelect();
            }}
            className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 ${
                isActive
                    ? 'ring-indigo-400/20 bg-transparent text-white shadow-none'
                    : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70'
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={`h-9 w-9 overflow-hidden rounded-[12px] bg-slate-800/35 flex items-center justify-center text-[11px] text-indigo-200/70 shrink-0 ${
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
                                    onOpenLightbox();
                                }}
                            />
                        ) : (
                            <span>{brand.name.slice(0, 1).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p
                            className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis truncate"
                            title={brand.name}
                        >
                            {brand.name}
                        </p>
                        <p className="text-xs text-indigo-200/60 truncate" title={`/${brand.slug}`}>
                            /{brand.slug}
                        </p>
                    </div>
                </div>
                <div
                    className="flex items-center gap-2 shrink-0"
                    title={`Active apps: ${summary.active}\nAB tests: ${summary.green}\nReady (no A/B): ${summary.yellow}\nBanned: ${summary.red}`}
                >
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-100/70 tabular-nums min-w-[22px]">
                        {clampCount(summary.active)}
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
}

function SortableBrandRow({
    brand,
    iconUrl,
    summary,
    isActive,
    isBusy,
    isDragging,
    showDragIndicator,
    onBlockedAction,
    onSelect,
    onOpenLightbox,
    clampCount,
    dotClass,
    countTextClass,
    setRowRef,
    text,
}: {
    brand: Brand;
    iconUrl: string | undefined;
    summary: { total: number; active: number; green: number; yellow: number; red: number };
    isActive: boolean;
    isBusy: boolean;
    isDragging: boolean;
    showDragIndicator: boolean;
    onBlockedAction: () => void;
    onSelect: () => void;
    onOpenLightbox: () => void;
    clampCount: (n: number) => string;
    dotClass: (kind: 'green' | 'yellow' | 'red', value: number) => string;
    countTextClass: (kind: 'green' | 'yellow' | 'red', value: number) => string;
    setRowRef: (el: HTMLButtonElement | null) => void;
    text: (key: TranslationKey) => string;
}) {
    const { attributes, listeners, setNodeRef, style } = useSortableTile(brand.id, isBusy);
    return (
        <button
            ref={(el) => {
                setNodeRef(el);
                setRowRef(el);
            }}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => {
                if (isBusy) {
                    onBlockedAction();
                    return;
                }
                if (isDragging) return;
                onSelect();
            }}
            className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 cursor-grab active:cursor-grabbing ${
                isActive
                    ? 'ring-indigo-400/20 bg-transparent text-white shadow-none'
                    : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70'
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {showDragIndicator ? (
                        <span aria-hidden="true" className="shrink-0 text-indigo-200/35">
                            <GripVertical size={14} />
                        </span>
                    ) : null}
                    <div
                        className={`h-9 w-9 overflow-hidden rounded-[12px] bg-slate-800/35 flex items-center justify-center text-[11px] text-indigo-200/70 shrink-0 ${
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
                                    if (isDragging) return;
                                    onOpenLightbox();
                                }}
                            />
                        ) : (
                            <span>{brand.name.slice(0, 1).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p
                            className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis truncate"
                            title={brand.name}
                        >
                            {brand.name}
                        </p>
                        <p className="text-xs text-indigo-200/60 truncate" title={`/${brand.slug}`}>
                            /{brand.slug}
                        </p>
                    </div>
                </div>
                <div
                    className="flex items-center gap-2 shrink-0"
                    title={`Active apps: ${summary.active}\nAB tests: ${summary.green}\nReady (no A/B): ${summary.yellow}\nBanned: ${summary.red}`}
                >
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-100/70 tabular-nums min-w-[22px]">
                        {clampCount(summary.active)}
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
}
