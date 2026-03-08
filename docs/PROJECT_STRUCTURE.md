# Project Structure

Concise overview of the current post-refactor layout. Excludes `node_modules/` and `dist/`.
Screenshot prompts are stored in Supabase (`app_screenshot_prompts`).
Screenshot sets + export picks/completion state are stored in Supabase (`app_screenshot_sets`, `app_asset_picks`, `app_export_status`).
Brand release planning metadata is stored in Supabase on `brands` (`target_countries`, `keywords`, `release_strategy_notes`, `release_strategy_updated_at`).
Brand ordering is stored in Supabase on `brands.order_index` (drag-and-drop reorder in Sidebar edit mode).
Accounts are stored in Supabase (`appstore_accounts`) and managed via the `/accounts` screen (pooled rows, optional 1-per-app assignment).
Ideas are stored in Supabase (`app_ideas`) with fixed categories in `app_idea_categories`; selected idea per app is persisted on `connector_app_configs.idea_id`.
Canonical App Store links are stored on `apps.appstore_url` and edited from the workspace App Store row.
Workspace collaboration presence + brand locks are stored in Supabase (`workspace_sessions`) and mediated via `/api/workspace-sessions`.
Hybrid lock UX is enabled by default: busy brands can be opened in view-only mode and require explicit “Start editing” claim before writes.
`No Brand` is a system-managed workspace bucket (real brand row) rendered as a separate fixed sidebar section above Accounts/Ideas, with a dedicated slate/cyan visual style to distinguish it from regular brands.
App aliases are globally unique per user (case-insensitive) via `public.apps (user_id, lower(alias))`.

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
- `lib/` - Shared runtime helpers, service clients, and server-only logic (including Supabase clients and webhook helpers).
- `public/` - Static assets.
- `docs/` - Product and design documentation.
- `supabase/` - Supabase configuration and local dev assets.
- `contexts/` - Reserved for future React contexts (currently empty).

## components/app Breakdown
- `components/app/AppShell.tsx` - Main authenticated UI state + orchestration (including collaboration hook wiring, hybrid soft-lock read-only mode, explicit lock-claim CTA, write guards, and No Brand Step 11 move-to-brand flow).
- `components/app/Sidebar.tsx` - Brand list, brand form, global controls, active-session indicator, and lock-state badges/notices (locked brands remain openable in view mode). Renders No Brand as a dedicated fixed system card (outside reorderable list) with its own slate/cyan palette.
- `components/app/BrandReleaseInfoPanel.tsx` - Brand release planning fields (target countries, keywords, release notes) with read-only write guards.
- `components/app/BrandReferencesPanel.tsx` - Collapsible screenshot reference library for the brand (read-only aware for upload/delete/reorder).
- `components/app/CountryMultiSelect.tsx` - Multi-select dropdown used for Target countries.
- `components/app/AppFolder.tsx` - App-folder wrapper and gooey layout container.
- `components/app/AppPills.tsx` - App pill row with drag/reorder and toggle.
- `components/app/AppFormCard.tsx` - Create/edit app form UI.
- `components/app/AppSimulatorSection.tsx` - Simulator screenshots upload + reorder (Step 8 in the AppFolder), read-only aware.
- `components/app/AppGenerationSection.tsx` - Generation UI modules (Icon generation, Screenshot prompts, Generated screenshots), read-only aware. In No Brand mode icon prompt is app-level (`apps.icon_prompt`) and does not require brand icon reference; screenshot slots omit brand references and may optionally reuse style from previously generated screenshots.
- `components/app/StepBlock.tsx` - Step badge wrapper used to render workflow numbers outside the folder body.
- `components/app/DevFilesPanel.tsx` - GitHub repository panel (create/delete repo, clone command), read-only aware.
- `components/app/AppStoreLinkRow.tsx` - Canonical App Store URL row (save/copy/open + geo chips from target countries), read-only aware.
- `components/app/AppStoreReviewWebhookRow.tsx` - App Store Connect review-webhook control row (receiver creation, Apple credential save, `appshelp.cc` bridge sync/test, recent delivery timeline), read-only aware.
- `components/app/ConnectorClientSpecPanel.tsx` - Step 2 idea picker (category + idea dropdowns) + client spec editor.
- `components/app/ConnectorVariablesSecretsPanel.tsx` - Connector config: variables + secrets (Step 3), including `Generate links` and `Generate webpage` actions.
- `components/app/AccountsPage.tsx` - Accounts pool UI (`/accounts`): view/edit modes, save-all, copy, optional app assignment.
- `components/app/IdeasPage.tsx` - Ideas pool UI (`/ideas`): category + description rows with per-row save/delete.
- `components/app/ConnectorRunnerPanel.tsx` - Hosted runner UI: jobs, messages, questions, generate/fix actions (Step 5), read-only aware.
- `components/app/IntegrationModulePanel.tsx` - Integration readiness checklist (placeholder) driven by Setup data (Step 6), with optional IAP surfaced as non-blocking.
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
3. Connector config: Variables + Secrets (`components/app/ConnectorVariablesSecretsPanel.tsx`)
4. GitHub repository (`components/app/DevFilesPanel.tsx`)
5. Development (`components/app/ConnectorRunnerPanel.tsx`)
6. Integration (placeholder) (`components/app/IntegrationModulePanel.tsx`)
7. Auto-release (placeholder) (`components/app/AutoReleaseModulePanel.tsx`)
8. Simulator screenshots (`components/app/AppSimulatorSection.tsx`)
9. Screenshot prompts (`components/app/AppGenerationSection.tsx` via `ScreenshotPromptsModule`)
10. Generated screenshots (`components/app/AppGenerationSection.tsx` via `GeneratedScreenshotsModule`)
11. No Brand only: Move app to regular brand (`components/app/AppShell.tsx`)

