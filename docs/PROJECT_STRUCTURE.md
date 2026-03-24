# Project Structure

Current repository map for the post-March 2026 layout.

This document focuses on maintained source directories and the product flows they own. Generated/runtime directories are intentionally not documented in detail: `node_modules/`, `node_modules.bak.20260206023905/`, `dist/`, `playwright-report/`, `test-results/`, `playwright/.auth/`, `playwright/.tmp/`, `supabase/.temp/`, `supabase/.branches/`, and `.vercel/`.

## Source Tree

```text
.
├── App.tsx
├── index.tsx
├── index.css
├── i18n.ts
├── api/
├── cloudflare/
├── components/
│   ├── app/
│   ├── fancy/
│   └── ui/
├── constants/
├── contexts/
├── data/
├── docs/
├── hooks/
├── lib/
├── public/
├── scripts/
├── supabase/
│   ├── functions/
│   └── migrations/
├── templates/
├── tests/
│   └── smoke/
├── types/
└── utils/
```

## Top-Level Files

- `App.tsx` - auth gate and top-level app entry that mounts the authenticated shell or the login page.
- `index.tsx` - React bootstrap.
- `index.css` - global styling, theme tokens, workspace layout styles, and shared utility classes.
- `index.html` - Vite HTML entry.
- `i18n.ts` - translations and `t()` helper.
- `package.json` - scripts and dependencies.
- `package-lock.json` - npm lockfile.
- `tsconfig.json` - TypeScript config.
- `vite.config.ts` - Vite config, local API middleware, and build settings.
- `vite-env.d.ts` - Vite client types.
- `tailwind.config.js` / `postcss.config.js` - styling toolchain config.
- `playwright.config.ts` - smoke-test harness config.
- `vercel.json` - Vercel routing/deployment config.
- `components.json` - local shadcn-style component config.
- `.env.example` - local env template.
- `.env.local` - local uncommitted environment overrides used for Vite/Vercel dev.
- `PLANS.md` - ongoing implementation notes.

## Top-Level Directories

- `.github/workflows/guardrails.yml` - CI build and smoke guardrails.
- `.githooks/pre-commit` and `.githooks/pre-push` - local git hook entrypoints installed through the repo `.githooks/` path.
- `.agent/` - local connector/agent rules and exec plans; not shipped to app repos.
- `.codex/` - Codex local environment metadata.
- `Ideas_example/` - sample idea-generation reference material.
- `New_Type_Jobs/` - runner-job handoff specs and rollout plans for newer job types.
- `api/` - Vercel serverless functions exposed under `/api/*`.
- `cloudflare/` - Cloudflare worker used for the public App Store review webhook bridge and landing pages.
- `components/` - React components, split into app features, fancy experiments, and UI primitives.
- `constants/` - shared app-wide constants and static lists.
- `contexts/` - currently empty; reserved for future React contexts.
- `data/` - thin data access layer around Supabase, Edge Functions, and first-party APIs.
- `docs/` - product, architecture, test, and feature docs.
- `hooks/` - stateful app logic and orchestration hooks.
- `lib/` - shared runtime helpers and server-only prompt helpers.
- `public/` - static assets and no-brand seed/reference images.
- `scripts/` - local tooling, smoke bootstrap, and guardrail checks.
- `supabase/` - Supabase config, schema, storage policies, Edge Functions, and migrations.
- `templates/` - GitHub repo seed templates used by repo creation.
- `tests/` - node-level regression tests and Playwright smoke coverage.
- `types/` - shared domain types and workspace orchestration types.
- `utils/` - pure helpers and cross-cutting workflow utilities.

## App Surface

The authenticated app currently exposes four main surfaces:

- `workspace` - the brand/app workspace for setup, generation, runner jobs, deliverables, App Store links, and review webhooks.
- `accounts` - pooled App Store accounts, assignments, and notes.
- `help` - the in-app Help Center with workflow guidance and deep-linkable sections.
- `ideas` - idea CRUD plus brand-scoped `idea_generation` runner jobs.

The authenticated shell is composed through:

- `components/app/AppShell.tsx`
- `components/app/AppShellLayout.tsx`
- `components/app/AppShellPageContent.tsx`
- `components/app/AppShellOverlays.tsx`

## Components

### Shared components

