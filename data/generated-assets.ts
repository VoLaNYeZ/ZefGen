import { supabase } from '../lib/supabase';
import type { GeneratedAsset } from '../types/zefgen';
import { GENERATED_BUCKET } from '../constants/zefgen';

export const fetchGeneratedAssets = async (userId: string) =>
    supabase
        .from('app_generated_assets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

export const createGeneratedAsset = async (payload: Omit<GeneratedAsset, 'id' | 'created_at'> & { user_id: string }) =>
    supabase
        .from('app_generated_assets')
        .insert(payload)
        .select()
        .single();

export const updateGeneratedAsset = async (payload: { id: string; userId: string; patch: Partial<GeneratedAsset> }) =>
    supabase
        .from('app_generated_assets')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const deleteGeneratedAsset = async (payload: { id: string; userId: string }) =>
    supabase
        .from('app_generated_assets')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const deleteGeneratedAssetsByIds = async (payload: { ids: string[]; userId: string }) =>
    supabase
        .from('app_generated_assets')
        .delete()
        .in('id', payload.ids)
        .eq('user_id', payload.userId);

export const uploadGeneratedAsset = async (payload: { path: string; file: File; contentType: string }) =>
    supabase.storage.from(GENERATED_BUCKET).upload(payload.path, payload.file, {
        upsert: true,
        contentType: payload.contentType,
        cacheControl: '3600',
    });

export const removeGeneratedAssets = async (paths: string[]) =>
    supabase.storage.from(GENERATED_BUCKET).remove(paths);
