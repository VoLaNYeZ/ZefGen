# System Map — ZefGen v1

## Components
- Web UI: React/Vite app with workspace shell, brand/app workflows, and editor UI.
- Backend/API: cloud backend for CRUD on brands/apps/references/assets.
- Storage: object storage for uploaded and generated images.
- Integrations: external image generation API(s) (Replicate “nanobanana”, ChatGPT image 1.5).
- Auth: simple auth (existing login page, unchanged).

## Core entities
- User
- Brand
- BrandReference (icon + screenshot refs)
- App
- AppScreenshot (simulator uploads, ordered)
- GeneratedAsset (icon + app store screenshots)
- AppMetadata (placeholder fields: AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description)
- GenerationJob (API request/response metadata)

## Key flows
1) Auth → workspace → create/select brand
2) Upload brand references (icon + screenshot refs)
3) Create app → upload simulator screenshots → reorder
4) Generate icon → store result
5) Generate App Store screenshots → edit → save

## Constraints & assumptions
- Existing login page must not change.
- App URLs must be canonical and resolvable as `/brandSlug/appAlias`, updating when brand/app slugs change.
- App Store assets must match Apple guideline sizes (6.5'' 1242x2688 default, 6.9'' 1320x2868 optional).
- Generation occurs via external API.
- Cloud storage is required for images and metadata.
- Image limits: icon stored as JPG; uploads accept PNG/JPG up to 10 MB; brand screenshot references max 6.
- Generated screenshots are versioned up to 3 per slot; users must delete a version to continue.
