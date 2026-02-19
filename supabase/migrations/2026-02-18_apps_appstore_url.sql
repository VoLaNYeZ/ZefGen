-- Store App Store URL per app for cross-device access. (2026-02-18)
--
-- Supabase note:
-- - Run in the Supabase SQL editor as a project owner.
-- - This script is idempotent and safe to re-run.

alter table public.apps
    add column if not exists appstore_url text;
