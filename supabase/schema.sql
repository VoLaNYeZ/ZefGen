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
    -- App-level App Store URL for geo-normalized links. (2026-02-18)
    appstore_url text,
    order_index integer,
    created_at timestamptz not null default now()
);

create unique index if not exists apps_brand_alias_key on public.apps (brand_id, alias);
create index if not exists apps_user_id_idx on public.apps (user_id);
create index if not exists apps_brand_id_idx on public.apps (brand_id);

-- App Store accounts pool with optional app assignment (source of truth for Setup data company name). (2026-02-15)
-- Note: updated from the initial 1-row-per-app design to a pooled accounts model. (2026-02-15)
create table if not exists public.appstore_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    app_id uuid references public.apps(id) on delete set null,
    usability boolean not null default true,
    was_used_before boolean not null default false,
    email text not null default '',
    password text not null default '',
    email_password text not null default '',
    number text not null default '',
    geo text not null default '',
    company_name text not null default '',
    proxy text not null default '',
    notes text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint appstore_accounts_used_before_blocks check (not was_used_before or not usability)
);

create unique index if not exists appstore_accounts_app_id_unique
    on public.appstore_accounts (app_id) where app_id is not null;
create index if not exists appstore_accounts_user_id_idx on public.appstore_accounts (user_id);
create index if not exists appstore_accounts_user_geo_idx on public.appstore_accounts (user_id, geo);

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
alter table public.appstore_accounts enable row level security;
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

create policy "appstore_accounts_select_own" on public.appstore_accounts
    for select using (auth.uid() = user_id);
create policy "appstore_accounts_insert_own" on public.appstore_accounts
    for insert with check (auth.uid() = user_id);
create policy "appstore_accounts_update_own" on public.appstore_accounts
    for update using (auth.uid() = user_id);
create policy "appstore_accounts_delete_own" on public.appstore_accounts
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

-- Connector legal links history for generated Privacy/Terms/Support assets. (2026-02-16)
create table if not exists public.connector_legal_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    fingerprint text not null,
    company_name text not null,
    appstore_name text not null,
    account_email text not null,
    privacy_doc_id text not null,
    privacy_url text not null,
    terms_doc_id text not null,
    terms_url text not null,
    support_form_id text not null,
    support_url text not null,
    support_schema jsonb not null default '{}'::jsonb,
    subtitle_variant text,
    regenerated_with_confirmation boolean not null default false,
    status text not null check (status in ('succeeded', 'failed')),
    error text,
    created_at timestamptz not null default now()
);

-- Indexes for app history scans and fingerprint checks. (2026-02-16)
create index if not exists connector_legal_links_user_app_created_idx
    on public.connector_legal_links (user_id, app_id, created_at desc);
create index if not exists connector_legal_links_app_fingerprint_created_idx
    on public.connector_legal_links (app_id, fingerprint, created_at desc);

-- Per-user access only; append-only from the client role. (2026-02-16)
alter table public.connector_legal_links enable row level security;

create policy "connector_legal_links_select_own" on public.connector_legal_links
    for select using (auth.uid() = user_id);
create policy "connector_legal_links_insert_own" on public.connector_legal_links
    for insert with check (auth.uid() = user_id);

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

