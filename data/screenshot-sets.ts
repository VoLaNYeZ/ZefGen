import { supabase } from '../lib/supabase';
import type { AppScreenshotSet } from '../types/zefgen';

export const fetchScreenshotSets = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('app_screenshot_sets')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

export const createScreenshotSet = async (payload: Omit<AppScreenshotSet, 'id' | 'created_at'> & { user_id: string }) =>
    supabase
        .from('app_screenshot_sets')
        .insert(payload)
        .select()
        .single();

export const updateScreenshotSet = async (payload: { id: string; userId: string; patch: Partial<AppScreenshotSet> }) =>
    supabase
        .from('app_screenshot_sets')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const deleteScreenshotSet = async (payload: { id: string; userId: string }) =>
    supabase
        .from('app_screenshot_sets')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);
