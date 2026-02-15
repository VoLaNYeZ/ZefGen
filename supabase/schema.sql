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
    -- Brand ordering via order_index. (2026-02-14)
    order_index integer not null default 0,
    -- Brand release planning metadata (target countries, keywords, notes). (2026-02-08)
    target_countries text[] not null default '{}',
    keywords text not null default '' check (char_length(keywords) <= 100),
    release_strategy_notes text not null default '',
    release_strategy_updated_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists brands_user_slug_key on public.brands (user_id, slug);
create index if not exists brands_user_id_idx on public.brands (user_id);
create index if not exists brands_user_order_idx on public.brands (user_id, order_index);

create table if not exists public.apps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    alias text not null,
    is_banned boolean not null default false,
    -- App-level GitHub repo link for dev handoff. (2026-02-08)
    github_repo_url text,
    github_repo_full_name text,
    github_repo_created_at timestamptz,
    github_repo_updated_at timestamptz,
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

-- Connector runner tables + job claim RPC for hosted Codex execution. (2026-02-09)
create table if not exists public.connector_app_configs (
    app_id uuid primary key references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    project_kind text not null default 'ios' check (project_kind in ('ios', 'web', 'other')),
    project_brief text not null default '',
    variables jsonb not null default '{}'::jsonb,
    verify_command text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists connector_app_configs_user_id_idx on public.connector_app_configs (user_id);

alter table public.connector_app_configs enable row level security;

create policy "connector_app_configs_select_own" on public.connector_app_configs
    for select using (auth.uid() = user_id);
create policy "connector_app_configs_insert_own" on public.connector_app_configs
    for insert with check (auth.uid() = user_id);
create policy "connector_app_configs_update_own" on public.connector_app_configs
    for update using (auth.uid() = user_id);
create policy "connector_app_configs_delete_own" on public.connector_app_configs
    for delete using (auth.uid() = user_id);

-- Per-app secrets for runner (plaintext for MVP). (2026-02-09)
-- Critical: clients must never be able to read `value` back via SELECT.
create table if not exists public.connector_app_secrets (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    value text not null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create unique index if not exists connector_app_secrets_app_key_key on public.connector_app_secrets (app_id, key);
create index if not exists connector_app_secrets_user_app_idx on public.connector_app_secrets (user_id, app_id);

alter table public.connector_app_secrets enable row level security;

create policy "connector_app_secrets_select_own" on public.connector_app_secrets
    for select using (auth.uid() = user_id);
create policy "connector_app_secrets_insert_own" on public.connector_app_secrets
    for insert with check (auth.uid() = user_id);
create policy "connector_app_secrets_update_own" on public.connector_app_secrets
    for update using (auth.uid() = user_id);
create policy "connector_app_secrets_delete_own" on public.connector_app_secrets
    for delete using (auth.uid() = user_id);

-- Restrict secret `value` from client roles, but keep it accessible for service_role.
revoke select (value) on public.connector_app_secrets from anon, authenticated;
grant select (id, app_id, user_id, key, updated_at, created_at) on public.connector_app_secrets to anon, authenticated;

create table if not exists public.connector_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    kind text not null check (kind in ('generate', 'fix')),
    status text not null default 'queued' check (status in ('queued', 'running', 'waiting_for_user', 'succeeded', 'failed', 'canceled')),
    requested_by text,
    input jsonb not null default '{}'::jsonb,
    repo_full_name text not null,
    base_branch text not null default 'main',
    work_branch text,
    pr_url text,
    pr_number integer,
    verify_status text check (verify_status in ('pass', 'fail', 'skipped')),
    verify_tail text,
    summary text,
    claimed_by text,
    claimed_at timestamptz,
    started_at timestamptz,
    heartbeat_at timestamptz,
    ended_at timestamptz,
    cancel_requested_at timestamptz,
    error text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists connector_jobs_status_created_at_idx on public.connector_jobs (status, created_at);
create index if not exists connector_jobs_user_app_created_at_idx on public.connector_jobs (user_id, app_id, created_at);
create index if not exists connector_jobs_claimed_by_claimed_at_idx on public.connector_jobs (claimed_by, claimed_at);

alter table public.connector_jobs enable row level security;

create policy "connector_jobs_select_own" on public.connector_jobs
    for select using (auth.uid() = user_id);
create policy "connector_jobs_insert_own" on public.connector_jobs
    for insert with check (auth.uid() = user_id);
create policy "connector_jobs_update_own" on public.connector_jobs
    for update using (auth.uid() = user_id);
create policy "connector_jobs_delete_own" on public.connector_jobs
    for delete using (auth.uid() = user_id);

create table if not exists public.connector_job_messages (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.connector_jobs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('runner', 'user', 'system')),
    kind text not null check (kind in ('log', 'question', 'answer')),
    in_reply_to uuid references public.connector_job_messages(id) on delete set null,
    content text not null,
    options jsonb,
    created_at timestamptz not null default now()
);

create index if not exists connector_job_messages_job_id_created_at_idx on public.connector_job_messages (job_id, created_at);
create index if not exists connector_job_messages_in_reply_to_idx on public.connector_job_messages (in_reply_to);

alter table public.connector_job_messages enable row level security;

create policy "connector_job_messages_select_own" on public.connector_job_messages
    for select using (auth.uid() = user_id);
create policy "connector_job_messages_insert_own" on public.connector_job_messages
    for insert with check (auth.uid() = user_id);

create or replace function public.connector_claim_next_job(p_runner_id text)
returns public.connector_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_job public.connector_jobs;
begin
    select *
    into v_job
    from public.connector_jobs
    where status = 'queued'
      and cancel_requested_at is null
    order by created_at asc
    for update skip locked
    limit 1;

    if not found then
        return null;
    end if;

    update public.connector_jobs
    set
        status = 'running',
        claimed_by = p_runner_id,
        claimed_at = now(),
        started_at = coalesce(started_at, now()),
        heartbeat_at = now(),
        updated_at = now()
    where id = v_job.id
    returning * into v_job;

    return v_job;
end;
$$;

revoke all on function public.connector_claim_next_job(text) from public;
grant execute on function public.connector_claim_next_job(text) to service_role;

grant select, insert, update, delete on public.connector_app_configs to authenticated;
grant insert, update, delete on public.connector_app_secrets to authenticated;
grant select, insert, update, delete on public.connector_jobs to authenticated;
grant select, insert, update, delete on public.connector_job_messages to authenticated;
