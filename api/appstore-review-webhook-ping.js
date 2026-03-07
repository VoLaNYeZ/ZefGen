import {
    appleRequest,
    createServiceSupabaseClient,
    getAppleCredentialsForApp,
    json,
    readJsonBody,
    requireAuthenticatedUser,
    requireOwnedApp,
    toPublicErrorStatus,
} from './appstore-review-webhook.shared.js';

const APPLE_API_ORIGIN = 'https://api.appstoreconnect.apple.com';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const body = await readJsonBody(req);
        const appId = String(body?.appId || '').trim();
        const { user } = await requireAuthenticatedUser(req);
        const service = createServiceSupabaseClient();
        await requireOwnedApp({ service, userId: user.id, appId });

        const { webhook, jwt } = await getAppleCredentialsForApp({ service, userId: user.id, appId });
        const appleWebhookId = String(webhook?.apple_webhook_id || '').trim();
        if (!appleWebhookId) {
            const error = new Error('Sync the Apple webhook first, then send a test ping.');
            error.status = 400;
            throw error;
        }

        const payload = await appleRequest({
            token: jwt,
            url: `${APPLE_API_ORIGIN}/v1/webhookPings`,
            method: 'POST',
            body: {
                data: {
                    type: 'webhookPings',
                    relationships: {
                        webhook: {
                            data: {
                                type: 'webhooks',
                                id: appleWebhookId,
                            },
                        },
                    },
                },
            },
        });

        return json(res, 200, {
            ok: true,
            data: payload?.data || null,
        });
    } catch (error) {
        return json(res, toPublicErrorStatus(error), {
            error: String(error?.message || 'Failed to send App Store webhook ping.').slice(0, 1000),
        });
    }
}
