# Project Structure

Concise overview of the current post-refactor layout. Excludes `node_modules/` and `dist/`.
Screenshot prompts are stored in Supabase (`app_screenshot_prompts`).
Screenshot sets + export picks/completion state are stored in Supabase (`app_screenshot_sets`, `app_asset_picks`, `app_export_status`).
Brand release planning metadata is stored in Supabase on `brands` (`target_countries`, `keywords`, `release_strategy_notes`, `release_strategy_updated_at`).
Brand ordering is stored in Supabase on `brands.order_index` (drag-and-drop reorder in Sidebar edit mode).

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
- `api/` - Vercel Serverless Functions (served under `/api/*` in production).
- `components/` - Reusable UI and feature components.
- `components/app/` - Main app UI split into focused sections (see breakdown below).
- `components/fancy/` - Custom visual effects, logo, and text treatments.
- `components/ui/` - Shared UI primitives (shadcn-style components).
- `data/` - Thin Supabase data access layer (queries, inserts, updates).
- `hooks/` - App hooks for auth, routing, layout, storage, and device handling.
- `utils/` - Pure helpers (routes, images, DOM, ids, downloads).
- `types/` - Domain types used across app features.
- `constants/` - Shared constants and configuration.
- `constants/countries.ts` - Static ISO country list + priority ordering for the Target countries dropdown.
- `lib/` - External service clients (Supabase).
- `public/` - Static assets.
- `docs/` - Product and design documentation.
- `supabase/` - Supabase configuration and local dev assets.
- `contexts/` - Reserved for future React contexts (currently empty).

## components/app Breakdown
- `components/app/AppShell.tsx` - Main authenticated UI state + orchestration.
- `components/app/Sidebar.tsx` - Brand list, brand form, and global controls.
- `components/app/BrandReleaseInfoPanel.tsx` - Brand release planning fields (target countries, keywords, release notes).
- `components/app/BrandReferencesPanel.tsx` - Collapsible screenshot reference library for the brand.
- `components/app/CountryMultiSelect.tsx` - Multi-select dropdown used for Target countries.
- `components/app/AppFolder.tsx` - App-folder wrapper and gooey layout container.
- `components/app/AppPills.tsx` - App pill row with drag/reorder and toggle.
- `components/app/AppFormCard.tsx` - Create/edit app form UI.
- `components/app/AppSimulatorSection.tsx` - Simulator screenshots upload + reorder (Step 6 in the AppFolder).
- `components/app/AppGenerationSection.tsx` - Generation UI modules (Icon generation, Screenshot prompts, Generated screenshots).
- `components/app/StepBlock.tsx` - Step badge wrapper used to render workflow numbers outside the folder body.
- `components/app/DevFilesPanel.tsx` - GitHub repository panel (create/delete repo, clone command).
- `components/app/ConnectorClientSpecPanel.tsx` - Idea picker placeholder + client spec editor (Step 2).
- `components/app/ConnectorVariablesSecretsPanel.tsx` - Connector config: variables + secrets (Step 4).
- `components/app/ConnectorRunnerPanel.tsx` - Hosted runner UI: jobs, messages, questions, generate/fix actions (Step 5).
- `components/app/IntegrationModulePanel.tsx` - Integration readiness checklist (placeholder) driven by Setup data (Step 6).
- `components/app/AutoReleaseModulePanel.tsx` - Auto-release / Fastlane placeholder (Step 7).
- `components/app/MatrixTerminal.tsx` - Matrix-themed terminal frame used by the Runner messages panel.
- `components/app/MatrixRain.tsx` - Canvas-based Matrix "code rain" idle animation (Runner).
- `components/app/EditPanel.tsx` - Text-layer editor for generated assets.
- `components/app/Lightbox.tsx` - Image lightbox overlay.
- `components/app/GenerationQueueWidget.tsx` - Bottom-right job/status widget for generation + ZIP + GitHub + Runner jobs.
- `components/app/TextLayersCanvasOverlay.tsx` - Canvas-rendered text overlay for accurate shadow/outline preview.
- `components/app/ConfirmIconButton.tsx` - Reusable inline delete confirmation popover for image deletes.

## AppFolder Steps (Module Order)
The App-level workflow inside the gooey folder is ordered as:
1. Icon generation (`components/app/AppGenerationSection.tsx` via `IconGenerationModule`)
2. Idea picker + Client spec (`components/app/ConnectorClientSpecPanel.tsx`) (project kind is fixed to iOS)
3. GitHub repository (`components/app/DevFilesPanel.tsx`)
4. Connector config: Variables + Secrets (`components/app/ConnectorVariablesSecretsPanel.tsx`)
5. Development (`components/app/ConnectorRunnerPanel.tsx`)
6. Integration (placeholder) (`components/app/IntegrationModulePanel.tsx`)
7. Auto-release (placeholder) (`components/app/AutoReleaseModulePanel.tsx`)
8. Simulator screenshots (`components/app/AppSimulatorSection.tsx`)
9. Screenshot prompts (`components/app/AppGenerationSection.tsx` via `ScreenshotPromptsModule`)
10. Generated screenshots (`components/app/AppGenerationSection.tsx` via `GeneratedScreenshotsModule`)

