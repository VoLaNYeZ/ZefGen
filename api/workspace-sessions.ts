// Vercel Serverless Function: POST /api/workspace-sessions
//
// Session presence + brand lock actions for shared-account collaboration.
// Protected by Supabase Bearer token so anonymous users cannot access session metadata.

import { createClient } from '@supabase/supabase-js';

type WorkspaceAction = 'heartbeat' | 'claim_brand' | 'take_over_brand' | 'release_brand' | 'snapshot';

type WorkspaceRequestBody = {
    action?: WorkspaceAction;
    clientSessionId?: string;
    clientDeviceId?: string;
    brandId?: string | null;
    ttlSeconds?: number;
};

const WORKSPACE_SESSION_RETENTION_HOURS = 48;
const WORKSPACE_PRESENCE_WINDOW_SECONDS = 180;
const FALLBACK_LOCK_RACE_DELAY_MS = 120;

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const extractBearerToken = (authorization: unknown) => {
    if (!isNonEmptyString(authorization)) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
};

const createUserSupabaseClient = (token: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
};

const readHeader = (req: any, key: string) => {
    const value = req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()] ?? req?.headers?.[key.toUpperCase()];
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
};

const normalizeCountry = (value: unknown) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (raw === 'unknown') return 'unknown';
    return /^[a-z]{2}$/.test(raw) ? raw : 'unknown';
};

const normalizeSessionPayload = (body: WorkspaceRequestBody) => {
    const clientSessionId = String(body.clientSessionId || '').trim();
    const clientDeviceId = String(body.clientDeviceId || '').trim();
    const ttlSeconds = Number.isFinite(Number(body.ttlSeconds))
        ? Math.max(5, Math.floor(Number(body.ttlSeconds)))
        : 30;
    const brandIdRaw = body.brandId;
    const brandId = typeof brandIdRaw === 'string' && brandIdRaw.trim() ? brandIdRaw.trim() : null;
    return { clientSessionId, clientDeviceId, ttlSeconds, brandId };
};

const normalizeLockResult = (payload: any) => {
    const ok = Boolean(payload?.ok);
    const reasonRaw = payload?.reason;
    const reason = reasonRaw == null ? null : String(reasonRaw);
    return { ok, reason };
};

const normalizeSnapshot = (payload: any) => {
    const activeSessionCount = Number(payload?.active_session_count ?? 0);
    const activeSessionCountriesRaw = Array.isArray(payload?.active_session_countries)
        ? payload.active_session_countries
        : [];
    const lockedBrandIdsRaw = Array.isArray(payload?.locked_brand_ids_by_other_devices)
        ? payload.locked_brand_ids_by_other_devices
        : [];
    return {
        active_session_count: Number.isFinite(activeSessionCount) ? Math.max(0, Math.floor(activeSessionCount)) : 0,
        active_session_countries: activeSessionCountriesRaw
            .map((v: any) => normalizeCountry(v))
            .filter((v: string) => Boolean(v)),
        locked_brand_ids_by_other_devices: lockedBrandIdsRaw
            .map((v: any) => String(v || '').trim())
            .filter((v: string) => Boolean(v)),
    };
};

type PresenceRow = {
    client_device_id?: string | null;
    country_code?: string | null;
    updated_at?: string | null;
};

type LockedBrandRow = {
    brand_id?: string | null;
};

type SessionStateRow = {
    client_device_id?: string | null;
    brand_id?: string | null;
};

const buildSnapshotFromRows = (presenceRows: PresenceRow[], lockedBrandRows: LockedBrandRow[]) => {
    const seenDeviceIds = new Set<string>();
    const activeSessionCountries: string[] = [];
    presenceRows.forEach((row, index) => {
        const deviceId = String(row?.client_device_id || '').trim() || `row-${index}`;
        if (seenDeviceIds.has(deviceId)) return;
        seenDeviceIds.add(deviceId);
        activeSessionCountries.push(normalizeCountry(row?.country_code));
    });

    const lockedBrandIds = Array.from(
        new Set(
            lockedBrandRows
                .map((row) => String(row?.brand_id || '').trim())
                .filter((value) => Boolean(value))
        )
    );
    return {
        active_session_count: seenDeviceIds.size,
        active_session_countries: activeSessionCountries,
        locked_brand_ids_by_other_devices: lockedBrandIds,
    };
};

