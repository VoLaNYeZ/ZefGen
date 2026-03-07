import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-apple-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });

const env = (key: string, fallback?: string) => {
    const value = Deno.env.get(key) || (fallback ? Deno.env.get(fallback) : null);
    return value ? String(value).trim() : '';
};

const getSupabaseConfig = () => {
    const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in function env.');
    }
    return { url, serviceRoleKey };
};

const parseSignatureHeader = (value: string | null) => {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/hmacsha256=([0-9a-f]+)/i);
    return match?.[1]?.trim().toLowerCase() || '';
};

const toHex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');

const computeHmacSha256Hex = async (secret: string, body: string) => {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    return toHex(signature);
};

const constantTimeEquals = (left: string, right: string) => {
    const a = String(left || '');
    const b = String(right || '');
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let index = 0; index < a.length; index += 1) {
        diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return diff === 0;
};

const toUpperSnakeCase = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
};

const normalizeIsoTimestamp = (value: unknown, fallbackIso: string) => {
    const raw = String(value || '').trim();
    if (!raw) return fallbackIso;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return fallbackIso;
    return date.toISOString();
};

const deriveEvent = (payload: any, fallbackIso: string) => {
    const data = payload && typeof payload === 'object' ? payload.data : null;
    const payloadType = String(data?.type || '').trim();
    const attributes = data && typeof data === 'object' ? data.attributes || {} : {};
    const eventType =
        payloadType === 'appStoreVersionAppVersionStateUpdated'
            ? 'APP_STORE_VERSION_APP_VERSION_STATE_UPDATED'
            : toUpperSnakeCase(payloadType);

    const stateFrom = String(attributes?.oldValue || '').trim() || null;
    const stateTo = String(attributes?.newValue || '').trim() || null;
    const eventAt = normalizeIsoTimestamp(attributes?.timestamp, fallbackIso);
    const deliveryStatus =
        payloadType === 'appStoreVersionAppVersionStateUpdated' || stateFrom || stateTo ? 'received' : 'ignored';

    return {
        eventType: eventType || payloadType || 'UNKNOWN',
        payloadType: payloadType || 'unknown',
        stateFrom,
        stateTo,
        eventAt,
        deliveryStatus,
    };
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

    const url = new URL(req.url);
    const publicToken = String(url.searchParams.get('token') || '').trim();
    if (!publicToken) return json(400, { error: 'Missing token.' });

    const rawBody = await req.text();
    if (!rawBody) return json(400, { error: 'Missing request body.' });

    try {
        const { url: supabaseUrl, serviceRoleKey } = getSupabaseConfig();
        const service = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: configRow, error: configError } = await service
            .from('appstore_review_webhooks')
            .select('app_id, user_id, secret')
            .eq('public_token', publicToken)
            .maybeSingle();
        if (configError) throw configError;
        if (!configRow) return json(404, { error: 'Webhook not found.' });

        const nowIso = new Date().toISOString();
        const providedSignature = parseSignatureHeader(req.headers.get('x-apple-signature'));
        const expectedSignature = await computeHmacSha256Hex(String(configRow.secret || ''), rawBody);

        if (!providedSignature || !constantTimeEquals(providedSignature, expectedSignature)) {
            await service
                .from('appstore_review_webhooks')
                .update({
                    last_delivery_at: nowIso,
                    last_delivery_status: 'invalid_signature',
                    last_error: 'Signature mismatch.',
                    updated_at: nowIso,
                })
                .eq('app_id', configRow.app_id);
            return json(401, { error: 'Invalid signature.' });
        }

        let payload: any;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            await service
                .from('appstore_review_webhooks')
                .update({
                    last_delivery_at: nowIso,
                    last_delivery_status: 'error',
                    last_error: 'Invalid JSON payload.',
                    updated_at: nowIso,
                })
                .eq('app_id', configRow.app_id);
            return json(400, { error: 'Invalid JSON payload.' });
        }

        const derived = deriveEvent(payload, nowIso);
        const { error: insertError } = await service.from('appstore_review_events').insert({
            app_id: configRow.app_id,
            user_id: configRow.user_id,
            event_type: derived.eventType,
            payload_type: derived.payloadType,
            state_from: derived.stateFrom,
            state_to: derived.stateTo,
            event_at: derived.eventAt,
            delivery_status: derived.deliveryStatus,
            raw_payload: payload,
        });
        if (insertError) throw insertError;

        const patch: Record<string, string | null> = {
            last_delivery_at: nowIso,
            last_delivery_status: derived.deliveryStatus,
            last_error: null,
            updated_at: nowIso,
        };
        if (derived.deliveryStatus === 'received') {
            patch.latest_event_type = derived.eventType;
            patch.latest_event_at = derived.eventAt;
            patch.latest_previous_state = derived.stateFrom;
            patch.latest_review_state = derived.stateTo;
        }

        const { error: updateError } = await service
            .from('appstore_review_webhooks')
            .update(patch)
            .eq('app_id', configRow.app_id);
        if (updateError) throw updateError;

        return json(200, { ok: true });
    } catch (error: any) {
        return json(500, { error: String(error?.message || 'Server error').slice(0, 500) });
    }
});
