# ZefGen v1 ExecPlan

## Purpose
Deliver a production-ready, web-based CRM workflow for brands/apps, including image uploads, generation, and editing, while keeping the existing login page unchanged.

## Constraints
- Follow user's initial plan and extend it to complete the project.
- No new packages unless really needed.
- Minimal diffs.
- Existing login page must not change.
- Finish each milestone with an i18n pass for new UI copy (EN/RU).

## Context map
- Entry points: `index.tsx`, `App.tsx`
- Relevant files: `components/`, `contexts/`, `utils/`, `supabase/`, `index.css`
- Existing patterns to copy: current layout shell, auth wiring, and any upload components.

## Milestones
M1: Workspace shell + Brand/App model scaffolding + i18n pass (R001, R002, R004, R005, R012, R015)
M2: Brand references + App screenshot uploads + ordering + i18n pass (R003, R006, R013)
M3: Generation flows + editor + placeholders + i18n pass (R007, R008, R009, R010, R011, R014, R016)

## Progress
- [x] M1
- [x] M2
- [x] M3

## Decision Log
- 2026-02-01: Use feature-complete v1 scope with production-ready definition and keep existing login page unchanged.
- 2026-02-02: Canonical app URLs use `/brandSlug/appAlias`; set image limits/sizes, editor tools, generation APIs, and 3-version limit per screenshot.
