# Smoke Tests

Browser smoke coverage lives in `/Users/faridzeyn/Apps/ZefGen/tests/smoke` and runs against the real app shell plus a deterministic local Supabase stack.

## Prerequisites

- Docker Desktop running
- Supabase CLI installed
- Node dependencies installed with `npm ci`

## Standard Run

```bash
npm run smoke:backend
npm run smoke:test
```

`npm run smoke:backend` will:

- start the required local Supabase services
- reset the local database to current migrations
- create the deterministic smoke user
- seed the workspace data used by Playwright

`npm run smoke:test` will:

- start the Vite dev server on `http://127.0.0.1:4173`
- run the Playwright smoke suite in Chromium
- fail on unexpected `pageerror`, `console.error`, or failed navigations

## Debugging

Headed run:

```bash
npm run smoke:test:headed
```

Reuse an already-running dev server on purpose:

```bash
npm run smoke:test:reuse
```

Or headed with reuse:

```bash
npm run smoke:test:headed:reuse
```

Reuse is opt-in because the default smoke path should stay deterministic.

## Common Failure

If `npm run smoke:backend` stalls while pulling local Supabase images, check Docker Desktop networking or proxy settings first. The local stack pulls images from Supabase registries before the tests can start.