- `components/LoginPage.tsx` - unauthenticated login screen.
- `components/ErrorBoundary.tsx` - global React error boundary wrapper.
- `components/FluidBackground.tsx` - animated background effect used in the shell.
- `components/ConfirmationPopover.tsx` - generic confirm popover.
- `components/DateRangePicker.tsx` - shared date-range input.

### App shell and page components

- `components/app/AppShell.tsx` - top-level orchestrator that wires data hooks, route state, collaboration state, workspace snapshots, and view models.
- `components/app/AppShellLayout.tsx` - shell scaffold that composes sidebar, chrome, page content, and overlays.
- `components/app/AppShellPageContent.tsx` - page router for `workspace`, `accounts`, `help`, and `ideas`.
- `components/app/AppShellOverlays.tsx` - overlay layer for deliverables, notices, lightbox, and job queue.
- `components/app/WorkspacePage.tsx` - workspace page composition.
- `components/app/AccountsPage.tsx` - App Store accounts page.
- `components/app/HelpCenterPage.tsx` - Help Center page with section anchors, internal TOC state, and route-hash syncing.
- `components/app/IdeasPage.tsx` - ideas table/editor plus idea-generation runner UI.
- `components/app/Sidebar.tsx` - brands list, forms, locks, app counts, and global navigation.
- `components/app/WorkspaceShellChrome.tsx` - sticky workspace header, alerts, and read-only banners.
- `components/app/WorkspaceSwitchOverlay.tsx` - animated overlay during guarded workspace switches.
- `components/app/help-center-content.ts` - localized Help Center copy and section metadata.

### Workspace selection and folder chrome

- `components/app/WorkspaceFolderSurface.tsx` - main folder surface that composes setup panels, generation sections, and collapsed deliverables.
- `components/app/AppFolder.tsx` - gooey folder container and layout shell.
- `components/app/WorkspaceAppSelection.tsx` - app pills, app create/edit card, and selection controls.
- `components/app/AppPills.tsx` - app chip row with reorder affordances.
- `components/app/AppFormCard.tsx` - create/edit app form.
- `components/app/WorkspaceNoAppsEmptyState.tsx` - no-app CTA state.
- `components/app/WorkspaceCollapsedDeliverables.tsx` - compact deliverables card when the assets area is collapsed.

### Workspace setup panels

- `components/app/WorkspaceSetupPanels.tsx` - ordered setup step renderer for App Store link, review webhook, icon, idea/client spec, setup data, repo, runner, integration, and auto-release.
- `components/app/WorkspaceSetupPanelsContent.tsx` - adapter that injects the generation view model into `WorkspaceSetupPanels`.
- `components/app/AppStoreLinkRow.tsx` - canonical App Store URL editor.
- `components/app/AppStoreReviewWebhookRow.tsx` - webhook and public `appshelp.cc` row.
- `components/app/BrandReleaseInfoPanel.tsx` - brand release planning fields.
- `components/app/BrandReferencesPanel.tsx` - brand screenshot/icon reference library.
- `components/app/CountryMultiSelect.tsx` - target-countries selector.
- `components/app/ConnectorClientSpecPanel.tsx` - client spec, idea assignment UI, and the external read-only spec window launcher.
- `components/app/ConnectorVariablesSecretsPanel.tsx` - setup data, secrets, legal-links generation, App Store description, and account assignment.
- `components/app/ConnectorAutosaveStatus.tsx` - autosave badge for connector config state.
- `components/app/ConnectorSaveConflictBanner.tsx` - stale-save conflict banner with reload/overwrite actions.
- `components/app/DevFilesPanel.tsx` - GitHub repo creation/deletion step.
- `components/app/ConnectorRunnerPanel.tsx` - runner job launcher, Q/A loop, logs, QA artifacts, and screenshot artifact viewers.
- `components/app/IntegrationModulePanel.tsx` - integration readiness and integration job trigger.
- `components/app/AutoReleaseModulePanel.tsx` - placeholder auto-release/Fastlane step.

### Generation, deliverables, and editing

