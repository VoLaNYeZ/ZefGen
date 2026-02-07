import { supabase } from '../lib/supabase';
import type { AssetPick } from '../types/zefgen';

export const fetchAssetPicks = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('app_asset_picks')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .order('created_at', { ascending: true });

export const setIconPick = async (payload: {
    userId: string;
    brandId: string;
    appId: string;
    generatedAssetId: string;
}) => {
    // Supabase JS doesn't support ON CONFLICT with partial unique indexes cleanly; keep it simple:
    // remove any previous icon pick then insert the new one.
    const del = await supabase
        .from('app_asset_picks')
        .delete()
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .eq('kind', 'icon');
    if (del.error) return del as any;

    return supabase
        .from('app_asset_picks')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            app_id: payload.appId,
            kind: 'icon',
            screenshot_set_id: null,
            slot_index: null,
            generated_asset_id: payload.generatedAssetId,
        } satisfies Partial<AssetPick>)
        .select()
        .single();
};

export const setScreenshotPick = async (payload: {
    userId: string;
    brandId: string;
    appId: string;
    screenshotSetId: string;
    slotIndex: number;
    generatedAssetId: string;
}) => {
    const del = await supabase
        .from('app_asset_picks')
        .delete()
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .eq('kind', 'screenshot')
        .eq('screenshot_set_id', payload.screenshotSetId)
        .eq('slot_index', payload.slotIndex);
    if (del.error) return del as any;

    return supabase
        .from('app_asset_picks')
        .insert({
            user_id: payload.userId,
            brand_id: payload.brandId,
            app_id: payload.appId,
            kind: 'screenshot',
            screenshot_set_id: payload.screenshotSetId,
            slot_index: payload.slotIndex,
            generated_asset_id: payload.generatedAssetId,
        } satisfies Partial<AssetPick>)
        .select()
        .single();
};

export const deletePickById = async (payload: { id: string; userId: string }) =>
    supabase
        .from('app_asset_picks')
        .delete()
        .eq('id', payload.id)
        .eq('user_id', payload.userId);

