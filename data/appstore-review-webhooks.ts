import { supabase } from '../lib/supabase';
import type { AppstoreReviewEvent, AppstoreReviewWebhook } from '../types/zefgen';

const WEBHOOK_SELECT = [
    'app_id',
    'user_id',
    'public_token',
    'secret',
    'public_subdomain',
    'public_page_published_at',
    'key_mode',
    'key_id',
    'issuer_id',
    'public_webhook_url',
    'asc_app_id',
    'asc_app_name',
    'asc_bundle_id',
    'apple_webhook_id',
    'latest_event_type',
    'latest_review_state',
    'latest_previous_state',
    'latest_event_at',
    'last_snapshot_at',
    'last_delivery_at',
    'last_delivery_status',
    'last_error',
    'last_sync_at',
    'last_sync_status',
    'last_sync_error',
    'created_at',
    'updated_at',
].join(', ');

const EVENT_SELECT = [
    'id',
    'app_id',
    'user_id',
    'event_type',
    'payload_type',
    'state_from',
    'state_to',
    'event_at',
    'delivery_status',
    'raw_payload',
    'created_at',
].join(', ');

export const fetchAppstoreReviewWebhook = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('appstore_review_webhooks')
        .select(WEBHOOK_SELECT)
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .maybeSingle();

export const ensureAppstoreReviewWebhook = async (payload: { userId: string; appId: string }) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('appstore_review_webhooks')
        .upsert(
            {
                app_id: payload.appId,
                user_id: payload.userId,
                updated_at: nowIso,
            },
            { onConflict: 'app_id' }
        )
        .select(WEBHOOK_SELECT)
        .single();
};

export const updateAppstoreReviewWebhook = async (payload: {
    userId: string;
    appId: string;
    patch: Partial<Omit<AppstoreReviewWebhook, 'app_id' | 'user_id' | 'created_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('appstore_review_webhooks')
        .update({ ...payload.patch, updated_at: nowIso })
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .select(WEBHOOK_SELECT)
        .single();
};

export const claimAppstoreReviewWebhookPublicSubdomain = async (payload: {
    appId: string;
    requested?: string | null;
}) =>
    supabase.rpc('appstore_review_webhook_claim_subdomain', {
        p_app_id: payload.appId,
        p_requested: String(payload.requested || '').trim() || null,
    });

export const deleteAppstoreReviewWebhook = async (payload: { userId: string; appId: string }) =>
    supabase
        .from('appstore_review_webhooks')
        .delete()
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId);

export const fetchAppstoreReviewEvents = async (payload: {
    userId: string;
    appId: string;
    limit?: number;
}) =>
    supabase
        .from('appstore_review_events')
        .select(EVENT_SELECT)
        .eq('user_id', payload.userId)
        .eq('app_id', payload.appId)
        .order('event_at', { ascending: false })
        .limit(Math.max(1, Math.min(12, Math.floor(payload.limit || 6))));
