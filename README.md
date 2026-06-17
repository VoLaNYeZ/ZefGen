# ZefGen

ZefGen is a React and Supabase workspace for planning, generating, and preparing app releases. It brings app ideas, setup data, generated assets, App Store metadata, screenshots, legal links, and release automation into one operator-focused dashboard.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS
- Supabase database, auth, storage, and edge functions
- Vercel serverless API routes
- Cloudflare Worker bridge for public App Store review webhook flows

## Local Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your own Supabase, GitHub, OpenAI, Replicate, and public bridge settings. Do not commit `.env.local`, `.secrets/`, or `cloudflare/appstore-review-bridge/wrangler.jsonc`.

## Useful Commands

```bash
npm run typecheck
npm run build
npm run check:credentials
npm run smoke
```

Supabase function deploy scripts read the target project from `SUPABASE_PROJECT_REF`.
