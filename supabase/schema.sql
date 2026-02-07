-- ZefGen v1 schema (brands, apps, references, app screenshots, generated assets)
-- CHANGELOG RULES (FOR AI/ASSISTANTS)
-- 1) Any new table/index/policy must be preceded by a short comment block that includes:
--    - Purpose of the change (1 line).
--    - Timestamp in YYYY-MM-DD format.
-- 2) Do not edit existing objects silently; add a note comment above the change.
-- Example:
-- -- Added app_screenshot_prompts for per-app prompt persistence. (2026-02-05)
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
    is_banned boolean not null default false,
    order_index integer,
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

create table if not exists public.app_screenshot_prompts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    brand_reference_id uuid not null references public.brand_references(id) on delete cascade,
    prompt text not null default '',
    updated_at timestamptz not null default now()
);

create unique index if not exists app_screenshot_prompts_app_ref_key on public.app_screenshot_prompts (app_id, brand_reference_id);
create index if not exists app_screenshot_prompts_user_id_idx on public.app_screenshot_prompts (user_id);
create index if not exists app_screenshot_prompts_brand_id_idx on public.app_screenshot_prompts (brand_id);
create index if not exists app_screenshot_prompts_app_id_idx on public.app_screenshot_prompts (app_id);

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

create table if not exists public.app_screenshot_sets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    name text not null,
    size_label text not null check (size_label in ('6.5', '6.9')),
    slot_count integer not null check (slot_count between 3 and 6),
    order_index integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists app_screenshot_sets_user_id_idx on public.app_screenshot_sets (user_id);
create index if not exists app_screenshot_sets_brand_id_idx on public.app_screenshot_sets (brand_id);
create index if not exists app_screenshot_sets_app_id_idx on public.app_screenshot_sets (app_id);

create table if not exists public.app_generated_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    -- Added screenshot_enhanced + icon_enhanced kinds for AI enhancement outputs. (2026-02-06)
    kind text not null check (kind in ('icon', 'icon_enhanced', 'screenshot', 'screenshot_enhanced')),
    slot_index integer,
    version_index integer not null default 1,
    image_path text not null,
    screenshot_set_id uuid references public.app_screenshot_sets(id) on delete set null,
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
create index if not exists app_generated_assets_set_slot_idx on public.app_generated_assets (app_id, kind, screenshot_set_id, slot_index);

create table if not exists public.app_asset_picks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    kind text not null check (kind in ('icon', 'screenshot')),
    screenshot_set_id uuid references public.app_screenshot_sets(id) on delete cascade,
    slot_index integer,
    generated_asset_id uuid not null references public.app_generated_assets(id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists app_asset_picks_user_id_idx on public.app_asset_picks (user_id);
create index if not exists app_asset_picks_app_id_idx on public.app_asset_picks (app_id);
create unique index if not exists app_asset_picks_one_icon_per_app on public.app_asset_picks (user_id, app_id) where kind = 'icon';
create unique index if not exists app_asset_picks_one_screenshot_per_slot_per_set on public.app_asset_picks (user_id, app_id, screenshot_set_id, slot_index) where kind = 'screenshot';

create table if not exists public.app_export_status (
    app_id uuid primary key references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    is_completed boolean not null default false,
    completed_at timestamptz,
    updated_at timestamptz not null default now()
);

create index if not exists app_export_status_user_id_idx on public.app_export_status (user_id);
create index if not exists app_export_status_brand_id_idx on public.app_export_status (brand_id);

alter table public.brands enable row level security;
alter table public.apps enable row level security;
alter table public.brand_references enable row level security;
alter table public.app_screenshot_prompts enable row level security;
alter table public.app_screenshots enable row level security;
alter table public.app_screenshot_sets enable row level security;
alter table public.app_generated_assets enable row level security;
alter table public.app_asset_picks enable row level security;
alter table public.app_export_status enable row level security;

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

create policy "app_screenshot_prompts_select_own" on public.app_screenshot_prompts
    for select using (auth.uid() = user_id);
create policy "app_screenshot_prompts_insert_own" on public.app_screenshot_prompts
    for insert with check (auth.uid() = user_id);
create policy "app_screenshot_prompts_update_own" on public.app_screenshot_prompts
    for update using (auth.uid() = user_id);
create policy "app_screenshot_prompts_delete_own" on public.app_screenshot_prompts
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

create policy "app_screenshot_sets_select_own" on public.app_screenshot_sets
    for select using (auth.uid() = user_id);
create policy "app_screenshot_sets_insert_own" on public.app_screenshot_sets
    for insert with check (auth.uid() = user_id);
create policy "app_screenshot_sets_update_own" on public.app_screenshot_sets
    for update using (auth.uid() = user_id);
create policy "app_screenshot_sets_delete_own" on public.app_screenshot_sets
    for delete using (auth.uid() = user_id);

create policy "app_asset_picks_select_own" on public.app_asset_picks
    for select using (auth.uid() = user_id);
create policy "app_asset_picks_insert_own" on public.app_asset_picks
    for insert with check (auth.uid() = user_id);
create policy "app_asset_picks_update_own" on public.app_asset_picks
    for update using (auth.uid() = user_id);
create policy "app_asset_picks_delete_own" on public.app_asset_picks
    for delete using (auth.uid() = user_id);

create policy "app_export_status_select_own" on public.app_export_status
    for select using (auth.uid() = user_id);
create policy "app_export_status_insert_own" on public.app_export_status
    for insert with check (auth.uid() = user_id);
create policy "app_export_status_update_own" on public.app_export_status
    for update using (auth.uid() = user_id);
create policy "app_export_status_delete_own" on public.app_export_status
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