- `components/app/AppGenerationSection.tsx` - icon generation, screenshot prompts, and generated screenshots modules.
- `components/app/WorkspaceGenerationSectionContent.tsx` - adapter that renders generation sections from the workspace generation view model.
- `components/app/AppSimulatorSection.tsx` - simulator screenshot upload/pick workflow.
- `components/app/DeliverablesPanel.tsx` - collapsed deliverables/download panel.
- `components/app/ExportCompletionRail.tsx` - completion rail that tracks picks and locks in final deliverables.
- `components/app/EditPanel.tsx` - text-layer editing UI for generated assets.
- `components/app/TextLayersCanvasOverlay.tsx` - canvas preview for text overlays.
- `components/app/Lightbox.tsx` - asset preview overlay.
- `components/app/ConfirmIconButton.tsx` - reusable destructive-action confirmation wrapper.
- `components/app/StepBlock.tsx` - numbered step wrapper.
- `components/app/GenerationQueueWidget.tsx` - global queue widget for client-side generation, downloads, GitHub, and runner jobs.

### Runner visuals and motion helpers

- `components/app/MatrixTerminal.tsx` - themed runner terminal frame.
- `components/app/MatrixRain.tsx` - matrix-style idle animation.

### DnD and UI primitives

- `components/app/dnd/sortable-list.tsx` - generic sortable list helper.
- `components/app/dnd/sortable-grid.tsx` - generic sortable grid helper.
- `components/ui/button.tsx` - shared button primitive.
- `components/ui/InstantTooltip.tsx` - lightweight tooltip.

### Fancy components

- `components/fancy/filter/` - gooey SVG filter primitives and demo components.
- `components/fancy/text/` - animated text effects, helper utilities, and the barrel export in `components/fancy/text/index.ts`.

## Hooks

### Shell, routing, and layout

- `hooks/use-app-shell-ui-state.ts` - shell-local UI state.
- `hooks/use-app-shell-selection-models.ts` - brand/app selection derivations.
- `hooks/use-app-shell-derived-state.ts` - shell-level derived loading and readiness state.
- `hooks/use-app-shell-actions.ts` - shell-level action helpers.
- `hooks/use-app-shell-notices.ts` - notices and transient warnings.
- `hooks/use-route-sync.ts` - URL synchronization for selected brand/app/page.
- `hooks/use-workspace-navigation-actions.ts` - public navigation callbacks.
- `hooks/use-workspace-navigation-controller.ts` - guarded workspace switching and restore logic.
- `hooks/use-workspace-switch-preparation.ts` - pre-switch save/flush orchestration.
- `hooks/use-workspace-switch-overlay.ts` - switch overlay stage timing.
- `hooks/use-app-folder-layout.ts` - gooey folder measurements and refs.
- `hooks/use-app-pill-pan.ts` - horizontal panning for app pill rows.
- `hooks/use-workspace-assets-layout.ts` - collapsed/expanded asset layout state.
- `hooks/use-workspace-presentation-state.ts` - lightbox and app-switch presentation state.
- `hooks/use-screen-size.ts` - viewport size tracking.
- `hooks/use-detect-browser.ts` - browser detection.

### Auth, catalog data, and read models

- `hooks/use-auth-session.ts` - Supabase auth session and loading state.
- `hooks/use-brands.ts` - brand CRUD, reorder, inactive state, and system No Brand maintenance.
- `hooks/use-apps.ts` - app CRUD, alias allocation, reorder, ban/unban, and brand scoping.
- `hooks/use-brand-references.ts` - brand reference uploads and CRUD.
- `hooks/use-app-screenshots.ts` - simulator screenshot CRUD and uploads.
- `hooks/use-app-screenshot-prompts.ts` - screenshot prompt persistence and hydration.
- `hooks/use-generated-assets.ts` - generated asset fetch, generation state, edit state, screenshot sets, picks, export status, and download flows.
- `hooks/use-app-screenshot-downloads.ts` - ZIP download flows for simulator screenshots and deliverables.
- `hooks/use-app-ideas.ts` - ideas/categories CRUD and app assignments.
- `hooks/use-appstore-accounts.ts` - pooled App Store accounts CRUD.
- `hooks/use-appstore-account.ts` - app-level account read helper.
- `hooks/use-brand-app-summaries.ts` - sidebar app counts and ready/banned/completed indicators.
- `hooks/use-signed-url-cache.ts` - signed URL caching across storage-backed assets.

### Connector, jobs, and artifacts

