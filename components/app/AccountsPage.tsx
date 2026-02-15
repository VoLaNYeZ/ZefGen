import React from 'react';
import { Check, Copy, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem, AppstoreAccount, Brand } from '../../types/zefgen';
import { ConfirmIconButton } from './ConfirmIconButton';

type Draft = Partial<
    Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at' | 'updated_at'> & { target_app_id?: string }
>;

const copyToClipboard = async (value: string) => {
    const text = String(value ?? '');
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        return;
    } catch {
        // Fallback for non-secure contexts.
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    try {
        document.execCommand('copy');
    } finally {
        document.body.removeChild(el);
    }
};

const normalize = (value: unknown) => String(value ?? '').trim();

const rowClass = (flash: boolean) =>
    `transition-colors ${flash ? 'bg-indigo-500/10' : 'bg-transparent'} hover:bg-slate-950/25`;

export function AccountsPage(props: {
    accounts: AppstoreAccount[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    createAccount: (args: {
        appId: string;
        row: Partial<Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at' | 'updated_at'>>;
    }) => Promise<any>;
    updateAccount: (args: { appId: string; patch: Partial<Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at'>> }) => Promise<any>;
    deleteAccount: (args: { appId: string }) => Promise<void>;
    apps: AppItem[];
    brands: Brand[];
    focusAppId: string | null;
    consumeFocus: () => void;
    reportError?: (message: string) => void;
    text: (key: TranslationKey) => string;
}) {
    const {
        accounts,
        loading,
        error,
        refresh,
        createAccount,
        updateAccount,
        deleteAccount,
        apps,
        brands,
        focusAppId,
        consumeFocus,
        reportError,
        text,
    } = props;

    const [search, setSearch] = React.useState('');
    const inputBase =
        'h-9 w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60';
    const inputMono = `${inputBase} font-mono text-[11px]`;
    const selectBase =
        'h-9 w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none focus:border-indigo-400/40 disabled:opacity-60';

    const [draftByAppId, setDraftByAppId] = React.useState<Record<string, Draft>>({});
    const [rowBusyByAppId, setRowBusyByAppId] = React.useState<Record<string, boolean>>({});
    const [rowErrorByAppId, setRowErrorByAppId] = React.useState<Record<string, string | null>>({});
    const [rowSavedByAppId, setRowSavedByAppId] = React.useState<Record<string, boolean>>({});

    const [newDraft, setNewDraft] = React.useState<{
        app_id: string;
        usability: boolean;
        email: string;
        password: string;
        email_password: string;
        number: string;
        geo: string;
        company_name: string;
        proxy: string;
    } | null>(null);
    const [newBusy, setNewBusy] = React.useState(false);
    const [newError, setNewError] = React.useState<string | null>(null);
    const [newRowScrollNonce, setNewRowScrollNonce] = React.useState(0);

    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
    const copiedTimerRef = React.useRef<number | null>(null);

    const [flashAppId, setFlashAppId] = React.useState<string | null>(null);
    const flashTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
            if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        };
    }, []);

    const usedAppIdSet = React.useMemo(() => new Set(accounts.map((a) => a.app_id)), [accounts]);
    const appById = React.useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
    const brandById = React.useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

    const availableAppsForNew = React.useMemo(() => {
        const list = apps.filter((a) => !usedAppIdSet.has(a.id));
        return list.sort((a, b) => String(a.alias || '').localeCompare(String(b.alias || '')));
    }, [apps, usedAppIdSet]);

    const formatAppLabel = React.useCallback(
        (app: AppItem | undefined) => {
            if (!app) return '—';
            const brand = brandById.get(app.brand_id);
            const brandPart = brand ? ` · ${brand.name}` : '';
            return `${app.alias} · ${app.name}${brandPart}`;
        },
        [brandById]
    );

    const markSaved = React.useCallback((appId: string) => {
        setRowSavedByAppId((prev) => ({ ...prev, [appId]: true }));
        window.setTimeout(() => {
            setRowSavedByAppId((prev) => {
                const next = { ...prev };
                delete next[appId];
                return next;
            });
        }, 1200);
    }, []);

    const copyWithToast = React.useCallback(
        async (k: string, value: string) => {
            try {
                await copyToClipboard(value);
                setCopiedKey(k);
                if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1200);
            } catch (e: any) {
                reportError?.(String(e?.message || e || text('download_failed')));
            }
        },
        [reportError, text]
    );

    const setDraftField = React.useCallback((appId: string, patch: Partial<Draft>) => {
        setDraftByAppId((prev) => ({ ...prev, [appId]: { ...(prev[appId] || {}), ...patch } }));
    }, []);

    const clearDraft = React.useCallback((appId: string) => {
        setDraftByAppId((prev) => {
            const next = { ...prev };
            delete next[appId];
            return next;
        });
        setRowErrorByAppId((prev) => {
            const next = { ...prev };
            delete next[appId];
            return next;
        });
    }, []);

    const isDirty = React.useCallback((account: AppstoreAccount, draft: Draft) => {
        const target = String(draft.target_app_id || account.app_id);
        if (target && target !== account.app_id) return true;
        const keys: Array<keyof Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at' | 'updated_at'>> = [
            'usability',
            'email',
            'password',
            'email_password',
            'number',
            'geo',
            'company_name',
            'proxy',
        ];
        return keys.some((k) => {
            if (!(k in draft)) return false;
            const a = k === 'usability' ? Boolean((account as any)[k]) : normalize((account as any)[k]);
            const b = k === 'usability' ? Boolean((draft as any)[k]) : normalize((draft as any)[k]);
            return a !== b;
        });
    }, []);

    const onSaveRow = React.useCallback(
        async (account: AppstoreAccount) => {
            const draft = draftByAppId[account.app_id] || {};
            if (!isDirty(account, draft)) return;
            const targetAppId = String(draft.target_app_id || account.app_id);
            if (!targetAppId) return;

            setRowBusyByAppId((prev) => ({ ...prev, [account.app_id]: true }));
            setRowErrorByAppId((prev) => ({ ...prev, [account.app_id]: null }));
            try {
                const merged = {
                    usability: draft.usability ?? account.usability,
                    email: normalize(draft.email ?? account.email),
                    password: normalize(draft.password ?? account.password),
                    email_password: normalize(draft.email_password ?? account.email_password),
                    number: normalize(draft.number ?? account.number),
                    geo: normalize(draft.geo ?? account.geo),
                    company_name: normalize(draft.company_name ?? account.company_name),
                    proxy: normalize(draft.proxy ?? account.proxy),
                };

                if (targetAppId === account.app_id) {
                    await updateAccount({ appId: account.app_id, patch: merged });
                    clearDraft(account.app_id);
                    markSaved(account.app_id);
                    return;
                }

                // Move: create new row then delete old.
                await createAccount({ appId: targetAppId, row: merged });
                await deleteAccount({ appId: account.app_id });
                clearDraft(account.app_id);
                markSaved(targetAppId);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorByAppId((prev) => ({ ...prev, [account.app_id]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyByAppId((prev) => ({ ...prev, [account.app_id]: false }));
            }
        },
        [draftByAppId, isDirty, updateAccount, createAccount, deleteAccount, clearDraft, markSaved, reportError]
    );

    const onRemoveRow = React.useCallback(
        async (appId: string) => {
            setRowBusyByAppId((prev) => ({ ...prev, [appId]: true }));
            setRowErrorByAppId((prev) => ({ ...prev, [appId]: null }));
            try {
                await deleteAccount({ appId });
                clearDraft(appId);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorByAppId((prev) => ({ ...prev, [appId]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyByAppId((prev) => ({ ...prev, [appId]: false }));
            }
        },
        [deleteAccount, clearDraft, reportError]
    );

    const openNewRow = React.useCallback(
        (prefillAppId?: string) => {
            const first = prefillAppId && !usedAppIdSet.has(prefillAppId) ? prefillAppId : availableAppsForNew[0]?.id;
            if (!first) return;
            setNewError(null);
            setNewDraft((prev) => {
                if (prev) return prev;
                return {
                    app_id: first,
                    usability: true,
                    email: '',
                    password: '',
                    email_password: '',
                    number: '',
                    geo: '',
                    company_name: '',
                    proxy: '',
                };
            });
            setNewRowScrollNonce((v) => v + 1);
        },
        [availableAppsForNew, usedAppIdSet]
    );

    React.useEffect(() => {
        if (!newDraft) return;
        if (!newRowScrollNonce) return;
        // Ensure the element is in the DOM before scrolling (React commit can land after timers).
        const raf1 = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const el = document.getElementById('account-row-new');
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        });
        return () => window.cancelAnimationFrame(raf1);
    }, [newDraft, newRowScrollNonce]);

    const onSaveNew = React.useCallback(async () => {
        if (!newDraft) return;
        const appId = String(newDraft.app_id || '').trim();
        if (!appId) return;
        if (usedAppIdSet.has(appId)) {
            setNewError(text('accounts_app_already_has_account'));
            return;
        }
        setNewBusy(true);
        setNewError(null);
        try {
            await createAccount({
                appId,
                row: {
                    usability: Boolean(newDraft.usability),
                    email: normalize(newDraft.email),
                    password: normalize(newDraft.password),
                    email_password: normalize(newDraft.email_password),
                    number: normalize(newDraft.number),
                    geo: normalize(newDraft.geo),
                    company_name: normalize(newDraft.company_name),
                    proxy: normalize(newDraft.proxy),
                },
            });
            setNewDraft(null);
            markSaved(appId);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setNewError(msg);
            reportError?.(msg);
        } finally {
            setNewBusy(false);
        }
    }, [newDraft, usedAppIdSet, createAccount, markSaved, reportError, text]);

    React.useEffect(() => {
        if (!focusAppId) return;
        if (usedAppIdSet.has(focusAppId)) {
            window.setTimeout(() => {
                const el = document.getElementById(`account-row-${focusAppId}`);
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                setFlashAppId(focusAppId);
                if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
                flashTimerRef.current = window.setTimeout(() => setFlashAppId(null), 1600);
            }, 0);
            consumeFocus();
            return;
        }

        // No account yet for this app: open a prefilled new row.
        openNewRow(focusAppId);
        consumeFocus();
    }, [focusAppId, usedAppIdSet, consumeFocus, openNewRow]);

    const visibleAccounts = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = [...accounts];
        list.sort((a, b) => {
            const aa = appById.get(a.app_id);
            const bb = appById.get(b.app_id);
            return String(aa?.alias || '').localeCompare(String(bb?.alias || ''));
        });
        if (!q) return list;
        return list.filter((a) => {
            const app = appById.get(a.app_id);
            const brand = app ? brandById.get(app.brand_id) : null;
            const hay = [
                app?.alias,
                app?.name,
                brand?.name,
                a.email,
                a.company_name,
                a.geo,
                a.number,
                a.proxy,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [accounts, search, appById, brandById]);

    const newDisabled = availableAppsForNew.length === 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold text-white">{text('accounts')}</h2>
                    <p className="mt-2 text-sm text-indigo-200/60">{text('accounts_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                        {text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (newDisabled) {
                                reportError?.(text('accounts_all_apps_have_accounts'));
                                return;
                            }
                            openNewRow();
                        }}
                        aria-disabled={newDisabled}
                        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold text-indigo-100 ${
                            newDisabled
                                ? 'cursor-not-allowed border-white/10 bg-slate-950/20 opacity-60'
                                : 'border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/20'
                        }`}
                        title={newDisabled ? text('accounts_all_apps_have_accounts') : undefined}
                    >
                        <Plus size={14} />
                        {text('accounts_new_account')}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {error}
                </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="relative w-full sm:w-[420px]">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-200/45" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`${inputBase} pl-10`}
                            placeholder={text('accounts_search_placeholder')}
                        />
                    </div>
                    <div className="text-[11px] text-indigo-200/45">
                        {text('accounts_rows')}: <span className="font-semibold text-indigo-100/80">{visibleAccounts.length}</span>
                    </div>
                </div>

                <div className="overflow-x-auto border-t border-white/10">
                    <table className="min-w-[1080px] w-full text-left text-[11px]">
                        <thead className="sticky top-0 border-b border-white/10 bg-slate-950/70 backdrop-blur">
                            <tr className="text-indigo-200/70">
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_usability')}</th>
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_app_alias')}</th>
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_email')}</th>
                                <th className="px-4 py-2.5 font-semibold min-w-[220px]">{text('accounts_password')}</th>
                                <th className="px-4 py-2.5 font-semibold min-w-[220px]">{text('accounts_email_password')}</th>
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_number')}</th>
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_geo')}</th>
                                <th className="px-4 py-2.5 font-semibold">{text('accounts_company_name')}</th>
                                <th className="px-4 py-2.5 font-semibold min-w-[220px]">{text('accounts_proxy')}</th>
                                <th className="px-4 py-2.5 font-semibold min-w-[140px]">{text('accounts_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {newDraft ? (
                                <tr id="account-row-new" className="bg-indigo-500/10">
                                    <td className="px-4 py-3 align-top">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(newDraft.usability)}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, usability: e.target.checked } : prev))}
                                            className="h-4 w-4 accent-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <select
                                            value={newDraft.app_id}
                                            onChange={(e) =>
                                                setNewDraft((prev) => (prev ? { ...prev, app_id: e.target.value } : prev))
                                            }
                                            className={selectBase}
                                        >
                                            {availableAppsForNew.map((app) => (
                                                <option key={app.id} value={app.id}>
                                                    {formatAppLabel(app)}
                                                </option>
                                            ))}
                                        </select>
                                        {newError ? <div className="mt-2 text-[11px] text-rose-200/90">{newError}</div> : null}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <input
                                            value={newDraft.email}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                                            className={inputBase}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="relative">
                                            <input
                                                value={newDraft.password}
                                                onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, password: e.target.value } : prev))}
                                                className={`${inputMono} pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => copyWithToast('new.password', newDraft.password)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                                title={text('copy')}
                                            >
                                                {copiedKey === 'new.password' ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="relative">
                                            <input
                                                value={newDraft.email_password}
                                                onChange={(e) =>
                                                    setNewDraft((prev) => (prev ? { ...prev, email_password: e.target.value } : prev))
                                                }
                                                className={`${inputMono} pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => copyWithToast('new.email_password', newDraft.email_password)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                                title={text('copy')}
                                            >
                                                {copiedKey === 'new.email_password' ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <input
                                            value={newDraft.number}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, number: e.target.value } : prev))}
                                            className={inputBase}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <input
                                            value={newDraft.geo}
                                            onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, geo: e.target.value } : prev))}
                                            className={inputBase}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <input
                                            value={newDraft.company_name}
                                            onChange={(e) =>
                                                setNewDraft((prev) => (prev ? { ...prev, company_name: e.target.value } : prev))
                                            }
                                            className={inputBase}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="relative">
                                            <input
                                                value={newDraft.proxy}
                                                onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, proxy: e.target.value } : prev))}
                                                className={`${inputMono} pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => copyWithToast('new.proxy', newDraft.proxy)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                                title={text('copy')}
                                            >
                                                {copiedKey === 'new.proxy' ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top min-w-[140px]">
                                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={onSaveNew}
                                                disabled={newBusy}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60"
                                                title={text('save')}
                                            >
                                                {newBusy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewDraft(null)}
                                                disabled={newBusy}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/70 hover:border-indigo-400/35 hover:text-white disabled:opacity-60"
                                                title={text('cancel')}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : null}

                            {visibleAccounts.map((a) => {
                                const draft = draftByAppId[a.app_id] || {};
                                const targetAppId = String(draft.target_app_id || a.app_id);
                                const app = appById.get(targetAppId);
                                const dirty = isDirty(a, draft);
                                const busy = Boolean(rowBusyByAppId[a.app_id]);
                                const saved = Boolean(rowSavedByAppId[a.app_id]);
                                const flash = flashAppId === a.app_id;
                                const rowError = rowErrorByAppId[a.app_id];

                                const field = (k: keyof Omit<AppstoreAccount, 'app_id' | 'user_id' | 'created_at' | 'updated_at'>) =>
                                    k in draft ? (draft as any)[k] : (a as any)[k];

                                return (
                                    <tr key={a.app_id} id={`account-row-${a.app_id}`} className={rowClass(flash)}>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(field('usability'))}
                                                onChange={(e) => setDraftField(a.app_id, { usability: e.target.checked })}
                                                disabled={busy}
                                                className="h-4 w-4 accent-indigo-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <select
                                                value={targetAppId}
                                                onChange={(e) => setDraftField(a.app_id, { target_app_id: e.target.value })}
                                                disabled={busy}
                                                className={selectBase}
                                            >
                                                {apps
                                                    .slice()
                                                    .sort((x, y) => String(x.alias || '').localeCompare(String(y.alias || '')))
                                                    .map((appOpt) => {
                                                        const disabled = usedAppIdSet.has(appOpt.id) && appOpt.id !== a.app_id;
                                                        return (
                                                            <option key={appOpt.id} value={appOpt.id} disabled={disabled}>
                                                                {formatAppLabel(appOpt)}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                            {rowError ? <div className="mt-2 text-[11px] text-rose-200/90">{rowError}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                value={String(field('email') ?? '')}
                                                onChange={(e) => setDraftField(a.app_id, { email: e.target.value })}
                                                disabled={busy}
                                                className={inputBase}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="relative">
                                                <input
                                                    value={String(field('password') ?? '')}
                                                    onChange={(e) => setDraftField(a.app_id, { password: e.target.value })}
                                                    disabled={busy}
                                                    className={`${inputMono} pr-10`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => copyWithToast(`${a.app_id}.password`, String(field('password') ?? ''))}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                                    disabled={busy}
                                                    title={text('copy')}
                                                >
                                                    {copiedKey === `${a.app_id}.password` ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="relative">
                                                <input
                                                    value={String(field('email_password') ?? '')}
                                                    onChange={(e) => setDraftField(a.app_id, { email_password: e.target.value })}
                                                    disabled={busy}
                                                    className={`${inputMono} pr-10`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        copyWithToast(`${a.app_id}.email_password`, String(field('email_password') ?? ''))
                                                    }
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                                    disabled={busy}
                                                    title={text('copy')}
                                                >
                                                    {copiedKey === `${a.app_id}.email_password` ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                value={String(field('number') ?? '')}
                                                onChange={(e) => setDraftField(a.app_id, { number: e.target.value })}
                                                disabled={busy}
                                                className={inputBase}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                value={String(field('geo') ?? '')}
                                                onChange={(e) => setDraftField(a.app_id, { geo: e.target.value })}
                                                disabled={busy}
                                                className={inputBase}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                value={String(field('company_name') ?? '')}
                                                onChange={(e) => setDraftField(a.app_id, { company_name: e.target.value })}
                                                disabled={busy}
                                                className={inputBase}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="relative">
                                                <input
                                                    value={String(field('proxy') ?? '')}
                                                    onChange={(e) => setDraftField(a.app_id, { proxy: e.target.value })}
                                                    disabled={busy}
                                                    className={`${inputMono} pr-10`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => copyWithToast(`${a.app_id}.proxy`, String(field('proxy') ?? ''))}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-60 hover:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                                    disabled={busy}
                                                    title={text('copy')}
                                                >
                                                    {copiedKey === `${a.app_id}.proxy` ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top min-w-[140px]">
                                            <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveRow(a)}
                                                    disabled={!dirty || busy}
                                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-60 ${
                                                        dirty
                                                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15'
                                                            : 'border-white/10 bg-slate-950/20 text-indigo-200/50'
                                                    }`}
                                                    title={text('save')}
                                                >
                                                    {busy ? (
                                                        <Loader2 className="animate-spin" size={14} />
                                                    ) : saved ? (
                                                        <Check size={14} />
                                                    ) : (
                                                        <Save size={14} />
                                                    )}
                                                </button>

                                                <ConfirmIconButton
                                                    label={text('delete')}
                                                    question={text('accounts_confirm_delete')}
                                                    confirmLabel={text('delete')}
                                                    cancelLabel={text('cancel')}
                                                    disabled={busy}
                                                    onConfirm={() => onRemoveRow(a.app_id)}
                                                >
                                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/70 hover:border-rose-400/40 hover:text-white">
                                                        <Trash2 size={14} />
                                                    </span>
                                                </ConfirmIconButton>

                                                {dirty && !busy ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => clearDraft(a.app_id)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/70 hover:border-indigo-400/35 hover:text-white"
                                                        title={text('accounts_discard')}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && !newDraft && visibleAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-indigo-200/60">
                                        {text('accounts_empty')}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