The sticky Deliverables rail is anchored to Steps 8–10 only.

## Integration Step (Badges → Setup Data Mapping)
The Integration step (Step 6) is a checklist driven by the values stored in Setup data (Step 4). Badges turn green once the corresponding field is filled.

- Apphud API key → Setup data: Secrets key `APPHUD_API_KEY`
- IAP Product ID → Setup data: Variables `id_purchases`
- Analytics URL → Setup data: Variables `domain` (re-labeled in UI; treated as `ANALYTICS_URL` by future integrations)
- Bundle ID → Setup data: Variables `bundle_id`
- Privacy Policy URL → Setup data: Variables `privacy_policy_url`
- Terms of Use URL → Setup data: Variables `terms_of_use_url`
- Support form URL → Setup data: Variables `support_form_url`
- Firebase plist snippet → Setup data: Variables `firebase_plist_snippet`

## Auto-Release Step (Placeholder)
Step 7 (“Auto-release”) is a placeholder for future Fastlane setup and release automation.

- Gating: the “Fastlane integration” button is disabled until all Integration (Step 6) requirements are filled.
- Current behavior: when enabled and clicked, it only shows a “Coming soon” toast (no repo modifications yet).
- Future intent: use the same Setup data + secrets to apply a Fastlane integration template into the app repo (and later run delivery jobs).

## hooks Breakdown
- `hooks/use-auth-session.ts` - Supabase auth session + loading state.
- `hooks/use-brands.ts` - Brand list + brand form state and CRUD.
- `hooks/use-apps.ts` - App list + app form, reorder, and ban/unban.
- `hooks/use-brand-references.ts` - Brand references CRUD, uploads, and prompts.
- `hooks/use-app-screenshots.ts` - Simulator screenshots CRUD and uploads.
- `hooks/use-generated-assets.ts` - Generation actions, downloads, and edit state.
- `hooks/use-generation-jobs.ts` - In-memory job tracking for long-running operations (generation, ZIP).
- `hooks/use-app-screenshot-prompts.ts` - Screenshot prompt persistence in Supabase.
- `hooks/use-connector-config-form.ts` - Loads/saves Connector app config + secret metadata (used by the Step 2/4 panels).
- `hooks/use-connector-messages.ts` - Connector runner message log + Q/A transcript.
- `hooks/use-route-sync.ts` - URL sync with selected brand/app.
- `hooks/use-signed-url-cache.ts` - Signed URL caching for storage assets.
- `hooks/use-slot-mappings.ts` - Slot mapping persistence.
- `hooks/use-app-folder-layout.ts` - Gooey layout measurements + refs.
- `hooks/use-app-pill-pan.ts` - Pointer-based horizontal panning logic.
- `hooks/use-detect-browser.ts` - Browser detection helper.
- `hooks/use-screen-size.ts` - Screen size tracking.
- `hooks/use-connector-jobs.ts` - Connector job polling + runner job lifecycle actions.
- `hooks/use-connector-job-queue.ts` - Global Runner job polling across apps (feeds the bottom-right job queue widget).

## data Breakdown
- `data/auth.ts` - Auth actions (sign out).
- `data/brands.ts` - Brand queries and writes.
- `data/apps.ts` - App queries and writes.
- `data/brand-references.ts` - Brand reference queries + storage ops.
- `data/app-screenshots.ts` - App screenshot queries + storage ops.
- `data/generated-assets.ts` - Generated asset queries + storage ops.
- `data/screenshot-sets.ts` - Screenshot set queries and writes (`app_screenshot_sets`).
- `data/asset-picks.ts` - Export pick queries and writes (`app_asset_picks`).
- `data/export-status.ts` - Completion status queries and writes (`app_export_status`).
- `data/app-screenshot-prompts.ts` - Screenshot prompt upserts/deletes.
- `data/connector-app-config.ts` - Connector non-secret app config (`connector_app_configs`).
- `data/connector-secrets.ts` - Connector secrets write-only storage (`connector_app_secrets`).
- `data/connector-jobs.ts` - Runner job queue (`connector_jobs`) + user-level job fetch for the global job widget.
- `data/connector-messages.ts` - Runner message log + Q/A (`connector_job_messages`).