No Brand nuance:
- In No Brand mode, Steps 1 and 2 are swapped: Client spec is Step 1 and Icon generation is Step 2.
- Icon prompt supports an AI helper button that derives a prompt idea from the first client-spec lines (`/api/generate-icon-prompt`, default model `gpt-5.2`).

The sticky Deliverables rail is anchored to Steps 8–10 only.

## Integration Step (Readiness + Action)
The Integration step (Step 6) is an action station driven by the values stored in Setup data (Step 3). It shows readiness badges, an editable `base_branch`, the latest integration status, and queues the `Integration` job only when required data is present.

- Apphud Key → Setup data: Variables `apphud_api_key`
- IAP Product ID (optional) → Setup data: Variables `id_purchases`
- Analytics URL → Setup data: Variables `domain` (the worker adapts to the CRM key directly)
- Bundle ID → Setup data: Variables `bundle_id`
- Privacy Policy URL → Setup data: Variables `privacy_policy_url`
- Terms of Use URL → Setup data: Variables `terms_of_use_url`
- Support form URL → Setup data: Variables `support_form_url`
- Firebase plist snippet → Setup data: Variables `firebase_plist_snippet`
- Company name → Setup data: read-only and sourced from the app’s assigned usable account (`appstore_accounts.company_name`)
- `base_branch` defaults to `main`, is editable per app, and is used for all code-producing jobs. QA and Screenshots stay SHA-driven downstream.

## Auto-Release Step (Placeholder)
Step 7 (“Auto-release”) is a placeholder for future Fastlane setup and release automation.

- Gating: the “Fastlane integration” button is disabled until all Integration (Step 6) requirements are filled.
- Current behavior: when enabled and clicked, it only shows a “Coming soon” toast (no repo modifications yet).
- Future intent: use the same Setup data + secrets to apply a Fastlane integration template into the app repo (and later run delivery jobs).

