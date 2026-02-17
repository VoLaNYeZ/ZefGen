import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

import { getGoogleAccessToken } from '../_shared/google-auth.ts';
import {
    createGoogleDocInFolder,
    ensureAppFolder,
    setAnyoneReaderPermission,
    trashGoogleFile,
} from '../_shared/google-drive.ts';
import { writeDocumentText } from '../_shared/google-docs.ts';
import { createAndConfigureSupportForm } from '../_shared/google-forms.ts';
import { buildSupportFormPlan, renderPrivacyPolicy, renderTermsOfUse } from '../_shared/legal-templates.ts';

// Required function secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - OAuth user auth (required):
//   - GOOGLE_OAUTH_CLIENT_ID
//   - GOOGLE_OAUTH_CLIENT_SECRET
//   - GOOGLE_OAUTH_REFRESH_TOKEN
// Storage mode for this project:
// - Personal-only (My Drive) via OAuth user mode.
// - GOOGLE_SHARED_DRIVE_ID is intentionally ignored.
// Deployment guardrail for this project:
// - Deploy this function with `--no-verify-jwt` and keep manual auth validation
//   via `service.auth.getUser(token)` below to avoid gateway JWT incompatibility incidents.

type JsonRecord = Record<string, unknown>;

type GenerateRequest = {
    appId?: string;
    confirmRegenerate?: boolean;
};

type GeneratedUrls = {
    privacy_policy_url: string;
    terms_of_use_url: string;
    support_form_url: string;
};

type ConfirmRequiredResponse = {
    status: 'confirm_required';
    urls: GeneratedUrls;
    fingerprint: string;
};

type GeneratedResponse = {
    status: 'generated';
    urls: GeneratedUrls;
    fingerprint: string;
    runId: string | null;
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APPSTORE_NAME_MAX_LENGTH = 30;

const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });

const asNonEmpty = (value: unknown) => {
    const out = String(value ?? '').trim();
    return out.length > 0 ? out : '';
};

