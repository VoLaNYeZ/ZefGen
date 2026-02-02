-- ZefGen v1 schema (brands, apps, references, app screenshots, generated assets)
create extension if not exists "pgcrypto";

create table if not exists public.brands (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    slug text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists brands_user_slug_key on public.brands (user_id, slug);
create index if not exists brands_user_id_idx on public.brands (user_id);

create table if not exists public.apps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    alias text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists apps_brand_alias_key on public.apps (brand_id, alias);
create index if not exists apps_user_id_idx on public.apps (user_id);
create index if not exists apps_brand_id_idx on public.apps (brand_id);

create table if not exists public.brand_references (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    kind text not null check (kind in ('icon', 'screenshot')),
    image_path text not null,
    prompt text,
    order_index integer,
    created_at timestamptz not null default now()
);

create index if not exists brand_references_user_id_idx on public.brand_references (user_id);
create index if not exists brand_references_brand_id_idx on public.brand_references (brand_id);
create unique index if not exists brand_references_one_icon_per_brand on public.brand_references (brand_id) where kind = 'icon';

create table if not exists public.app_screenshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    image_path text not null,
    order_index integer,
    created_at timestamptz not null default now()
);

create index if not exists app_screenshots_user_id_idx on public.app_screenshots (user_id);
create index if not exists app_screenshots_brand_id_idx on public.app_screenshots (brand_id);
create index if not exists app_screenshots_app_id_idx on public.app_screenshots (app_id);

create table if not exists public.app_generated_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    kind text not null check (kind in ('icon', 'screenshot')),
    slot_index integer,
    version_index integer not null default 1,
    image_path text not null,
    size_label text,
    width integer,
    height integer,
    status text not null default 'ready' check (status in ('ready', 'pending', 'failed')),
    edit_state jsonb,
    created_at timestamptz not null default now()
);

create index if not exists app_generated_assets_user_id_idx on public.app_generated_assets (user_id);
create index if not exists app_generated_assets_brand_id_idx on public.app_generated_assets (brand_id);
create index if not exists app_generated_assets_app_id_idx on public.app_generated_assets (app_id);
create index if not exists app_generated_assets_slot_idx on public.app_generated_assets (app_id, kind, slot_index);

alter table public.brands enable row level security;
alter table public.apps enable row level security;
alter table public.brand_references enable row level security;
alter table public.app_screenshots enable row level security;
alter table public.app_generated_assets enable row level security;

create policy "brands_select_own" on public.brands
    for select using (auth.uid() = user_id);
create policy "brands_insert_own" on public.brands
    for insert with check (auth.uid() = user_id);
create policy "brands_update_own" on public.brands
    for update using (auth.uid() = user_id);
create policy "brands_delete_own" on public.brands
    for delete using (auth.uid() = user_id);

create policy "apps_select_own" on public.apps
    for select using (auth.uid() = user_id);
create policy "apps_insert_own" on public.apps
    for insert with check (auth.uid() = user_id);
create policy "apps_update_own" on public.apps
    for update using (auth.uid() = user_id);
create policy "apps_delete_own" on public.apps
    for delete using (auth.uid() = user_id);

create policy "brand_refs_select_own" on public.brand_references
    for select using (auth.uid() = user_id);
create policy "brand_refs_insert_own" on public.brand_references
    for insert with check (auth.uid() = user_id);
create policy "brand_refs_update_own" on public.brand_references
    for update using (auth.uid() = user_id);
create policy "brand_refs_delete_own" on public.brand_references
    for delete using (auth.uid() = user_id);

create policy "app_screenshots_select_own" on public.app_screenshots
    for select using (auth.uid() = user_id);
create policy "app_screenshots_insert_own" on public.app_screenshots
    for insert with check (auth.uid() = user_id);
create policy "app_screenshots_update_own" on public.app_screenshots
    for update using (auth.uid() = user_id);
create policy "app_screenshots_delete_own" on public.app_screenshots
    for delete using (auth.uid() = user_id);

create policy "app_generated_assets_select_own" on public.app_generated_assets
    for select using (auth.uid() = user_id);
create policy "app_generated_assets_insert_own" on public.app_generated_assets
    for insert with check (auth.uid() = user_id);
create policy "app_generated_assets_update_own" on public.app_generated_assets
    for update using (auth.uid() = user_id);
create policy "app_generated_assets_delete_own" on public.app_generated_assets
    for delete using (auth.uid() = user_id);

-- Storage buckets + policies
insert into storage.buckets (id, name, public)
values
    ('brand-references', 'brand-references', false),
    ('app-screenshots', 'app-screenshots', false),
    ('generated-assets', 'generated-assets', false)
on conflict (id) do nothing;

-- Storage object policies must be created via the Storage UI or with a storage admin role.
-- See: supabase/storage_policies.sql
