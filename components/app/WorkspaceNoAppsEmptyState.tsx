import React from 'react';
import { Plus } from 'lucide-react';
import type { TranslationKey } from '../../i18n';

type WorkspaceNoAppsEmptyStateProps = {
    canAddApp: boolean;
    isReadOnly: boolean;
    onOpenCreateApp: () => void;
    onReadOnlyBlocked: () => void;
    text: (key: TranslationKey) => string;
};

export function WorkspaceNoAppsEmptyState({
    canAddApp,
    isReadOnly,
    onOpenCreateApp,
    onReadOnlyBlocked,
    text,
}: WorkspaceNoAppsEmptyStateProps) {
    return (
        <div className="rounded-[32px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] p-10 text-center">
            <p className="text-lg font-semibold text-white">{text('no_apps_yet')}</p>
            <p className="mt-2 text-sm text-indigo-200/70">{text('ready_for_screenshots_icons')}</p>
            <button
                type="button"
                onClick={() => {
                    if (isReadOnly) {
                        onReadOnlyBlocked();
                        return;
                    }
                    onOpenCreateApp();
                }}
                disabled={!canAddApp || isReadOnly}
                className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold border ${
                    canAddApp && !isReadOnly
                        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                        : 'border-white/10 text-indigo-200/40 cursor-not-allowed'
                }`}
            >
                <Plus size={16} />
                {text('add_app')}
            </button>
        </div>
    );
}
