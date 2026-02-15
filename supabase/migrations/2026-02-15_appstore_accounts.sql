-- App Store accounts per app (source of truth for Setup data company name). (2026-02-15)

create table if not exists public.appstore_accounts (
    app_id uuid primary key references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    usability boolean not null default true,
    email text not null default '',
    password text not null default '',
    email_password text not null default '',
    number text not null default '',
    geo text not null default '',
    company_name text not null default '',
    proxy text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists appstore_accounts_user_id_idx on public.appstore_accounts (user_id);
create index if not exists appstore_accounts_user_geo_idx on public.appstore_accounts (user_id, geo);

alter table public.appstore_accounts enable row level security;

create policy "appstore_accounts_select_own" on public.appstore_accounts
    for select using (auth.uid() = user_id);
create policy "appstore_accounts_insert_own" on public.appstore_accounts
    for insert with check (auth.uid() = user_id);
create policy "appstore_accounts_update_own" on public.appstore_accounts
    for update using (auth.uid() = user_id);
create policy "appstore_accounts_delete_own" on public.appstore_accounts
    for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.appstore_accounts to authenticated;

