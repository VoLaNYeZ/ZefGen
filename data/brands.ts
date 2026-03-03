import { supabase } from '../lib/supabase';
import type { Brand } from '../types/zefgen';
import { makeUniqueSlug } from '../utils/slug';
import { isNoBrand } from '../utils/no-brand';

export const NO_BRAND_NAME = 'No Brand';
export const NO_BRAND_BASE_SLUG = 'no-brand';

export const fetchBrands = async (userId: string) => {
    const res = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });
    // Defensive: if migration hasn't been applied yet, fall back to created_at ordering.
    if (res.error && /order_index/i.test(res.error.message || '')) {
        return supabase
            .from('brands')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
    }
    return res;
};

export const createBrand = async (payload: { userId: string; name: string; slug: string; orderIndex: number }) => {
    const insertPayload: any = {
        user_id: payload.userId,
        name: payload.name,
        slug: payload.slug,
        order_index: payload.orderIndex,
    };
    const res = await supabase.from('brands').insert(insertPayload).select().single();
    // Defensive: if migration hasn't been applied yet, retry without order_index.
    if (res.error && /order_index/i.test(res.error.message || '')) {
        return supabase
            .from('brands')
            .insert({
                user_id: payload.userId,
                name: payload.name,
                slug: payload.slug,
            })
            .select()
            .single();
    }
    return res;
};

export const updateBrand = async (payload: { id: string; userId: string; patch: Partial<Brand> }) =>
    supabase
        .from('brands')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const ensureNoBrand = async (payload: { userId: string; existingBrands: Brand[] }) => {
    const existingNoBrand = payload.existingBrands.find((brand) => isNoBrand(brand)) || null;
    if (existingNoBrand) {
        // Self-heal legacy rows where "no-brand" exists but the boolean flag is still false.
        if (!existingNoBrand.is_no_brand) {
            const promoted = await supabase
                .from('brands')
                .update({ is_no_brand: true } as any)
                .eq('id', existingNoBrand.id)
                .eq('user_id', payload.userId)
                .select()
                .single();
            if (!promoted.error && promoted.data) {
                return { data: promoted.data as Brand, error: null as any, created: false };
            }
            if (promoted.error && !/is_no_brand/i.test(String(promoted.error.message || ''))) {
                return { data: existingNoBrand, error: promoted.error, created: false };
            }
        }
        return { data: existingNoBrand, error: null as any, created: false };
    }

    const existingSlugs = payload.existingBrands.map((brand) => String(brand.slug || ''));
    const slug = makeUniqueSlug(NO_BRAND_BASE_SLUG, existingSlugs);
    const nextOrderIndex =
        payload.existingBrands.reduce((max, brand) => Math.max(max, Number(brand.order_index ?? -1)), -1) + 1;

    const insertPayload: any = {
        user_id: payload.userId,
        name: NO_BRAND_NAME,
        slug,
        order_index: nextOrderIndex,
        is_no_brand: true,
    };

    const res = await supabase.from('brands').insert(insertPayload).select().single();
    if (!res.error) {
        return { data: res.data as Brand, error: null as any, created: Boolean(res.data) };
    }

    // Defensive fallback for environments where is_no_brand column migration isn't applied yet.
    if (/is_no_brand/i.test(String(res.error?.message || ''))) {
        const fallback = await supabase
            .from('brands')
            .insert({
                user_id: payload.userId,
                name: NO_BRAND_NAME,
                slug,
                order_index: nextOrderIndex,
            })
            .select()
            .single();
        return { data: fallback.data as Brand, error: fallback.error, created: Boolean(fallback.data) };
    }

    return { data: null as any, error: res.error, created: false };
};
