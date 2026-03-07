import {
    appleRequest,
    claimManagedPublicSubdomain,
    createServiceSupabaseClient,
    extractManagedPublicSubdomainFromUrl,
    fetchBundleIdForApp,
    getAppleCredentialsForApp,
    getPublicWebhookTarget,
    json,
    listAppStoreConnectApps,
    normalizeAppleAppCandidates,
    pickAutoBoundAppleApp,
    readJsonBody,
    requireAuthenticatedUser,
    requireOwnedApp,
    syncWebhookBindingFromCandidate,
    toPublicErrorStatus,
    updateWebhookRow,
    webhookAttributesPayload,
} from './appstore-review-webhook.shared.js';

const APPLE_API_ORIGIN = 'https://api.appstoreconnect.apple.com';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    let service = null;
    let user = null;
    let appId = '';
    let webhook = null;

    try {
        const body = await readJsonBody(req);
        appId = String(body?.appId || '').trim();
        ({ user } = await requireAuthenticatedUser(req));
        service = createServiceSupabaseClient();
        const app = await requireOwnedApp({ service, userId: user.id, appId });

        const [{ webhook: credentialWebhook, jwt }, bundleId] = await Promise.all([
            getAppleCredentialsForApp({ service, userId: user.id, appId }),
            fetchBundleIdForApp({ service, userId: user.id, appId }),
        ]);
        webhook = credentialWebhook;

        if (!String(webhook?.asc_app_id || '').trim()) {
            const rawApps = await listAppStoreConnectApps({ token: jwt });
            const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
            const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
            if (!autoBoundCandidate) {
                const selectionError = new Error('Select the App Store Connect app first, then sync the webhook.');
                selectionError.status = 400;
                throw selectionError;
            }
            webhook = await syncWebhookBindingFromCandidate({
                service,
                userId: user.id,
                appId,
                webhook,
                candidate: autoBoundCandidate,
            });
        }

        if (
            !String(webhook?.public_subdomain || '').trim() &&
            !String(webhook?.public_webhook_url || '').trim()
        ) {
            webhook = await claimManagedPublicSubdomain({
                service,
                userId: user.id,
                appId,
                webhook,
            });
        } else if (!String(webhook?.public_subdomain || '').trim() && extractManagedPublicSubdomainFromUrl(webhook?.public_webhook_url)) {
            webhook = await claimManagedPublicSubdomain({
                service,
                userId: user.id,
                appId,
                webhook,
            });
        }

        const { effectiveUrl, internalUrl } = getPublicWebhookTarget({ webhook });
        const attributes = webhookAttributesPayload({
            effectiveUrl,
            secret: webhook.secret,
            name: `${String(app?.name || 'App').trim() || 'App'} review status`,
        });

        let appleWebhookId = String(webhook?.apple_webhook_id || '').trim();
        let responsePayload = null;

        if (appleWebhookId) {
            try {
                responsePayload = await appleRequest({
                    token: jwt,
                    url: `${APPLE_API_ORIGIN}/v1/webhooks/${encodeURIComponent(appleWebhookId)}`,
                    method: 'PATCH',
                    body: {
                        data: {
                            id: appleWebhookId,
                            type: 'webhooks',
                            attributes,
                        },
                    },
                });
            } catch (error) {
                if (Number(error?.status || 0) !== 404) throw error;
                appleWebhookId = '';
            }
        }

        if (!appleWebhookId) {
            responsePayload = await appleRequest({
                token: jwt,
                url: `${APPLE_API_ORIGIN}/v1/webhooks`,
                method: 'POST',
                body: {
                    data: {
                        type: 'webhooks',
                        attributes,
                        relationships: {
                            app: {
                                data: {
                                    type: 'apps',
                                    id: webhook.asc_app_id,
                                },
                            },
                        },
                    },
                },
            });
            appleWebhookId = String(responsePayload?.data?.id || '').trim();
        }

        if (!appleWebhookId) {
            throw new Error('Apple did not return a webhook ID.');
        }

        const updatedWebhook = await updateWebhookRow({
            service,
            userId: user.id,
            appId,
            patch: {
                apple_webhook_id: appleWebhookId,
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'connected',
                last_sync_error: null,
            },
        });

        return json(res, 200, {
            ok: true,
            webhook: updatedWebhook,
            effective_public_webhook_url: effectiveUrl,
            internal_listener_url: internalUrl,
        });
    } catch (error) {
        if (service && user?.id && appId && webhook?.app_id) {
            try {
                await updateWebhookRow({
                    service,
                    userId: user.id,
                    appId,
                    patch: {
                        last_sync_at: new Date().toISOString(),
                        last_sync_status: 'error',
                        last_sync_error: String(error?.message || 'Webhook sync failed.').slice(0, 1000),
                    },
                });
            } catch {
                // Ignore secondary persistence failure.
            }
        }
        return json(res, toPublicErrorStatus(error), {
            error: String(error?.message || 'Failed to sync App Store webhook.').slice(0, 1000),
        });
    }
}