## hooks Breakdown
- `hooks/use-auth-session.ts` - Supabase auth session + loading state.
- `hooks/use-brands.ts` - Brand list + brand form state and CRUD (ensures exactly one system No Brand row per user and keeps it non-editable/reorder-excluded).
- `hooks/use-apps.ts` - App list + app form, reorder, and ban/unban (global alias auto-allocation + collision notifications).
- `hooks/use-brand-references.ts` - Brand references CRUD, uploads, and prompts.
- `hooks/use-app-screenshots.ts` - Simulator screenshots CRUD and uploads.
- `hooks/use-generated-assets.ts` - Generation actions, downloads, and edit state.
- `hooks/use-generation-jobs.ts` - In-memory job tracking for long-running operations (generation, ZIP).
- `hooks/use-app-screenshot-prompts.ts` - Screenshot prompt persistence in Supabase.
- `hooks/use-connector-config-form.ts` - Loads/saves Connector app config (+ selected `idea_id`) and secret metadata (used by Step 2/3 panels).
- `hooks/use-app-ideas.ts` - Ideas/categories pool list + CRUD for `/ideas`.
- `hooks/use-connector-messages.ts` - Connector runner message log + Q/A transcript.
- `hooks/use-route-sync.ts` - URL sync with selected brand/app (alias matching normalized case-insensitively).
- `hooks/use-workspace-collaboration.ts` - Session presence polling + heartbeat, brand lock claim/release, lock conflict state, and optional `heartbeatBrandId` lock-hold override.
- `hooks/use-signed-url-cache.ts` - Signed URL caching for storage assets.
- `hooks/use-slot-mappings.ts` - Slot mapping persistence.
- `hooks/use-app-folder-layout.ts` - Gooey layout measurements + refs; background height is derived from normal-flow content bounds so the folder can shrink correctly after collapsed sections.
- `hooks/use-app-pill-pan.ts` - Pointer-based horizontal panning logic.
- `hooks/use-detect-browser.ts` - Browser detection helper.
- `hooks/use-screen-size.ts` - Screen size tracking.
- `hooks/use-connector-jobs.ts` - Connector job polling + runner job lifecycle actions.
- `hooks/use-connector-job-queue.ts` - Global Runner job polling across apps (feeds the bottom-right job queue widget).
- `hooks/use-appstore-accounts.ts` - App Store accounts pool list + CRUD (feeds `/accounts` and Setup data account block).

## data Breakdown
- `data/auth.ts` - Auth actions (sign out).
- `data/brands.ts` - Brand queries and writes.
- `data/apps.ts` - App queries and writes (includes `move_app_to_brand` RPC wrapper).
- `data/brand-references.ts` - Brand reference queries + storage ops.
- `data/app-screenshots.ts` - App screenshot queries + storage ops.
- `data/generated-assets.ts` - Generated asset queries + storage ops.
- `data/screenshot-sets.ts` - Screenshot set queries and writes (`app_screenshot_sets`).
- `data/asset-picks.ts` - Export pick queries and writes (`app_asset_picks`).
- `data/export-status.ts` - Completion status queries and writes (`app_export_status`).
- `data/app-screenshot-prompts.ts` - Screenshot prompt upserts/deletes.
- `data/connector-app-config.ts` - Connector non-secret app config (`connector_app_configs`).
- `data/app-ideas.ts` - Ideas/categories CRUD (`app_ideas`, `app_idea_categories`).
- `data/connector-secrets.ts` - Connector secrets write-only storage (`connector_app_secrets`).
- `data/connector-legal-links.ts` - Legal links precheck/fingerprint + Edge Function invoke (`generate-legal-links`).
- `data/appstore-description.ts` - App Store description generation API client (`/api/generate-appstore-description`) with auth refresh/retry.
- `data/appstore-review-webhooks.ts` - App Store review webhook row/event queries and writes (`appstore_review_webhooks`, `appstore_review_events`).
- `data/appstore-review-webhook-api.ts` - Webhook status + `appshelp.cc` bridge client (`/api/appstore-review-webhook-status`, `/_bridge/appstore/*`).
- `data/icon-prompt.ts` - No Brand icon prompt generation API client (`/api/generate-icon-prompt`) with auth refresh/retry.
- `data/connector-jobs.ts` - Runner job queue (`connector_jobs`) + user-level job fetch for the global job widget.
- `data/connector-messages.ts` - Runner message log + Q/A (`connector_job_messages`).
- `data/appstore-accounts.ts` - App Store accounts pool CRUD (`appstore_accounts`).

## api Breakdown
- `api/workspace-sessions.ts` - Collaboration endpoint for `snapshot | heartbeat | claim_brand | release_brand`.
  - Presence snapshot is computed from table rows (`workspace_sessions`) using a 180s recency window (`last_seen_at`).
  - `active_session_count` is unique per `client_device_id` (deduped devices, not raw tab/session rows).
  - Brand locks remain strict on active lease (`expires_at > now()`) with 30s TTL.
  - Retention cleanup is best-effort per request: deletes caller-owned rows older than 48h past expiry.
