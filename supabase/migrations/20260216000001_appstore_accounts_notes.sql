-- App Store accounts: add free-form notes field. (2026-02-16)

alter table public.appstore_accounts
    add column if not exists notes text not null default '';

