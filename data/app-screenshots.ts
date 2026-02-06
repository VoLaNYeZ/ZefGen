import { supabase } from '../lib/supabase';
import type { AppScreenshot } from '../types/zefgen';
import { APP_SCREENSHOT_BUCKET } from '../constants/zefgen';

export const fetchAppScreenshots = async (userId: string) =>
    supabase
        .from('app_screenshots')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

export const createAppScreenshot = async (payload: {
    userId: string;
    brandId: string;
    appId: string;
    imagePath: string;
    orderIndex: number;
}) =>
    supabase
        .from('app_screenshots')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            app_id: payload.appId,
            image_path: payload.imagePath,
            order_index: payload.orderIndex,
        })
        .select()
        .single();

export const updateAppScreenshot = async (payload: { id: string; userId: string; patch: Partial<AppScreenshot> }) =>
    supabase
        .from('app_screenshots')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('user_id', payload.userId)
        .select()
        .single();

export const deleteAppScreenshot = async (payload: { id: string; userId: string }) =>
    supabase
        .from('app_screenshots')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const updateAppScreenshotOrder = async (payload: { id: string; userId: string; orderIndex: number }) =>
    supabase
        .from('app_screenshots')
        .update({ order_index: payload.orderIndex })
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const uploadAppScreenshotImage = async (payload: { path: string; file: File; contentType: string }) =>
    supabase.storage.from(APP_SCREENSHOT_BUCKET).upload(payload.path, payload.file, {
        upsert: true,
        contentType: payload.contentType,
        // App screenshot paths are immutable (unique ids in filename), so we can cache aggressively.
        cacheControl: '31536000',
    });

export const removeAppScreenshotImage = async (path: string) =>
    supabase.storage.from(APP_SCREENSHOT_BUCKET).remove([path]);