- `hooks/use-connector-config-form.ts` - connector config load/save, autosave state, save-conflict handling, and App Store description/legal-links actions.
- `hooks/use-connector-jobs.ts` - app-scoped runner jobs.
- `hooks/use-connector-job-queue.ts` - global job queue across apps.
- `hooks/use-connector-job-artifacts.ts` - QA/report/screenshot artifact polling and URL hydration.
- `hooks/use-connector-messages.ts` - runner message log and question/answer loop.
- `hooks/use-generation-jobs.ts` - client-side long-running generation/download jobs.
- `hooks/use-idea-generation-jobs.ts` - brand-scoped `idea_generation` job lifecycle for the ideas page.

### Workspace collaboration and snapshots

- `hooks/use-workspace-collaboration.ts` - presence polling and brand lock lifecycle.
- `hooks/use-workspace-readonly-state.ts` - current read-only and lock visibility state.
- `hooks/use-workspace-lock-side-effects.ts` - read-only transitions, lost-lock handling, and explicit claim flow.
- `hooks/use-workspace-busy-guards.ts` - unload protection and busy-state aggregation.
- `hooks/use-workspace-snapshot-hydration.ts` - hydrate cached workspace snapshots into active hooks.
- `hooks/use-workspace-snapshot-cache.ts` - keep per-app snapshots warm in memory.
- `hooks/use-workspace-step-readiness.ts` - current step completion/readiness model.
- `hooks/use-workspace-generation-view-model.ts` - stable public generation view-model entry.
- `hooks/use-workspace-generation-view-model-impl.tsx` - actual generation section assembly.

### No Brand and local workspace helpers

- `hooks/use-no-brand-workspace-actions.ts` - no-brand icon-prompt autogen, screenshot-prompt autogen, and move-to-brand flow.
- `hooks/use-slot-mappings.ts` - local per-app slot mapping persistence.

## Data Layer

### Core workspace data

- `data/auth.ts` - sign-out actions.
- `data/brands.ts` - brand reads/writes.
- `data/apps.ts` - app reads/writes and move-to-brand RPC integration.
- `data/brand-references.ts` - brand reference storage and CRUD.
- `data/app-screenshots.ts` - simulator screenshot storage and CRUD.
- `data/generated-assets.ts` - generated asset storage, CRUD, uploads, and related fetch helpers.
- `data/app-indicators.ts` - lightweight counts used for sidebar summaries.

### Screenshot workflow data

- `data/screenshot-sets.ts` - screenshot-set CRUD.
- `data/asset-picks.ts` - export pick persistence.
- `data/export-status.ts` - completion/lock-in state.
- `data/app-screenshot-prompts.ts` - per-slot prompt persistence.
- `data/screenshot-prompt-autogen.ts` - client API wrapper for no-brand screenshot prompt/title autogeneration.

### Ideas, accounts, and connector config

- `data/app-ideas.ts` - ideas, categories, and app assignments.
- `data/appstore-accounts.ts` - pooled App Store accounts and app assignment queries.
- `data/connector-app-config.ts` - connector config persistence.
- `data/connector-secrets.ts` - secret writes and metadata.
- `data/connector-legal-links.ts` - legal-links generation trigger/history.
- `data/connector-jobs.ts` - runner jobs CRUD and polling helpers.
- `data/connector-messages.ts` - runner message log and Q/A helpers.
- `data/connector-job-artifacts.ts` - runner artifact reads.

### Server-backed generation and webhook clients

- `data/appstore-description.ts` - browser client for App Store description generation.
- `data/icon-prompt.ts` - browser client for no-brand icon prompt generation.
- `data/appstore-review-webhooks.ts` - review webhook row/event persistence.
- `data/appstore-review-webhook-api.ts` - bridge calls to `appshelp.cc` and status endpoints.

## Types, Constants, Lib, and Utils

### Types

- `types/zefgen.ts` - main domain types for brands, apps, assets, jobs, ideas, accounts, webhooks, and provider IDs.
- `types/workspace-snapshot.ts` - cached per-app workspace snapshot shape.
- `types/workspace-switch.ts` - guarded workspace-switch contracts.

### Constants

- `constants/zefgen.ts` - feature flags, limits, storage bucket names, fonts, screenshot sizes, and collaboration defaults.
- `constants/countries.ts` - ISO countries and priority ordering.

### Shared libraries

