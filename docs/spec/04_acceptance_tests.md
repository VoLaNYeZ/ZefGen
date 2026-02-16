# Acceptance Tests — ZefGen v1

## Scenario tests
1) Given a logged-in user, when they create a brand, then the brand appears in the sidebar and Brand Overview loads.
2) Given a brand with no references, when the brand is selected, then an empty-state prompt to add references is shown.
3) Given a brand, when the user uploads an icon reference (PNG/JPG) and adds a text prompt, then it is persisted and stored as JPG and visible on reload.
4) Given a brand, when the user creates an app with name + alias, then the app appears in the apps list and has a canonical URL in `/brandSlug/appAlias` format that updates on rename.
5) Given an app, when the user uploads simulator screenshots (PNG/JPG ≤10 MB) and reorders them, then the order persists on reload.
6) Given an app, when the user generates an icon, then a 1024x1024 JPG result appears and is stored.
7) Given an app, when the user generates 3–6 App Store screenshots, then results match 1242x2688 or 1320x2868 and are stored.
8) Given a generated screenshot, when the user edits text and saves, then the edits persist and are visible on reload.
9) Given a screenshot slot with 3 generated versions, when the user attempts to generate another, then they are prompted to delete a version before continuing.
10) Given an app detail page, then the App Data placeholder fields are visible (AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description).
11) Accounts navigation: clicking sidebar `Accounts` navigates to `/accounts` and renders the Accounts grid; browser back/forward returns to the prior workspace route.
12) Accounts edit guard: in Edit mode with unsaved changes, navigation away from `/accounts` is blocked and browser refresh/close shows a native confirm.
13) Accounts CRUD: user can create an unassigned account row, save, refresh, and values persist. User can delete an account row and it stays deleted after refresh.
14) Accounts assignment: user can assign an account to an app (max 1 per app), and the assigned account is shown in the app’s Setup data panel; company name is locked to the account value when usable.
15) Accounts ban filter: Active filter hides rows assigned to banned apps, Banned filter shows only those rows, and All shows everything.
16) Accounts status: if assigned app is banned, Status shows `Banned` in red; Unusable uses “ice” color; Used before amber; Usable green.
17) Accounts copy: Email/Password/Email password/Proxy have copy buttons; copy copies the full value and shows a brief “copied” feedback.

## Smoke tests
- Login page still matches the existing UI and behavior.
- Core navigation (brands → app detail) works without console errors.
- Upload, generate, and edit flows complete successfully on happy path.

## NFR checks
- Basic auth protection for all workspace routes.
- Per-user data isolation for brands/apps/assets.
- Image generation failures show a retry path.