## utils Breakdown
- `utils/slug.ts` - Slug creation helpers.
- `utils/routes.ts` - Route build/parse helpers.
- `utils/id.ts` - ID creation helper.
- `utils/images.ts` - Image validation, loading, resizing, and rendering.
- `utils/dom.ts` - Auto-grow textarea sync.
- `utils/download.ts` - Download trigger helper.
- `utils/retry.ts` - Retry helper for async actions.
- `utils/runner-log.ts` - Best-effort parser that compacts Runner log lines into a user-friendly status view.

## Generation/Download Notes
- Step markers:
  - Step number chips are rendered via `components/app/StepBlock.tsx` and visually indicate completion by turning green.
  - Step completion is UI heuristic-based (e.g. picked icon, project brief saved, repo present, variables filled, runner success, prompts/screenshots/export completion) and is non-blocking.
- Generated assets upload a small `-preview.jpg` variant for fast UI thumbnails/lightbox.
- Older assets may not have previews; the UI falls back to full-size objects automatically.
- “Download all screenshots” produces a ZIP of final-rendered images named in App Store order (`iOS 6.5 1.jpg`, ...).
- While client-side generation/ZIP is running, the app warns on refresh/close to avoid wasting work. Brand/app switching is allowed; jobs continue in background. Runner jobs do not trigger unload warnings.
- Screenshot sets:
  - Each app has a default set named `Original`, plus optional additional named sets (A/B tests).
  - Screenshot generation/enhancement is scoped to the currently selected set.
- Slot mappings + prompts:
  - Slot source mapping (simulator screenshot + optional brand reference) is stored in `localStorage` per app: `zefgen.slotMappings.<appId>`.
  - Users can select “No reference” per slot (persisted as `brandRefId: null`). Generation still works by reusing image 1 as image 2 and instructing the provider to ignore image 2.
  - When “No reference” is selected, the per-slot prompt is stored in `localStorage` per app + set + slot: `zefgen.slotPrompt.<appId>.<setId>.<slotIndex>`.
- Slot system prompts:
  - Each screenshot slot shows a “System prompt” block (provider-facing instructions).
  - Overrides are stored in `localStorage` per app + screenshot set + slot (generate/enhance modes) and used for subsequent generations.
- Picks + completion:
  - Users explicitly pick 1 icon and 1 screenshot per slot per set for export (`app_asset_picks`).
  - “Mark as completed” validates picks and can prune unpicked generated assets to save storage (`app_export_status`).
  - When the workspace is collapsed, the deliverables panel shows download-only ZIP buttons per set.

## GitHub Repo Creation
- Serverless endpoint: `api/create-github-repo.ts` (Vercel Function) creates a private repo, adds default collaborators, and seeds template files.
- Serverless endpoint: `api/delete-github-repo.ts` deletes the created repo and clears the stored app link.
- Templates live in `templates/github/*.tpl` and are committed into the created repo with simple `{{VAR_NAME}}` substitution.
- Important: keep runner-local instruction packs out of the remote repo. `ZefGen_Connector` blocks jobs if files like `INSTRUCTIONS.md`, `.agent/`, `docs/spec/`, etc become tracked in git.
- Repo links are persisted on `public.apps` so they work across devices: `github_repo_url`, `github_repo_full_name`.
- Invariant: repo creation requires a picked icon first, and seeds `assets/app_icon.jpg`.

## Connector (Hosted Runner)
- Migration: `supabase/migrations/2026-02-09_connector_runner_jobs.sql`
  - Tables: `connector_app_configs`, `connector_app_secrets`, `connector_jobs`, `connector_job_messages`
  - RPC: `connector_claim_next_job(p_runner_id text)` (service-role only)
- The Runner verify log (`verify_tail`) is hidden by default (too noisy for normal users).
  - Debug enable (local only): `localStorage.setItem('zefgen.debug.verifyTail', '1'); location.reload();`
- The Runner log output is compacted by default (product-grade).
  - Debug enable verbose logs (local only): `localStorage.setItem('zefgen.debug.runnerVerbose', '1'); location.reload();`
  - Debug disable: `localStorage.removeItem('zefgen.debug.runnerVerbose'); location.reload();`

## Generation Providers (Prod)
- `api/generate-screenshot.ts` runs server-side on Vercel so provider keys are never exposed to the client.
- Replicate:
  - Requires `REPLICATE_API_TOKEN` in the prod environment.
  - If the token/account has insufficient credit, Replicate responds with 402 and the UI surfaces a billing/token ownership hint.
- OpenAI:
  - Requires `OPENAI_API_KEY` in the prod environment.

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
- `npm run dev` also mounts a small local middleware for a subset of `/api/*` routes (currently: `generate-screenshot`, `create-github-repo`, `delete-github-repo`) so you can iterate without `vercel dev`.
- The local middleware also exposes `GET /api/provider-status` for quick env diagnostics.
- To run the full Vercel routing layer locally (for `/api/*` + rewrites), use `vercel dev` (requires Vercel CLI) and ensure env vars are set.
