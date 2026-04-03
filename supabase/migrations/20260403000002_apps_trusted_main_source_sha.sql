-- Store a trusted GitHub main SHA per app for direct-mode QA/screenshots gating. (2026-04-03)

alter table public.apps
    add column if not exists trusted_main_source_sha text,
    add column if not exists trusted_main_source_synced_at timestamptz;
