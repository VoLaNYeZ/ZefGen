import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { AppFormState, AppItem, Brand } from '../types/zefgen';
import { MAX_ACTIVE_APPS } from '../constants/zefgen';
import { createApp, deleteApp, fetchApps, updateApp, updateAppOrder } from '../data/apps';
import { makeUniqueSlug, slugify } from '../utils/slug';

const LAST_APP_BY_BRAND_STORAGE_KEY = 'zefgen.lastAppByBrand';

const readLastAppByBrand = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(LAST_APP_BY_BRAND_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        const result: Record<string, string> = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([brandId, appId]) => {
            const normalizedBrandId = String(brandId || '').trim();
            const normalizedAppId = String(appId || '').trim();
            if (normalizedBrandId && normalizedAppId) {
                result[normalizedBrandId] = normalizedAppId;
            }
        });
        return result;
    } catch {
        return {};
    }
};

const writeLastAppByBrand = (map: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAST_APP_BY_BRAND_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // ignore write failures
    }
};

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedBrandId: string | null;
    selectedAppId: string | null;
    setSelectedAppId: (value: string | null) => void;
    text: (key: TranslationKey) => string;
    onDataError?: (message: string) => void;
};

export const useApps = ({
    session,
    selectedBrand,
    selectedBrandId,
    selectedAppId,
    setSelectedAppId,
    text,
    onDataError,
}: Params) => {
    const [apps, setApps] = useState<AppItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const [appFormOpen, setAppFormOpen] = useState(false);
    const [appForm, setAppForm] = useState<AppFormState>({ name: '', alias: '' });
    const [appFormError, setAppFormError] = useState<string | null>(null);
    const [appFormLoading, setAppFormLoading] = useState(false);
    const [editingAppId, setEditingAppId] = useState<string | null>(null);
    const [isBannedView, setIsBannedView] = useState(false);
    const lastAppIdByBrandRef = useRef<Record<string, string>>({});

    const refresh = useCallback(async () => {
        if (!session) {
            setApps([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        const { data, error } = await fetchApps(session.user.id);
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
        } else {
            setApps((data || []).map((app) => ({ ...app, is_banned: app.is_banned ?? false })));
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setApps([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && apps.length) return;
        refresh();
    }, [session, apps.length, refresh]);

    useEffect(() => {
        lastAppIdByBrandRef.current = readLastAppByBrand();
    }, []);

    const orderedApps = useMemo(() => {
        if (!apps.length) return apps;
        return [...apps].sort((a, b) => {
            const aIndex = a.order_index ?? Number.MAX_SAFE_INTEGER;
            const bIndex = b.order_index ?? Number.MAX_SAFE_INTEGER;
            if (aIndex !== bIndex) return aIndex - bIndex;
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
        });
    }, [apps]);

    const selectedBrandApps = useMemo(
        () => orderedApps.filter((app) => app.brand_id === selectedBrandId),
        [orderedApps, selectedBrandId]
    );

    const { suggestedNewAppAlias, newAppAliasPlaceholder } = useMemo(() => {
        const brandApps = orderedApps.filter((app) => app.brand_id === selectedBrandId);
        const re = /^([a-z0-9][a-z0-9-]*?)-(\d+)$/i;

        const parsed = brandApps
            .map((app) => {
                const m = re.exec(String(app.alias || '').trim());
                if (!m) return null;
                const prefix = String(m[1] || '').toLowerCase();
                const n = Number.parseInt(String(m[2] || ''), 10);
                if (!prefix) return null;
                if (!Number.isFinite(n)) return null;
                const createdAt = app.created_at ? new Date(app.created_at).getTime() : 0;
                return { prefix, n, createdAt };
            })
            .filter(Boolean) as Array<{ prefix: string; n: number; createdAt: number }>;

        let prefix = 'ef';
        if (parsed.length) {
            let latest = parsed[0]!;
            for (const p of parsed) {
                if (p.createdAt > latest.createdAt) latest = p;
            }
            prefix = latest.prefix || prefix;
        }

        let maxN = 0;
        for (const p of parsed) {
            if (p.prefix !== prefix) continue;
            if (p.n > maxN) maxN = p.n;
        }

        const next = maxN > 0 ? maxN + 1 : 1;
        const numStr = String(next).padStart(2, '0');
        const prefixUpper = prefix.toUpperCase();
        return {
            suggestedNewAppAlias: `${prefixUpper}-${numStr}`,
            newAppAliasPlaceholder: `${prefixUpper}-...`,
        };
    }, [orderedApps, selectedBrandId]);

    const bannedAppIdSet = useMemo(
        () => new Set(selectedBrandApps.filter((app) => app.is_banned).map((app) => app.id)),
        [selectedBrandApps]
    );

    const activeApps = useMemo(
        () => selectedBrandApps.filter((app) => !bannedAppIdSet.has(app.id)),
        [selectedBrandApps, bannedAppIdSet]
    );
    const bannedApps = useMemo(
        () => selectedBrandApps.filter((app) => bannedAppIdSet.has(app.id)),
        [selectedBrandApps, bannedAppIdSet]
    );
    const visibleActiveApps = useMemo(
        () => activeApps.slice(0, MAX_ACTIVE_APPS),
        [activeApps]
    );
    const visibleApps = useMemo(
        () => (isBannedView ? bannedApps : visibleActiveApps),
        [isBannedView, bannedApps, visibleActiveApps]
    );
    const canAddApp = activeApps.length < MAX_ACTIVE_APPS;
    const showBannedToggle = bannedApps.length > 0 || !canAddApp;

    useEffect(() => {
        if (!selectedBrandId) {
            setSelectedAppId(null);
            setIsBannedView(false);
            return;
        }

        if (isBannedView && bannedApps.length === 0) {
            setIsBannedView(false);
            return;
        }

        const hasSelected = visibleApps.some((app) => app.id === selectedAppId);
        if (hasSelected) return;

        const rememberedAppId = lastAppIdByBrandRef.current[selectedBrandId];
        if (rememberedAppId && visibleApps.some((app) => app.id === rememberedAppId)) {
            setSelectedAppId(rememberedAppId);
            return;
        }

        setSelectedAppId(visibleApps[0]?.id ?? null);
    }, [selectedBrandId, visibleApps, selectedAppId, isBannedView, bannedApps.length, setSelectedAppId]);

    useEffect(() => {
        if (!selectedBrandId || !selectedAppId) return;
        const selectedApp = apps.find((app) => app.id === selectedAppId);
        if (!selectedApp || selectedApp.brand_id !== selectedBrandId) return;
        if (lastAppIdByBrandRef.current[selectedBrandId] === selectedAppId) return;
        lastAppIdByBrandRef.current = {
            ...lastAppIdByBrandRef.current,
            [selectedBrandId]: selectedAppId,
        };
        writeLastAppByBrand(lastAppIdByBrandRef.current);
    }, [selectedBrandId, selectedAppId, apps]);

    const appAliasPreview = slugify(appForm.alias || appForm.name || '');
    const isEditingBanned = Boolean(editingAppId && bannedAppIdSet.has(editingAppId));

    const openAppForm = (app?: AppItem) => {
        if (app) {
            setEditingAppId(app.id);
            setAppForm({ name: app.name, alias: app.alias });
            setSelectedAppId(app.id);
        } else {
            setEditingAppId(null);
            setAppForm({ name: '', alias: suggestedNewAppAlias });
        }
        setAppFormError(null);
        setAppFormOpen(true);
    };

    const closeAppForm = useCallback(() => {
        setAppFormOpen(false);
        setAppFormError(null);
        setEditingAppId(null);
    }, []);

    const submitAppForm = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!session || !selectedBrand) return;

        const name = appForm.name.trim();
        if (!name) {
            setAppFormError(text('app_name_required'));
            return;
        }

        if (!editingAppId && activeApps.length >= MAX_ACTIVE_APPS) {
            setAppFormError(text('max_active_apps'));
            return;
        }

        const baseAlias = slugify(appForm.alias || name);
        const existingAliases = apps
            .filter((app) => app.brand_id === selectedBrand.id && app.id !== editingAppId)
            .map((app) => app.alias);
        const alias = makeUniqueSlug(baseAlias, existingAliases);

        setAppFormLoading(true);
        setAppFormError(null);

        if (editingAppId) {
            const { data, error } = await updateApp({
                id: editingAppId,
                userId: session.user.id,
                patch: { name, alias },
            });
            if (error) {
                setAppFormError(error.message);
                setAppFormLoading(false);
                return;
            }
            if (data) {
                setApps((prev) =>
                    prev.map((app) =>
                        app.id === editingAppId
                            ? { ...app, ...data, is_banned: data.is_banned ?? app.is_banned ?? false }
                            : app
                    )
                );
                setSelectedAppId(data.id);
            }
        } else {
            const { data, error } = await createApp({
                userId: session.user.id,
                brandId: selectedBrand.id,
                name,
                alias,
                orderIndex: selectedBrandApps.length,
            });
            if (error) {
                setAppFormError(error.message);
                setAppFormLoading(false);
                return;
            }
            if (data) {
                setApps((prev) => [...prev, { ...data, is_banned: data.is_banned ?? false }]);
                setSelectedAppId(data.id);
            }
        }

        setAppFormLoading(false);
        closeAppForm();
    };

    const handleDeleteApp = async () => {
        if (!session || !editingAppId || !selectedBrand) return;
        const confirmed = window.confirm(text('confirm_delete_app'));
        if (!confirmed) return;
        setAppFormLoading(true);
        setAppFormError(null);
        const { error } = await deleteApp({ id: editingAppId, userId: session.user.id });
        if (error) {
            setAppFormError(error.message);
            setAppFormLoading(false);
            return;
        }
        setApps((prev) => prev.filter((app) => app.id !== editingAppId));
        const remaining = apps.filter((app) => app.brand_id === selectedBrand.id && app.id !== editingAppId);
        setSelectedAppId(remaining[0]?.id ?? null);
        setAppFormLoading(false);
        closeAppForm();
    };

    const updateAppBanStatus = async (appId: string, isBanned: boolean) => {
        if (!session) return false;
        setAppFormError(null);
        const { data, error } = await updateApp({
            id: appId,
            userId: session.user.id,
            patch: { is_banned: isBanned },
        });
        if (error) {
            setAppFormError(error.message);
            return false;
        }
        if (data) {
            setApps((prev) =>
                prev.map((app) =>
                    app.id === appId ? { ...app, is_banned: data.is_banned ?? isBanned } : app
                )
            );
        }
        return true;
    };

    const handleBanApp = async (appId: string) => {
        const ok = await updateAppBanStatus(appId, true);
        if (!ok) return;
        setIsBannedView(true);
        setSelectedAppId(appId);
    };

    const handleUnbanApp = async (appId: string) => {
        const wasLastBanned = bannedApps.length === 1 && bannedApps[0]?.id === appId;
        const ok = await updateAppBanStatus(appId, false);
        if (!ok) return;
        if (isBannedView && wasLastBanned) {
            setIsBannedView(false);
            setSelectedAppId(visibleActiveApps[0]?.id ?? null);
        }
    };

    const patchApp = useCallback(
        async (appId: string, patch: Partial<AppItem>): Promise<AppItem | null> => {
            if (!session) return null;
            setAppFormError(null);
            const { data, error } = await updateApp({
                id: appId,
                userId: session.user.id,
                patch,
            });
            if (error) {
                setAppFormError(error.message);
                onDataError?.(error.message);
                return null;
            }
            if (!data) return null;
            setApps((prev) =>
                prev.map((app) =>
                    app.id === appId
                        ? { ...app, ...data, is_banned: data.is_banned ?? app.is_banned ?? false }
                        : app
                )
            );
            return {
                ...data,
                is_banned: data.is_banned ?? false,
            };
        },
        [onDataError, session]
    );

    const reorderBrandApps = async (sourceId: string, targetId: string) => {
        if (!selectedBrandId || sourceId === targetId) return;
        const brandApps = orderedApps.filter((app) => app.brand_id === selectedBrandId);
        const sourceIndex = brandApps.findIndex((app) => app.id === sourceId);
        const targetIndex = brandApps.findIndex((app) => app.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return;

        const nextBrandApps = [...brandApps];
        const [moved] = nextBrandApps.splice(sourceIndex, 1);
        nextBrandApps.splice(targetIndex, 0, moved);
        const orderMap = new Map(nextBrandApps.map((app, index) => [app.id, index]));

        setApps((prev) =>
            prev.map((app) =>
                app.brand_id === selectedBrandId && orderMap.has(app.id)
                    ? { ...app, order_index: orderMap.get(app.id) ?? app.order_index ?? 0 }
                    : app
            )
        );

        if (!session) return;
        const updates = nextBrandApps.map((app, index) =>
            updateAppOrder({ id: app.id, userId: session.user.id, orderIndex: index })
        );
        const results = await Promise.all(updates);
        const firstError = results.find((result) => result.error)?.error;
        if (firstError) {
            setAppFormError(firstError.message);
        }
    };

    return {
        apps,
        loading,
        error,
        refresh,
        orderedApps,
        selectedBrandApps,
        activeApps,
        bannedApps,
        visibleActiveApps,
        visibleApps,
        canAddApp,
        showBannedToggle,
        appFormOpen,
        appForm,
        appFormError,
        appFormLoading,
        editingAppId,
        appAliasPreview,
        newAppAliasPlaceholder,
        isEditingBanned,
        isBannedView,
        setIsBannedView,
        openAppForm,
        closeAppForm,
        submitAppForm,
        handleDeleteApp,
        handleBanApp,
        handleUnbanApp,
        patchApp,
        reorderBrandApps,
        setAppForm,
        setAppFormOpen,
        setEditingAppId,
        setAppFormError,
    };
};
