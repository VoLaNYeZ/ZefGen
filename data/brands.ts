import { supabase } from '../lib/supabase';
import type { Brand } from '../types/zefgen';

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
