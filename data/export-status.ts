import { supabase } from '../lib/supabase';
import type { AppExportStatus } from '../types/zefgen';

export const fetchExportStatus = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('app_export_status')
        .select('*')
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .maybeSingle();

export const upsertExportStatus = async (payload: {
    app_id: string;
    user_id: string;
    brand_id: string;
    is_completed: boolean;
    completed_at: string | null;
}) =>
    supabase
        .from('app_export_status')
        .upsert(
            {
                ...payload,
                updated_at: new Date().toISOString(),
            } satisfies Partial<AppExportStatus>,
            { onConflict: 'app_id' }
        )
        .select()
        .single();

