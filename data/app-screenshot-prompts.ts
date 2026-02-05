import { supabase } from '../lib/supabase';
import type { AppScreenshotPrompt } from '../types/zefgen';

export const fetchAppScreenshotPrompts = async (payload: {
    userId: string;
    brandId: string;
    appId: string;
}) =>
    supabase
        .from('app_screenshot_prompts')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('brand_id', payload.brandId)
        .eq('app_id', payload.appId)
        .order('updated_at', { ascending: false });

export const upsertAppScreenshotPrompts = async (payload: {
    rows: Array<Omit<AppScreenshotPrompt, 'id' | 'updated_at'>>;
}) =>
    supabase
        .from('app_screenshot_prompts')
        .upsert(
            payload.rows.map((row) => ({
                ...row,
                updated_at: new Date().toISOString(),
            })),
            { onConflict: 'app_id,brand_reference_id' }
        )
        .select();

export const deleteAppScreenshotPrompts = async (payload: {
    userId: string;
    appId: string;
    refIds: string[];
}) =>
    supabase
        .from('app_screenshot_prompts')
        .delete()
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .in('brand_reference_id', payload.refIds);
