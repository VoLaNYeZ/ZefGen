# UI Map — ZefGen v1

## Screens
- Login (existing; unchanged)
- Workspace shell (left sidebar for brands, main content area)
- Accounts (`/accounts`)
- Ideas (`/ideas`, stub)
- Brand Overview (brand references on top, apps list below)
- App Detail (simulator screenshots, generation actions, generated assets, App Data placeholders, Dev Files placeholder)
- Screenshot Editor (modal or full-screen editor)
- Brand Create/Edit (modal or inline form)
- App Create/Edit (modal or inline form)

## Navigation transitions
- Login → Workspace shell (on successful auth)
- Workspace shell: select brand → Brand Overview (if brand exists)
- Workspace shell: sidebar bottom `Accounts` → Accounts screen
- Accounts screen: click a brand/app in sidebar → Workspace shell (brand/app workspace route)
- Workspace shell: sidebar bottom `Ideas` → Ideas screen (coming soon)
- Brand Overview: add brand → Brand Create → Brand Overview
- Brand Overview: select app → App Detail
- App Detail: generate screenshots → generated results visible in App Detail
- App Detail: open edit mode → Screenshot Editor → App Detail (on save/cancel)
- Any screen: error state → retry action returns to last screen

## Modals/sheets
- Brand Create/Edit
- App Create/Edit
- Screenshot Editor
- Upload progress / failure dialog (optional)
- Version limit prompt (delete to continue)

## States (major screens)
- Brand list: empty, loading, error
- Brand references: empty, loading, error
- Apps list: empty, loading, error
- App screenshots: empty, loading, error
- Generation actions: loading/progress, error, success
- App Data: placeholder fields visible, non-editable or read-only