const fetchSnapshotFromTable = async (supabase: any, clientDeviceId: string) => {
    const nowIso = new Date().toISOString();
    const presenceCutoffIso = new Date(Date.now() - WORKSPACE_PRESENCE_WINDOW_SECONDS * 1000).toISOString();

    const { data: presenceRowsData, error: presenceError } = await supabase
        .from('workspace_sessions')
        .select('client_device_id, country_code, updated_at')
        .gt('last_seen_at', presenceCutoffIso)
        .order('updated_at', { ascending: false });
    if (presenceError) throw presenceError;

    const { data: lockedBrandRowsData, error: lockedBrandError } = await supabase
        .from('workspace_sessions')
        .select('brand_id')
        .gt('expires_at', nowIso)
        .not('brand_id', 'is', null)
        .neq('client_device_id', clientDeviceId);
    if (lockedBrandError) throw lockedBrandError;

    return buildSnapshotFromRows(
        Array.isArray(presenceRowsData) ? presenceRowsData : [],
        Array.isArray(lockedBrandRowsData) ? lockedBrandRowsData : []
    );
};

const decodeBase64Url = (input: string) => {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
};

const extractTokenUserId = (token: string) => {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payloadRaw = decodeBase64Url(parts[1]);
        const payload = JSON.parse(payloadRaw);
        const sub = String(payload?.sub || '').trim();
        return sub || null;
    } catch {
        return null;
    }
};

const getSessionStateRow = async (supabase: any, clientSessionId: string) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from('workspace_sessions')
        .select('client_device_id, brand_id')
        .eq('client_session_id', clientSessionId)
        .gt('expires_at', nowIso)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return (data || null) as SessionStateRow | null;
};

const hasCrossDeviceBrandConflict = async (supabase: any, brandId: string, clientDeviceId: string) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from('workspace_sessions')
        .select('client_session_id')
        .eq('brand_id', brandId)
        .gt('expires_at', nowIso)
        .neq('client_device_id', clientDeviceId)
        .limit(1);
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
};

const sleep = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const hasCrossDeviceBrandConflictStabilized = async (supabase: any, brandId: string, clientDeviceId: string) => {
    const immediate = await hasCrossDeviceBrandConflict(supabase, brandId, clientDeviceId);
    if (immediate) return true;
    await sleep(FALLBACK_LOCK_RACE_DELAY_MS);
    return hasCrossDeviceBrandConflict(supabase, brandId, clientDeviceId);
};

const clearBrandFromOtherSessions = async (supabase: any, brandId: string, clientDeviceId: string) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
        .from('workspace_sessions')
        .update({ brand_id: null, last_seen_at: nowIso, updated_at: nowIso })
        .eq('brand_id', brandId)
        .gt('expires_at', nowIso)
        .neq('client_device_id', clientDeviceId);
    if (error) throw error;
};

const upsertSessionState = async (
    supabase: any,
    userId: string,
    clientSessionId: string,
    clientDeviceId: string,
    brandId: string | null,
    countryCode: string,
    ttlSeconds: number
) => {
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error } = await supabase.from('workspace_sessions').upsert(
        [
            {
                user_id: userId,
                client_session_id: clientSessionId,
                client_device_id: clientDeviceId,
                brand_id: brandId,
                country_code: countryCode,
                last_seen_at: nowIso,
                expires_at: expiresAtIso,
                updated_at: nowIso,
            },
        ],
        { onConflict: 'user_id,client_session_id' }
    );
    if (error) throw error;
};

const fallbackClaimBrand = async (
    supabase: any,
    userId: string | null,
    clientSessionId: string,
    clientDeviceId: string,
    brandId: string,
    countryCode: string,
    ttlSeconds: number
) => {
    if (!userId) return { ok: false, reason: 'unauthorized' };
    const existing = await getSessionStateRow(supabase, clientSessionId);
    const previousBrandId = existing?.brand_id || null;
    if (existing?.client_device_id && existing.client_device_id !== clientDeviceId) {
        return { ok: false, reason: 'session_id_collision' };
    }

    const hasConflict = await hasCrossDeviceBrandConflict(supabase, brandId, clientDeviceId);
    if (hasConflict) {
        await upsertSessionState(
            supabase,
            userId,
            clientSessionId,
            clientDeviceId,
            previousBrandId,
            countryCode,
            ttlSeconds
        );
        return { ok: false, reason: 'locked_by_other_device' };
    }

    await upsertSessionState(supabase, userId, clientSessionId, clientDeviceId, brandId, countryCode, ttlSeconds);
    const postWriteConflict = await hasCrossDeviceBrandConflictStabilized(supabase, brandId, clientDeviceId);
    if (postWriteConflict) {
        await upsertSessionState(
            supabase,
            userId,
            clientSessionId,
            clientDeviceId,
            previousBrandId,
            countryCode,
            ttlSeconds
        );
        return { ok: false, reason: 'locked_by_other_device' };
    }
    return { ok: true, reason: null };
};