create or replace function public.connector_commit_legal_links_success(
    p_user_id uuid,
    p_app_id uuid,
    p_fingerprint text,
    p_company_name text,
    p_appstore_name text,
    p_account_email text,
    p_privacy_doc_id text,
    p_privacy_url text,
    p_terms_doc_id text,
    p_terms_url text,
    p_support_form_id text,
    p_support_url text,
    p_support_schema jsonb default '{}'::jsonb,
    p_subtitle_variant text default null,
    p_regenerated_with_confirmation boolean default false,
    p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_run_id uuid;
begin
    update public.connector_app_configs
    set
        variables = coalesce(variables, '{}'::jsonb) || jsonb_build_object(
            'privacy_policy_url', p_privacy_url,
            'terms_of_use_url', p_terms_url,
            'support_form_url', p_support_url
        ),
        updated_at = p_now
    where user_id = p_user_id
      and app_id = p_app_id;

    if not found then
        raise exception 'connector_app_configs row not found for user/app';
    end if;

    insert into public.connector_legal_links (
        user_id,
        app_id,
        fingerprint,
        company_name,
        appstore_name,
        account_email,
        privacy_doc_id,
        privacy_url,
        terms_doc_id,
        terms_url,
        support_form_id,
        support_url,
        support_schema,
        subtitle_variant,
        regenerated_with_confirmation,
        status,
        error,
        created_at
    )
    values (
        p_user_id,
        p_app_id,
        p_fingerprint,
        p_company_name,
        p_appstore_name,
        p_account_email,
        p_privacy_doc_id,
        p_privacy_url,
        p_terms_doc_id,
        p_terms_url,
        p_support_form_id,
        p_support_url,
        coalesce(p_support_schema, '{}'::jsonb),
        p_subtitle_variant,
        coalesce(p_regenerated_with_confirmation, false),
        'succeeded',
        null,
        p_now
    )
    returning id into v_run_id;

    return v_run_id;
end;
$$;

revoke all on function public.connector_commit_legal_links_success(
    uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, timestamptz
) from public;
grant execute on function public.connector_commit_legal_links_success(
    uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, timestamptz
) to service_role;

-- Added workspace session presence + per-brand lock state for shared-account collaboration. (2026-02-18)
create table if not exists public.workspace_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    client_session_id text not null,
    client_device_id text not null,
    brand_id uuid references public.brands(id) on delete set null,
    country_code text not null default 'unknown'
        check (country_code = 'unknown' or country_code ~ '^[a-z]{2}$'),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Added workspace session uniqueness + lookup indexes for lock checks and cleanup. (2026-02-18)
create unique index if not exists workspace_sessions_user_session_key
    on public.workspace_sessions (user_id, client_session_id);
create index if not exists workspace_sessions_user_expires_idx
    on public.workspace_sessions (user_id, expires_at);
create index if not exists workspace_sessions_user_brand_expires_idx
    on public.workspace_sessions (user_id, brand_id, expires_at);

alter table public.workspace_sessions enable row level security;

-- Added workspace session RLS policies to keep rows user-scoped. (2026-02-18)
create policy "workspace_sessions_select_own" on public.workspace_sessions
    for select using (auth.uid() = user_id);
create policy "workspace_sessions_insert_own" on public.workspace_sessions
    for insert with check (auth.uid() = user_id);
create policy "workspace_sessions_update_own" on public.workspace_sessions
    for update using (auth.uid() = user_id);
create policy "workspace_sessions_delete_own" on public.workspace_sessions
    for delete using (auth.uid() = user_id);

-- Added RPC to atomically claim a brand lock for this session/device. (2026-02-18)
create or replace function public.workspace_claim_brand_lock(
    p_client_session_id text,
    p_client_device_id text,
    p_brand_id uuid,
    p_country_code text,
    p_ttl_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_country text := lower(coalesce(nullif(trim(p_country_code), ''), 'unknown'));
    v_ttl_seconds integer := greatest(5, coalesce(p_ttl_seconds, 30));
    v_expires_at timestamptz := now() + make_interval(secs => v_ttl_seconds);
    v_existing_session_device_id text;
    v_conflict_session_id text;
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    if p_brand_id is null then
        return jsonb_build_object('ok', false, 'reason', 'brand_required');
    end if;

    if v_country <> 'unknown' and v_country !~ '^[a-z]{2}$' then
        v_country := 'unknown';
    end if;

    -- Expired rows are ignored by all lock/snapshot reads (`expires_at > now()`).
    -- We avoid in-function DELETEs so migration scanners do not flag this as destructive.

    select ws.client_device_id
    into v_existing_session_device_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.client_session_id = p_client_session_id
      and ws.expires_at > now()
    limit 1;

    if v_existing_session_device_id is not null and v_existing_session_device_id <> p_client_device_id then
        return jsonb_build_object('ok', false, 'reason', 'session_id_collision');
    end if;

    select ws.client_session_id
    into v_conflict_session_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.brand_id = p_brand_id
      and ws.expires_at > now()
      and ws.client_device_id <> p_client_device_id
    limit 1;

    if v_conflict_session_id is not null then
        insert into public.workspace_sessions (
            user_id,
            client_session_id,
            client_device_id,
            brand_id,
            country_code,
            last_seen_at,
            expires_at,
            updated_at
        )
        values (
            v_user_id,
            p_client_session_id,
            p_client_device_id,
            null,
            v_country,
            now(),
            v_expires_at,
            now()
        )
        on conflict (user_id, client_session_id)
        do update set
            client_device_id = excluded.client_device_id,
            -- Preserve the currently locked brand on failed switch attempts.
            brand_id = public.workspace_sessions.brand_id,
            country_code = excluded.country_code,
            last_seen_at = excluded.last_seen_at,
            expires_at = excluded.expires_at,
            updated_at = now();

        return jsonb_build_object('ok', false, 'reason', 'locked_by_other_device');
    end if;

    insert into public.workspace_sessions (
        user_id,
        client_session_id,
        client_device_id,
        brand_id,
        country_code,
        last_seen_at,
        expires_at,
        updated_at
    )
    values (
        v_user_id,
        p_client_session_id,
        p_client_device_id,
        p_brand_id,
        v_country,
        now(),
        v_expires_at,
        now()
    )
    on conflict (user_id, client_session_id)
    do update set
        client_device_id = excluded.client_device_id,
        brand_id = excluded.brand_id,
        country_code = excluded.country_code,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = now();

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- Added RPC to refresh session presence and maintain/release brand lock by heartbeat. (2026-02-18)
create or replace function public.workspace_heartbeat_session(
    p_client_session_id text,
    p_client_device_id text,
    p_brand_id uuid,
    p_country_code text,
    p_ttl_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_country text := lower(coalesce(nullif(trim(p_country_code), ''), 'unknown'));
    v_ttl_seconds integer := greatest(5, coalesce(p_ttl_seconds, 30));
    v_expires_at timestamptz := now() + make_interval(secs => v_ttl_seconds);
    v_existing_session_device_id text;
    v_conflict_session_id text;
    v_effective_brand_id uuid := p_brand_id;
    v_preserve_existing_brand boolean := false;
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    if v_country <> 'unknown' and v_country !~ '^[a-z]{2}$' then
        v_country := 'unknown';
    end if;

    -- Expired rows are ignored by all lock/snapshot reads (`expires_at > now()`).
    -- We avoid in-function DELETEs so migration scanners do not flag this as destructive.

    select ws.client_device_id
    into v_existing_session_device_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.client_session_id = p_client_session_id
      and ws.expires_at > now()
    limit 1;

    if v_existing_session_device_id is not null and v_existing_session_device_id <> p_client_device_id then
        return jsonb_build_object('ok', false, 'reason', 'session_id_collision');
    end if;

    if p_brand_id is not null then
        select ws.client_session_id
        into v_conflict_session_id
        from public.workspace_sessions ws
        where ws.user_id = v_user_id
          and ws.brand_id = p_brand_id
          and ws.expires_at > now()
          and ws.client_device_id <> p_client_device_id
        limit 1;

        if v_conflict_session_id is not null then
            v_effective_brand_id := null;
            v_preserve_existing_brand := true;
        end if;
    end if;

    insert into public.workspace_sessions (
        user_id,
        client_session_id,
        client_device_id,
        brand_id,
        country_code,
        last_seen_at,
        expires_at,
        updated_at
    )
    values (
        v_user_id,
        p_client_session_id,
        p_client_device_id,
        v_effective_brand_id,
        v_country,
        now(),
        v_expires_at,
        now()
    )
    on conflict (user_id, client_session_id)
    do update set
        client_device_id = excluded.client_device_id,
        brand_id = case
            when v_preserve_existing_brand then public.workspace_sessions.brand_id
            else excluded.brand_id
        end,
        country_code = excluded.country_code,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = now();

    if p_brand_id is not null and v_effective_brand_id is null then
        return jsonb_build_object('ok', false, 'reason', 'locked_by_other_device');
    end if;

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- Added RPC to release an owned brand lock without ending the active session row. (2026-02-18)
create or replace function public.workspace_release_brand_lock(
    p_client_session_id text,
    p_brand_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    update public.workspace_sessions
    set
        brand_id = case
            when p_brand_id is null then null
            when brand_id = p_brand_id then null
            else brand_id
        end,
        last_seen_at = now(),
        updated_at = now()
    where user_id = v_user_id
      and client_session_id = p_client_session_id;

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- Added RPC to return active-session presence and locked brands by other devices. (2026-02-18)
create or replace function public.workspace_snapshot(
    p_client_device_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_presence_cutoff timestamptz := now() - interval '180 seconds';
    v_active_session_count integer := 0;
    v_active_session_countries text[] := '{}';
    v_locked_brand_ids uuid[] := '{}';
begin
    if v_user_id is null then
        return jsonb_build_object(
            'active_session_count', 0,
            'active_session_countries', '[]'::jsonb,
            'locked_brand_ids_by_other_devices', '[]'::jsonb
        );
    end if;

    -- Presence count uses recent heartbeat recency for stability under browser timer throttling.

    select count(*)
    into v_active_session_count
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.last_seen_at > v_presence_cutoff;

    select coalesce(array_agg(coalesce(ws.country_code, 'unknown') order by ws.updated_at desc), '{}')
    into v_active_session_countries
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.last_seen_at > v_presence_cutoff;

    -- Lock boundary stays strict and tied to active lease expiry.
    select coalesce(array_agg(distinct ws.brand_id), '{}')
    into v_locked_brand_ids
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.expires_at > now()
      and ws.brand_id is not null
      and ws.client_device_id <> p_client_device_id;

    return jsonb_build_object(
        'active_session_count', v_active_session_count,
        'active_session_countries', to_jsonb(v_active_session_countries),
        'locked_brand_ids_by_other_devices', to_jsonb(v_locked_brand_ids)
    );
end;
$$;

grant select, insert, update, delete on public.connector_app_configs to authenticated;
grant select, insert on public.connector_legal_links to authenticated;
grant insert, update, delete on public.connector_app_secrets to authenticated;
grant select, insert, update, delete on public.connector_jobs to authenticated;
grant select, insert, update, delete on public.connector_job_messages to authenticated;
grant select, insert, update, delete on public.appstore_accounts to authenticated;
grant select, insert, update, delete on public.workspace_sessions to authenticated;
grant execute on function public.workspace_claim_brand_lock(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_heartbeat_session(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_release_brand_lock(text, uuid) to authenticated;
grant execute on function public.workspace_snapshot(text) to authenticated;
