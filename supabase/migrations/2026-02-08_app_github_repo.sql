-- Store GitHub repo link per app for cross-device access. (2026-02-08)
--
-- Supabase note:
-- - Run in the Supabase SQL editor as a project owner.
-- - This script is idempotent and safe to re-run.

alter table public.apps
    add column if not exists github_repo_url text,
    add column if not exists github_repo_full_name text,
    add column if not exists github_repo_created_at timestamptz,
    add column if not exists github_repo_updated_at timestamptz;

