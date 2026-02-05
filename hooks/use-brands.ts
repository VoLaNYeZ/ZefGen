import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { Brand, BrandFormState } from '../types/zefgen';
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
        } else {
            setEditingBrandId(null);
            setBrandForm({ name: '' });
        }
        setBrandFormError(null);
        setBrandFormOpen(true);
    };

    const submitBrandForm = async (event: React.FormEvent) => {
        event.preventDefault();
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
            }
        } else {
            const { data, error } = await createBrand({
                userId: session.user.id,
                name,
                slug,
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
        setBrandFormOpen(false);
    };

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
    };
};
