import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { TranslationKey } from '../../i18n';

export function IdeasPage(props: { text: (key: TranslationKey) => string }) {
    const { text } = props;

    return (
        <section className="rounded-[32px] bg-slate-900 ring-1 ring-white/5 p-10 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-indigo-400/25 bg-indigo-500/10 text-indigo-100/80">
                <Lightbulb size={18} />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{text('ideas')}</h2>
            <p className="mt-2 text-sm text-indigo-200/60">{text('coming_soon')}</p>
        </section>
    );
}

