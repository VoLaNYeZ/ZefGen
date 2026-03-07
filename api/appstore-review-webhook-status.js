import {
    createServiceSupabaseClient,
    getQueryParam,
    getWebhookStatusPayload,
    json,
    requireAuthenticatedUser,
    requireOwnedApp,
    toPublicErrorStatus,
} from './appstore-review-webhook.shared.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const { user } = await requireAuthenticatedUser(req);
        const service = createServiceSupabaseClient();
        const appId = getQueryParam(req, 'appId');
        await requireOwnedApp({ service, userId: user.id, appId });
        const payload = await getWebhookStatusPayload({ service, userId: user.id, appId });
        return json(res, 200, payload);
    } catch (error) {
        return json(res, toPublicErrorStatus(error), {
            error: String(error?.message || 'Failed to load App Store review webhook status.').slice(0, 1000),
        });
    }
}
