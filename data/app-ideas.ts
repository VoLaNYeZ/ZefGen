import { supabase } from '../lib/supabase';
import type { AppIdea } from '../types/zefgen';

const IDEA_SELECT = 'id, user_id, category_id, description, updated_at, created_at';
const CATEGORY_SELECT = 'id, slug, name, order_index, created_at';

export const fetchIdeaCategories = async () =>
    supabase
        .from('app_idea_categories')
        .select(CATEGORY_SELECT)
        .order('order_index', { ascending: true })
        .order('name', { ascending: true });

export const fetchAppIdeas = async (userId: string) =>
    supabase
        .from('app_ideas')
        .select(IDEA_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

export const createAppIdea = async (payload: {
    userId: string;
    row: Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('app_ideas')
        .insert({
            user_id: payload.userId,
            updated_at: nowIso,
            ...payload.row,
        })
        .select(IDEA_SELECT)
        .single();
};

export const updateAppIdea = async (payload: {
    userId: string;
    id: string;
    patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('app_ideas')
        .update({ ...payload.patch, updated_at: nowIso })
        .eq('user_id', payload.userId)
        .eq('id', payload.id)
        .select(IDEA_SELECT)
        .single();
};

export const deleteAppIdea = async (payload: { userId: string; id: string }) =>
    supabase
        .from('app_ideas')
        .delete()
        .eq('user_id', payload.userId)
        .eq('id', payload.id);
