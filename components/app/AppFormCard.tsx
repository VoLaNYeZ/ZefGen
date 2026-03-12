import React from 'react';
import type { AppFormState } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';

type AppFormCardProps = {
    appFormOpen: boolean;
    appForm: AppFormState;
    setAppForm: React.Dispatch<React.SetStateAction<AppFormState>>;
    appFormError: string | null;
    appFormLoading: boolean;
    editingAppId: string | null;
    isEditingBanned: boolean;
    selectedBrandSlug?: string;
    selectedBrandName?: string;
    appAliasPreview: string;
    aliasPlaceholder: string;
    onSubmit: (event: React.FormEvent) => void;
    onCancel: () => void;
    onDelete: () => void;
    onBan: (appId: string) => void;
    onUnban: (appId: string) => void;
    text: (key: TranslationKey) => string;
};

export const AppFormCard = ({
    appFormOpen,
    appForm,
    setAppForm,
    appFormError,
    appFormLoading,
    editingAppId,
    isEditingBanned,
    selectedBrandSlug,
    selectedBrandName,
    appAliasPreview,
    aliasPlaceholder,
    onSubmit,
    onCancel,
    onDelete,
    onBan,
    onUnban,
    text,
}: AppFormCardProps) => {
    if (!appFormOpen) return null;

    const appNamePlaceholder = React.useMemo(() => {
        const raw = String(selectedBrandName || '').trim();
        if (!raw) return 'APP...';
        const words = raw.split(/\s+/).filter(Boolean).slice(0, 4);
        const parts = words
            .map((w) => String(w[0] || '').toUpperCase())
            .filter(Boolean)
            .map((ch) => `${ch}...`);
        return parts.length ? parts.join(' ') : 'APP...';
    }, [selectedBrandName]);

    return (
        <form
            onSubmit={onSubmit}
            className="mt-4 rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3 animate-shelf"
        >
            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                {editingAppId ? text('update_app') : text('create_app')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="app-form-name" className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('app_name')}</label>
                    <input
                        id="app-form-name"
                        value={appForm.name}
                        onChange={(event) => setAppForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:italic placeholder:text-indigo-200/35 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        placeholder={appNamePlaceholder}
                    />
                </div>
                <div>
                    <label htmlFor="app-form-alias" className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('alias')}</label>
                    <input
                        id="app-form-alias"
                        value={appForm.alias}
                        onChange={(event) => setAppForm((prev) => ({ ...prev, alias: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:italic placeholder:text-indigo-200/35 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        placeholder={aliasPlaceholder || 'EF-...'}
                    />
                </div>
            </div>
            <div className="text-xs text-indigo-200/70">
                {text('url_preview')}: /{selectedBrandSlug ?? 'brand'}/{appAliasPreview || 'app'}
            </div>
            {appFormError && (
                <p className="text-xs text-rose-300">{appFormError}</p>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={appFormLoading}
                    className="flex-1 rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30"
                >
                    {appFormLoading ? text('saving') : editingAppId ? text('update_app') : text('create_app')}
                </button>
                {editingAppId && (
                    <button
                        type="button"
                        onClick={() => {
                            if (isEditingBanned) {
                                onUnban(editingAppId);
                            } else {
                                onBan(editingAppId);
                            }
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                            isEditingBanned
                                ? 'border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/20'
                                : 'border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
                        }`}
                    >
                        {isEditingBanned ? text('unban_app') : text('ban_app')}
                    </button>
                )}
                {editingAppId && (
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={appFormLoading}
                        className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
                    >
                        {text('delete_app')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                >
                    {text('cancel')}
                </button>
            </div>
        </form>
    );
};
