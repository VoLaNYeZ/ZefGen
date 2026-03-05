import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { AppItem, AppstoreAccount, Brand } from '../../types/zefgen';
import { InstantTooltip } from '../ui/InstantTooltip';

type Draft = Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
type UsabilityStatus = 'usable' | 'unusable' | 'used_before';
type ComputedStatus = UsabilityStatus | 'banned';

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

const maskSecretForView = (value: unknown) => {
    const raw = String(value ?? '');
    if (!raw) return '';
    const dots = Math.max(6, Math.min(12, raw.length));
    return '•'.repeat(dots);
};

const statusFromFlags = (payload: { usability: boolean; was_used_before: boolean }): UsabilityStatus => {
    if (payload.was_used_before) return 'used_before';
    return payload.usability ? 'usable' : 'unusable';
};

const flagsFromStatus = (
    status: UsabilityStatus
): Pick<AppstoreAccount, 'usability' | 'was_used_before'> => {
    if (status === 'usable') return { usability: true, was_used_before: false };
    if (status === 'used_before') return { usability: false, was_used_before: true };
    return { usability: false, was_used_before: false };
};

const statusTextClass = (status: ComputedStatus) => {
    if (status === 'banned') return 'text-rose-100';
    if (status === 'usable') return 'text-emerald-200';
    if (status === 'used_before') return 'text-amber-100/90';
    return 'text-cyan-100/95';
};

const statusCellBgClass = (status: ComputedStatus) => {
    if (status === 'banned') return 'bg-rose-500/10';
    if (status === 'usable') return 'bg-emerald-500/10';
    if (status === 'used_before') return 'bg-amber-500/10';
    return 'bg-cyan-500/10';
};

const statusPillClass = (status: ComputedStatus) => {
    if (status === 'banned') return 'border-rose-400/30 bg-rose-500/10 text-rose-50/90';
    if (status === 'usable') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    if (status === 'used_before') return 'border-amber-400/30 bg-amber-500/10 text-amber-100/95';
    return 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100/90';
};