- `api/provider-status.ts` - Environment/provider diagnostics endpoint.
- `api/generate-screenshot.ts` - Server-side screenshot generation proxy.
- `api/generate-appstore-description.ts` - Server-side App Store description generator (OpenAI-backed, bearer-protected).
- `api/generate-icon-prompt.ts` - Server-side No Brand icon-prompt generator (OpenAI-backed, bearer-protected).
- `api/appstore-review-webhook-status.js` - Read-only webhook status/events endpoint for the workspace UI.
- `api/create-github-repo.ts` - GitHub repository creation endpoint.
- `api/delete-github-repo.ts` - GitHub repository deletion endpoint.

## utils Breakdown
- `utils/slug.ts` - Slug creation helpers (`makeUniqueAlias` allocates first free numbered alias, e.g. `ef-02` instead of `ef-01-2`).
- `utils/routes.ts` - Route build/parse helpers.
- `utils/id.ts` - ID creation helper.
- `utils/images.ts` - Image validation, loading, resizing, and rendering.
- `utils/dom.ts` - Auto-grow textarea sync.
- `utils/download.ts` - Download trigger helper.
- `utils/appstore.ts` - App Store URL normalization and geo-link helpers.
- `utils/retry.ts` - Retry helper for async actions.
- `utils/runner-log.ts` - Best-effort parser that compacts Runner log lines into a user-friendly status view.
- `utils/no-brand.ts` - No Brand detector utility (supports legacy rows via slug/name fallback).

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
  - In No Brand mode, `brandRefId` is always forced to `null` and ignored by generation even if stale legacy values exist in localStorage/DB prompts.
  - Users can select “No reference” per slot (persisted as `brandRefId: null`). Generation still works by reusing image 1 as image 2 and instructing the provider to ignore image 2.
  - When “No reference” is selected, the per-slot prompt is stored in `localStorage` per app + set + slot: `zefgen.slotPrompt.<appId>.<setId>.<slotIndex>`.
- Slot system prompts:
  - Each screenshot slot shows a “System prompt” block (provider-facing instructions).
  - Overrides are stored in `localStorage` per app + screenshot set + slot (generate/enhance modes) and used for subsequent generations.
- Picks + completion:
  - Users explicitly pick 1 icon and 1 screenshot per slot per set for export (`app_asset_picks`).
  - “Mark as completed” validates picks and can prune unpicked generated assets to save storage (`app_export_status`).
  - When deliverables are collapsed, only the deliverables/generation workspace is compacted; the App Store link, review webhook row, and icon step remain visible in setup.
  - In collapsed mode, the deliverables panel shows download-only ZIP buttons per set.

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

## Workspace Collaboration (Brand Locks + Presence)
- Base migration: `supabase/migrations/2026-02-18_workspace_sessions_brand_lock.sql`
  - Table: `public.workspace_sessions`
  - RPCs: `workspace_claim_brand_lock`, `workspace_heartbeat_session`, `workspace_release_brand_lock`, `workspace_snapshot`
- Follow-up migration: `supabase/migrations/2026-02-18_workspace_sessions_lock_preserve_conflict.sql`
  - Preserves existing lock on blocked switch and adds `session_id_collision` handling.
- Presence-window migration: `supabase/migrations/2026-02-18_workspace_presence_window.sql`
  - Keeps lock enforcement strict while widening snapshot presence recency semantics.
- Current runtime path:
  - API snapshot reads table rows directly and normalizes payload shape.
  - Lock actions prefer RPC; API has table-based fallback paths for resilience.
  - Client hook (`hooks/use-workspace-collaboration.ts`) uses persistent `client_device_id` (localStorage) and per-load `client_session_id` (runtime), polls every 10s, and triggers immediate refresh on focus/visibility/online.
- Hybrid soft-lock mode (current default):
  - Controlled by `WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED` (`constants/zefgen.ts`).
  - Busy brand by another device opens in view-only mode instead of hard navigation block.
  - Workspace shows top notice with explicit “Start editing” button to attempt lock claim.
  - Heartbeat lock-hold is decoupled from selected brand via `heartbeatBrandId`; read-only viewing does not keep claiming the lock.
  - If lock is lost mid-edit, user stays on the same brand and switches to read-only (no forced brand redirect).
  - Write paths across workspace panels are guarded in read-only mode; read-safe actions (navigation/open/copy/preview) remain available.

## App Store URL (Workspace Surface)
- Migration: `supabase/migrations/2026-02-18_apps_appstore_url.sql`
  - Adds `public.apps.appstore_url`.
