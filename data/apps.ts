import { supabase } from '../lib/supabase';
import type { AppItem } from '../types/zefgen';

export const fetchApps = async (userId: string) =>
    supabase
        .from('apps')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

export const createApp = async (payload: {
    userId: string;
    brandId: string;
    name: string;
    alias: string;
    orderIndex: number;
}) =>
    supabase
        .from('apps')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            name: payload.name,
            alias: payload.alias,
            order_index: payload.orderIndex,
        })
        .select()
        .single();

export const updateApp = async (payload: { id: string; userId: string; patch: Partial<AppItem> }) =>
    supabase
        .from('apps')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const deleteApp = async (payload: { id: string; userId: string }) =>
    supabase
        .from('apps')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const updateAppOrder = async (payload: { id: string; userId: string; orderIndex: number }) =>
    supabase
        .from('apps')
        .update({ order_index: payload.orderIndex })
        .eq('id', payload.id)
        .eq('user_id', payload.userId);
