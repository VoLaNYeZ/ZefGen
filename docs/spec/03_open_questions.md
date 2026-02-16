# Open Questions — ZefGen v1

## Remaining open questions
None.

## Resolved decisions
- Canonical URLs: `/brandSlug/appAlias` (example `/adidas/hw200`), and they update when brand or app aliases change.
- App Data placeholders: AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description.
- Image constraints: 1 icon; up to 6 App Store screenshots; 10 MB max per file; uploads accept PNG/JPG; icon stored as JPG with conversion where needed.
- Screenshot sizes: 6.5'' = 1242x2688 (default), 6.9'' = 1320x2868 (optional).
- Editor tools: multiple fonts, text positioning/sizing/rotation, and basic text layer adding; inpainting deferred.
- Generation APIs: Replicate “nanobanana” and ChatGPT image 1.5 (targeted).
- Versioning: up to 3 versions per generated screenshot; user must delete a version to continue.
- Accounts are stored in a pooled `/accounts` sheet; rows can be unassigned or assigned to an app (max 1 row per app).
- Accounts uses View vs Edit mode; Edit mode requires explicit Save (Save all) and blocks navigation/refresh while dirty.
- Accounts “Banned” status is computed from the assigned app’s ban flag (`apps.is_banned`) and is not an account field.
- Setup data `company_name` is read-only and sourced from the assigned account when the account is usable.