- `lib/supabase.ts` - shared browser Supabase client.
- `lib/appstore-review-state.shared.js` - shared App Store review-state normalization and terminal/background-refresh rules.
- `lib/server/generate-appstore-description.shared.js` - server prompt sanitizers/helpers reused across text-generation endpoints.
- `lib/server/appstore-review-webhook.shared.js` - shared webhook parsing/normalization helpers.

### Utilities

- `utils/slug.ts` - slugify and unique alias allocation.
- `utils/routes.ts` - route parsing/building.
- `utils/id.ts` - id helper.
- `utils/images.ts` - image validation, rendering, resize, and edit-layer composition.
- `utils/download.ts` - file and blob download helpers.
- `utils/dom.ts` - textarea auto-grow helper.
- `utils/retry.ts` - async retry helper.
- `utils/no-brand.ts` - No Brand detection and brand option helpers.
- `utils/workspace-selection.ts` - startup workspace restore rules plus local persistence for last workspace and per-brand last-app selection.
- `utils/appstore.ts` - App Store URL normalization and helper links.
- `utils/appstore-review-webhook.ts` - public subdomain and effective review-webhook URL helpers.
- `utils/accounts-paste.ts` - bulk account paste parser.
- `utils/runner-log.ts` - runner log compaction and stage parsing.
- `utils/connector-runner-state.js` - runner-state derivation and artifact grouping.
- `utils/integration-terminal.js` - integration terminal parsing helpers.
- `utils/screenshot-prompt-workflow.js` - no-brand screenshot prompt templates and slot readiness logic.

## Backend and External Integrations

### Vercel `/api` functions

- `api/generate-screenshot.ts` - server-side image generation proxy.
- `api/generate-icon-prompt.ts` - no-brand icon prompt autogen.
- `api/generate-screenshot-prompts.ts` - app-theme and screenshot-title autogen for no-brand flows.
- `api/generate-appstore-description.ts` - App Store description generation.
- `api/provider-status.ts` - local env/provider diagnostics.
- `api/create-github-repo.ts` - GitHub repo creation and seeding.
- `api/delete-github-repo.ts` - GitHub repo deletion.
- `api/workspace-sessions.ts` - presence snapshot, heartbeat, claim/release lock.
- `api/appstore-review-webhook-status.js` - review webhook status and event timeline reads.

### Supabase Edge Functions

- `supabase/functions/generate-legal-links/index.ts` - generates legal documents, Google Drive files, and support form URLs.
- `supabase/functions/appstore-review-webhook/index.ts` - hidden review-webhook receiver behind the Cloudflare bridge.
- `supabase/functions/_shared/google-auth.ts` - Google OAuth helpers.
- `supabase/functions/_shared/google-drive.ts` - Google Drive helpers.
- `supabase/functions/_shared/google-docs.ts` - Google Docs helpers.
- `supabase/functions/_shared/google-forms.ts` - Google Forms helpers.
- `supabase/functions/_shared/legal-templates.ts` - legal document templates.

### Cloudflare bridge

- `cloudflare/appstore-review-bridge/worker.js` - public `appshelp.cc` worker that exposes the bridge endpoints, raw webhook ingress, public landing/privacy/terms/support/icon routes, and the hourly Apple status snapshot sweep.
- `cloudflare/appstore-review-bridge/wrangler.jsonc` - worker config.
- `cloudflare/appstore-review-bridge/wrangler.jsonc.example` - config template.

### Repo templates

- `templates/github/README.md.tpl` - initial README seeded into app repos created from ZefGen.

## Supabase and Database

- `supabase/config.toml` - local Supabase config.
- `supabase/schema.sql` - canonical schema fallback used by smoke bootstrap when migrations are skipped.
- `supabase/schema_check.sql` - schema verification query file.
- `supabase/seed.sql` - local seed data.
- `supabase/storage_policies.sql` - storage policy definitions.
- `supabase/migrations/` - sequential schema history. Major groups currently cover:
  - initial schema and generated assets
  - screenshot sets, picks, and completion
  - GitHub repo tracking
  - brand release planning and brand ordering
  - runner jobs and connector handshake/safe-save followups
  - App Store accounts pool and notes
  - legal links and commit RPC
  - App Store URL
  - workspace presence and brand locks
  - ideas and idea title cleanup
  - global alias uniqueness and no-brand move-to-brand
  - review webhooks, Apple Connect sync, public subdomains, and Cloudflare bridge/public page support
  - idea-generation jobs and indexes
  - brand inactive state
  - downstream capture mode enforcement

