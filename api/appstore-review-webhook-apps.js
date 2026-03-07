import {
    createServiceSupabaseClient,
    fetchBundleIdForApp,
    getAppleCredentialsForApp,
    getQueryParam,
    json,
    listAppStoreConnectApps,
    normalizeAppleAppCandidates,
    pickAutoBoundAppleApp,
    requireAuthenticatedUser,
    requireOwnedApp,
    syncWebhookBindingFromCandidate,
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

        const [{ webhook, jwt }, bundleId] = await Promise.all([
            getAppleCredentialsForApp({ service, userId: user.id, appId }),
            fetchBundleIdForApp({ service, userId: user.id, appId }),
        ]);
        const rawApps = await listAppStoreConnectApps({ token: jwt });
        const candidates = normalizeAppleAppCandidates(rawApps, bundleId);
        const autoBoundCandidate = pickAutoBoundAppleApp(candidates, bundleId);
        const nextWebhook =
            autoBoundCandidate && autoBoundCandidate.id !== webhook?.asc_app_id
                ? await syncWebhookBindingFromCandidate({
                      service,
                      userId: user.id,
                      appId,
                      webhook,
                      candidate: autoBoundCandidate,
                  })
                : webhook;

        return json(res, 200, {
            candidates,
            auto_bound_app_id: autoBoundCandidate?.id || null,
            webhook: nextWebhook,
        });
    } catch (error) {
        return json(res, toPublicErrorStatus(error), {
            error: String(error?.message || 'Failed to load App Store Connect apps.').slice(0, 1000),
        });
    }
}
