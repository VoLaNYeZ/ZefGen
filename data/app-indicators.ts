import { supabase } from '../lib/supabase';

// Lightweight app-level indicators used for Sidebar brand summaries.
// This keeps UI decoupled from the heavier generation hooks.

export const fetchAllScreenshotSetCounts = async (userId: string) =>
    supabase
        .from('app_screenshot_sets')
        .select('app_id')
        .eq('user_id', userId);

export const fetchAllExportStatuses = async (userId: string) =>
    supabase
        .from('app_export_status')
        .select('app_id,is_completed')
        .eq('user_id', userId);

