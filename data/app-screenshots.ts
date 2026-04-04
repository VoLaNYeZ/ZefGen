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
    sourceKind?: 'upload' | 'runner';
    artifactId?: string | null;
    importedFromJobId?: string | null;
    captureVariant?: 'render' | 'simulator' | null;
    theme?: string | null;
    viewport?: string | null;
    targetId?: string | null;
}) =>
    supabase
        .from('app_screenshots')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            app_id: payload.appId,
            image_path: payload.imagePath,
            order_index: payload.orderIndex,
            source_kind: payload.sourceKind ?? 'upload',
            artifact_id: payload.artifactId ?? null,
            imported_from_job_id: payload.importedFromJobId ?? null,
            capture_variant: payload.captureVariant ?? null,
            theme: payload.theme ?? null,
            viewport: payload.viewport ?? null,
            target_id: payload.targetId ?? null,
        })
        .select()
        .single();

export const createAppScreenshotsBatch = async (
    payload: {
        userId: string;
        brandId: string;
        appId: string;
        imagePath: string;
        orderIndex: number;
        sourceKind?: 'upload' | 'runner';
        artifactId?: string | null;
        importedFromJobId?: string | null;
        captureVariant?: 'render' | 'simulator' | null;
        theme?: string | null;
        viewport?: string | null;
        targetId?: string | null;
    }[]
) =>
    supabase
        .from('app_screenshots')
        .insert(
            payload.map((row) => ({
                user_id: row.userId,
                brand_id: row.brandId,
                app_id: row.appId,
                image_path: row.imagePath,
                order_index: row.orderIndex,
                source_kind: row.sourceKind ?? 'upload',
                artifact_id: row.artifactId ?? null,
                imported_from_job_id: row.importedFromJobId ?? null,
                capture_variant: row.captureVariant ?? null,
                theme: row.theme ?? null,
                viewport: row.viewport ?? null,
                target_id: row.targetId ?? null,
            }))
        )
        .select('*');

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

export const deleteAppScreenshotsByIds = async (payload: { ids: string[]; userId: string }) =>
    supabase
        .from('app_screenshots')
        .delete()
        .eq('user_id', payload.userId)
        .in('id', payload.ids);

export const updateAppScreenshotOrder = async (payload: { id: string; userId: string; orderIndex: number }) =>
    supabase
        .from('app_screenshots')
        .update({ order_index: payload.orderIndex })
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

export const fetchAppScreenshotArtifactIgnores = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('app_screenshot_artifact_ignores')
        .select('artifact_id')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId);

export const createAppScreenshotArtifactIgnore = async (payload: { userId: string; appId: string; artifactId: string }) =>
    supabase
        .from('app_screenshot_artifact_ignores')
        .insert({
            user_id: payload.userId,
            app_id: payload.appId,
            artifact_id: payload.artifactId,
        });

export const uploadAppScreenshotImage = async (payload: { path: string; file: File; contentType: string }) =>
    supabase.storage.from(APP_SCREENSHOT_BUCKET).upload(payload.path, payload.file, {
        upsert: true,
        contentType: payload.contentType,
        // App screenshot paths are immutable (unique ids in filename), so we can cache aggressively.
        cacheControl: '31536000',
    });

export const removeAppScreenshotImage = async (path: string) =>
    supabase.storage.from(APP_SCREENSHOT_BUCKET).remove([path]);
