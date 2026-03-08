# App Store Review Webhook via `appshelp.cc`

This setup hides your Supabase URL from Apple by putting a Cloudflare Worker in front of the existing `appstore-review-webhook` Supabase function.
The same Worker also serves the lightweight public landing page on each app subdomain and now handles the Apple setup/test API calls too.

What Apple sees:

- `https://holdlist-in-due-time.appshelp.cc/appstore-review?token=...`
- `https://holdlist-in-due-time.appshelp.cc/_bridge/appstore/...`

What Apple does not see:

- `https://onzswbbqaikkjpmvzplb.supabase.co/functions/v1/appstore-review-webhook`

Managed/default flow is always `*.appshelp.cc`.
Legacy explicit custom HTTPS webhook URLs can still work, but direct `supabase.co` webhook URLs are not supported anymore.

## What this isolates

This setup isolates both:

- inbound webhook delivery from Apple
- Apple-facing setup/test API calls (`Load Apple apps`, `Sync Apple webhook`, `Send test`)

Shared ZefGen can still read status, but Apple only sees `*.appshelp.cc`.

## 1. Create the wildcard DNS record

In Cloudflare for `appshelp.cc`:

1. Open `DNS`.
2. Add a record:
   - Type: `A`
   - Name: `*`
   - IPv4 address: `192.0.2.1`
   - Proxy status: `Proxied`
3. Save it.

The IP itself is only a placeholder. The important part is that the wildcard host is proxied through Cloudflare so the Worker route can catch every subdomain.

## 2. Create the Worker

Use the files in [cloudflare/appstore-review-bridge/worker.js](/Users/faridzeyn/Apps/ZefGen/cloudflare/appstore-review-bridge/worker.js) and [cloudflare/appstore-review-bridge/wrangler.jsonc.example](/Users/faridzeyn/Apps/ZefGen/cloudflare/appstore-review-bridge/wrangler.jsonc.example).

Set:

- `route`: `*.appshelp.cc/*`
- `PUBLIC_ROOT_DOMAIN`: `appshelp.cc`

Important:

- Do not include `?token=...` in `INTERNAL_WEBHOOK_BASE_URL`.
- The Worker forwards the incoming query string unchanged, so each app keeps its own existing token.
- Set the Worker secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put INTERNAL_WEBHOOK_BASE_URL
```

## 3. Deploy the Worker

From the worker folder:

```bash
npx wrangler whoami
npx wrangler deploy
```

If you are not authenticated yet:

```bash
npx wrangler login
```

## 4. Verify the wildcard route works

There is no public health endpoint anymore.

Use one of these checks instead:

- After you publish a real app webpage, open its final URL like `https://holdlist-in-due-time.appshelp.cc/`
- Before any app is published, opening `https://test.appshelp.cc/` should return `404 Not found` from the Worker instead of a Cloudflare connection error

## 5. Tell ZefGen to suggest `appshelp.cc` subdomains

In `.env.local`:

```env
VITE_APPSTORE_REVIEW_PROXY_ROOT_DOMAIN=appshelp.cc
```

Then restart the dev server.

After that, the App Store review webhook panel will auto-suggest a public URL like:

```text
https://holdlist-in-due-time.appshelp.cc/appstore-review?token=...
```

The readable part comes only from `App's App Store name`.
If that field is empty, ZefGen will block automatic subdomain allocation and tell you to fill it first.
If the clean hostname is already taken, ZefGen allocates `-2`, then `-3`, and so on.

## 6. Per app, what you do in ZefGen

For each app:

1. Click `Create receiver`.
2. Confirm the `Public webhook URL Apple calls` is an `appshelp.cc` subdomain, not the raw Supabase host.
3. Enter:
   - `Key ID`
   - `Team / Issuer ID`
   - `.p8`
4. Click `Save Apple config`.
5. Click `Load Apple apps`.
6. Pick the matching App Store Connect app.
7. Click `Sync Apple webhook`.
8. Click `Send test`.
9. If you also want the landing page live, click `Generate webpage` in Setup once App Store description + Privacy + Terms + Support are ready.

The public page stays dark until `Generate webpage` is clicked.
After that, `https://holdlist-in-due-time.appshelp.cc/` goes live and reflects later saved Setup edits automatically.

## 7. If you want the absolute minimum manual fallback

If Apple automation is failing but the Worker is already live, you can still create the webhook manually in App Store Connect with:

- URL: the `appshelp.cc` public URL shown in ZefGen
- Secret: the signing secret shown in ZefGen
- Event type: `APP_STORE_VERSION_APP_VERSION_STATE_UPDATED`

## Common mistakes

- `Public webhook URL Apple calls` still shows `supabase.co`
  - `VITE_APPSTORE_REVIEW_PROXY_ROOT_DOMAIN` is missing or the dev server was not restarted.

- `https://test.appshelp.cc/` fails with a Cloudflare connection error instead of returning `404`
  - the wildcard DNS record is missing or not proxied
  - the Worker route was not added for `*.appshelp.cc/*`

- `/privacy`, `/terms`, `/support`, or `/icon` return 404
  - the page was never published with `Generate webpage`
  - the app does not have that setup data or picked icon yet
  - the Worker is missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`

- `Load Apple apps`, `Sync Apple webhook`, or `Send test` fail with auth/session errors
  - the Worker is missing `SUPABASE_ANON_KEY`
  - your browser session token is expired

- Apple deliveries fail signature validation
  - the Worker must forward the raw body unchanged
  - do not parse and re-serialize the JSON before forwarding
