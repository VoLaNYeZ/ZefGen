# Project Structure

Concise overview of the current post-refactor layout. Excludes `node_modules/` and `dist/`.
Screenshot prompts are stored in Supabase (`app_screenshot_prompts`).

## Top-Level Files
- `App.tsx` - App entry that gates auth and mounts `AppShell`.
- `index.tsx` - React bootstrap and root render.
- `index.html` - Vite HTML entry.
- `index.css` - Global styles and app theme CSS (including app-folder styles).
- `i18n.ts` - Translation strings and `t()` helper.
- `package.json` - Scripts and dependencies.
- `tsconfig.json` - TypeScript compiler config.
- `vite.config.ts` - Vite build and dev config.
- `tailwind.config.js` - Tailwind theme and plugins.
- `postcss.config.js` - PostCSS config.
- `.env.local` - Local environment variables (not committed).
- `vercel.json` - Deployment config.
- `components.json` - Shadcn UI config.

## Key Directories
- `components/` - Reusable UI and feature components.
- `components/app/` - Main app UI split into focused sections (see breakdown below).
- `components/fancy/` - Custom visual effects, logo, and text treatments.
- `components/ui/` - Shared UI primitives (shadcn-style components).
- `data/` - Thin Supabase data access layer (queries, inserts, updates).
- `hooks/` - App hooks for auth, routing, layout, storage, and device handling.
- `utils/` - Pure helpers (routes, images, DOM, ids, downloads).
- `types/` - Domain types used across app features.
- `constants/` - Shared constants and configuration.
- `lib/` - External service clients (Supabase).
- `public/` - Static assets.
- `docs/` - Product and design documentation.
- `supabase/` - Supabase configuration and local dev assets.
- `contexts/` - Reserved for future React contexts (currently empty).

## components/app Breakdown
- `components/app/AppShell.tsx` - Main authenticated UI state + orchestration.
- `components/app/Sidebar.tsx` - Brand list, brand form, and global controls.
- `components/app/BrandReferencesPanel.tsx` - Brand icon + screenshot references UI.
- `components/app/AppFolder.tsx` - App-folder wrapper and gooey layout container.
- `components/app/AppPills.tsx` - App pill row with drag/reorder and toggle.
- `components/app/AppFormCard.tsx` - Create/edit app form UI.
- `components/app/AppSimulatorSection.tsx` - Simulator screenshots upload + reorder.
- `components/app/AppGenerationSection.tsx` - Generation controls, slot mapping, outputs.
- `components/app/EditPanel.tsx` - Text-layer editor for generated assets.
- `components/app/Lightbox.tsx` - Image lightbox overlay.
- `components/app/GenerationQueueWidget.tsx` - Bottom-right job/status widget for generation + ZIP downloads.
- `components/app/TextLayersCanvasOverlay.tsx` - Canvas-rendered text overlay for accurate shadow/outline preview.
- `components/app/ConfirmIconButton.tsx` - Reusable inline delete confirmation popover for image deletes.

## hooks Breakdown
- `hooks/use-auth-session.ts` - Supabase auth session + loading state.
- `hooks/use-brands.ts` - Brand list + brand form state and CRUD.
- `hooks/use-apps.ts` - App list + app form, reorder, and ban/unban.
- `hooks/use-brand-references.ts` - Brand references CRUD, uploads, and prompts.
- `hooks/use-app-screenshots.ts` - Simulator screenshots CRUD and uploads.
- `hooks/use-generated-assets.ts` - Generation actions, downloads, and edit state.
- `hooks/use-generation-jobs.ts` - In-memory job tracking for long-running operations (generation, ZIP).
- `hooks/use-app-screenshot-prompts.ts` - Screenshot prompt persistence in Supabase.
- `hooks/use-route-sync.ts` - URL sync with selected brand/app.
- `hooks/use-signed-url-cache.ts` - Signed URL caching for storage assets.
- `hooks/use-slot-mappings.ts` - Slot mapping persistence.
- `hooks/use-app-folder-layout.ts` - Gooey layout measurements + refs.
- `hooks/use-app-pill-pan.ts` - Pointer-based horizontal panning logic.
- `hooks/use-detect-browser.ts` - Browser detection helper.
- `hooks/use-screen-size.ts` - Screen size tracking.

## data Breakdown
- `data/auth.ts` - Auth actions (sign out).
- `data/brands.ts` - Brand queries and writes.
- `data/apps.ts` - App queries and writes.
- `data/brand-references.ts` - Brand reference queries + storage ops.
- `data/app-screenshots.ts` - App screenshot queries + storage ops.
- `data/generated-assets.ts` - Generated asset queries + storage ops.
- `data/app-screenshot-prompts.ts` - Screenshot prompt upserts/deletes.

## utils Breakdown
- `utils/slug.ts` - Slug creation helpers.
- `utils/routes.ts` - Route build/parse helpers.
- `utils/id.ts` - ID creation helper.
- `utils/images.ts` - Image validation, loading, resizing, and rendering.
- `utils/dom.ts` - Auto-grow textarea sync.
- `utils/download.ts` - Download trigger helper.
- `utils/retry.ts` - Retry helper for async actions.

## Generation/Download Notes
- Generated assets upload a small `-preview.jpg` variant for fast UI thumbnails/lightbox.
- “Download all screenshots” produces a ZIP of final-rendered images named in App Store order (`iOS 6.5 1.jpg`, ...).
- While generation/ZIP is running, app/brand switching is blocked and the app warns on refresh/close to avoid wasting work.

## How to Add Features
Use this path when introducing a new domain feature (data + UI).
1. Define or extend domain types in `types/zefgen.ts`.
2. Add Supabase queries in `data/` (one file per domain object).
3. Create a hook in `hooks/` to own state + side effects + actions.
4. Add a focused UI component in `components/app/` (or `components/` if shared).
5. Wire the hook and component in `components/app/AppShell.tsx`.
6. Update `docs/PROJECT_STRUCTURE.md` to document the new files and responsibilities.

Data flow: UI component → hook → data layer → Supabase.

## Local Dev Notes
- `npm run dev` runs the Vite client only (no `/api/*` serverless functions).
- To run Vercel Functions locally (for `/api/*`), use `vercel dev` (requires Vercel CLI) and ensure env vars are set.
