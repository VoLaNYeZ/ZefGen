import { supabase } from '../lib/supabase';
import type { Brand } from '../types/zefgen';

export const fetchBrands = async (userId: string) =>
    supabase
        .from('brands')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

export const createBrand = async (payload: { userId: string; name: string; slug: string }) =>
    supabase
        .from('brands')
        .insert({
            user_id: payload.userId,
            name: payload.name,
            slug: payload.slug,
        })
        .select()
        .single();

export const updateBrand = async (payload: { id: string; userId: string; patch: Partial<Brand> }) =>
    supabase
        .from('brands')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();