- UI: `components/app/AppStoreLinkRow.tsx` (shown in workspace when an app is selected).
- Utilities: `utils/appstore.ts` for canonicalization and geo-friendly URL helpers.

## App Store Review Webhooks
- Migration: `supabase/migrations/2026-03-07_appstore_review_webhooks.sql`
  - Adds `public.appstore_review_webhooks` (one listener config per app).
  - Adds `public.appstore_review_events` (append-only delivery timeline per app).
- Migration: `supabase/migrations/2026-03-07_appstore_review_webhooks_apple_connect.sql`
  - Adds Apple binding/sync metadata (`key_mode`, `key_id`, `issuer_id`, `asc_app_id`, `apple_webhook_id`, etc).
- Migration: `supabase/migrations/2026-03-08_appstore_review_webhook_public_subdomain.sql`
  - Adds persistent clean `public_subdomain` allocation for `*.appshelp.cc`.
- Migration: `supabase/migrations/2026-03-08_appstore_review_webhook_publish_and_bridge.sql`
  - Adds `public_page_published_at` and bridge/public-page support fields.
- UI: `components/app/AppStoreReviewWebhookRow.tsx` (rendered below the App Store URL row in the workspace).
- Data layer: `data/appstore-review-webhooks.ts`.
- Bridge client: `data/appstore-review-webhook-api.ts` (browser calls to `https://{subdomain}.appshelp.cc/_bridge/appstore/...`).
- Utility: `utils/appstore-review-webhook.ts` (clean `public_subdomain` + effective public webhook/page URL helpers).
- Status/read API: `api/appstore-review-webhook-status.js` (shared ZefGen reads current webhook state for the UI).
- Worker bridge/public surface: `cloudflare/appstore-review-bridge/worker.js`
  - `/_bridge/appstore/apps|sync|ping` = Apple-facing setup/test actions
  - `/appstore-review` = raw webhook forwarder to the hidden Supabase receiver
  - `/`, `/privacy`, `/terms`, `/support`, `/icon` = public app page/redirect/icon routes on the same subdomain
- Hidden receiver: `supabase/functions/appstore-review-webhook/index.ts` (called behind the Worker; deploy with `--no-verify-jwt`).
- Public URL behavior:
  - Managed/default flow is `https://{subdomain}.appshelp.cc/appstore-review?token=...`.
  - Public landing page flow is `https://{subdomain}.appshelp.cc/` after explicit `Generate webpage`.
  - Legacy explicit custom HTTPS webhook URLs are still honored if they are not the raw Supabase host.

## Alias Uniqueness & Allocation
- DB contract:
  - Legacy per-brand index remains: `apps_brand_alias_key`.
  - Global enforcement index: `apps_user_alias_lower_key` on `(user_id, lower(alias))`.
  - Different users may reuse the same alias; uniqueness scope is per user workspace.
- Migration behavior:
  - `supabase/migrations/2026-03-02_global_alias_uniqueness.sql` fails fast if existing duplicates are found by `(user_id, lower(alias))`.
- App create/edit behavior:
  - Alias input is normalized with `slugify`.
  - If requested alias is busy globally for the same user, client auto-picks first free alias.
  - For numbered aliases, allocator picks first free number (`ef-01` busy -> `ef-02`, not `ef-01-2`).
  - UI shows a toast notification when auto-adjustment is applied.
- No Brand move behavior:
  - Step 11 alias collision preflight is global (all apps of same user).
  - Auto-adjusted alias is surfaced to user via toast notification.

## Legal Links Generation (Step 3 Setup data)
- Trigger UI: `Generate links` / `Regenerate links` in `components/app/ConnectorVariablesSecretsPanel.tsx`.
- Related publish action: `Generate webpage` / `Open webpage` in the same panel controls when the public `appshelp.cc` page goes live.
- Backend: Supabase Edge Function `supabase/functions/generate-legal-links/index.ts`.
- Output keys in `connector_app_configs.variables`:
  - `privacy_policy_url`
  - `terms_of_use_url`
  - `support_form_url`
- History table: `public.connector_legal_links` (succeeded/failed runs, fingerprint, metadata).
- Atomic success write: RPC `public.connector_commit_legal_links_success(...)` updates setup URLs + inserts success run in one transaction.

### Inputs / preconditions
- Required data:
  - `company_name` (from variables, fallback to assigned account company name)
  - `appstore_name`
  - assigned account `email`
