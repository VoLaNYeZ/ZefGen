import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { Brand, BrandFormState } from '../types/zefgen';
import { arrayMove } from '@dnd-kit/sortable';
import { createBrand, fetchBrands, updateBrand } from '../data/brands';
import { makeUniqueSlug, slugify } from '../utils/slug';

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
            setBrands(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

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

    const submitBrandForm = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!session) return;

        const name = brandForm.name.trim();
        if (!name) {
            setBrandFormError(text('brand_name_required'));
            return;
        }

        setBrandFormLoading(true);
        setBrandFormError(null);

        const baseSlug = slugify(name);
        const existingSlugs = brands
            .filter((brand) => brand.id !== editingBrandId)
            .map((brand) => brand.slug);
        const slug = makeUniqueSlug(baseSlug, existingSlugs);

        if (editingBrandId) {
            const original = originalEditingBrandRef.current;
            if (original && original.id === editingBrandId && name === original.name && slug === original.slug) {
                setBrandFormLoading(false);
                closeBrandForm();
                return;
            }
            const { data, error } = await updateBrand({
                id: editingBrandId,
                userId: session.user.id,
                patch: { name, slug },
            });
            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return;
            }
            if (data) {
                setBrands((prev) => prev.map((brand) => (brand.id === editingBrandId ? data : brand)));
                originalEditingBrandRef.current = { id: data.id, name: data.name, slug: data.slug };
            }
        } else {
            const nextIndex =
                brands.reduce((max, b) => Math.max(max, Number(b.order_index ?? -1)), -1) + 1;
            const { data, error } = await createBrand({
                userId: session.user.id,
                name,
                slug,
                orderIndex: nextIndex,
            });
            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return;
            }
            if (data) {
                setBrands((prev) => [...prev, data]);
                setSelectedBrandId(data.id);
            }
        }

        setBrandFormLoading(false);
        closeBrandForm();
    };

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
                setBrands((prev) => prev.map((b) => (b.id === data.id ? data : b)));
            }
        },
        [session]
    );

    const reorderBrands = useCallback(
        async (sourceId: string, targetId: string) => {
            if (!session) return;
            if (!sourceId || !targetId || sourceId === targetId) return;
            const fromIndex = brands.findIndex((b) => b.id === sourceId);
            const toIndex = brands.findIndex((b) => b.id === targetId);
            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

            const nextBrands = arrayMove(brands, fromIndex, toIndex).map((b, idx) => ({
                ...b,
                order_index: idx,
            }));

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
        brandSlugPreview,
        openBrandForm,
        submitBrandForm,
        setBrandForm,
        setBrandFormOpen,
        closeBrandForm,
        patchBrand,
        reorderBrands,
    };
};