export function AccountsPage(props: {
    accounts: AppstoreAccount[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    createAccount: (args: {
        row: Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
    }) => Promise<AppstoreAccount | null | undefined>;
    updateAccount: (args: {
        id: string;
        patch: Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at'>>;
    }) => Promise<AppstoreAccount | null | undefined>;
    deleteAccount: (args: { id: string }) => Promise<void>;
    apps: AppItem[];
    brands: Brand[];
    onOpenApp: (appId: string) => void;
    focusAppId: string | null;
    consumeFocus: () => void;
    onUnsavedChangesChange?: (hasChanges: boolean) => void;
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
        onOpenApp,
        focusAppId,
        consumeFocus,
        onUnsavedChangesChange,
        reportError,
        text,
    } = props;

    const [mode, setMode] = React.useState<'view' | 'edit'>('view');
    const [search, setSearch] = React.useState('');
    const [banFilter, setBanFilter] = React.useState<'active' | 'banned' | 'all'>('active');
    const isEditMode = mode === 'edit';
    const searchInput =
        'h-9 w-full rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 focus:border-indigo-400/40 disabled:opacity-60';
    const cellInput =
        'h-10 w-full bg-transparent px-3 text-xs text-indigo-100/90 outline-none placeholder:text-indigo-200/30 disabled:opacity-60';
    const cellInputMono = `${cellInput} font-mono text-[11px]`;
    const cellSelect =
        'h-10 w-full bg-transparent px-3 text-xs text-indigo-100/90 outline-none disabled:opacity-60';
    const cellBox =
        'min-w-0 focus-within:bg-slate-950/20 focus-within:ring-1 focus-within:ring-inset focus-within:ring-indigo-400/25';
    const gridStyle = React.useMemo<React.CSSProperties>(() => {
        return {
            gridTemplateColumns:
                '44px 120px 110px minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 0.95fr) minmax(0, 0.7fr) minmax(0, 0.6fr) minmax(0, 0.6fr) minmax(0, 1fr) minmax(0, 1fr) 96px',
        };
    }, []);

    const [draftById, setDraftById] = React.useState<Record<string, Draft>>({});
    const [rowBusyById, setRowBusyById] = React.useState<Record<string, boolean>>({});
    const [rowErrorById, setRowErrorById] = React.useState<Record<string, string | null>>({});
    const [rowSavedById, setRowSavedById] = React.useState<Record<string, boolean>>({});
    const [saveAllBusy, setSaveAllBusy] = React.useState(false);
    const [saveAllSaved, setSaveAllSaved] = React.useState(false);

    const [newDraft, setNewDraft] = React.useState<{
        app_id: string | null;
        usability: boolean;
        was_used_before: boolean;
        email: string;
        password: string;
        email_password: string;
        number: string;
        geo: string;
        company_name: string;
        proxy: string;
        notes: string;
    } | null>(null);
    const [newBusy, setNewBusy] = React.useState(false);
    const [newError, setNewError] = React.useState<string | null>(null);
    const [newRowScrollNonce, setNewRowScrollNonce] = React.useState(0);

    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
    const copiedTimerRef = React.useRef<number | null>(null);
    const saveAllTimerRef = React.useRef<number | null>(null);

    const [flashAccountId, setFlashAccountId] = React.useState<string | null>(null);
    const flashTimerRef = React.useRef<number | null>(null);

    const appPickerAnchorByIdRef = React.useRef<Record<string, HTMLElement | null>>({});
    const appPickerRef = React.useRef<HTMLDivElement | null>(null);
    const [appPickerOpenForId, setAppPickerOpenForId] = React.useState<string | null>(null);
    const [appPickerPos, setAppPickerPos] = React.useState<{ top: number; left: number; minWidth: number } | null>(
        null
    );

    React.useEffect(() => {
        return () => {
            if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
            if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
            if (saveAllTimerRef.current) window.clearTimeout(saveAllTimerRef.current);
        };
    }, []);

    const appById = React.useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
    const brandById = React.useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
    const accountById = React.useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
    const accountIndexById = React.useMemo(() => {
        const map = new Map<string, number>();
        accounts.forEach((a, i) => map.set(a.id, i + 1));
        return map;
    }, [accounts]);

    const appsSorted = React.useMemo(() => {
        const list = [...apps];
        list.sort((a, b) => String(a.alias || '').localeCompare(String(b.alias || '')));
        return list;
    }, [apps]);

    const appsAssignableSorted = React.useMemo(() => {
        return appsSorted.filter((app) => !Boolean(app.is_banned));
    }, [appsSorted]);

    const assignedAccountIdByAppId = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const account of accounts) {
            if (!account.app_id) continue;
            map.set(account.app_id, account.id);
        }
        return map;
    }, [accounts]);

    const predictedAccountIdByAppId = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const account of accounts) {
            const draft = draftById[account.id] || {};
            const appId = normalize('app_id' in draft ? (draft as any).app_id : account.app_id);
            if (!appId) continue;
            // Preserve the first owner; duplicates are handled on save.
            if (!map.has(appId)) map.set(appId, account.id);
        }
        if (newDraft) {
            const appId = normalize(newDraft.app_id);
            if (appId && !map.has(appId)) map.set(appId, 'new');
        }
        return map;
    }, [accounts, draftById, newDraft]);

    const formatAppLabel = React.useCallback(
        (app: AppItem | undefined) => {
            if (!app) return '—';
            const brand = brandById.get(app.brand_id);
            const brandPart = brand ? ` · ${brand.name}` : '';
            return `${String(app.alias || '').toUpperCase()} · ${app.name}${brandPart}`;
        },
        [brandById]
    );

    const markSaved = React.useCallback((accountId: string) => {
        setRowSavedById((prev) => ({ ...prev, [accountId]: true }));
        window.setTimeout(() => {
            setRowSavedById((prev) => {
                const next = { ...prev };
                delete next[accountId];
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

    const setDraftField = React.useCallback((accountId: string, patch: Partial<Draft>) => {
        setDraftById((prev) => ({ ...prev, [accountId]: { ...(prev[accountId] || {}), ...patch } }));
    }, []);

    const clearDraft = React.useCallback((accountId: string) => {
        setDraftById((prev) => {
            const next = { ...prev };
            delete next[accountId];
            return next;
        });
        setRowErrorById((prev) => {
            const next = { ...prev };
            delete next[accountId];
            return next;
        });
    }, []);

    const isDirty = React.useCallback((account: AppstoreAccount, draft: Draft) => {
        const keys: Array<keyof Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = [
            'app_id',
            'usability',
            'was_used_before',
            'email',
            'password',
            'email_password',
            'number',
            'geo',
            'company_name',
            'proxy',
            'notes',
        ];
        return keys.some((k) => {
            if (!(k in draft)) return false;
            const a =
                k === 'usability' || k === 'was_used_before'
                    ? Boolean((account as any)[k])
                    : k === 'app_id'
                      ? normalize((account as any)[k])
                      : normalize((account as any)[k]);
            const b =
                k === 'usability' || k === 'was_used_before'
                    ? Boolean((draft as any)[k])
                    : k === 'app_id'
                      ? normalize((draft as any)[k])
                      : normalize((draft as any)[k]);
            return a !== b;
        });
    }, []);

    const onSaveRow = React.useCallback(
        async (account: AppstoreAccount) => {
            if (!isEditMode) return;
            const draft = draftById[account.id] || {};
            if (!isDirty(account, draft)) return;

            setRowBusyById((prev) => ({ ...prev, [account.id]: true }));
            setRowErrorById((prev) => ({ ...prev, [account.id]: null }));
            try {
                const merged = {
                    app_id: 'app_id' in draft ? (draft as any).app_id ?? null : account.app_id,
                    usability: 'usability' in draft ? Boolean((draft as any).usability) : account.usability,
                    was_used_before:
                        'was_used_before' in draft ? Boolean((draft as any).was_used_before) : account.was_used_before,
                    email: normalize(draft.email ?? account.email),
                    password: normalize(draft.password ?? account.password),
                    email_password: normalize(draft.email_password ?? account.email_password),
                    number: normalize(draft.number ?? account.number),
                    geo: normalize(draft.geo ?? account.geo),
                    company_name: normalize(draft.company_name ?? account.company_name),
                    proxy: normalize(draft.proxy ?? account.proxy),
                    notes: normalize(draft.notes ?? account.notes),
                };

                // DB constraint: used_before implies blocked.
                if (merged.was_used_before) merged.usability = false;

                if (merged.app_id) {
                    const takenBy = assignedAccountIdByAppId.get(merged.app_id);
                    if (takenBy && takenBy !== account.id) {
                        setRowErrorById((prev) => ({ ...prev, [account.id]: text('accounts_app_already_has_account') }));
                        return;
                    }
                }

                await updateAccount({ id: account.id, patch: merged });
                clearDraft(account.id);
                markSaved(account.id);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorById((prev) => ({ ...prev, [account.id]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [account.id]: false }));
            }
        },
        [isEditMode, draftById, isDirty, updateAccount, clearDraft, markSaved, reportError, assignedAccountIdByAppId, text]
    );

    const onRemoveRow = React.useCallback(
        async (accountId: string) => {
            if (!isEditMode) return;
            setRowBusyById((prev) => ({ ...prev, [accountId]: true }));
            setRowErrorById((prev) => ({ ...prev, [accountId]: null }));
            try {
                await deleteAccount({ id: accountId });
                clearDraft(accountId);
            } catch (e: any) {
                const msg = String(e?.message || e);
                setRowErrorById((prev) => ({ ...prev, [accountId]: msg }));
                reportError?.(msg);
            } finally {
                setRowBusyById((prev) => ({ ...prev, [accountId]: false }));
            }
        },
        [isEditMode, deleteAccount, clearDraft, reportError]
    );

    const openNewRow = React.useCallback(
        (prefillAppId?: string | null) => {
            setMode('edit');
            setNewError(null);
            setNewDraft((prev) => {
                if (prev) return prev;
                return {
                    app_id: prefillAppId || null,
                    usability: true,
                    was_used_before: false,
                    email: '',
                    password: '',
                    email_password: '',
                    number: '',
                    geo: '',
                    company_name: '',
                    proxy: '',
                    notes: '',
                };
            });
            setNewRowScrollNonce((v) => v + 1);
        },
        [setMode]
    );

    React.useEffect(() => {
        if (!newDraft) return;
        if (!newRowScrollNonce) return;
        // Ensure the element is in the DOM before scrolling (React commit can land after timers).
        const raf1 = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const el = document.getElementById('account-row-new');
                el?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            });
        });
        return () => window.cancelAnimationFrame(raf1);
    }, [newDraft, newRowScrollNonce]);

    const onSaveNew = React.useCallback(async () => {
        if (!isEditMode) return;
        if (!newDraft) return;
        const appId = newDraft.app_id ? String(newDraft.app_id).trim() : '';
        if (appId && assignedAccountIdByAppId.has(appId)) {
            setNewError(text('accounts_app_already_has_account'));
            return;
        }
        setNewBusy(true);
        setNewError(null);
        try {
            const created = await createAccount({
                row: {
                    app_id: appId ? appId : null,
                    usability: Boolean(newDraft.usability) && !Boolean(newDraft.was_used_before),
                    was_used_before: Boolean(newDraft.was_used_before),
                    email: normalize(newDraft.email),
                    password: normalize(newDraft.password),
                    email_password: normalize(newDraft.email_password),
                    number: normalize(newDraft.number),
                    geo: normalize(newDraft.geo),
                    company_name: normalize(newDraft.company_name),
                    proxy: normalize(newDraft.proxy),
                    notes: normalize(newDraft.notes),
                } satisfies Draft,
            });
            setNewDraft(null);
            if (created?.id) markSaved(created.id);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setNewError(msg);
            reportError?.(msg);
        } finally {
            setNewBusy(false);
        }
    }, [isEditMode, newDraft, assignedAccountIdByAppId, createAccount, markSaved, reportError, text]);

    React.useEffect(() => {
        if (!focusAppId) return;
        if (loading) return;
        const existing = accounts.find((a) => a.app_id === focusAppId) || null;
        if (existing) {
            // Ensure the focused row is visible even if the user is currently filtering.
            if (banFilter !== 'all') {
                const app = appById.get(focusAppId) || null;
                const isBanned = Boolean(app?.is_banned);
                if (isBanned && banFilter === 'active') setBanFilter('banned');
                if (!isBanned && banFilter === 'banned') setBanFilter('active');
            }
            window.setTimeout(() => {
                const el = document.getElementById(`account-row-${existing.id}`);
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                setFlashAccountId(existing.id);
                if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
                flashTimerRef.current = window.setTimeout(() => setFlashAccountId(null), 1600);
            }, 0);
            consumeFocus();
            return;
        }

        // No account yet for this app: open a prefilled new row.
        openNewRow(focusAppId);
        consumeFocus();
    }, [focusAppId, loading, accounts, consumeFocus, openNewRow, banFilter, appById]);

    const visibleAccounts = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return accounts.filter((a) => {
            const draft = draftById[a.id] || {};
            const effectiveAppId = ('app_id' in draft ? (draft as any).app_id : a.app_id) as string | null | undefined;
            const app = effectiveAppId ? appById.get(effectiveAppId) : null;
            const appLabel = app ? formatAppLabel(app) : '';
            const isBanned = Boolean(app?.is_banned);

            if (banFilter === 'active') {
                if (effectiveAppId && isBanned) return false;
            } else if (banFilter === 'banned') {
                if (!effectiveAppId) return false;
                if (!isBanned) return false;
            }

            if (!q) return true;

            const email = normalize(draft.email ?? a.email);
            const company = normalize(draft.company_name ?? a.company_name);
            const geo = normalize(draft.geo ?? a.geo);
            const number = normalize(draft.number ?? a.number);
            const proxy = normalize(draft.proxy ?? a.proxy);
            const notes = normalize(draft.notes ?? a.notes);
            const hay = [
                app?.alias,
                appLabel,
                email,
                company,
                geo,
                number,
                proxy,
                notes,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [accounts, search, banFilter, appById, draftById, formatAppLabel]);

    const dirtyIds = React.useMemo(() => {
        if (!isEditMode) return [];
        return accounts
            .filter((account) => isDirty(account, draftById[account.id] || {}))
            .map((account) => account.id);
    }, [isEditMode, accounts, draftById, isDirty]);

    const dirtyCount = React.useMemo(() => {
        if (!isEditMode) return 0;
        return dirtyIds.length + (newDraft ? 1 : 0);
    }, [isEditMode, dirtyIds.length, newDraft]);

    React.useEffect(() => {
        onUnsavedChangesChange?.(isEditMode && dirtyCount > 0);
    }, [onUnsavedChangesChange, isEditMode, dirtyCount]);

    React.useEffect(() => {
        return () => onUnsavedChangesChange?.(false);
    }, [onUnsavedChangesChange]);

    const anyBusy = loading || newBusy || saveAllBusy || Object.values(rowBusyById).some(Boolean);

    const handleRefresh = React.useCallback(() => {
        if (isEditMode && dirtyCount > 0) {
            reportError?.(text('accounts_unsaved_block'));
            return;
        }
        setDraftById({});
        setRowBusyById({});
        setRowErrorById({});
        setRowSavedById({});
        setNewDraft(null);
        setNewError(null);
        setAppPickerOpenForId(null);
        refresh();
    }, [dirtyCount, isEditMode, refresh, reportError, text]);

    const cancelEditing = React.useCallback(() => {
        if (!isEditMode) return;
        setDraftById({});
        setRowBusyById({});
        setRowErrorById({});
        setNewDraft(null);
        setNewError(null);
        setAppPickerOpenForId(null);
        setSaveAllSaved(false);
        setMode('view');
    }, [isEditMode]);

    const saveAll = React.useCallback(async () => {
        if (!isEditMode) return;
        if (saveAllBusy) return;
        if (dirtyIds.length === 0 && !newDraft) return;

        setAppPickerOpenForId(null);

        const canonAppId = (value: unknown): string | null => {
            const v = normalize(value);
            return v ? v : null;
        };

        // Validate final assignments (including non-dirty rows): no duplicates for non-null app_id.
        const ownerByAppId = new Map<string, string>();
        const conflicts = new Set<string>();

        for (const account of accounts) {
            const draft = draftById[account.id] || {};
            const effectiveAppId = canonAppId('app_id' in draft ? (draft as any).app_id : account.app_id);
            if (!effectiveAppId) continue;
            const prevOwner = ownerByAppId.get(effectiveAppId);
            if (prevOwner && prevOwner !== account.id) {
                conflicts.add(prevOwner);
                conflicts.add(account.id);
            } else {
                ownerByAppId.set(effectiveAppId, account.id);
            }
        }

        if (newDraft) {
            const effectiveAppId = canonAppId(newDraft.app_id);
            if (effectiveAppId) {
                const prevOwner = ownerByAppId.get(effectiveAppId);
                if (prevOwner && prevOwner !== 'new') {
                    conflicts.add(prevOwner);
                    conflicts.add('new');
                } else {
                    ownerByAppId.set(effectiveAppId, 'new');
                }
            }
        }

        if (conflicts.size) {
            const msg = text('accounts_app_already_has_account');
            setRowErrorById((prev) => {
                const next = { ...prev };
                for (const id of conflicts) {
                    if (id === 'new') continue;
                    next[id] = msg;
                }
                return next;
            });
            if (conflicts.has('new')) setNewError(msg);
            reportError?.(msg);
            return;
        }

        const dirtyIdSet = new Set(dirtyIds);
        const dirtyAccounts = accounts.filter((a) => dirtyIdSet.has(a.id));
        const mergedById = new Map<string, Draft>();
        const idsToUnassignFirst: string[] = [];

        for (const account of dirtyAccounts) {
            const draft = draftById[account.id] || {};
            const merged: Draft = {
                app_id: canonAppId('app_id' in draft ? (draft as any).app_id : account.app_id),
                usability: 'usability' in draft ? Boolean((draft as any).usability) : account.usability,
                was_used_before: 'was_used_before' in draft ? Boolean((draft as any).was_used_before) : account.was_used_before,
                email: normalize(draft.email ?? account.email),
                password: normalize(draft.password ?? account.password),
                email_password: normalize(draft.email_password ?? account.email_password),
                number: normalize(draft.number ?? account.number),
                geo: normalize(draft.geo ?? account.geo),
                company_name: normalize(draft.company_name ?? account.company_name),
                proxy: normalize(draft.proxy ?? account.proxy),
                notes: normalize(draft.notes ?? account.notes),
            };

            // DB constraint: used_before implies blocked.
            if (merged.was_used_before) merged.usability = false;

            mergedById.set(account.id, merged);

            const currentAppId = canonAppId(account.app_id);
            const desiredAppId = canonAppId(merged.app_id);
            if (currentAppId && desiredAppId !== currentAppId) {
                idsToUnassignFirst.push(account.id);
            }
        }

        setSaveAllBusy(true);
        setSaveAllSaved(false);
        setNewError(null);
        setRowBusyById((prev) => {
            const next = { ...prev };
            for (const id of dirtyIds) next[id] = true;
            return next;
        });
        setRowErrorById((prev) => {
            const next = { ...prev };
            for (const id of dirtyIds) next[id] = null;
            return next;
        });

        let currentStep: { kind: 'unassign' | 'update' | 'create'; id?: string } = { kind: 'update' };

        try {
            // Phase 1: free any currently-assigned app_id to avoid unique constraint conflicts on swaps.
            for (const id of idsToUnassignFirst) {
                currentStep = { kind: 'unassign', id };
                await updateAccount({ id, patch: { app_id: null } });
            }

            // Phase 2: write the final row patches.
            for (const account of dirtyAccounts) {
                currentStep = { kind: 'update', id: account.id };
                const patch = mergedById.get(account.id);
                if (!patch) continue;
                await updateAccount({ id: account.id, patch });
                clearDraft(account.id);
                markSaved(account.id);
            }

            if (newDraft) {
                currentStep = { kind: 'create' };
                const created = await createAccount({
                    row: {
                        app_id: canonAppId(newDraft.app_id),
                        usability: Boolean(newDraft.usability) && !Boolean(newDraft.was_used_before),
                        was_used_before: Boolean(newDraft.was_used_before),
                        email: normalize(newDraft.email),
                        password: normalize(newDraft.password),
                        email_password: normalize(newDraft.email_password),
                        number: normalize(newDraft.number),
                        geo: normalize(newDraft.geo),
                        company_name: normalize(newDraft.company_name),
                        proxy: normalize(newDraft.proxy),
                        notes: normalize(newDraft.notes),
                    } satisfies Draft,
                });
                setNewDraft(null);
                if (created?.id) markSaved(created.id);
            }

            setSaveAllSaved(true);
            if (saveAllTimerRef.current) window.clearTimeout(saveAllTimerRef.current);
            saveAllTimerRef.current = window.setTimeout(() => setSaveAllSaved(false), 1200);
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (currentStep.kind === 'create') {
                setNewError(msg);
            } else if (currentStep.id) {
                setRowErrorById((prev) => ({ ...prev, [currentStep.id as string]: msg }));
            }
            reportError?.(msg);
        } finally {
            setRowBusyById((prev) => {
                const next = { ...prev };
                for (const id of dirtyIds) next[id] = false;
                return next;
            });
            setSaveAllBusy(false);
        }
    }, [
        isEditMode,
        saveAllBusy,
        dirtyIds,
        newDraft,
        accounts,
        draftById,
        updateAccount,
        clearDraft,
        markSaved,
        createAccount,
        reportError,
        text,
    ]);

    const onExistingCellKeyDown = React.useCallback(
        (event: React.KeyboardEvent, account: AppstoreAccount) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                clearDraft(account.id);
                setAppPickerOpenForId(null);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void onSaveRow(account);
            }
        },
        [clearDraft, onSaveRow]
    );

    const onNewCellKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setNewDraft(null);
                setNewError(null);
                setAppPickerOpenForId(null);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void onSaveNew();
            }
        },
        [onSaveNew]
    );

    const openAppPicker = React.useCallback(
        (id: string) => {
            if (!isEditMode) return;
            const anchor = appPickerAnchorByIdRef.current[id];
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            setAppPickerPos({
                top: rect.bottom + 8,
                left: rect.left,
                minWidth: Math.max(260, rect.width),
            });
            setAppPickerOpenForId(id);
        },
        [isEditMode]
    );

    const closeAppPicker = React.useCallback(() => {
        setAppPickerOpenForId(null);
    }, []);

    const pickAppForOpenPicker = React.useCallback(
        (nextAppId: string | null) => {
            if (!isEditMode) return;
            if (!appPickerOpenForId) return;
            if (appPickerOpenForId === 'new') {
                setNewDraft((prev) => (prev ? { ...prev, app_id: nextAppId } : prev));
            } else {
                setDraftField(appPickerOpenForId, { app_id: nextAppId });
            }
            setAppPickerOpenForId(null);
        },
        [isEditMode, appPickerOpenForId, setDraftField]
    );

    React.useEffect(() => {
        if (!appPickerOpenForId) return;
        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const anchor = appPickerAnchorByIdRef.current[appPickerOpenForId];
                if (!anchor || !anchor.isConnected) return;
                const rect = anchor.getBoundingClientRect();
                setAppPickerPos({
                    top: rect.bottom + 8,
                    left: rect.left,
                    minWidth: Math.max(260, rect.width),
                });
            });
        };

        schedule();
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
        };
    }, [appPickerOpenForId]);

    React.useEffect(() => {
        if (!appPickerOpenForId) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeAppPicker();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [appPickerOpenForId, closeAppPicker]);

    React.useEffect(() => {
        if (!appPickerOpenForId) return;
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            const pop = appPickerRef.current;
            if (pop && pop.contains(target)) return;
            const anchor = appPickerAnchorByIdRef.current[appPickerOpenForId];
            if (anchor && anchor.contains(target)) return;
            closeAppPicker();
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [appPickerOpenForId, closeAppPicker]);

    return (
        <>
            <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold text-white">{text('accounts')}</h2>
                    <p className="mt-2 text-sm text-indigo-200/60">{text('accounts_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={anyBusy}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs font-semibold text-indigo-100 hover:border-indigo-400/40 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                        {text('refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (isEditMode) {
                                if (dirtyCount > 0) {
                                    reportError?.(text('accounts_unsaved_block'));
                                    return;
                                }
                                cancelEditing();
                                return;
                            }
                            setMode('edit');
                        }}
                        disabled={anyBusy}
                        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:opacity-60 ${
                            isEditMode
                                ? 'border-indigo-400/35 bg-indigo-500/10 text-white hover:bg-indigo-500/15'
                                : 'border-white/10 bg-slate-950/20 text-indigo-100 hover:border-indigo-400/40'
                        }`}
                        aria-pressed={isEditMode}
                    >
                        <Pencil size={14} />
                        {text('edit')}
                    </button>
                    <button
                        type="button"
                        onClick={() => openNewRow()}
                        disabled={anyBusy}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/20"
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

            <section className="rounded-2xl border border-white/10 bg-slate-950/10">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
                        <div className="relative w-full sm:w-[420px]">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-200/45" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={`${searchInput} pl-10`}
                                placeholder={text('accounts_search_placeholder')}
                            />
                        </div>
                        <div className="relative shrink-0 rounded-xl border border-white/10 bg-slate-950/20 p-1 w-[210px]">
                            <span
                                className={`absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-lg bg-white/10 transition-transform duration-200 ${
                                    banFilter === 'banned'
                                        ? 'translate-x-[100%]'
                                        : banFilter === 'all'
                                          ? 'translate-x-[200%]'
                                          : ''
                                }`}
                            />
                            <div className="relative z-10 grid grid-cols-3">
                                {(
                                    [
                                        { id: 'active', label: text('accounts_filter_active') },
                                        { id: 'banned', label: text('accounts_filter_banned') },
                                        { id: 'all', label: text('accounts_filter_all') },
                                    ] as Array<{ id: 'active' | 'banned' | 'all'; label: string }>
                                ).map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setBanFilter(opt.id)}
                                        className={`inline-flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-colors ${
                                            banFilter === opt.id
                                                ? 'text-white'
                                                : 'text-indigo-200/60 hover:text-white'
                                        }`}
                                        aria-pressed={banFilter === opt.id}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="text-[11px] text-indigo-200/45">
                        {text('accounts_rows')}: <span className="font-semibold text-indigo-100/80">{visibleAccounts.length}</span>
                    </div>
                </div>

                <div className="border-t border-white/10">
                    <div className="overflow-x-auto sm:overflow-x-visible">
                        <div
                            className="sticky top-0 z-10 grid min-w-[1280px] sm:min-w-0 divide-x divide-white/5 border-b border-white/10 bg-slate-950/50 backdrop-blur"
                            style={gridStyle}
                        >
                            <div className="flex items-center justify-center px-2 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                #
                            </div>
                            <div className="flex items-center justify-center px-2 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_usability')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_app_alias')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_email')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_password')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_email_password')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_number')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_geo')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_company_name')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_proxy')}
                            </div>
                            <div className="flex items-center px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_notes')}
                            </div>
                            <div className="flex items-center justify-center px-2 py-2 text-[10px] font-semibold tracking-[0.12em] text-indigo-200/55">
                                {text('accounts_actions')}
                            </div>
                        </div>

                        <div className="flex min-w-[1280px] sm:min-w-0 flex-col">
                        {isEditMode && newDraft ? (
                            <div
                                id="account-row-new"
                                className="order-last grid divide-x divide-white/5 border-b border-white/5 bg-indigo-500/10"
                                style={gridStyle}
                            >
                                <div className="flex h-10 items-center justify-center px-2 text-xs font-semibold text-indigo-100/70">
                                    +
                                </div>
                                {(() => {
                                    const app = newDraft.app_id ? appById.get(newDraft.app_id) : null;
                                    const alias = app?.alias ? String(app.alias).toUpperCase() : '—';
                                    const statusRaw = statusFromFlags({
                                        usability: Boolean(newDraft.usability),
                                        was_used_before: Boolean(newDraft.was_used_before),
                                    });
                                    const computedStatus: ComputedStatus =
                                        newDraft.app_id && Boolean(app?.is_banned) ? 'banned' : statusRaw;

                                    return (
                                        <>
                                            <div className={`min-w-0 ${cellBox} ${statusCellBgClass(computedStatus)}`}>
                                                {computedStatus === 'banned' ? (
                                                    <div className="flex h-10 items-center justify-center px-2">
                                                        <span
                                                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusPillClass(
                                                                computedStatus
                                                            )}`}
                                                        >
                                                            {text('accounts_banned')}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={statusRaw}
                                                        onChange={(e) => {
                                                            const next = flagsFromStatus(e.target.value as UsabilityStatus);
                                                            setNewDraft((prev) => (prev ? { ...prev, ...next } : prev));
                                                        }}
                                                        onKeyDown={onNewCellKeyDown}
                                                        disabled={newBusy}
                                                        className={`${cellSelect} font-semibold ${statusTextClass(statusRaw)}`}
                                                    >
                                                        <option value="usable">{text('accounts_usable')}</option>
                                                        <option value="unusable">{text('accounts_disabled')}</option>
                                                        <option value="used_before">{text('accounts_used_before')}</option>
                                                    </select>
                                                )}
                                            </div>
                                            <div className={`min-w-0 ${cellBox}`}>
                                                <button
                                                    type="button"
                                                    ref={(el) => {
                                                        appPickerAnchorByIdRef.current['new'] = el;
                                                    }}
                                                    onClick={() => openAppPicker('new')}
                                                    onKeyDown={onNewCellKeyDown}
                                                    disabled={newBusy}
                                                    className="flex h-10 w-full items-center justify-between gap-2 px-3 text-left outline-none disabled:opacity-60"
                                                >
                                                    <InstantTooltip
                                                        content={app ? formatAppLabel(app) : '—'}
                                                        disabled={!app}
                                                    >
                                                        <span
                                                            className={`font-mono text-xs ${
                                                                app ? 'text-indigo-100/90' : 'text-indigo-200/40'
                                                            }`}
                                                        >
                                                            {alias}
                                                        </span>
                                                    </InstantTooltip>
                                                    <ChevronDown size={14} className="text-indigo-100/50" />
                                                </button>
                                                {newError ? (
                                                    <div className="px-3 pb-2 text-[10px] text-rose-200/90">{newError}</div>
                                                ) : null}
                                            </div>
                                            <div className={`group relative min-w-0 ${cellBox}`}>
                                                <input
                                                    value={newDraft.email}
                                                    onChange={(e) =>
                                                        setNewDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                                                    }
                                                    onKeyDown={onNewCellKeyDown}
                                                    className={`${cellInput} pr-10`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => copyWithToast('new.email', newDraft.email)}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                                    title={text('copy')}
                                                >
                                                    {copiedKey === 'new.email' ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                                <div className={`group relative min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.password}
                                        onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, password: e.target.value } : prev))}
                                        onKeyDown={onNewCellKeyDown}
                                        className={`${cellInputMono} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyWithToast('new.password', newDraft.password)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                        title={text('copy')}
                                    >
                                        {copiedKey === 'new.password' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className={`group relative min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.email_password}
                                        onChange={(e) =>
                                            setNewDraft((prev) => (prev ? { ...prev, email_password: e.target.value } : prev))
                                        }
                                        onKeyDown={onNewCellKeyDown}
                                        className={`${cellInputMono} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyWithToast('new.email_password', newDraft.email_password)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                        title={text('copy')}
                                    >
                                        {copiedKey === 'new.email_password' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className={`min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.number}
                                        onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, number: e.target.value } : prev))}
                                        onKeyDown={onNewCellKeyDown}
                                        className={cellInput}
                                    />
                                </div>
                                <div className={`min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.geo}
                                        onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, geo: e.target.value } : prev))}
                                        onKeyDown={onNewCellKeyDown}
                                        className={cellInput}
                                    />
                                </div>
                                <div className={`min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.company_name}
                                        onChange={(e) =>
                                            setNewDraft((prev) => (prev ? { ...prev, company_name: e.target.value } : prev))
                                        }
                                        onKeyDown={onNewCellKeyDown}
                                        className={cellInput}
                                    />
                                </div>
                                <div className={`group relative min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.proxy}
                                        onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, proxy: e.target.value } : prev))}
                                        onKeyDown={onNewCellKeyDown}
                                        className={`${cellInputMono} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyWithToast('new.proxy', newDraft.proxy)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30"
                                        title={text('copy')}
                                    >
                                        {copiedKey === 'new.proxy' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                                <div className={`min-w-0 ${cellBox}`}>
                                    <input
                                        value={newDraft.notes}
                                        onChange={(e) => setNewDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                                        onKeyDown={onNewCellKeyDown}
                                        className={cellInput}
                                    />
                                </div>
                                <div className={`flex items-center justify-center gap-2 px-2 ${cellBox}`}>
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
                                        onClick={() => {
                                            setNewDraft(null);
                                            setNewError(null);
                                        }}
                                        disabled={newBusy}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/70 hover:border-indigo-400/35 hover:text-white disabled:opacity-60"
                                        title={text('cancel')}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {visibleAccounts.map((a) => {
                            const draft = draftById[a.id] || {};
                            const dirty = isDirty(a, draft);
                            const busy = Boolean(rowBusyById[a.id]);
                            const saved = Boolean(rowSavedById[a.id]);
                            const flash = flashAccountId === a.id;
                            const rowError = rowErrorById[a.id];

                            const field = <K extends keyof Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>(
                                k: K
                            ) => (k in draft ? (draft as any)[k] : (a as any)[k]) as AppstoreAccount[K];

                            const effectiveAppId = field('app_id') as string | null;
                            const app = effectiveAppId ? appById.get(effectiveAppId) : null;
                            const alias = app?.alias ? String(app.alias).toUpperCase() : '—';
                            const status = statusFromFlags({
                                usability: Boolean(field('usability')),
                                was_used_before: Boolean(field('was_used_before')),
                            });
                            const computedStatus: ComputedStatus =
                                effectiveAppId && Boolean(app?.is_banned) ? 'banned' : status;

                            return (
                                <div
                                    key={a.id}
                                    id={`account-row-${a.id}`}
                                    className={`grid divide-x divide-white/5 border-b border-white/5 transition-colors ${
                                        flash ? 'bg-indigo-500/10' : 'bg-transparent'
                                    } hover:bg-slate-950/15`}
                                    style={gridStyle}
                                >
                                    <div className="flex h-10 items-center justify-center px-2 text-[11px] font-semibold text-indigo-100/60">
                                        {accountIndexById.get(a.id) ?? '—'}
                                    </div>
                                    <div className={`min-w-0 ${cellBox} ${statusCellBgClass(computedStatus)}`}>
                                        {!isEditMode || computedStatus === 'banned' ? (
                                            <div className="flex h-10 items-center justify-center px-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusPillClass(
                                                        computedStatus
                                                    )}`}
                                                >
                                                    {computedStatus === 'banned'
                                                        ? text('accounts_banned')
                                                        : computedStatus === 'used_before'
                                                          ? text('accounts_used_before')
                                                          : computedStatus === 'usable'
                                                            ? text('accounts_usable')
                                                            : text('accounts_disabled')}
                                                </span>
                                            </div>
                                        ) : (
                                            <select
                                                value={status}
                                                onChange={(e) =>
                                                    setDraftField(a.id, flagsFromStatus(e.target.value as UsabilityStatus))
                                                }
                                                onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                                disabled={busy}
                                                className={`${cellSelect} font-semibold ${statusTextClass(status)}`}
                                            >
                                                <option value="usable">{text('accounts_usable')}</option>
                                                <option value="unusable">{text('accounts_disabled')}</option>
                                                <option value="used_before">{text('accounts_used_before')}</option>
                                            </select>
                                        )}
                                    </div>

                                    <div className={`min-w-0 ${cellBox}`}>
                                        <button
                                            type="button"
                                            ref={(el) => {
                                                appPickerAnchorByIdRef.current[a.id] = el;
                                            }}
                                            onClick={() => {
                                                if (isEditMode) {
                                                    openAppPicker(a.id);
                                                    return;
                                                }
                                                if (!effectiveAppId) return;
                                                onOpenApp(effectiveAppId);
                                            }}
                                            disabled={busy || (!isEditMode && (!effectiveAppId || !app))}
                                            className="flex h-10 w-full items-center justify-between gap-2 px-3 text-left outline-none disabled:opacity-60"
                                        >
                                            <InstantTooltip content={app ? formatAppLabel(app) : '—'} disabled={!app}>
                                                <span
                                                    className={`font-mono text-xs ${
                                                        app
                                                            ? 'text-indigo-100/90 underline-offset-4 hover:text-white'
                                                            : 'text-indigo-200/40'
                                                    } ${!isEditMode && app ? 'hover:underline' : ''}`}
                                                >
                                                    {alias}
                                                </span>
                                            </InstantTooltip>
                                            {isEditMode ? <ChevronDown size={14} className="text-indigo-100/50" /> : null}
                                        </button>
                                        {rowError ? <div className="px-3 pb-2 text-[10px] text-rose-200/90">{rowError}</div> : null}
                                    </div>
                                    <div className={`group relative min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('email') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { email: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={`${cellInput} pr-10`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => copyWithToast(`${a.id}.email`, String(field('email') ?? ''))}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                            disabled={busy}
                                            title={text('copy')}
                                        >
                                            {copiedKey === `${a.id}.email` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className={`group relative min-w-0 ${cellBox}`}>
                                        <input
                                            value={
                                                isEditMode
                                                    ? String(field('password') ?? '')
                                                    : maskSecretForView(field('password'))
                                            }
                                            onChange={(e) => setDraftField(a.id, { password: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={`${cellInputMono} pr-10`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => copyWithToast(`${a.id}.password`, String(field('password') ?? ''))}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                            disabled={busy}
                                            title={text('copy')}
                                        >
                                            {copiedKey === `${a.id}.password` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className={`group relative min-w-0 ${cellBox}`}>
                                        <input
                                            value={
                                                isEditMode
                                                    ? String(field('email_password') ?? '')
                                                    : maskSecretForView(field('email_password'))
                                            }
                                            onChange={(e) => setDraftField(a.id, { email_password: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={`${cellInputMono} pr-10`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyWithToast(`${a.id}.email_password`, String(field('email_password') ?? ''))
                                            }
                                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                            disabled={busy}
                                            title={text('copy')}
                                        >
                                            {copiedKey === `${a.id}.email_password` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className={`min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('number') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { number: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={cellInput}
                                        />
                                    </div>
                                    <div className={`min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('geo') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { geo: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={cellInput}
                                        />
                                    </div>
                                    <div className={`min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('company_name') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { company_name: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={cellInput}
                                        />
                                    </div>
                                    <div className={`group relative min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('proxy') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { proxy: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={`${cellInputMono} pr-10`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => copyWithToast(`${a.id}.proxy`, String(field('proxy') ?? ''))}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-indigo-100/60 opacity-20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white/10 hover:bg-slate-950/30 hover:text-white focus:opacity-100 focus:border-indigo-400/40 focus:bg-slate-950/30 disabled:opacity-60"
                                            disabled={busy}
                                            title={text('copy')}
                                        >
                                            {copiedKey === `${a.id}.proxy` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className={`min-w-0 ${cellBox}`}>
                                        <input
                                            value={String(field('notes') ?? '')}
                                            onChange={(e) => setDraftField(a.id, { notes: e.target.value })}
                                            onKeyDown={(e) => onExistingCellKeyDown(e, a)}
                                            readOnly={!isEditMode}
                                            disabled={busy}
                                            className={cellInput}
                                        />
                                    </div>
                                    <div className={`flex items-center justify-center gap-2 px-2 ${cellBox}`}>
                                        {isEditMode ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveRow(a)}
                                                    disabled={!dirty || busy}
                                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-60 ${
                                                        dirty
                                                            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15'
                                                            : 'border-white/10 bg-slate-950/20 text-indigo-200/45'
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

                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        const ok = window.confirm(text('accounts_confirm_delete'));
                                                        if (!ok) return;
                                                        void onRemoveRow(a.id);
                                                    }}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/20 text-indigo-200/60 hover:border-rose-400/40 hover:text-white disabled:opacity-60"
                                                    title={text('delete')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}

                        {!loading && !newDraft && visibleAccounts.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-indigo-200/60">
                                {text('accounts_empty')}
                            </div>
                        ) : null}
                        </div>
                    </div>

                    {isEditMode && dirtyCount > 0 ? (
                        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/65 px-4 py-3 backdrop-blur">
                            <div className="text-[11px] font-medium text-indigo-200/70">
                                {String(text('accounts_unsaved_rows') || '').replace('{count}', String(dirtyCount))}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => void saveAll()}
                                    disabled={anyBusy}
                                    className={`inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 font-semibold text-emerald-50/95 hover:border-emerald-300/40 hover:bg-emerald-500/15 disabled:opacity-60 ${
                                        dirtyCount >= 2 ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-xs'
                                    }`}
                                    title={text('accounts_save_all')}
                                >
                                    {saveAllBusy ? (
                                        <Loader2 className="animate-spin" size={14} />
                                    ) : saveAllSaved ? (
                                        <Check size={14} />
                                    ) : (
                                        <Save size={14} />
                                    )}
                                    {text('accounts_save_all')}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    disabled={anyBusy}
                                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/20 px-3 text-xs font-semibold text-indigo-100/80 hover:border-indigo-400/35 hover:text-white disabled:opacity-60"
                                    title={text('cancel')}
                                >
                                    {text('cancel')}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>

        {isEditMode && appPickerOpenForId && appPickerPos
            ? createPortal(
                  (() => {
                      const currentOwnerId = appPickerOpenForId;
                      const currentAppId = (() => {
                          if (currentOwnerId === 'new') return normalize(newDraft?.app_id);
                          const account = accountById.get(currentOwnerId);
                          const draft = draftById[currentOwnerId] || {};
                          return normalize('app_id' in draft ? (draft as any).app_id : account?.app_id);
                      })();

                      return (
                          <div
                              ref={appPickerRef}
                              className="fixed z-[210] max-h-[320px] overflow-auto rounded-xl border border-white/10 bg-slate-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
                              style={{
                                  top: `${appPickerPos.top}px`,
                                  left: `${appPickerPos.left}px`,
                                  minWidth: `${appPickerPos.minWidth}px`,
                              }}
                          >
                              <button
                                  type="button"
                                  onClick={() => pickAppForOpenPicker(null)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-indigo-100/90 hover:bg-white/5 ${
                                      !currentAppId ? 'bg-white/5' : ''
                                  }`}
                              >
                                  <span className="font-mono">{'—'}</span>
                              </button>
                              <div className="my-1 h-px bg-white/5" />
                              {appsAssignableSorted.map((app) => {
                                  const takenBy = predictedAccountIdByAppId.get(app.id) || null;
                                  const disabled = Boolean(takenBy && takenBy !== currentOwnerId);
                                  const selected = app.id === currentAppId;
                                  return (
                                      <button
                                          key={app.id}
                                          type="button"
                                          disabled={disabled}
                                          onClick={() => pickAppForOpenPicker(app.id)}
                                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                                              disabled
                                                  ? 'cursor-not-allowed text-indigo-200/25'
                                                  : 'text-indigo-100/90 hover:bg-white/5'
                                          } ${selected ? 'bg-white/5' : ''}`}
                                      >
                                          <span className="min-w-0 truncate">{formatAppLabel(app)}</span>
                                      </button>
                                  );
                              })}
                          </div>
                      );
                  })(),
                  document.body
              )
            : null}
        </>
    );
}