const fallbackTakeOverBrand = async (
    supabase: any,
    userId: string | null,
    clientSessionId: string,
    clientDeviceId: string,
    brandId: string,
    countryCode: string,
    ttlSeconds: number
) => {
    if (!userId) return { ok: false, reason: 'unauthorized' };
    const existing = await getSessionStateRow(supabase, clientSessionId);
    if (existing?.client_device_id && existing.client_device_id !== clientDeviceId) {
        return { ok: false, reason: 'session_id_collision' };
    }

    await upsertSessionState(supabase, userId, clientSessionId, clientDeviceId, brandId, countryCode, ttlSeconds);
    await clearBrandFromOtherSessions(supabase, brandId, clientDeviceId);

    const postWriteConflict = await hasCrossDeviceBrandConflictStabilized(supabase, brandId, clientDeviceId);
    if (!postWriteConflict) {
        return { ok: true, reason: null };
    }

    await clearBrandFromOtherSessions(supabase, brandId, clientDeviceId);
    const finalConflict = await hasCrossDeviceBrandConflict(supabase, brandId, clientDeviceId);
    if (finalConflict) {
        return { ok: false, reason: 'locked_by_other_device' };
    }

    return { ok: true, reason: null };
};

const fallbackHeartbeat = async (
    supabase: any,
    userId: string | null,
    clientSessionId: string,
    clientDeviceId: string,
    brandId: string | null,
    countryCode: string,
    ttlSeconds: number
) => {
    if (!userId) return { ok: false, reason: 'unauthorized' };
    const existing = await getSessionStateRow(supabase, clientSessionId);
    const previousBrandId = existing?.brand_id || null;
    if (existing?.client_device_id && existing.client_device_id !== clientDeviceId) {
        return { ok: false, reason: 'session_id_collision' };
    }

    let effectiveBrandId = brandId;
    let blockedByOtherDevice = false;
    if (brandId) {
        const hasConflict = await hasCrossDeviceBrandConflict(supabase, brandId, clientDeviceId);
        if (hasConflict) {
            blockedByOtherDevice = true;
            effectiveBrandId = previousBrandId;
        }
    }

    await upsertSessionState(
        supabase,
        userId,
        clientSessionId,
        clientDeviceId,
        effectiveBrandId || null,
        countryCode,
        ttlSeconds
    );
    if (blockedByOtherDevice) {
        return { ok: false, reason: 'locked_by_other_device' };
    }

    if (brandId && effectiveBrandId === brandId) {
        const postWriteConflict = await hasCrossDeviceBrandConflictStabilized(supabase, brandId, clientDeviceId);
        if (postWriteConflict) {
            await upsertSessionState(
                supabase,
                userId,
                clientSessionId,
                clientDeviceId,
                previousBrandId,
                countryCode,
                ttlSeconds
            );
            return { ok: false, reason: 'locked_by_other_device' };
        }
    }

    return { ok: true, reason: null };
};

const fallbackReleaseBrand = async (supabase: any, clientSessionId: string, brandId: string | null) => {
    const nowIso = new Date().toISOString();
    let query = supabase
        .from('workspace_sessions')
        .update({ brand_id: null, last_seen_at: nowIso, updated_at: nowIso })
        .eq('client_session_id', clientSessionId);
    if (brandId) {
        query = query.eq('brand_id', brandId);
    }
    const { error } = await query;
    if (error) throw error;
    return { ok: true, reason: null };
};

const isAuthError = (error: any) => {
    const message = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    return (
        status === 401 ||
        status === 403 ||
        code === '401' ||
        code === '403' ||
        code === 'pgrst301' ||
        message.includes('jwt') ||
        message.includes('unauthorized') ||
        message.includes('invalid token') ||
        message.includes('invalid claim') ||
        message.includes('permission denied')
    );
};

