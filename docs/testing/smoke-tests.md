# Smoke Tests

Browser smoke coverage lives in `tests/smoke` and runs against the real app shell plus a deterministic local Supabase stack.

## Prerequisites

- Docker Desktop running
- Supabase CLI installed
- Node dependencies installed with `npm ci`

## Standard Run

```bash
npm run smoke
```

This is the authoritative regression path. It always reseeds the local smoke backend before Playwright starts.

`npm run smoke:backend` will:

- start the required local Supabase services
- reset the local database to current migrations
- create the deterministic smoke user
- seed the workspace data used by Playwright

`npm run smoke:test` will:

- start the Vite dev server on `http://127.0.0.1:4173`
- run the Playwright smoke suite in Chromium
- fail on unexpected `pageerror`, `console.error`, or failed navigations
- fail early with a clear dirty-seed error that tells you to rerun `npm run smoke:backend`

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

Treat reuse as a debugging shortcut, not as the authoritative regression command.

## Local Push Guard

This repo also supports a local `pre-push` smoke guard through `.githooks/pre-push`.

- It runs `npm run smoke` before `git push` when the pushed changes touch smoke-relevant code such as `components/`, `hooks/`, `data/`, `utils/`, `tests/smoke/`, `supabase/`, `cloudflare/`, or `playwright.config.ts`.
- It skips the smoke suite automatically for obviously unrelated pushes.
- You can bypass it once with `SKIP_SMOKE_PREPUSH=1 git push`.

Manual invocation:

```bash
npm run guard:pre-push
```

## Common Failure

If `npm run smoke:backend` stalls while pulling local Supabase images, check Docker Desktop networking or proxy settings first. The local stack pulls images from Supabase registries before the tests can start.
