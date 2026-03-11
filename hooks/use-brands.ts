import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { Brand, BrandFormState } from '../types/zefgen';
import { arrayMove } from '@dnd-kit/sortable';
import { createBrand, ensureNoBrand, fetchBrands, updateBrand } from '../data/brands';
import { makeUniqueSlug, slugify } from '../utils/slug';
import { isNoBrand } from '../utils/no-brand';

type Params = {
    session: Session | null;
    text: (key: TranslationKey) => string;
    setSelectedBrandId: (value: string | null) => void;
    onDataError?: (message: string) => void;
};

export const useBrands = ({ session, text, setSelectedBrandId, onDataError }: Params) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const [brandFormOpen, setBrandFormOpen] = useState(false);
    const [brandForm, setBrandForm] = useState<BrandFormState>({ name: '' });
    const [brandFormError, setBrandFormError] = useState<string | null>(null);
    const [brandFormLoading, setBrandFormLoading] = useState(false);
    const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
    const originalEditingBrandRef = useRef<{ id: string; name: string; slug: string } | null>(null);

    const brandSlugPreview = useMemo(() => slugify(brandForm.name || ''), [brandForm.name]);
    const normalizedBrandName = String(brandForm.name || '').trim();
    const brandFormDirty = useMemo(() => {
        if (!brandFormOpen) return false;
        if (!editingBrandId) return normalizedBrandName.length > 0;
        const original = originalEditingBrandRef.current;
        if (!original || original.id !== editingBrandId) return normalizedBrandName.length > 0;
        return normalizedBrandName !== original.name || brandSlugPreview !== original.slug;
    }, [brandFormOpen, editingBrandId, normalizedBrandName, brandSlugPreview]);
    const isEditingExistingBrandForm = Boolean(brandFormOpen && editingBrandId);
    const hasMeaningfulNewBrandDraft = Boolean(brandFormOpen && !editingBrandId && normalizedBrandName.length > 0);

    const sortBrands = useCallback((items: Brand[]) => {
        return [...items].sort((a, b) => {
            const ai = Number(a.order_index ?? Number.MAX_SAFE_INTEGER);
            const bi = Number(b.order_index ?? Number.MAX_SAFE_INTEGER);
            if (ai !== bi) return ai - bi;
            const at = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
            return at - bt;
        });
    }, []);

    const refresh = useCallback(async () => {
        if (!session) {
            setBrands([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }

        setLoading(true);
        setError(null);
        const { data, error } = await fetchBrands(session.user.id);
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
        } else {
            let nextBrands = sortBrands(data || []);
            const ensured = await ensureNoBrand({
                userId: session.user.id,
                existingBrands: nextBrands,
            });
            if (ensured.error) {
                onDataError?.(ensured.error.message || String(ensured.error));
            } else if (ensured.data && !nextBrands.some((brand) => brand.id === ensured.data.id)) {
                nextBrands = sortBrands([...nextBrands, ensured.data]);
            }
            setBrands(nextBrands);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError, sortBrands]);

    useEffect(() => {
        if (!session) {
            setBrands([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && brands.length) return;
        refresh();
    }, [session, brands.length, refresh]);

    const openBrandForm = (brand?: Brand) => {
        if (isNoBrand(brand)) return;
        if (brand) {
            setEditingBrandId(brand.id);
            setBrandForm({ name: brand.name });
            originalEditingBrandRef.current = { id: brand.id, name: brand.name, slug: brand.slug };
        } else {
            setEditingBrandId(null);
            setBrandForm({ name: '' });
            originalEditingBrandRef.current = null;
        }
        setBrandFormError(null);
        setBrandFormOpen(true);
    };

    const closeBrandForm = useCallback(() => {
        setBrandFormOpen(false);
        setBrandFormError(null);
        setEditingBrandId(null);
        originalEditingBrandRef.current = null;
    }, []);

    const submitBrandForm = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!session) return false;

        const name = normalizedBrandName;
        if (!name) {
            setBrandFormError(text('brand_name_required'));
            return false;
        }

        setBrandFormLoading(true);
        setBrandFormError(null);

        const baseSlug = slugify(name);
        const existingSlugs = brands
            .filter((brand) => brand.id !== editingBrandId)
            .map((brand) => brand.slug);
        const slug = makeUniqueSlug(baseSlug, existingSlugs);

        if (editingBrandId) {
            const editingBrand = brands.find((brand) => brand.id === editingBrandId) || null;
            if (isNoBrand(editingBrand)) {
                setBrandFormLoading(false);
                setBrandFormError(text('no_brand_edit_forbidden'));
                return false;
            }
            const original = originalEditingBrandRef.current;
            if (original && original.id === editingBrandId && name === original.name && slug === original.slug) {
                setBrandFormLoading(false);
                closeBrandForm();
                return true;
            }
            const { data, error } = await updateBrand({
                id: editingBrandId,
                userId: session.user.id,
                patch: { name, slug },
            });
            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return false;
            }
            if (data) {
                setBrands((prev) => prev.map((brand) => (brand.id === editingBrandId ? data : brand)));
                originalEditingBrandRef.current = { id: data.id, name: data.name, slug: data.slug };
            }
        } else {
            const regularBrands = brands.filter((brand) => !isNoBrand(brand));
            const nextIndex =
                regularBrands.reduce((max, b) => Math.max(max, Number(b.order_index ?? -1)), -1) + 1;
            const { data, error } = await createBrand({
                userId: session.user.id,
                name,
                slug,
                orderIndex: nextIndex,
            });
            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return false;
            }
            if (data) {
                setBrands((prev) => sortBrands([...prev, data]));
                setSelectedBrandId(data.id);
            }
        }

        setBrandFormLoading(false);
        closeBrandForm();
        return true;
    };

    const getBrandSwitchBlockReason = useCallback(() => {
        if (!brandFormOpen) return null;
        if (brandFormLoading) return text('finish_editing_brand_first');
        if (editingBrandId) {
            if (!normalizedBrandName) return text('brand_name_required');
            return null;
        }
        if (hasMeaningfulNewBrandDraft) return text('finish_creating_brand_first');
        return null;
    }, [
        brandFormLoading,
        brandFormOpen,
        editingBrandId,
        hasMeaningfulNewBrandDraft,
        normalizedBrandName,
        text,
    ]);

    const saveCurrentEditForSwitch = useCallback(async () => {
        if (!brandFormOpen) return true;
        if (brandFormLoading) return false;
        if (!editingBrandId) {
            if (!hasMeaningfulNewBrandDraft) {
                closeBrandForm();
                return true;
            }
            return false;
        }
        if (!brandFormDirty) {
            closeBrandForm();
            return true;
        }
        return await submitBrandForm();
    }, [
        brandFormDirty,
        brandFormLoading,
        brandFormOpen,
        closeBrandForm,
        editingBrandId,
        hasMeaningfulNewBrandDraft,
        submitBrandForm,
    ]);

    const patchBrand = useCallback(
        async (brandId: string, patch: Partial<Brand>) => {
            if (!session) return;
            const { data, error } = await updateBrand({
                id: brandId,
                userId: session.user.id,
                patch,
            });
            if (error) throw error;
            if (data) {
                setBrands((prev) => sortBrands(prev.map((b) => (b.id === data.id ? data : b))));
            }
        },
        [session, sortBrands]
    );

    const reorderBrands = useCallback(
        async (sourceId: string, targetId: string) => {
            if (!session) return;
            if (!sourceId || !targetId || sourceId === targetId) return;
            const regularBrands = brands.filter((brand) => !isNoBrand(brand));
            const fromIndex = regularBrands.findIndex((b) => b.id === sourceId);
            const toIndex = regularBrands.findIndex((b) => b.id === targetId);
            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

            const movedRegularBrands = arrayMove(regularBrands, fromIndex, toIndex).map((b, idx) => ({
                ...b,
                order_index: idx,
            }));
            const noBrand = brands.find((brand) => isNoBrand(brand)) || null;
            const nextBrands = noBrand
                ? [...movedRegularBrands, { ...noBrand, order_index: movedRegularBrands.length }]
                : movedRegularBrands;

            setBrands(nextBrands);

            const updates = nextBrands.map((b, idx) =>
                updateBrand({ id: b.id, userId: session.user.id, patch: { order_index: idx } as any })
            );
            const results = await Promise.all(updates);
            const firstError = results.find((r) => r.error)?.error;
            if (firstError) {
                // Best-effort: surface error and refetch to reconcile.
                onDataError?.(firstError.message);
                await refresh();
            }
        },
        [session, brands, onDataError, refresh]
    );

    return {
        brands,
        loading,
        error,
        refresh,
        brandFormOpen,
        brandForm,
        brandFormError,
        brandFormLoading,
        editingBrandId,
        isEditingExistingBrandForm,
        isDirty: brandFormDirty,
        hasMeaningfulNewBrandDraft,
        brandSlugPreview,
        openBrandForm,
        submitBrandForm,
        saveCurrentEditForSwitch,
        getBrandSwitchBlockReason,
        setBrandForm,
        setBrandFormOpen,
        closeBrandForm,
        patchBrand,
        reorderBrands,
    };
};
