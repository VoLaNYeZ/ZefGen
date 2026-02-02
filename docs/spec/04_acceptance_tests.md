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

## Smoke tests
- Login page still matches the existing UI and behavior.
- Core navigation (brands → app detail) works without console errors.
- Upload, generate, and edit flows complete successfully on happy path.

## NFR checks
- Basic auth protection for all workspace routes.
- Per-user data isolation for brands/apps/assets.
- Image generation failures show a retry path.
