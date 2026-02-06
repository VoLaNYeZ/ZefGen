import { supabase } from '../lib/supabase';
import type { BrandReference } from '../types/zefgen';
import { BRAND_BUCKET } from '../constants/zefgen';

export const fetchBrandReferences = async (userId: string) =>
    supabase
        .from('brand_references')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

export const createBrandReference = async (payload: {
    userId: string;
    brandId: string;
    kind: BrandReference['kind'];
    imagePath: string;
    prompt?: string;
    orderIndex: number;
}) =>
    supabase
        .from('brand_references')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            kind: payload.kind,
            image_path: payload.imagePath,
            prompt: payload.prompt ?? '',
            order_index: payload.orderIndex,
        })
        .select()
        .single();

export const updateBrandReference = async (payload: { id: string; userId: string; patch: Partial<BrandReference> }) =>
    supabase
        .from('brand_references')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const deleteBrandReference = async (payload: { id: string; userId: string }) =>
    supabase
        .from('brand_references')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const updateBrandReferenceOrder = async (payload: { id: string; userId: string; orderIndex: number }) =>
    supabase
        .from('brand_references')
        .update({ order_index: payload.orderIndex })
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const uploadBrandReferenceImage = async (payload: {
    path: string;
    file: File;
    contentType: string;
}) =>
    supabase.storage.from(BRAND_BUCKET).upload(payload.path, payload.file, {
        upsert: true,
        contentType: payload.contentType,
        // Brand reference paths are immutable (unique ids in filename), so we can cache aggressively.
        cacheControl: '31536000',
    });

export const removeBrandReferenceImage = async (path: string) =>
    supabase.storage.from(BRAND_BUCKET).remove([path]);
