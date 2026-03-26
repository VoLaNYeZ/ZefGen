import React from 'react';
import type { RefObject } from 'react';
import { ArrowUpRight, CheckCircle2, Clapperboard, ImageIcon, Target } from 'lucide-react';
import type { Language } from '../../i18n';
import { buildHelpRoute } from '../../utils/routes';
import { getHelpCenterCopy, type HelpSection, type HelpSectionId } from './help-center-content';

type HelpCenterPageProps = {
    lang: Language;
    mainScrollContainerRef: RefObject<HTMLDivElement | null>;
};

const resolveHashSectionId = (sections: HelpSection[]) => {
    const raw = window.location.hash.replace(/^#/, '').trim();
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    return sections.some((section) => section.id === decoded) ? (decoded as HelpSectionId) : null;
};

const getSectionCardClasses = (section: HelpSection, isActive: boolean) => {
    if (section.groupId === 'special-cases') {
        return isActive
            ? 'border-sky-300/16 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.06),transparent_30%),linear-gradient(160deg,rgba(10,15,28,0.98)_0%,rgba(11,18,32,0.94)_100%)]'
            : 'border-white/7 bg-slate-950/36';
    }

    return isActive
        ? 'border-sky-300/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_32%),linear-gradient(160deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_100%)]'
        : 'border-white/8 bg-slate-900/45';
};

const getSectionContentClasses = (section: HelpSection, hasVisualSlot: boolean) => {
    if (!hasVisualSlot) {
        return 'space-y-4';
    }

    if (section.visual?.placement === 'wide') {
        return 'space-y-4';
    }

    if (section.visual?.size === 'small') {
        return 'space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start lg:gap-5 lg:space-y-0';
    }

    if (section.visual?.size === 'medium') {
        return 'space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_284px] lg:items-start lg:gap-6 lg:space-y-0';
    }

    return 'space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 lg:space-y-0';
};

const getVisualSlotClasses = (section: HelpSection, expanded = false) => {
    const visual = section.visual;
    if (!visual) return '';

    const base =
        'relative overflow-hidden rounded-[16px] border border-dashed border-sky-300/18 bg-[linear-gradient(180deg,rgba(15,23,42,0.82)_0%,rgba(2,6,23,0.92)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

    if (expanded) {
        return `${base} min-h-[320px] sm:min-h-[420px] lg:min-h-[540px]`;
    }

    if (visual.placement === 'wide') {
        return `${base} min-h-[220px] sm:min-h-[260px] lg:min-h-[320px]`;
    }

    if (visual.size === 'small') {
        return `${base} min-h-[188px] lg:min-h-[220px]`;
    }

    if (visual.size === 'medium') {
        return `${base} min-h-[224px] lg:min-h-[276px]`;
    }

    return `${base} min-h-[264px] lg:min-h-[360px]`;
};

const getVisualChipLabel = (lang: Language, section: HelpSection, kind: 'medium' | 'size' | 'placement') => {
    const visual = section.visual;
    if (!visual) return '';

    if (kind === 'medium') {
        if (visual.medium === 'gif') return 'GIF';
        return lang === 'ru' ? 'СКРИН' : 'IMAGE';
    }

    if (kind === 'size') {
        if (lang === 'ru') {
            return visual.size === 'large' ? 'БОЛЬШОЙ' : visual.size === 'medium' ? 'СРЕДНИЙ' : 'МАЛЫЙ';
        }
        return visual.size.toUpperCase();
    }

    if (visual.placement === 'wide') {
        return lang === 'ru' ? 'ШИРОКИЙ' : 'WIDE';
    }

    return lang === 'ru' ? 'СПРАВА' : 'RIGHT';
};

const getOpenVisualLabel = (lang: Language) => (lang === 'ru' ? 'Открыть визуал' : 'Open visual');

const getCloseVisualLabel = (lang: Language) => (lang === 'ru' ? 'Закрыть' : 'Close');

const VisualPlaceholder = ({
    lang,
    section,
    expanded = false,
}: {
    lang: Language;
    section: HelpSection;
    expanded?: boolean;
}) => {
    const visual = section.visual;
    if (!visual) return null;

    const Icon = visual.medium === 'gif' ? Clapperboard : ImageIcon;

    return (
        <div
            data-testid={`help-visual-${section.id}`}
            data-visual-medium={visual.medium}
            data-visual-size={visual.size}
            data-visual-placement={visual.placement}
            className={`${getVisualSlotClasses(section, expanded)} ${!expanded && visual.placement === 'wide' ? 'mt-1' : !expanded ? 'lg:self-start' : ''}`}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

            <div className={`relative flex h-full flex-col gap-4 ${expanded ? 'p-5 sm:p-6' : 'p-4'}`}>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/78">
                        {getVisualChipLabel(lang, section, 'medium')}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/62">
                        {getVisualChipLabel(lang, section, 'size')}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200/62">
                        {getVisualChipLabel(lang, section, 'placement')}
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className={`rounded-[14px] border border-white/10 bg-slate-950/45 text-sky-100/78 shadow-[0_18px_44px_-34px_rgba(56,189,248,0.5)] ${expanded ? 'p-5' : 'p-4'}`}>
                            <Icon size={expanded ? 36 : 28} strokeWidth={1.8} />
                        </div>
                        <div className="space-y-1">
                            <p className={`${expanded ? 'text-[14px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.24em] text-sky-50/82`}>
                                {getVisualChipLabel(lang, section, 'medium')}
                            </p>
                            <p className={`${expanded ? 'text-[11px]' : 'text-[10px]'} font-semibold uppercase tracking-[0.22em] text-slate-300/48`}>
                                {getVisualChipLabel(lang, section, 'size')} · {getVisualChipLabel(lang, section, 'placement')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 opacity-70">
                    <div className="h-2.5 rounded-full bg-white/8" />
                    <div className="h-2.5 rounded-full bg-white/10" />
                    <div className="h-2.5 rounded-full bg-white/8" />
                </div>
            </div>
        </div>
    );
};

export function HelpCenterPage({ lang, mainScrollContainerRef }: HelpCenterPageProps) {
    const content = React.useMemo(() => getHelpCenterCopy(lang), [lang]);
    const sections = content.sections;
    const [activeSectionId, setActiveSectionId] = React.useState<HelpSectionId>(sections[0]?.id ?? 'overview');
    const [lightboxSectionId, setLightboxSectionId] = React.useState<HelpSectionId | null>(null);
    const sectionRefs = React.useRef<Partial<Record<HelpSectionId, HTMLElement | null>>>({});
    const requestedSectionIdRef = React.useRef<HelpSectionId | null>(null);
    const requestedScrollTopRef = React.useRef<number | null>(null);
    const requestedScrollReachedRef = React.useRef(false);

    const setSectionRef = React.useCallback(
        (sectionId: HelpSectionId) => (node: HTMLElement | null) => {
            sectionRefs.current[sectionId] = node;
        },
        []
    );

    const jumpToSection = React.useCallback(
        (sectionId: HelpSectionId, options?: { behavior?: ScrollBehavior; updateHash?: boolean }) => {
            const node = sectionRefs.current[sectionId];
            if (!node) return;

            if (options?.updateHash !== false) {
                window.history.replaceState({}, '', `${buildHelpRoute()}#${sectionId}`);
            }

            const container = mainScrollContainerRef.current;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const nodeRect = node.getBoundingClientRect();
                const rawTargetTop = container.scrollTop + (nodeRect.top - containerRect.top) - 120;
                const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
                const targetTop = Math.min(maxScrollTop, Math.max(0, rawTargetTop));
                container.scrollTo({
                    top: targetTop,
                    behavior: options?.behavior ?? 'smooth',
                });
                requestedScrollTopRef.current = targetTop;
                requestedScrollReachedRef.current = false;
            } else {
                node.scrollIntoView({
                    behavior: options?.behavior ?? 'smooth',
                    block: 'start',
                    inline: 'nearest',
                });
                requestedScrollTopRef.current = null;
                requestedScrollReachedRef.current = true;
            }

            requestedSectionIdRef.current = sectionId;
            setActiveSectionId(sectionId);
        },
        [mainScrollContainerRef]
    );

    React.useEffect(() => {
        const targetId = resolveHashSectionId(sections);
        if (!targetId) {
            setActiveSectionId(sections[0]?.id ?? 'overview');
            return;
        }

        const timer = window.setTimeout(() => {
            jumpToSection(targetId, { behavior: 'auto', updateHash: false });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [jumpToSection, sections]);

    React.useEffect(() => {
        const handleHashChange = () => {
            const targetId = resolveHashSectionId(sections);
            if (!targetId) return;
            jumpToSection(targetId, { behavior: 'auto', updateHash: false });
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [jumpToSection, sections]);

    React.useEffect(() => {
        const container = mainScrollContainerRef.current;
        if (!container) return;

        let rafId = 0;

        const updateActiveSection = () => {
            const containerRect = container.getBoundingClientRect();
            const requestedSectionId = requestedSectionIdRef.current;

            if (requestedSectionId) {
                const requestedScrollTop = requestedScrollTopRef.current;
                const targetReached =
                    requestedScrollTop === null || Math.abs(container.scrollTop - requestedScrollTop) <= 6;

                if (!requestedScrollReachedRef.current && !targetReached) {
                    setActiveSectionId((current) => (current === requestedSectionId ? current : requestedSectionId));
                    return;
                }

                requestedScrollReachedRef.current = true;

                const requestedNode = sectionRefs.current[requestedSectionId];
                if (requestedNode) {
                    const requestedRect = requestedNode.getBoundingClientRect();
                    const requestedIsVisible =
                        requestedRect.bottom > containerRect.top + 4 && requestedRect.top < containerRect.bottom - 4;

                    if (requestedIsVisible) {
                        setActiveSectionId((current) => (current === requestedSectionId ? current : requestedSectionId));
                        return;
                    }
                }

                requestedSectionIdRef.current = null;
                requestedScrollTopRef.current = null;
                requestedScrollReachedRef.current = false;
            }

            let nextId = sections[0]?.id ?? 'overview';
            let bestPast = Number.NEGATIVE_INFINITY;
            let bestFuture = Number.POSITIVE_INFINITY;

            sections.forEach((section) => {
                const node = sectionRefs.current[section.id];
                if (!node) return;
                const delta = node.getBoundingClientRect().top - containerRect.top - 148;
                if (delta <= 0 && delta > bestPast) {
                    bestPast = delta;
                    nextId = section.id;
                    return;
                }
                if (bestPast === Number.NEGATIVE_INFINITY && delta < bestFuture) {
                    bestFuture = delta;
                    nextId = section.id;
                }
            });

            setActiveSectionId((current) => (current === nextId ? current : nextId));
        };

        const schedule = () => {
            cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(updateActiveSection);
        };

        schedule();
        container.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(rafId);
            container.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [mainScrollContainerRef, sections]);

    const handleTopJump = React.useCallback(() => {
        const container = mainScrollContainerRef.current;
        window.history.replaceState({}, '', buildHelpRoute());
        requestedSectionIdRef.current = null;
        requestedScrollTopRef.current = null;
        requestedScrollReachedRef.current = false;
        container?.scrollTo({ top: 0, behavior: 'smooth' });
        setActiveSectionId(sections[0]?.id ?? 'overview');
    }, [mainScrollContainerRef, sections]);

    React.useEffect(() => {
        if (!lightboxSectionId) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLightboxSectionId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxSectionId]);

    const lightboxSection = lightboxSectionId ? sections.find((section) => section.id === lightboxSectionId) ?? null : null;

    return (
        <div data-testid="help-page-root" className="space-y-8">
            <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(155deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-5 shadow-[0_24px_80px_-52px_rgba(56,189,248,0.38)] ring-1 ring-white/6 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{content.heroTitle}</h1>
                        <p className="text-sm leading-6 text-slate-200/76">{content.heroSummary}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleTopJump}
                        className="inline-flex shrink-0 items-center gap-2 self-start rounded-[14px] border border-white/10 bg-slate-950/35 px-4 py-2 text-xs font-semibold text-slate-100/85 transition hover:border-sky-300/30 hover:bg-slate-950/55 hover:text-white"
                    >
                        <ArrowUpRight size={14} />
                        <span>{buildHelpRoute()}</span>
                    </button>
                </div>
            </section>

            <div className="space-y-3 lg:hidden">
                <div className="px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/62">{content.tocLabel}</p>
                </div>
                <nav
                    data-testid="help-page-nav-mobile"
                    aria-label={content.tocLabel}
                    className="flex gap-1.5 overflow-x-auto pb-1"
                >
                    {sections.map((section, index) => {
                        const isActive = section.id === activeSectionId;
                        const startsGroup = index > 0 && sections[index - 1]?.groupId !== section.groupId;
                        return (
                            <React.Fragment key={section.id}>
                                {startsGroup ? (
                                    <div
                                        className="mx-1 h-6 w-px self-center bg-gradient-to-b from-transparent via-sky-300/30 to-transparent"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <button
                                    type="button"
                                    aria-current={isActive ? 'true' : undefined}
                                    onClick={() => jumpToSection(section.id)}
                                    className={`shrink-0 rounded-[14px] border px-3 py-1.5 text-[11px] font-semibold transition ${
                                        isActive
                                            ? 'border-sky-300/40 bg-sky-400/16 text-sky-50 shadow-[0_18px_42px_-34px_rgba(56,189,248,0.72)]'
                                            : 'border-white/10 bg-slate-900/45 text-slate-100/78 hover:border-sky-300/25 hover:bg-slate-900/65'
                                    }`}
                                >
                                    {section.tocLabel}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </nav>
            </div>

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
                <aside className="hidden lg:block">
                    <div className="sticky top-5 space-y-3 rounded-[18px] border border-white/8 bg-slate-900/45 p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.92)] ring-1 ring-white/6">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/62">{content.tocLabel}</p>
                        </div>
                        <nav
                            data-testid="help-page-nav"
                            aria-label={content.tocLabel}
                            className="max-h-[calc(100vh-11.5rem)] space-y-1.5 overflow-y-auto pr-1"
                            style={{
                                maxHeight: 'calc(100vh - 11.5rem)',
                                overflowY: 'auto',
                            }}
                        >
                            {sections.map((section, index) => {
                                const isActive = section.id === activeSectionId;
                                const startsGroup = index > 0 && sections[index - 1]?.groupId !== section.groupId;
                                return (
                                    <React.Fragment key={section.id}>
                                        {startsGroup ? (
                                            <div
                                                className="my-2 h-px bg-gradient-to-r from-transparent via-sky-300/28 to-transparent"
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        <button
                                            type="button"
                                            aria-current={isActive ? 'true' : undefined}
                                            onClick={() => jumpToSection(section.id)}
                                            className={`block w-full rounded-[14px] border px-3 py-2 text-left text-[13px] leading-5 transition ${
                                                isActive
                                                    ? 'border-sky-300/35 bg-sky-400/14 text-sky-50 shadow-[0_18px_42px_-36px_rgba(56,189,248,0.78)]'
                                                    : 'border-white/8 bg-slate-950/30 text-slate-100/76 hover:border-sky-300/20 hover:bg-slate-950/55'
                                            }`}
                                        >
                                            {section.tocLabel}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                <div className="space-y-6">
                    {sections.map((section, index) => {
                        const isActive = section.id === activeSectionId;
                        const startsGroup = index === 0 || sections[index - 1]?.groupId !== section.groupId;
                        const group = content.groups[section.groupId];
                        const hasVisualSlot = Boolean(section.visual);
                        const visualAsset = section.visual?.asset;
                        const hasVisualAsset = Boolean(visualAsset?.src);
                        return (
                            <React.Fragment key={section.id}>
                                {startsGroup ? (
                                    <div
                                        data-testid={`help-group-${group.id}`}
                                        className="space-y-2 px-1 pt-2"
                                    >
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-lg font-semibold tracking-tight text-white">{group.title}</h2>
                                            <div className="h-px flex-1 bg-gradient-to-r from-sky-300/25 to-transparent" aria-hidden="true" />
                                        </div>
                                        <p className="max-w-3xl text-sm leading-6 text-slate-300/68">{group.summary}</p>
                                    </div>
                                ) : null}

                                <section
                                    id={section.id}
                                    ref={setSectionRef(section.id)}
                                    data-testid={`help-section-${section.id}`}
                                    className={`rounded-[20px] border px-5 py-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.95)] transition sm:px-6 ${getSectionCardClasses(
                                        section,
                                        isActive
                                    )}`}
                                    style={{ scrollMarginTop: 120 }}
                                >
                                    <div className={getSectionContentClasses(section, hasVisualSlot)}>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/70">{section.eyebrow}</p>
                                                <h2 className="text-[22px] font-semibold tracking-tight text-white">{section.title}</h2>
                                            </div>

                                            <p className="text-sm leading-6 text-slate-200/78">{section.summary}</p>

                                            {section.points.length > 0 ? (
                                                <div className="space-y-2.5">
                                                    {section.points.map((point) => (
                                                        <div
                                                            key={point}
                                                        className="flex items-start gap-3 rounded-[14px] border border-white/6 bg-slate-950/22 px-3.5 py-3 text-sm leading-6 text-slate-100/82"
                                                        >
                                                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sky-300/90" />
                                                            <p>{point}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {section.callout ? (
                                                <div className="rounded-[16px] border border-sky-300/14 bg-sky-400/8 px-4 py-3.5">
                                                    <div className="flex items-start gap-3">
                                                        <Target size={16} className="mt-0.5 shrink-0 text-sky-200/90" />
                                                        <p className="text-sm leading-6 text-slate-100/74">{section.callout}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {hasVisualAsset ? (
                                            <button
                                                type="button"
                                                data-testid={`help-visual-${section.id}`}
                                                data-visual-medium={section.visual?.medium}
                                                data-visual-size={section.visual?.size}
                                                data-visual-placement={section.visual?.placement}
                                                aria-label={getOpenVisualLabel(lang)}
                                                onClick={() => setLightboxSectionId(section.id)}
                                                className={`group overflow-hidden rounded-[16px] border border-white/10 bg-slate-950/40 text-left transition hover:border-sky-300/28 ${
                                                    section.visual?.placement === 'wide' ? 'mt-1' : 'lg:self-start'
                                                }`}
                                            >
                                                <img
                                                    src={visualAsset?.src}
                                                    alt={visualAsset?.alt}
                                                    className="block h-auto w-full object-cover transition duration-200 group-hover:scale-[1.01]"
                                                    loading="lazy"
                                                />
                                            </button>
                                        ) : hasVisualSlot ? (
                                            <button
                                                type="button"
                                                aria-label={getOpenVisualLabel(lang)}
                                                onClick={() => setLightboxSectionId(section.id)}
                                                className="block w-full text-left"
                                            >
                                                <VisualPlaceholder lang={lang} section={section} />
                                            </button>
                                        ) : null}
                                    </div>
                                </section>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {lightboxSection ? (
                <div
                    data-testid="help-visual-lightbox"
                    className="fixed inset-0 z-[80] bg-slate-950/86 backdrop-blur-sm"
                    onClick={() => setLightboxSectionId(null)}
                >
                    <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                        <div
                            className="w-full max-w-6xl rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,0.98)_100%)] p-4 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.92)] sm:p-5"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/64">{lightboxSection.eyebrow}</p>
                                    <h3 data-testid="help-visual-lightbox-title" className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                                        {lightboxSection.title}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    data-testid="help-visual-lightbox-close"
                                    onClick={() => setLightboxSectionId(null)}
                                    className="inline-flex shrink-0 items-center rounded-[14px] border border-white/10 bg-slate-950/34 px-3 py-1.5 text-xs font-semibold text-slate-100/80 transition hover:border-sky-300/25 hover:bg-slate-950/50 hover:text-white"
                                >
                                    {getCloseVisualLabel(lang)}
                                </button>
                            </div>

                            {lightboxSection.visual?.asset?.src ? (
                                <div className="overflow-hidden rounded-[16px] border border-white/10 bg-slate-950/40">
                                    <img
                                        src={lightboxSection.visual.asset.src}
                                        alt={lightboxSection.visual.asset.alt}
                                        className="block max-h-[78vh] w-full object-contain"
                                    />
                                </div>
                            ) : (
                                <VisualPlaceholder lang={lang} section={lightboxSection} expanded />
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
