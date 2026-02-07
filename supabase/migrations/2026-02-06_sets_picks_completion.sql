-- Screenshot sets + explicit picks + completion status (deliverables workflow). (2026-02-06)
--
-- Supabase note:
-- - Run in the Supabase SQL editor as a project owner.
-- - This script is idempotent and safe to re-run.

-- 1) Screenshot sets
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

alter table public.app_screenshot_sets enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_screenshot_sets' and policyname = 'app_screenshot_sets_select_own'
    ) then
        execute 'create policy "app_screenshot_sets_select_own" on public.app_screenshot_sets for select using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_screenshot_sets' and policyname = 'app_screenshot_sets_insert_own'
    ) then
        execute 'create policy "app_screenshot_sets_insert_own" on public.app_screenshot_sets for insert with check (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_screenshot_sets' and policyname = 'app_screenshot_sets_update_own'
    ) then
        execute 'create policy "app_screenshot_sets_update_own" on public.app_screenshot_sets for update using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_screenshot_sets' and policyname = 'app_screenshot_sets_delete_own'
    ) then
        execute 'create policy "app_screenshot_sets_delete_own" on public.app_screenshot_sets for delete using (auth.uid() = user_id)';
    end if;
end $$;

-- 2) Attach screenshots to sets
alter table public.app_generated_assets
    add column if not exists screenshot_set_id uuid;

do $$
begin
    if not exists (
        select 1 from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = rel.relnamespace
        where nsp.nspname = 'public'
          and rel.relname = 'app_generated_assets'
          and con.conname = 'app_generated_assets_screenshot_set_id_fkey'
    ) then
        execute 'alter table public.app_generated_assets add constraint app_generated_assets_screenshot_set_id_fkey foreign key (screenshot_set_id) references public.app_screenshot_sets(id) on delete set null';
    end if;
end $$;

create index if not exists app_generated_assets_set_slot_idx
    on public.app_generated_assets (app_id, kind, screenshot_set_id, slot_index);

-- 3) Picks
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

-- One icon pick per app (per user).
create unique index if not exists app_asset_picks_one_icon_per_app
    on public.app_asset_picks (user_id, app_id)
    where kind = 'icon';

-- One screenshot pick per slot per set (per user).
create unique index if not exists app_asset_picks_one_screenshot_per_slot_per_set
    on public.app_asset_picks (user_id, app_id, screenshot_set_id, slot_index)
    where kind = 'screenshot';

alter table public.app_asset_picks enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_asset_picks' and policyname = 'app_asset_picks_select_own'
    ) then
        execute 'create policy "app_asset_picks_select_own" on public.app_asset_picks for select using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_asset_picks' and policyname = 'app_asset_picks_insert_own'
    ) then
        execute 'create policy "app_asset_picks_insert_own" on public.app_asset_picks for insert with check (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_asset_picks' and policyname = 'app_asset_picks_update_own'
    ) then
        execute 'create policy "app_asset_picks_update_own" on public.app_asset_picks for update using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_asset_picks' and policyname = 'app_asset_picks_delete_own'
    ) then
        execute 'create policy "app_asset_picks_delete_own" on public.app_asset_picks for delete using (auth.uid() = user_id)';
    end if;
end $$;

-- 4) Completion status
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

alter table public.app_export_status enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_export_status' and policyname = 'app_export_status_select_own'
    ) then
        execute 'create policy "app_export_status_select_own" on public.app_export_status for select using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_export_status' and policyname = 'app_export_status_insert_own'
    ) then
        execute 'create policy "app_export_status_insert_own" on public.app_export_status for insert with check (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_export_status' and policyname = 'app_export_status_update_own'
    ) then
        execute 'create policy "app_export_status_update_own" on public.app_export_status for update using (auth.uid() = user_id)';
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'app_export_status' and policyname = 'app_export_status_delete_own'
    ) then
        execute 'create policy "app_export_status_delete_own" on public.app_export_status for delete using (auth.uid() = user_id)';
    end if;
end $$;

