-- App Store accounts: allow pooled rows + optional app assignment. (2026-02-15)
-- Note: this migration alters the initial 1-row-per-app design to support:
-- - many rows per user
-- - nullable app_id (unassigned accounts)
-- - at most 1 assigned account per app (partial unique index)

-- 1) Add id primary key
alter table public.appstore_accounts
    add column if not exists id uuid;

update public.appstore_accounts
set id = gen_random_uuid()
where id is null;

alter table public.appstore_accounts
    alter column id set default gen_random_uuid(),
    alter column id set not null;

-- 2) Replace primary key (app_id -> id)
alter table public.appstore_accounts
    drop constraint if exists appstore_accounts_pkey;

alter table public.appstore_accounts
    add constraint appstore_accounts_pkey primary key (id);

-- 3) app_id becomes optional + FK becomes ON DELETE SET NULL
alter table public.appstore_accounts
    alter column app_id drop not null;

alter table public.appstore_accounts
    drop constraint if exists appstore_accounts_app_id_fkey;

alter table public.appstore_accounts
    add constraint appstore_accounts_app_id_fkey
        foreign key (app_id) references public.apps(id) on delete set null;

-- 4) 3-state usability support ("used before" implies blocked)
alter table public.appstore_accounts
    add column if not exists was_used_before boolean not null default false;

alter table public.appstore_accounts
    drop constraint if exists appstore_accounts_used_before_blocks;

alter table public.appstore_accounts
    add constraint appstore_accounts_used_before_blocks
        check (not was_used_before or not usability);

-- 5) Enforce at most 1 assigned account per app (but allow many unassigned rows)
drop index if exists appstore_accounts_app_id_unique;
create unique index if not exists appstore_accounts_app_id_unique
    on public.appstore_accounts (app_id)
    where app_id is not null;