const statusForRpcError = (error: any) => (isAuthError(error) ? 401 : 500);

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed' });
    }

    const token = extractBearerToken(req.headers?.authorization ?? req.headers?.Authorization);
    if (!token) {
        return json(res, 401, { error: 'Missing bearer token' });
    }

    try {
        const body: WorkspaceRequestBody =
            typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

        const action = String(body.action || '').trim() as WorkspaceAction;
        if (!action || !['heartbeat', 'claim_brand', 'take_over_brand', 'release_brand', 'snapshot'].includes(action)) {
            return json(res, 400, { error: 'Invalid action' });
        }

        const { clientSessionId, clientDeviceId, ttlSeconds, brandId } = normalizeSessionPayload(body);
        if (!clientSessionId || !clientDeviceId) {
            return json(res, 400, { error: 'Missing clientSessionId or clientDeviceId' });
        }

        const countryHeader = readHeader(req, 'x-vercel-ip-country') || readHeader(req, 'cf-ipcountry');
        const countryCode = normalizeCountry(countryHeader);
        const tokenUserId = extractTokenUserId(token);
        const supabase = createUserSupabaseClient(token);
        const cleanupCutoffIso = new Date(
            Date.now() - WORKSPACE_SESSION_RETENTION_HOURS * 60 * 60 * 1000
        ).toISOString();
        // Best-effort retention cleanup for this authenticated user.
        // RLS keeps this scoped to the caller's own rows.
        try {
            await supabase.from('workspace_sessions').delete().lt('expires_at', cleanupCutoffIso);
        } catch {
            // Cleanup is best-effort and must never block action handling.
        }

        if (action === 'snapshot') {
            try {
                const snapshot = await fetchSnapshotFromTable(supabase, clientDeviceId);
                return json(res, 200, normalizeSnapshot(snapshot));
            } catch (tableError: any) {
                const { data, error } = await supabase.rpc('workspace_snapshot', {
                    p_client_device_id: clientDeviceId,
                });
                if (error) {
                    const status = statusForRpcError(tableError) === 401 ? 401 : statusForRpcError(error);
                    return json(res, status, {
                        error: String(error.message || tableError?.message || tableError || error),
                    });
                }
                return json(res, 200, normalizeSnapshot(data));
            }
        }

        if (action === 'claim_brand') {
            if (!brandId) {
                return json(res, 400, { error: 'Missing brandId for claim_brand' });
            }
            const { data, error } = await supabase.rpc('workspace_claim_brand_lock', {
                p_client_session_id: clientSessionId,
                p_client_device_id: clientDeviceId,
                p_brand_id: brandId,
                p_country_code: countryCode,
                p_ttl_seconds: ttlSeconds,
            });
            if (error) {
                if (isAuthError(error)) {
                    return json(res, statusForRpcError(error), { error: String(error.message || error) });
                }
                try {
                    const fallback = await fallbackClaimBrand(
                        supabase,
                        tokenUserId,
                        clientSessionId,
                        clientDeviceId,
                        brandId,
                        countryCode,
                        ttlSeconds
                    );
                    return json(res, 200, normalizeLockResult(fallback));
                } catch (fallbackError: any) {
                    return json(res, 500, { error: String(fallbackError?.message || error) });
                }
            }
            return json(res, 200, normalizeLockResult(data));
        }

        if (action === 'take_over_brand') {
            if (!brandId) {
                return json(res, 400, { error: 'Missing brandId for take_over_brand' });
            }
            const { data, error } = await supabase.rpc('workspace_take_over_brand_lock', {
                p_client_session_id: clientSessionId,
                p_client_device_id: clientDeviceId,
                p_brand_id: brandId,
                p_country_code: countryCode,
                p_ttl_seconds: ttlSeconds,
            });
            if (error) {
                if (isAuthError(error)) {
                    return json(res, statusForRpcError(error), { error: String(error.message || error) });
                }
                try {
                    const fallback = await fallbackTakeOverBrand(
                        supabase,
                        tokenUserId,
                        clientSessionId,
                        clientDeviceId,
                        brandId,
                        countryCode,
                        ttlSeconds
                    );
                    return json(res, 200, normalizeLockResult(fallback));
                } catch (fallbackError: any) {
                    return json(res, 500, { error: String(fallbackError?.message || error) });
                }
            }
            return json(res, 200, normalizeLockResult(data));
        }

        if (action === 'heartbeat') {
            const { data, error } = await supabase.rpc('workspace_heartbeat_session', {
                p_client_session_id: clientSessionId,
                p_client_device_id: clientDeviceId,
                p_brand_id: brandId,
                p_country_code: countryCode,
                p_ttl_seconds: ttlSeconds,
            });
            if (error) {
                if (isAuthError(error)) {
                    return json(res, statusForRpcError(error), { error: String(error.message || error) });
                }
                try {
                    const fallback = await fallbackHeartbeat(
                        supabase,
                        tokenUserId,
                        clientSessionId,
                        clientDeviceId,
                        brandId,
                        countryCode,
                        ttlSeconds
                    );
                    return json(res, 200, normalizeLockResult(fallback));
                } catch (fallbackError: any) {
                    return json(res, 500, { error: String(fallbackError?.message || error) });
                }
            }
            return json(res, 200, normalizeLockResult(data));
        }

        const { data, error } = await supabase.rpc('workspace_release_brand_lock', {
            p_client_session_id: clientSessionId,
            p_brand_id: brandId,
        });
        if (error) {
            if (isAuthError(error)) {
                return json(res, statusForRpcError(error), { error: String(error.message || error) });
            }
            try {
                const fallback = await fallbackReleaseBrand(supabase, clientSessionId, brandId);
                return json(res, 200, normalizeLockResult(fallback));
            } catch (fallbackError: any) {
                return json(res, 500, { error: String(fallbackError?.message || error) });
            }
        }
        return json(res, 200, normalizeLockResult(data));
    } catch (err: any) {
        return json(res, 500, { error: String(err?.message || 'Server error').slice(0, 500) });
    }
}
