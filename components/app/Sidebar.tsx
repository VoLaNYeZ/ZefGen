import React from 'react';
import {
    AlertTriangle,
    DoorOpen,
    Plus,
    ArrowUpRight,
    ChevronDown,
    ChevronRight,
    Loader2,
    X,
    Users,
    Lightbulb,
    BookOpen,
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
import { InstantTooltip } from '../ui/InstantTooltip';
import type { Brand, BrandFormState } from '../../types/zefgen';
import { isNoBrand } from '../../utils/no-brand';
import { EMPTY_BRAND_APP_SUMMARY, type BrandAppSummary } from '../../utils/brand-app-summary';

type SidebarProps = {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (value: boolean) => void;
    activePage: AppPage;
    onSelectAccounts: () => void;
    onSelectHelp: () => void;
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
        BrandAppSummary
    >;
    selectedBrandId: string | null;
    activeSessionCount: number;
    activeSessionCountries: string[];
    lockedBrandIdSet: Set<string>;
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
    onActivateInactiveBrand: (brandId: string) => Promise<void> | void;
    onLockedBrandAction: () => void;
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
    onSelectHelp,
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
    activeSessionCount,
    activeSessionCountries,
    lockedBrandIdSet,
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
    onActivateInactiveBrand,
    onLockedBrandAction,
    openLightbox,
    handleLogout,
    text,
}: SidebarProps) => {
    const clampCount = (n: number) => {
        const v = Math.max(0, Math.floor(Number(n) || 0));
        if (v > 99) return '99+';
        return String(v);
    };

    const dotClass = (kind: 'active' | 'inProgress' | 'banned', value: number) => {
        const isZero = !(Number(value) > 0);
        const dim = isZero ? 'opacity-35' : 'opacity-95';
        if (kind === 'active') return `h-1.5 w-1.5 rounded-full ${dim} bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.40)]`;
        if (kind === 'inProgress') return `h-1.5 w-1.5 rounded-full ${dim} bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.35)]`;
        return `h-1.5 w-1.5 rounded-full ${dim} bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.35)]`;
    };

    const countTextClass = (kind: 'active' | 'inProgress' | 'banned', value: number) => {
        const isZero = !(Number(value) > 0);
        const dim = isZero ? 'opacity-35' : 'opacity-95';
        if (kind === 'active') return `${dim} text-emerald-100/90`;
        if (kind === 'inProgress') return `${dim} text-amber-50/90`;
        return `${dim} text-rose-50/90`;
    };

    const brandListRef = React.useRef<HTMLDivElement | null>(null);
    const brandRowRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const [activeBrandRect, setActiveBrandRect] = React.useState<{ top: number; height: number } | null>(null);
    const [brandListDragActiveId, setBrandListDragActiveId] = React.useState<string | null>(null);
    const brandListLastDragAtRef = React.useRef<number>(0);
    const [showLockedBrandNotice, setShowLockedBrandNotice] = React.useState(false);
    const [activatingInactiveBrandId, setActivatingInactiveBrandId] = React.useState<string | null>(null);
    const [isAmaterasuLogo, setIsAmaterasuLogo] = React.useState(false);
    const isBrandReorderMode = brandFormOpen && Boolean(editingBrandId);
    const cycleLogoVariant = React.useCallback(() => {
        setLogoVariantIndex((prev) => (prev + 1) % 6);
    }, [setLogoVariantIndex]);

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
        if (!container.contains(activeRow)) {
            // No Brand lives outside the scrollable brands list; do not project list highlight for it.
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

        (Object.values(brandRowRefs.current) as Array<HTMLButtonElement | null>).forEach((row) => {
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
    const regularBrands = React.useMemo(
        () => brands.filter((brand) => !isNoBrand(brand)),
        [brands]
    );
    const activeBrands = React.useMemo(
        () => regularBrands.filter((brand) => !brand.is_inactive),
        [regularBrands]
    );
    const inactiveBrands = React.useMemo(
        () => regularBrands.filter((brand) => brand.is_inactive),
        [regularBrands]
    );
    const noBrand = React.useMemo(
        () => brands.find((brand) => isNoBrand(brand)) || null,
        [brands]
    );
    const [inactiveBrandsExpanded, setInactiveBrandsExpanded] = React.useState(false);
    const hasPinnedInactiveBrand = React.useMemo(
        () => inactiveBrands.some((brand) => brand.id === selectedBrandId || brand.id === editingBrandId),
        [inactiveBrands, selectedBrandId, editingBrandId]
    );
    const isAccountsActive = activePage === 'accounts';
    const isHelpActive = activePage === 'help';
    const isIdeasActive = activePage === 'ideas';
    const tooltipCountries = React.useMemo(() => {
        if (activeSessionCountries.length > 0) {
            return activeSessionCountries;
        }
        const fallbackCount = Math.max(0, Math.floor(Number(activeSessionCount) || 0));
        if (!fallbackCount) return [];
        return Array.from({ length: fallbackCount }, () => 'unknown');
    }, [activeSessionCountries, activeSessionCount]);
    const formatCountryLabel = React.useCallback(
        (country: string) => {
            const raw = String(country || '').trim().toLowerCase();
            if (!raw || raw === 'unknown') return text('active_sessions_unknown_country');
            return raw.toUpperCase();
        },
        [text]
    );
    const handleLockedBrandAction = React.useCallback(() => {
        setShowLockedBrandNotice(true);
        onLockedBrandAction();
    }, [onLockedBrandAction]);

    React.useEffect(() => {
        if (!showLockedBrandNotice) return;
        const timer = window.setTimeout(() => setShowLockedBrandNotice(false), 2600);
        return () => window.clearTimeout(timer);
    }, [showLockedBrandNotice]);

    React.useEffect(() => {
        if (hasPinnedInactiveBrand) {
            setInactiveBrandsExpanded(true);
        }
    }, [hasPinnedInactiveBrand]);

    return (
        <aside
            data-testid="brand-sidebar"
            aria-label={text('brands')}
            className={`
                fixed top-0 left-0 h-[100dvh] z-50 w-72 bg-slate-900 text-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col border-r border-indigo-900/40
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:h-screen md:z-40
            `}
        >
            <div className="relative p-5 border-b border-indigo-900/30">
                <div
                    ref={logoContainerRef}
                    className="sidebar-logo-chip relative isolate w-full overflow-hidden rounded-[26px] border border-white/8 px-4 py-3 select-none"
                >
                    <div className="relative flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setIsAmaterasuLogo((prev) => !prev)}
                            aria-pressed={isAmaterasuLogo}
                            aria-label={isAmaterasuLogo ? 'Use default smoke logo colors' : 'Use Amaterasu smoke logo colors'}
                            className={`sidebar-logo-mark-shell h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                isAmaterasuLogo ? 'is-amaterasu' : ''
                            }`}
                        >
                            <span aria-hidden="true" className={`sidebar-logo-mark-aura ${isAmaterasuLogo ? 'is-amaterasu' : ''}`} />
                            <span className="relative z-10 block h-10 w-10">
                                <img
                                    src="/genlogo.png"
                                    alt=""
                                    className={`sidebar-logo-image ${isAmaterasuLogo ? 'is-hidden' : ''}`}
                                />
                                <span aria-hidden="true" className={`sidebar-logo-mask sidebar-logo-mask-shadow ${isAmaterasuLogo ? 'is-amaterasu' : ''}`} />
                                <span aria-hidden="true" className={`sidebar-logo-mask sidebar-logo-mask-base ${isAmaterasuLogo ? 'is-amaterasu' : ''}`} />
                                <span aria-hidden="true" className={`sidebar-logo-mask sidebar-logo-mask-ember ${isAmaterasuLogo ? 'is-amaterasu' : ''}`} />
                                <span aria-hidden="true" className={`sidebar-logo-mask sidebar-logo-mask-hotspot ${isAmaterasuLogo ? 'is-amaterasu' : ''}`} />
                            </span>
                        </button>
                        <div className="min-w-0 flex-1 flex items-center">
                            <button
                                type="button"
                                onClick={cycleLogoVariant}
                                aria-label="Cycle ZefGen wordmark animation"
                                className={`logo-wrap transition-opacity duration-300 ${
                                    logoFontReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                } rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
                                style={{ fontFamily: '"Roboto Flex Variable", "Roboto Flex", sans-serif' }}
                            >
                                {(() => {
                                    const baseClassName = 'translate-y-px text-[2.15rem] leading-none text-white font-roboto-flex tracking-[0.045em]';
                                    const variants = [
                                        <LetterSwapForward label={logoWord} className={`${baseClassName} font-light`} />,
                                        <LetterSwapPingPong label={logoWord} staggerFrom="center" className={`${baseClassName} font-light`} />,
                                        <VariableFontHoverByRandomLetter
                                            label={logoWord}
                                            className={baseClassName}
                                            fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                            toFontVariationSettings="'wght' 900, 'slnt' 0"
                                        />,
                                        <VariableFontCursorProximity
                                            label={logoWord}
                                            className={baseClassName}
                                            fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                            toFontVariationSettings="'wght' 900, 'slnt' -10"
                                            radius={180}
                                            falloff="gaussian"
                                            containerRef={logoContainerRef}
                                        />,
                                        <BreathingText
                                            className={`${baseClassName} cursor-pointer`}
                                            fromFontVariationSettings="'wght' 260, 'slnt' 0"
                                            toFontVariationSettings="'wght' 820, 'slnt' -8"
                                        >
                                            {logoWord}
                                        </BreathingText>,
                                        <ScrambleHover
                                            text={logoWord}
                                            className={`${baseClassName} font-light`}
                                            scrambleSpeed={45}
                                            maxIterations={8}
                                        />,
                                    ];

                                    return variants[logoVariantIndex] ?? variants[4];
                                })()}
                            </button>
                        </div>
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
                            <label htmlFor="brand-form-name" className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_name')}</label>
                            <input
                                id="brand-form-name"
                                value={brandForm.name}
                                onChange={(event) =>
                                    setBrandForm((prev) => ({ ...prev, name: event.target.value }))
                                }
                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                placeholder="Adidas"
                            />
                        </div>
                        {editingBrandId ? (
                            <label data-testid="brand-inactive-toggle" className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-1.5">
                                <span className="text-xs font-semibold text-indigo-100/85">{text('brand_inactive_toggle')}</span>
                                <span
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                                        brandForm.isInactive
                                            ? 'border-amber-300/35 bg-amber-500/15'
                                            : 'border-white/10 bg-slate-950/55'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={brandForm.isInactive}
                                        onChange={(event) =>
                                            setBrandForm((prev) => ({ ...prev, isInactive: event.target.checked }))
                                        }
                                        className="sr-only"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block h-4 w-4 rounded-full transition-transform duration-200 ${
                                            brandForm.isInactive
                                                ? 'translate-x-6 bg-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)]'
                                                : 'translate-x-1 bg-indigo-100/80'
                                        }`}
                                    />
                                </span>
                            </label>
                        ) : null}
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

                    {!brandsLoading && !regularBrands.length && (
                        <div className="rounded-2xl border border-dashed border-indigo-900/60 p-4 text-sm text-indigo-200/70">
                            {text('no_brands_yet')}
                        </div>
                    )}

                    {isBrandReorderMode ? (
                        <SortableList
                            ids={activeBrands.map((b) => b.id)}
                            disabled={isBusy}
                            onActiveIdChange={setBrandListDragActiveId}
                            onCommitMove={({ activeId, toIndex }) => {
                                const targetId = activeBrands[toIndex]?.id;
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
                                        const summary = brandAppSummaryByBrandId[brand.id] || EMPTY_BRAND_APP_SUMMARY;
                                        return (
                                            <React.Fragment key={brand.id}>
                                                <SortableBrandRow
                                                    brand={brand}
                                                    iconUrl={iconUrl}
                                                    summary={summary}
                                                    isActive={brand.id === selectedBrandId}
                                                    isInactive={false}
                                                    isLockedByOtherDevice={lockedBrandIdSet.has(brand.id)}
                                                    isBusy={isBusy}
                                                    isDragging={Boolean(activeId)}
                                                    showDragIndicator={isBrandReorderMode}
                                                    onBlockedAction={onBlockedAction}
                                                    onLockedAction={handleLockedBrandAction}
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
                                            </React.Fragment>
                                        );
                                    })}
                                </>
                            )}
                        </SortableList>
                    ) : (
                        activeBrands.map((brand) => {
                            const isActive = brand.id === selectedBrandId;
                            const iconUrl = brandIconUrls[brand.id];
                            const summary = brandAppSummaryByBrandId[brand.id] || EMPTY_BRAND_APP_SUMMARY;
                            return (
                                <React.Fragment key={brand.id}>
                                    <PlainBrandRow
                                        brand={brand}
                                        iconUrl={iconUrl}
                                        summary={summary}
                                        isActive={isActive}
                                        isInactive={false}
                                        isNoBrand={false}
                                        isLockedByOtherDevice={lockedBrandIdSet.has(brand.id)}
                                        isBusy={isBusy}
                                        onBlockedAction={onBlockedAction}
                                        onLockedAction={handleLockedBrandAction}
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
                                </React.Fragment>
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

            <div className="border-t border-white/6 bg-slate-950/70 px-3 py-2">
                    <button
                        type="button"
                        data-testid="inactive-brands-toggle"
                        onClick={() => {
                            if (hasPinnedInactiveBrand) {
                                setInactiveBrandsExpanded(true);
                                return;
                            }
                            setInactiveBrandsExpanded((prev) => !prev);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-slate-950/35 px-3 py-2 text-left transition hover:border-indigo-400/20 hover:bg-slate-900/60"
                    >
                        <span className="inline-flex items-center gap-2">
                            {inactiveBrandsExpanded ? (
                                <ChevronDown size={14} className="text-indigo-200/70" />
                            ) : (
                                <ChevronRight size={14} className="text-indigo-200/70" />
                            )}
                            <span className="text-[11px] font-semibold tracking-[0.14em] text-indigo-200/70 uppercase">
                                {text('inactive_brands')}
                            </span>
                        </span>
                        <span className="inline-flex min-w-[24px] items-center justify-center rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100/85 tabular-nums">
                            {clampCount(inactiveBrands.length)}
                        </span>
                    </button>

                    {inactiveBrandsExpanded ? (
                        <div data-testid="inactive-brands-panel" className="mt-2 max-h-52 space-y-2 overflow-y-auto px-1 py-1">
                            {inactiveBrands.length ? (
                                inactiveBrands.map((brand) => {
                                    const iconUrl = brandIconUrls[brand.id];
                                    return (
                                        <React.Fragment key={brand.id}>
                                            <InactiveDrawerBrandRow
                                                brand={brand}
                                                iconUrl={iconUrl}
                                                isActive={brand.id === selectedBrandId}
                                                isLockedByOtherDevice={lockedBrandIdSet.has(brand.id)}
                                                isBusy={isBusy}
                                                isActivating={activatingInactiveBrandId === brand.id}
                                                onBlockedAction={onBlockedAction}
                                                onLockedAction={handleLockedBrandAction}
                                                onSelect={() => {
                                                    setSelectedBrandId(brand.id);
                                                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                                                }}
                                                onActivate={async () => {
                                                    if (lockedBrandIdSet.has(brand.id)) {
                                                        handleLockedBrandAction();
                                                        return;
                                                    }
                                                    if (isBusy || activatingInactiveBrandId === brand.id) {
                                                        onBlockedAction();
                                                        return;
                                                    }
                                                    setActivatingInactiveBrandId(brand.id);
                                                    try {
                                                        await onActivateInactiveBrand(brand.id);
                                                        setSelectedBrandId(brand.id);
                                                        setInactiveBrandsExpanded(false);
                                                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                                                    } finally {
                                                        setActivatingInactiveBrandId(null);
                                                    }
                                                }}
                                                onOpenLightbox={() => iconUrl && openLightbox(iconUrl, text('icon_reference'))}
                                                setRowRef={(el) => setBrandRowRef(brand.id, el)}
                                                text={text}
                                            />
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-dashed border-white/8 px-3 py-2 text-[11px] text-indigo-200/55">
                                    {text('inactive_brands_empty')}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

            {noBrand ? (
                <div className="border-t border-cyan-400/20 bg-gradient-to-b from-cyan-950/35 to-slate-900 px-3 py-3">
                    <React.Fragment key={noBrand.id}>
                        <PlainBrandRow
                            brand={noBrand}
                            iconUrl={brandIconUrls[noBrand.id]}
                            summary={brandAppSummaryByBrandId[noBrand.id] || EMPTY_BRAND_APP_SUMMARY}
                            isActive={noBrand.id === selectedBrandId}
                            isInactive={false}
                            isNoBrand
                            isLockedByOtherDevice={lockedBrandIdSet.has(noBrand.id)}
                            isBusy={isBusy}
                            onBlockedAction={onBlockedAction}
                            onLockedAction={handleLockedBrandAction}
                            onSelect={() => {
                                setSelectedBrandId(noBrand.id);
                                if (window.innerWidth < 768) setIsSidebarOpen(false);
                            }}
                            onOpenLightbox={() => {}}
                            clampCount={clampCount}
                            dotClass={dotClass}
                            countTextClass={countTextClass}
                            setRowRef={(el) => setBrandRowRef(noBrand.id, el)}
                            text={text}
                        />
                    </React.Fragment>
                </div>
            ) : null}

            <div className="bg-slate-900 border-t border-slate-800/60 px-4 py-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onSelectAccounts()}
                        className={`inline-flex h-8 w-[100px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            isAccountsActive
                                ? 'border-indigo-400/45 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_-30px_rgba(99,102,241,0.75)]'
                                : 'border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:bg-slate-950/30'
                        }`}
                        aria-label={text('accounts')}
                        title={text('accounts')}
                    >
                        <Users size={11} className="shrink-0 text-indigo-200/70" />
                        <span className="truncate">{text('accounts')}</span>
                    </button>
                    <InstantTooltip
                        content={
                            <div className="min-w-[180px] space-y-1">
                                <p className="font-semibold text-indigo-100">
                                    {`${Math.max(0, Math.floor(Number(activeSessionCount) || 0))} ${text('active_sessions_tooltip_title')}`}
                                </p>
                                {tooltipCountries.length > 0 ? (
                                    <div className="space-y-0.5">
                                        {tooltipCountries.map((country, index) => (
                                            <p key={`${country}-${index}`} className="leading-snug text-indigo-200/85">
                                                {formatCountryLabel(country)}
                                            </p>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        }
                    >
                        <span
                            className="inline-flex h-8 w-[34px] shrink-0 items-center justify-center gap-1 rounded-full border border-white/10 bg-slate-950/25 px-1.5 text-indigo-100/80"
                            aria-label={`${Math.max(0, Math.floor(Number(activeSessionCount) || 0))} ${text('active_sessions_tooltip_title')}`}
                            title={`${Math.max(0, Math.floor(Number(activeSessionCount) || 0))} ${text('active_sessions_tooltip_title')}`}
                        >
                            <Users size={11} className="shrink-0 text-indigo-200/80" />
                            <span className="text-[10px] font-semibold tabular-nums">
                                {Math.max(0, Math.floor(Number(activeSessionCount) || 0))}
                            </span>
                        </span>
                    </InstantTooltip>
                    <InstantTooltip content={<span className="font-semibold text-indigo-100">{text('help')}</span>}>
                        <button
                            type="button"
                            onClick={() => onSelectHelp()}
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                                isHelpActive
                                    ? 'border-indigo-400/45 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_-30px_rgba(99,102,241,0.75)]'
                                    : 'border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:bg-slate-950/30'
                            }`}
                            aria-label={text('help')}
                            title={text('help')}
                        >
                            <BookOpen size={12} className="text-indigo-200/80" />
                        </button>
                    </InstantTooltip>
                    <button
                        type="button"
                        onClick={() => onSelectIdeas()}
                        className={`inline-flex h-8 w-[74px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            isIdeasActive
                                ? 'border-indigo-400/45 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_-30px_rgba(99,102,241,0.75)]'
                                : 'border-white/10 bg-slate-950/20 text-indigo-100/80 hover:border-indigo-400/35 hover:bg-slate-950/30'
                        }`}
                        aria-label={text('ideas')}
                        title={text('ideas')}
                    >
                        <Lightbulb size={11} className="shrink-0 text-indigo-200/70" />
                        <span className="truncate">{text('ideas')}</span>
                    </button>
                </div>
            </div>
            {showLockedBrandNotice ? (
                <div className="bg-slate-900 px-5 pb-3">
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
                        {text('brand_under_work_readonly')}
                    </div>
                </div>
            ) : null}

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

const buildInProgressAttentionLabel = (text: (key: TranslationKey) => string, count: number) =>
    String(text('in_progress_attention_tooltip') || '').replace('{count}', String(Math.max(0, Math.floor(count || 0))));

const buildBrandSummaryTooltip = (text: (key: TranslationKey) => string, summary: BrandAppSummary) => {
    const lines = [
        `${text('active_apps')} + ${text('in_progress')}: ${summary.nonBanned}`,
        `${text('active_apps')}: ${summary.active}`,
        `${text('in_progress')}: ${summary.inProgress}`,
        `${text('banned_apps')}: ${summary.banned}`,
    ];
    if (summary.inProgressAttentionCount > 0) {
        lines.push(buildInProgressAttentionLabel(text, summary.inProgressAttentionCount));
    }
    return lines.join('\n');
};

function InProgressAttentionMarker({
    count,
    text,
    dataTestId,
}: {
    count: number;
    text: (key: TranslationKey) => string;
    dataTestId?: string;
}) {
    const label = buildInProgressAttentionLabel(text, count);
    if (!(count > 0)) return null;

    return (
        <span
            data-testid={dataTestId}
            className="inline-flex items-center justify-center text-amber-200/85"
            title={label}
            aria-label={label}
        >
            <AlertTriangle size={10} />
        </span>
    );
}

function BrandStatusSummaryCluster({
    summary,
    clampCount,
    dotClass,
    countTextClass,
    text,
    showActiveIndicator = false,
    className = '',
}: {
    summary: BrandAppSummary;
    clampCount: (n: number) => string;
    dotClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    countTextClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    text: (key: TranslationKey) => string;
    showActiveIndicator?: boolean;
    className?: string;
}) {
    return (
        <div
            data-testid="brand-row-status-summary"
            className={['flex items-center gap-2 shrink-0', className].filter(Boolean).join(' ')}
            title={buildBrandSummaryTooltip(text, summary)}
        >
            <span
                data-testid="brand-row-non-banned-count"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-950/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-100/70 tabular-nums min-w-[22px]"
            >
                {clampCount(summary.nonBanned)}
            </span>
            <div className="flex flex-col items-end justify-center gap-0.5">
                <div
                    data-testid="brand-row-status-active"
                    className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums"
                >
                    <span className={dotClass('active', summary.active)} />
                    <span className={countTextClass('active', summary.active)}>{clampCount(summary.active)}</span>
                </div>
                <div
                    data-testid="brand-row-status-in-progress"
                    className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums"
                >
                    <span className={dotClass('inProgress', summary.inProgress)} />
                    <span className={countTextClass('inProgress', summary.inProgress)}>{clampCount(summary.inProgress)}</span>
                    <InProgressAttentionMarker
                        count={summary.inProgressAttentionCount}
                        text={text}
                        dataTestId="brand-row-in-progress-warning"
                    />
                </div>
                <div
                    data-testid="brand-row-status-banned"
                    className="flex items-center gap-1 text-[9px] font-semibold leading-none tabular-nums"
                >
                    <span className={dotClass('banned', summary.banned)} />
                    <span className={countTextClass('banned', summary.banned)}>{clampCount(summary.banned)}</span>
                </div>
            </div>
            {showActiveIndicator ? <ArrowUpRight size={16} className="text-indigo-200" /> : null}
        </div>
    );
}

function PlainBrandRow({
    brand,
    iconUrl,
    summary,
    isActive,
    isInactive,
    enableActiveTestId = true,
    isNoBrand,
    isLockedByOtherDevice,
    isBusy,
    onBlockedAction,
    onLockedAction,
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
    summary: BrandAppSummary;
    isActive: boolean;
    isInactive: boolean;
    enableActiveTestId?: boolean;
    isNoBrand: boolean;
    isLockedByOtherDevice: boolean;
    isBusy: boolean;
    onBlockedAction: () => void;
    onLockedAction: () => void;
    onSelect: () => void;
    onOpenLightbox: () => void;
    clampCount: (n: number) => string;
    dotClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    countTextClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    setRowRef: (el: HTMLButtonElement | null) => void;
    text: (key: TranslationKey) => string;
}) {
    const effectiveIconUrl = isNoBrand ? undefined : iconUrl;
    const rowStateClass = isNoBrand
        ? isLockedByOtherDevice
            ? 'ring-cyan-200/10 bg-cyan-950/20 text-cyan-100/70 opacity-55'
            : isActive
              ? 'ring-cyan-300/35 bg-cyan-500/[0.10] text-cyan-50 shadow-[0_16px_44px_-30px_rgba(34,211,238,0.8)]'
              : 'ring-cyan-300/45 bg-gradient-to-r from-cyan-950/40 to-slate-900/90 text-cyan-50 shadow-[0_14px_34px_-28px_rgba(34,211,238,0.75)] hover:from-cyan-950/55 hover:to-slate-900'
        : isLockedByOtherDevice
          ? 'ring-white/10 bg-slate-950/20 text-indigo-100/70 opacity-55'
          : isInactive
            ? isActive
              ? 'ring-amber-300/30 bg-amber-500/[0.08] text-amber-50 shadow-[0_16px_38px_-32px_rgba(251,191,36,0.6)]'
              : 'ring-amber-300/15 bg-slate-950/30 text-indigo-100/80 hover:ring-amber-300/25 hover:bg-slate-900/75'
          : isActive
            ? 'ring-indigo-400/20 bg-transparent text-white shadow-none'
            : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70';

    return (
        <button
            ref={setRowRef}
            data-brand-id={brand.id}
            data-testid={enableActiveTestId && isActive ? 'active-brand-row' : isNoBrand ? 'no-brand-row' : undefined}
            onClick={() => {
                if (isLockedByOtherDevice) {
                    onLockedAction();
                }
                if (isBusy) {
                    onBlockedAction();
                    return;
                }
                onSelect();
            }}
            className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 ${rowStateClass}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={`h-9 w-9 overflow-hidden rounded-[12px] flex items-center justify-center text-[11px] shrink-0 ${
                            isNoBrand
                                ? 'bg-cyan-950/45 text-cyan-100/85'
                                : 'bg-slate-800/35 text-indigo-200/70'
                        } ${
                            effectiveIconUrl
                                ? 'border border-transparent'
                                : isNoBrand
                                  ? 'border border-cyan-300/25'
                                  : 'border border-indigo-400/20'
                        }`}
                    >
                        {effectiveIconUrl ? (
                            <img
                                src={effectiveIconUrl}
                                alt={text('icon_reference')}
                                className="h-full w-full object-cover rounded-[12px] cursor-zoom-in"
                                loading="lazy"
                                decoding="async"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenLightbox();
                                }}
                            />
                        ) : (
                            <span>{isNoBrand ? text('no_brand_short') : brand.name.slice(0, 1).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <p
                                className={`font-semibold whitespace-nowrap overflow-hidden text-ellipsis truncate ${
                                    isNoBrand ? 'text-cyan-50' : isInactive ? 'text-amber-50' : 'text-white'
                                }`}
                                title={brand.name}
                            >
                                {brand.name}
                            </p>
                            {isInactive && !isLockedByOtherDevice ? (
                                <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-1.5 py-[1px] text-[9px] font-semibold text-amber-100/85 whitespace-nowrap leading-none">
                                    {text('inactive_badge')}
                                </span>
                            ) : null}
                            {isLockedByOtherDevice ? (
                                <span className="shrink-0 rounded-full border border-amber-300/35 bg-amber-500/10 px-1.5 py-[1px] text-[9px] font-semibold text-amber-100/90 whitespace-nowrap leading-none">
                                    {text('brand_used_by_another_user')}
                                </span>
                            ) : null}
                        </div>
                        {!isNoBrand && (
                            <p className="text-xs text-indigo-200/60 truncate" title={`/${brand.slug}`}>
                                /{brand.slug}
                            </p>
                        )}
                    </div>
                </div>
                {isNoBrand ? (
                    <div
                        className="flex items-center gap-2 shrink-0"
                        title={`${text('active_apps')} + ${text('in_progress')}: ${summary.nonBanned}`}
                    >
                        <span className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-semibold text-cyan-100/85 tabular-nums min-w-[24px]">
                            {clampCount(summary.nonBanned)}
                        </span>
                        {isActive && <ArrowUpRight size={16} className="text-cyan-200" />}
                    </div>
                ) : (
                    <BrandStatusSummaryCluster
                        summary={summary}
                        clampCount={clampCount}
                        dotClass={dotClass}
                        countTextClass={countTextClass}
                        text={text}
                        showActiveIndicator={isActive}
                    />
                )}
            </div>
        </button>
    );
}

function InactiveDrawerBrandRow({
    brand,
    iconUrl,
    isActive,
    isLockedByOtherDevice,
    isBusy,
    isActivating,
    onBlockedAction,
    onLockedAction,
    onSelect,
    onActivate,
    onOpenLightbox,
    setRowRef,
    text,
}: {
    brand: Brand;
    iconUrl: string | undefined;
    isActive: boolean;
    isLockedByOtherDevice: boolean;
    isBusy: boolean;
    isActivating: boolean;
    onBlockedAction: () => void;
    onLockedAction: () => void;
    onSelect: () => void;
    onActivate: () => Promise<void> | void;
    onOpenLightbox: () => void;
    setRowRef: (el: HTMLButtonElement | null) => void;
    text: (key: TranslationKey) => string;
}) {
    const rowStateClass = isLockedByOtherDevice
        ? 'ring-white/10 bg-slate-950/20 text-indigo-100/70 opacity-55'
        : isActive
          ? 'ring-amber-300/30 bg-amber-500/[0.08] text-amber-50 shadow-[0_16px_38px_-32px_rgba(251,191,36,0.6)]'
          : 'ring-amber-300/15 bg-slate-950/30 text-indigo-100/80 hover:ring-amber-300/25 hover:bg-slate-900/75';

    return (
        <div className={`flex items-center justify-between gap-2.5 rounded-2xl px-4 py-3 transition ring-1 ${rowStateClass}`}>
            <button
                ref={setRowRef}
                type="button"
                data-brand-id={brand.id}
                data-testid={isActive ? 'active-brand-row' : undefined}
                onClick={() => {
                    if (isLockedByOtherDevice) {
                        onLockedAction();
                    }
                    if (isBusy || isActivating) {
                        onBlockedAction();
                        return;
                    }
                    onSelect();
                }}
                className="min-w-0 flex flex-1 items-center gap-2.5 text-left"
            >
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
                            loading="lazy"
                            decoding="async"
                            onClick={(event) => {
                                event.stopPropagation();
                                onOpenLightbox();
                            }}
                        />
                    ) : (
                        <span>{brand.name.slice(0, 1).toUpperCase()}</span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                        <p
                            className="truncate whitespace-nowrap text-[14px] font-semibold leading-tight text-amber-50"
                            title={brand.name}
                        >
                            {brand.name}
                        </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-indigo-200/60 truncate" title={`/${brand.slug}`}>
                            /{brand.slug}
                        </p>
                    </div>
                </div>
            </button>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    if (isLockedByOtherDevice) {
                        onLockedAction();
                        return;
                    }
                    if (isBusy || isActivating) {
                        onBlockedAction();
                        return;
                    }
                    void onActivate();
                }}
                disabled={isLockedByOtherDevice || isBusy || isActivating}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 text-[9px] font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
            >
                {isActivating ? text('saving') : text('activate_brand')}
            </button>
        </div>
    );
}

function SortableBrandRow({
    brand,
    iconUrl,
    summary,
    isActive,
    isInactive,
    isLockedByOtherDevice,
    isBusy,
    isDragging,
    showDragIndicator,
    onBlockedAction,
    onLockedAction,
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
    summary: BrandAppSummary;
    isActive: boolean;
    isInactive: boolean;
    isLockedByOtherDevice: boolean;
    isBusy: boolean;
    isDragging: boolean;
    showDragIndicator: boolean;
    onBlockedAction: () => void;
    onLockedAction: () => void;
    onSelect: () => void;
    onOpenLightbox: () => void;
    clampCount: (n: number) => string;
    dotClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    countTextClass: (kind: 'active' | 'inProgress' | 'banned', value: number) => string;
    setRowRef: (el: HTMLButtonElement | null) => void;
    text: (key: TranslationKey) => string;
}) {
    const isLocked = isLockedByOtherDevice;
    const { attributes, listeners, setNodeRef, style } = useSortableTile(brand.id, isBusy || isLocked);
    const rowStateClass = isLocked
        ? 'ring-white/10 bg-slate-950/20 text-indigo-100/70 opacity-55'
        : isInactive
          ? isActive
            ? 'ring-amber-300/30 bg-amber-500/[0.08] text-amber-50 shadow-[0_16px_38px_-32px_rgba(251,191,36,0.6)]'
            : 'ring-amber-300/15 bg-slate-950/30 text-indigo-100/80 hover:ring-amber-300/25 hover:bg-slate-900/75'
        : isActive
          ? 'ring-indigo-400/20 bg-transparent text-white shadow-none'
          : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70';

    return (
        <button
            ref={(el) => {
                setNodeRef(el);
                setRowRef(el);
            }}
            style={style}
            data-brand-id={brand.id}
            data-testid={isActive ? 'active-brand-row' : undefined}
            {...attributes}
            {...listeners}
            onClick={() => {
                if (isLocked) {
                    onLockedAction();
                }
                if (isBusy) {
                    onBlockedAction();
                    return;
                }
                if (isDragging) return;
                onSelect();
            }}
            className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 ${
                isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
            } ${rowStateClass}`}
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
                                loading="lazy"
                                decoding="async"
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
                        <div className="flex items-start justify-between gap-2">
                            <p
                                className={`font-semibold whitespace-nowrap overflow-hidden text-ellipsis truncate ${
                                    isInactive ? 'text-amber-50' : 'text-white'
                                }`}
                                title={brand.name}
                            >
                                {brand.name}
                            </p>
                            {isInactive && !isLocked ? (
                                <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-1.5 py-[1px] text-[9px] font-semibold text-amber-100/85 whitespace-nowrap leading-none">
                                    {text('inactive_badge')}
                                </span>
                            ) : null}
                            {isLocked ? (
                                <span className="shrink-0 rounded-full border border-amber-300/35 bg-amber-500/10 px-1.5 py-[1px] text-[9px] font-semibold text-amber-100/90 whitespace-nowrap leading-none">
                                    {text('brand_used_by_another_user')}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-indigo-200/60 truncate" title={`/${brand.slug}`}>
                            /{brand.slug}
                        </p>
                    </div>
                </div>
                <BrandStatusSummaryCluster
                    summary={summary}
                    clampCount={clampCount}
                    dotClass={dotClass}
                    countTextClass={countTextClass}
                    text={text}
                    showActiveIndicator={isActive}
                />
            </div>
        </button>
    );
}
