import React from 'react';
import type { RefObject } from 'react';
import { ArrowUpRight, CheckCircle2, Image, Layers3, Target } from 'lucide-react';
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

export function HelpCenterPage({ lang, mainScrollContainerRef }: HelpCenterPageProps) {
    const content = React.useMemo(() => getHelpCenterCopy(lang), [lang]);
    const sections = content.sections;
    const [activeSectionId, setActiveSectionId] = React.useState<HelpSectionId>(sections[0]?.id ?? 'overview');
    const sectionRefs = React.useRef<Partial<Record<HelpSectionId, HTMLElement | null>>>({});

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
            node.scrollIntoView({
                behavior: options?.behavior ?? 'smooth',
                block: 'start',
                inline: 'nearest',
            });
            setActiveSectionId(sectionId);
        },
        []
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
        container?.scrollTo({ top: 0, behavior: 'smooth' });
        setActiveSectionId(sections[0]?.id ?? 'overview');
    }, [mainScrollContainerRef, sections]);

    return (
        <div data-testid="help-page-root" className="space-y-8">
            <section className="overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(155deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-5 shadow-[0_24px_80px_-52px_rgba(56,189,248,0.38)] ring-1 ring-white/6 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{content.heroTitle}</h1>
                        <p className="max-w-2xl text-sm leading-6 text-slate-200/76">{content.heroSummary}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleTopJump}
                        className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 text-xs font-semibold text-slate-100/85 transition hover:border-sky-300/30 hover:bg-slate-950/55 hover:text-white"
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
                    {sections.map((section) => {
                        const isActive = section.id === activeSectionId;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                aria-current={isActive ? 'true' : undefined}
                                onClick={() => jumpToSection(section.id)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                                    isActive
                                        ? 'border-sky-300/40 bg-sky-400/16 text-sky-50 shadow-[0_18px_42px_-34px_rgba(56,189,248,0.72)]'
                                        : 'border-white/10 bg-slate-900/45 text-slate-100/78 hover:border-sky-300/25 hover:bg-slate-900/65'
                                }`}
                            >
                                {section.tocLabel}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
                <aside className="hidden lg:block">
                    <div className="sticky top-5 space-y-3 rounded-[24px] border border-white/8 bg-slate-900/45 p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.92)] ring-1 ring-white/6">
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
                            {sections.map((section) => {
                                const isActive = section.id === activeSectionId;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        aria-current={isActive ? 'true' : undefined}
                                        onClick={() => jumpToSection(section.id)}
                                        className={`block w-full rounded-[18px] border px-3 py-2 text-left text-[13px] leading-5 transition ${
                                            isActive
                                                ? 'border-sky-300/35 bg-sky-400/14 text-sky-50 shadow-[0_18px_42px_-36px_rgba(56,189,248,0.78)]'
                                                : 'border-white/8 bg-slate-950/30 text-slate-100/76 hover:border-sky-300/20 hover:bg-slate-950/55'
                                        }`}
                                    >
                                        {section.tocLabel}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                <div className="space-y-6">
                    {sections.map((section) => {
                        const isActive = section.id === activeSectionId;
                        return (
                            <section
                                key={section.id}
                                id={section.id}
                                ref={setSectionRef(section.id)}
                                data-testid={`help-section-${section.id}`}
                                className={`rounded-[26px] border px-5 py-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.95)] transition sm:px-6 ${
                                    isActive
                                        ? 'border-sky-300/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_32%),linear-gradient(160deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_100%)]'
                                        : 'border-white/8 bg-slate-900/45'
                                }`}
                                style={{ scrollMarginTop: 120 }}
                            >
                                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/70">{section.eyebrow}</p>
                                            <h2 className="text-[22px] font-semibold tracking-tight text-white">{section.title}</h2>
                                        </div>

                                        <p className="text-sm leading-6 text-slate-200/78">{section.summary}</p>

                                        <div className="space-y-2.5">
                                            {section.points.map((point) => (
                                                <div
                                                    key={point}
                                                    className="flex items-start gap-3 rounded-[18px] border border-white/6 bg-slate-950/22 px-3.5 py-3 text-sm leading-6 text-slate-100/82"
                                                >
                                                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sky-300/90" />
                                                    <p>{point}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {section.callout ? (
                                            <div className="rounded-[20px] border border-sky-300/14 bg-sky-400/8 px-4 py-3.5">
                                                <div className="flex items-start gap-3">
                                                    <Target size={16} className="mt-0.5 shrink-0 text-sky-200/90" />
                                                    <p className="text-sm leading-6 text-slate-100/74">{section.callout}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <aside className="rounded-[22px] border border-dashed border-sky-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.34)_0%,rgba(15,23,42,0.72)_100%)] p-4 text-center">
                                        <div className="flex h-full flex-col justify-between gap-6">
                                            <div className="inline-flex items-center gap-2 self-center rounded-full border border-white/10 bg-slate-950/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-100/72">
                                                <Image size={13} />
                                                <span>{content.mediaPlaceholderLabel}</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-slate-950/28 text-sky-100/82">
                                                    <Layers3 size={28} />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-base font-semibold text-white">{section.mediaLabel}</p>
                                                    <p className="text-sm leading-6 text-slate-100/68">{section.mediaHint}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </aside>
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
