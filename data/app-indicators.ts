import { supabase } from '../lib/supabase';

// Lightweight app-level indicators used for Sidebar brand summaries.
// This keeps UI decoupled from the heavier generation hooks.

export const fetchAllAppstoreReviewStates = async (userId: string) =>
    supabase
        .from('appstore_review_webhooks')
        .select('app_id,latest_review_state')
        .eq('user_id', userId);