- `appstore_name` is capped at 30 chars (App Store constraint).
- Frontend blocks generation when required inputs are missing.

### Generation behavior
- Fingerprint = `sha256(normalize(company_name) + "|" + normalize(appstore_name) + "|" + normalize(email))`.
- If latest succeeded run has same fingerprint and `confirmRegenerate=false`, function returns `confirm_required`.
- Creates per-app folder in Google My Drive (`zefgen-<appId>-<slug>`), then:
  - Google Doc: Privacy Policy
  - Google Doc: Terms of Use
  - Google Form: Support form
- Docs are shared as anyone-with-link reader.
- Form is published and accepting responses.
- On failure after partial file creation, function does best-effort cleanup by moving created Google files to trash.

### Parallel App Store Description Generation (Step 3)
- Trigger: same Step 3 button (`Generate links` / `Regenerate links`) now runs two tasks in parallel:
  - legal links generation (Supabase Edge Function);
  - App Store description generation (Vercel API).
- Description endpoint: `POST /api/generate-appstore-description` (`api/generate-appstore-description.ts`).
- Auth model for endpoint: `Authorization: Bearer <supabase_access_token>` verified via Supabase `/auth/v1/user`.
- Data layer client: `data/appstore-description.ts`.
- Hook integration: `hooks/use-connector-config-form.ts` adds:
  - `generateDescriptionBusy`
  - `regenerateAppstoreDescription(...)`
- Storage target: generated text is saved into `connector_app_configs.variables.appstore_description`.
- Short-spec rule:
  - If `project_brief` (`Client spec`) has fewer than 100 chars, description generation returns `skipped_short_spec`.
  - This does not block legal links generation.
- Prompting:
  - 3 in-code long-form prompt templates.
  - One template is selected randomly per run (uniform distribution).
  - Output is validated server-side for length, paragraph structure, bullet overuse, and generic CTA endings before it is saved.
- Field-level actions (Step 3 Variables):
  - `appstore_description` has `Regenerate` (description-only) and `Copy`.
  - `Regenerate` is disabled when `Client spec < 100`.

### Where support form responses go
- Responses are stored in Google Forms (Google account context), not in Supabase.
- Supabase stores only generated URLs + generation run history.

### Auth model (important)
- Google side: OAuth refresh token flow (`GOOGLE_OAUTH_*` secrets), personal My Drive mode.
- Supabase side for this function: deploy with gateway JWT verification disabled and validate bearer token inside function via `service.auth.getUser(token)`.
- Deployment guardrail command:
  - `npm run deploy:legal-links`
  - (equivalent) `supabase functions deploy generate-legal-links --project-ref onzswbbqaikkjpmvzplb --use-api --no-verify-jwt`

### Common troubleshooting
- `Invalid JWT` / auth errors on invoke:
  - ensure function was deployed with `--no-verify-jwt`;
  - hard refresh app and re-login once;
  - verify frontend uses current auth session (data-layer handles refresh/retry).
- Google 403 quota/storage errors:
  - check target Google account storage and OAuth scopes.

## Generation Providers (Prod)
- `api/generate-screenshot.ts` runs server-side on Vercel so provider keys are never exposed to the client.
- `api/generate-appstore-description.ts` runs server-side on Vercel for text generation.
- Replicate:
  - Requires `REPLICATE_API_TOKEN` in the prod environment.
  - Supported models in this app:
    - `google/nano-banana-pro`
    - `google/nano-banana-2` (wired with `resolution=2K`, `google_search=false`, `image_search=false`)
    - `bytedance/seedream-4`
  - If the token/account has insufficient credit, Replicate responds with 402 and the UI surfaces a billing/token ownership hint.
- OpenAI:
  - Requires `OPENAI_API_KEY` in the prod environment.
  - Optional model override for appstore descriptions: `OPENAI_APPSTORE_MODEL` (default: `gpt-5.2`).

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
- `npm run dev` also mounts a small local middleware for a subset of `/api/*` routes (currently: `generate-screenshot`, `generate-appstore-description`, `generate-icon-prompt`, `create-github-repo`, `delete-github-repo`, `workspace-sessions`) so you can iterate without `vercel dev`.
- The local middleware also exposes `GET /api/provider-status` for quick env diagnostics.
- To run the full Vercel routing layer locally (for `/api/*` + rewrites), use `vercel dev` (requires Vercel CLI) and ensure env vars are set.
