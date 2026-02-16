# PRD — ZefGen CRM v1

## Summary
ZefGen v1 is a web-based CRM for managing brands and their apps, with strong image workflows. Users manage brand references (icon and screenshot references), upload simulator screenshots per app, and generate App Store-ready assets via external APIs. The product emphasizes a modern, intuitive UI and a production-ready baseline, while keeping the existing login page unchanged and enforcing canonical app URLs like `/adidas/hw200`.

## In scope (v1)
- Web UI with a workspace shell, brand sidebar, brand references, and app management.
- App-level workflows: upload simulator screenshots, reorder them, generate icon and App Store screenshots, and edit generated screenshots.
- Accounts pool: a dedicated `/accounts` screen to store App Store account rows (incl. passwords) per user, optionally assignable to apps.
- Setup data integration: when an account is assigned to an app and is usable, its `company_name` is surfaced as read-only and synced into Setup data.
- Cloud storage for data + images, with simple auth and user isolation.
- Placeholder sections for App Data and Dev Files (no functional data entry).
- App Data placeholder fields: AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description.

## Out of scope (v1)
- Mobile/desktop clients.
- Advanced roles/permissions beyond simple auth.
- Analytics, reporting, or recommendation features.
- Automated background generation or scheduled jobs (unless required by the API).
- Deep App Data or Dev Files functionality (placeholders only).
- Inpainting and complex compositing tools.

## Requirements
- R001: The existing login page remains unchanged; after successful auth, users land in the main workspace. Error state: invalid login shows existing error UX; loading state uses existing behavior.
- R002: The workspace includes a left sidebar listing user-created brands with an “add brand” action. Empty state: show a first-time CTA to create a brand. Loading state: skeleton list. Error state: show retry.
- R003: Selecting a brand shows a Brand Overview area with references at the top: one icon reference (image + text prompt) and screenshot references (up to 6 images + text prompts). Uploads accept PNG/JPG up to 10 MB; icon references are stored as JPG. Empty state: prompt to upload references. Loading/error states: per section.
- R004: A Brand Apps section appears below references, listing apps for the brand with a modern, easy-switch UI. Empty state: CTA to add first app. Loading/error states: list-level.
- R005: Each app has name + alias and a canonical, shareable URL in the format `/brandSlug/appAlias`, which updates when brand name/slug or app alias changes. Errors for invalid alias/URL are shown inline.
- R006: App Detail shows simulator screenshots uploaded by the user, supports ordered lists and reordering, and persists ordering. Uploads accept PNG/JPG up to 10 MB. Empty state: prompt to upload screenshots. Error state: failed upload/reorder shows retry.
- R007: “Generate Icon” produces a 1024x1024 JPG icon using brand icon reference + text description via API. Loading state: progress indicator; error state: failure message with retry.
- R008: “Generate App Store Screenshots” allows selecting 3–6 outputs (max 6), uses brand screenshot references + simulator uploads, and returns images that match Apple guidelines (default 6.5'' 1242x2688; optional 6.9'' 1320x2868). Loading/error states are visible per generation batch.
- R009: Each generated screenshot supports an edit mode with multiple fonts, text positioning/sizing/rotation, and basic text layer adding. Changes can be saved and persist. Error state: save failure shows retry.
- R010: App Data section appears under generation features as placeholder content and displays the required field list (AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description) without persistence.
- R011: Dev Files section appears below App Data as placeholder content (no functional fields yet).
- R012: All brands, apps, references, uploads, and generated assets are stored in a cloud backend with user-level isolation.
- R013: Images (uploads + generated assets) are stored in a dedicated storage layer and referenced by metadata records; access is restricted to the owning user.
- R014: The system integrates with external APIs for image generation and supports multiple integrations if needed (Replicate “nanobanana” and ChatGPT image 1.5 targeted for v1).
- R015: Non-functional priorities: fast delivery and maintainable structure, with baseline security (auth-protected access, per-user data isolation).
- R016: Generated App Store screenshots are versioned up to 3 per screenshot slot; when the limit is reached, the user must delete a version before generating more.
- R017: Accounts screen: users can create unlimited App Store account rows, optionally assign 1 row per app, and view/copy all fields.
- R018: Setup data lock-in: `company_name` is not user-editable in Setup data; it is sourced from the assigned account when the account is usable, otherwise it must be empty (blocking the step).

## Acceptance criteria (v1)
- [ ] User can log in with the existing page and reach the workspace shell.
- [ ] User can create/select a brand from the sidebar and see the Brand Overview.
- [ ] Brand references (1 icon + up to 6 screenshot refs) can be uploaded and edited with text prompts, respecting file limits/types.
- [ ] User can create an app, see name + alias, and navigate via `/brandSlug/appAlias` URLs that update on rename.
- [ ] User can upload, order, and reorder simulator screenshots for an app with 10 MB PNG/JPG limits.
- [ ] User can generate a 1024x1024 JPG icon and 3–6 App Store screenshots at 1242x2688 or 1320x2868.
- [ ] User can open edit mode for a generated screenshot, change text styling/position/rotation, and save.
- [ ] App Data and Dev Files sections are present as placeholders (fields visible, no persistence).
- [ ] Generated screenshots enforce a 3-version limit per slot with a delete-to-continue flow.
- [ ] All data/assets persist in the cloud backend and are scoped per user.