## Tests and Tooling

### Scripts

- `scripts/bootstrap-smoke-backend.mjs` - boots local Supabase, applies schema fallback if needed, and seeds smoke data.
- `scripts/check-credentials.mjs` - credential leak guard.
- `scripts/check-declaration-order.mjs` - declaration-order guard.
- `scripts/check-supabase-migration-filenames.mjs` - migration naming guard.
- `scripts/dev-restart.mjs` - local dev-server restart helper.
- `scripts/install-git-hooks.mjs` - installs the repo `.githooks/` path for local hooks.
- `scripts/run-pre-push-guard.mjs` - local pre-push gate that runs smoke tests when pushed changes touch smoke-relevant code.
- `scripts/smoke-legal-links.mjs` - legal-links smoke check.

### Tests

- `tests/*.test.*` - node-level regression tests for accounts paste, App Store description helpers, review webhooks, capture modes, runner state, workspace startup selection, integration terminal parsing, and screenshot prompt workflow.
- `tests/smoke/*.spec.ts` - browser smoke coverage for auth, navigation, workspace CRUD, startup workspace restore, brand inactive behavior, accounts, help-center routing, ideas, spec-reader window behavior, and screenshot prompt workflows.
- `tests/smoke/auth.setup.ts` - authenticated Playwright setup.
- `tests/smoke/support/fixtures.ts` - global browser guard layer for smoke tests.
- `tests/smoke/support/helpers.ts` - shared smoke helpers.
- `tests/smoke/support/smoke-env.ts` - typed access to generated smoke env metadata.
- `playwright/.auth/` and `playwright/.tmp/` - generated smoke auth/session artifacts and temp outputs.

## Docs and Reference Material

- `docs/PROJECT_STRUCTURE.md` - this file.
- `docs/testing/smoke-tests.md` - smoke test runbook.
- `docs/appstore-review-webhook-cloudflare.md` - Cloudflare bridge rollout notes.
- `docs/zefgen-logo-font.md` - logo/font notes.
- `docs/spec/` - product spec set, UI map, system map, open questions, acceptance tests, and milestones.
- `docs/spec/00_source/initial_brief.md` - original brief source.
- `docs/ai/` - working AI-generated briefs, UI map, runner spec, interview log, and open questions.

## Current Workflow Notes

### Workspace step order

The workspace currently renders:

- non-numbered app rows first: App Store link and App Store review webhook
- numbered setup steps after that:
  1. icon generation
  2. idea picker and client spec
  3. variables and secrets
  4. GitHub repo
  5. runner
  6. integration
  7. auto-release placeholder

No Brand mode swaps numbered steps 1 and 2, and adds:

- no-brand icon prompt autogen via `api/generate-icon-prompt.ts`
- screenshot prompt/title autogen via `api/generate-screenshot-prompts.ts`
- move-to-brand actions in `hooks/use-no-brand-workspace-actions.ts`

The generation area below setup continues through:

- simulator screenshots
- screenshot prompts
- generated screenshots
- picks/completion rail
- deliverables downloads

### Runner job kinds

`data/connector-jobs.ts` currently defines:

- `generate`
- `fix`
- `integration`
- `visual_qa`
- `screenshots`
- `idea_generation`

Runner artifacts currently cover:

- `qa_report`
- `qa_evidence`
- `screenshot_manifest`
- `screenshot_image`

## Local Dev Notes

- `npm run dev` starts the Vite app and the local middleware-backed subset of `/api/*` routes.
- `npm run dev:vercel` runs the full Vercel routing layer locally.
- `npm run smoke` is the canonical full regression command.
- `npm run smoke:backend` resets/boots local Supabase and smoke data.
- `npm run smoke:test` runs Playwright smoke coverage.
- `npm run typecheck` runs TypeScript without emitting.
- `npm run build` runs migration/declaration checks and the production build.

## Adding New Features

Keep the layering consistent:

1. Start with `types/` and `constants/` if the domain model changes.
2. Add reads/writes in `data/`.
3. Add orchestration in `hooks/`.
4. Add focused UI in `components/app/` or shared UI in `components/`.
5. Wire the feature into `components/app/AppShell.tsx` or the relevant page component.
6. Add regression coverage in `tests/` or `tests/smoke/`.
7. Update this file when the shape of the repo changes.
