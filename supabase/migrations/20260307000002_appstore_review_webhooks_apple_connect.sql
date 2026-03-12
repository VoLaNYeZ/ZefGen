-- Extend App Store review webhooks with Apple-side connection + sync metadata. (2026-03-07)

alter table public.appstore_review_webhooks
    add column if not exists key_mode text,
    add column if not exists key_id text,
    add column if not exists issuer_id text,
    add column if not exists public_webhook_url text,
    add column if not exists asc_app_id text,
    add column if not exists asc_app_name text,
    add column if not exists asc_bundle_id text,
    add column if not exists apple_webhook_id text,
    add column if not exists last_sync_at timestamptz,
    add column if not exists last_sync_status text not null default 'idle',
    add column if not exists last_sync_error text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'appstore_review_webhooks_key_mode_check'
    ) then
        alter table public.appstore_review_webhooks
            add constraint appstore_review_webhooks_key_mode_check
            check (key_mode in ('team', 'individual'));
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'appstore_review_webhooks_last_sync_status_check'
    ) then
        alter table public.appstore_review_webhooks
            add constraint appstore_review_webhooks_last_sync_status_check
            check (last_sync_status in ('idle', 'connected', 'error'));
    end if;
end $$;