const normalizeFingerprintPart = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const sha256Hex = async (value: string) => {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const toFolderName = (appId: string, alias: string) => {
    const safeAlias =
        alias
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'app';
    return `zefgen-${appId}-${safeAlias}`;
};

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

const extractBearer = (authorization: string | null) => {
    const raw = String(authorization || '').trim();
    const match = raw.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || '';
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

    let requestBody: GenerateRequest = {};
    try {
        requestBody = (await req.json()) as GenerateRequest;
    } catch {
        return json(400, { error: 'Invalid JSON body.' });
    }

    const appId = asNonEmpty(requestBody.appId);
    if (!appId) return json(400, { error: 'Missing appId.' });
    const confirmRegenerate = requestBody.confirmRegenerate === true;

    const token = extractBearer(req.headers.get('Authorization'));
    if (!token) return json(401, { error: 'Missing bearer token.' });

    const nowIso = new Date().toISOString();
    let runContext: {
        userId: string;
        appId: string;
        fingerprint: string;
        companyName: string;
        appstoreName: string;
        accountEmail: string;
        privacyDocId: string;
        privacyUrl: string;
        termsDocId: string;
        termsUrl: string;
        supportFormId: string;
        supportUrl: string;
        supportSchema: JsonRecord;
        subtitleVariant: string | null;
    } | null = null;
    const createdFileIds: string[] = [];
    let googleAccessTokenForCleanup = '';

    try {
        const { url, serviceRoleKey } = getSupabaseConfig();

        const service = createClient(url, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
            data: { user },
            error: userError,
        } = await service.auth.getUser(token);
        if (userError || !user) return json(401, { error: 'Unauthorized.' });

        const { data: appRow, error: appError } = await service
            .from('apps')
            .select('id, alias, name')
            .eq('id', appId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (appError) throw appError;
        if (!appRow) return json(404, { error: 'App not found.' });

        const { data: cfgRow, error: cfgError } = await service
            .from('connector_app_configs')
            .select('app_id, user_id, variables')
            .eq('app_id', appId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (cfgError) throw cfgError;
        if (!cfgRow) return json(400, { error: 'Setup data row is missing for this app.' });

        const { data: accountRow, error: accountError } = await service
            .from('appstore_accounts')
            .select('email, company_name')
            .eq('app_id', appId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (accountError) throw accountError;
        if (!accountRow) return json(400, { error: 'No assigned App Store account for this app.' });

        const variables = ((cfgRow as { variables?: JsonRecord }).variables || {}) as JsonRecord;
        const companyName = asNonEmpty((variables as { company_name?: string }).company_name) || asNonEmpty(accountRow.company_name);
        const appstoreName = asNonEmpty((variables as { appstore_name?: string }).appstore_name);
        const accountEmail = asNonEmpty(accountRow.email);

        if (!companyName) return json(400, { error: 'Missing company_name in setup data.' });
        if (!appstoreName) return json(400, { error: 'Missing appstore_name in setup data.' });
        if (appstoreName.length > APPSTORE_NAME_MAX_LENGTH) {
            return json(400, {
                error: `appstore_name exceeds ${APPSTORE_NAME_MAX_LENGTH} characters.`,
            });
        }
        if (!accountEmail) return json(400, { error: 'Missing assigned account email.' });

        const fingerprintSource = [
            normalizeFingerprintPart(companyName),
            normalizeFingerprintPart(appstoreName),
            normalizeFingerprintPart(accountEmail),
        ].join('|');
        const fingerprint = await sha256Hex(fingerprintSource);

        const { data: latestSucceeded, error: latestError } = await service
            .from('connector_legal_links')
            .select('id, fingerprint, privacy_url, terms_url, support_url')
            .eq('user_id', user.id)
            .eq('app_id', appId)
            .eq('status', 'succeeded')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (latestError) throw latestError;

        if (latestSucceeded && String(latestSucceeded.fingerprint || '') === fingerprint && !confirmRegenerate) {
            const confirmPayload: ConfirmRequiredResponse = {
                status: 'confirm_required',
                urls: {
                    privacy_policy_url:
                        asNonEmpty(latestSucceeded.privacy_url) || asNonEmpty((variables as { privacy_policy_url?: string }).privacy_policy_url),
                    terms_of_use_url:
                        asNonEmpty(latestSucceeded.terms_url) || asNonEmpty((variables as { terms_of_use_url?: string }).terms_of_use_url),
                    support_form_url:
                        asNonEmpty(latestSucceeded.support_url) || asNonEmpty((variables as { support_form_url?: string }).support_form_url),
                },
                fingerprint,
            };
            return json(200, confirmPayload);
        }

        const googleAccessToken = await getGoogleAccessToken();
        googleAccessTokenForCleanup = googleAccessToken;
        const ignoredSharedDriveId = env('GOOGLE_SHARED_DRIVE_ID');
        if (ignoredSharedDriveId) {
            console.warn(
                '[generate-legal-links] GOOGLE_SHARED_DRIVE_ID is set but ignored (personal-only mode / My Drive).'
            );
        }
        const folderName = toFolderName(appId, asNonEmpty(appRow.alias) || asNonEmpty(appRow.name) || 'app');
        const folderId = await ensureAppFolder({
            accessToken: googleAccessToken,
            folderName,
            sharedDriveId: null,
        });

        const templateInput = {
            companyName,
            appStoreName: appstoreName,
            supportEmail: accountEmail,
            generatedAtIso: nowIso,
        };
        const privacyText = renderPrivacyPolicy(templateInput);
        const termsText = renderTermsOfUse(templateInput);
        const supportPlan = buildSupportFormPlan({ appStoreName: appstoreName });

        runContext = {
            userId: user.id,
            appId,
            fingerprint,
            companyName,
            appstoreName,
            accountEmail,
            privacyDocId: '',
            privacyUrl: '',
            termsDocId: '',
            termsUrl: '',
            supportFormId: '',
            supportUrl: '',
            supportSchema: supportPlan.schema as JsonRecord,
            subtitleVariant: supportPlan.subtitleVariant,
        };

        const privacyDoc = await createGoogleDocInFolder({
            accessToken: googleAccessToken,
            parentFolderId: folderId,
            name: `${appstoreName} Privacy Policy`,
        });
        createdFileIds.push(privacyDoc.id);
        await writeDocumentText({
            accessToken: googleAccessToken,
            documentId: privacyDoc.id,
            text: privacyText,
        });
        await setAnyoneReaderPermission({
            accessToken: googleAccessToken,
            fileId: privacyDoc.id,
        });
        runContext.privacyDocId = privacyDoc.id;
        runContext.privacyUrl = `https://docs.google.com/document/d/${privacyDoc.id}/view`;

        const termsDoc = await createGoogleDocInFolder({
            accessToken: googleAccessToken,
            parentFolderId: folderId,
            name: `${appstoreName} Terms of Use`,
        });
        createdFileIds.push(termsDoc.id);
        await writeDocumentText({
            accessToken: googleAccessToken,
            documentId: termsDoc.id,
            text: termsText,
        });
        await setAnyoneReaderPermission({
            accessToken: googleAccessToken,
            fileId: termsDoc.id,
        });
        runContext.termsDocId = termsDoc.id;
        runContext.termsUrl = `https://docs.google.com/document/d/${termsDoc.id}/view`;

        const supportForm = await createAndConfigureSupportForm({
            accessToken: googleAccessToken,
            parentFolderId: folderId,
            title: supportPlan.title,
            description: supportPlan.description,
            fields: supportPlan.fields,
        });
        createdFileIds.push(supportForm.formId);
        runContext.supportFormId = supportForm.formId;
        runContext.supportUrl = supportForm.responderUri;

        const generatedUrls: GeneratedUrls = {
            privacy_policy_url: runContext.privacyUrl,
            terms_of_use_url: runContext.termsUrl,
            support_form_url: runContext.supportUrl,
        };

        const { data: runIdValue, error: commitError } = await service.rpc('connector_commit_legal_links_success', {
            p_user_id: user.id,
            p_app_id: appId,
            p_fingerprint: fingerprint,
            p_company_name: companyName,
            p_appstore_name: appstoreName,
            p_account_email: accountEmail,
            p_privacy_doc_id: runContext.privacyDocId,
            p_privacy_url: runContext.privacyUrl,
            p_terms_doc_id: runContext.termsDocId,
            p_terms_url: runContext.termsUrl,
            p_support_form_id: runContext.supportFormId,
            p_support_url: runContext.supportUrl,
            p_support_schema: runContext.supportSchema,
            p_subtitle_variant: runContext.subtitleVariant,
            p_regenerated_with_confirmation: confirmRegenerate,
            p_now: nowIso,
        });
        if (commitError) throw commitError;
        const runId = asNonEmpty(runIdValue) || null;

        const responsePayload: GeneratedResponse = {
            status: 'generated',
            urls: generatedUrls,
            fingerprint,
            runId,
        };
        return json(200, responsePayload);
    } catch (error) {
        const message = String((error as { message?: string })?.message || error || 'Unknown error');

        try {
            if (googleAccessTokenForCleanup && createdFileIds.length > 0) {
                const seen = new Set<string>();
                for (let i = createdFileIds.length - 1; i >= 0; i -= 1) {
                    const fileId = asNonEmpty(createdFileIds[i]);
                    if (!fileId || seen.has(fileId)) continue;
                    seen.add(fileId);
                    try {
                        await trashGoogleFile({
                            accessToken: googleAccessTokenForCleanup,
                            fileId,
                        });
                    } catch (cleanupError) {
                        console.warn(
                            `[generate-legal-links] cleanup failed for ${fileId}: ${String(
                                (cleanupError as { message?: string })?.message || cleanupError
                            )}`
                        );
                    }
                }
            }
            if (runContext) {
                const { url, serviceRoleKey } = getSupabaseConfig();
                const service = createClient(url, serviceRoleKey, {
                    auth: { persistSession: false, autoRefreshToken: false },
                });
                await service.from('connector_legal_links').insert({
                    user_id: runContext.userId,
                    app_id: runContext.appId,
                    fingerprint: runContext.fingerprint,
                    company_name: runContext.companyName,
                    appstore_name: runContext.appstoreName,
                    account_email: runContext.accountEmail,
                    privacy_doc_id: runContext.privacyDocId || '',
                    privacy_url: runContext.privacyUrl || '',
                    terms_doc_id: runContext.termsDocId || '',
                    terms_url: runContext.termsUrl || '',
                    support_form_id: runContext.supportFormId || '',
                    support_url: runContext.supportUrl || '',
                    support_schema: runContext.supportSchema || {},
                    subtitle_variant: runContext.subtitleVariant,
                    regenerated_with_confirmation: requestBody.confirmRegenerate === true,
                    status: 'failed',
                    error: message.slice(0, 5000),
                });
            }
        } catch {
            // Best-effort failure logging; ignore nested failure.
        }

        return json(500, { error: message.slice(0, 1000) });
    }
});
