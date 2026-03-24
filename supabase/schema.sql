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
    -- System-managed "No Brand" bucket flag. (2026-03-02)
    is_no_brand boolean not null default false,
    -- Sidebar inactive bucket flag for hiding brands from the main list. (2026-03-16)
    is_inactive boolean not null default false,
    -- Brand release planning metadata (target countries, keywords, notes). (2026-02-08)
    target_countries text[] not null default '{}',
    keywords text not null default '' check (char_length(keywords) <= 100),
    release_strategy_notes text not null default '',
    release_strategy_updated_at timestamptz,
    created_at timestamptz not null default now(),
    constraint brands_no_brand_not_inactive check (not (is_no_brand and is_inactive))
);

create unique index if not exists brands_user_slug_key on public.brands (user_id, slug);
create index if not exists brands_user_id_idx on public.brands (user_id);
create index if not exists brands_user_order_idx on public.brands (user_id, order_index);
create unique index if not exists brands_one_no_brand_per_user on public.brands (user_id) where is_no_brand;

create table if not exists public.apps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    alias text not null,
    -- App-level icon prompt for No Brand generation. (2026-03-02)
    icon_prompt text not null default '',
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
-- Enforce alias uniqueness across all apps within the same user workspace. (2026-03-02)
create unique index if not exists apps_user_alias_lower_key on public.apps (user_id, lower(alias));
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

-- App-level App Store review webhook configuration + listener credentials. (2026-03-07)
create table if not exists public.appstore_review_webhooks (
    app_id uuid primary key references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    public_token text not null default encode(gen_random_bytes(16), 'hex'),
    secret text not null default encode(gen_random_bytes(24), 'hex'),
    public_subdomain text,
    public_page_published_at timestamptz,
    key_mode text check (key_mode in ('team', 'individual')),
    key_id text,
    issuer_id text,
    public_webhook_url text,
    asc_app_id text,
    asc_app_name text,
    asc_bundle_id text,
    apple_webhook_id text,
    latest_event_type text,
    latest_review_state text,
    latest_previous_state text,
    latest_event_at timestamptz,
    last_snapshot_at timestamptz,
    last_delivery_at timestamptz,
    last_delivery_status text not null default 'idle'
        check (last_delivery_status in ('idle', 'received', 'ignored', 'invalid_signature', 'error')),
    last_error text,
    last_sync_at timestamptz,
    last_sync_status text not null default 'idle'
        check (last_sync_status in ('idle', 'connected', 'error')),
    last_sync_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists appstore_review_webhooks_public_token_key
    on public.appstore_review_webhooks (public_token);
create unique index if not exists appstore_review_webhooks_public_subdomain_key
    on public.appstore_review_webhooks (public_subdomain)
    where public_subdomain is not null;
create index if not exists appstore_review_webhooks_user_id_idx
    on public.appstore_review_webhooks (user_id);

-- Append-only App Store review webhook deliveries for per-app history. (2026-03-07)
create table if not exists public.appstore_review_events (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null default '',
    payload_type text not null default '',
    state_from text,
    state_to text,
    event_at timestamptz not null default now(),
    delivery_status text not null default 'received'
        check (delivery_status in ('received', 'ignored', 'error', 'snapshot')),
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists appstore_review_events_user_app_event_idx
    on public.appstore_review_events (user_id, app_id, event_at desc);
create index if not exists appstore_review_events_app_created_idx
    on public.appstore_review_events (app_id, created_at desc);

-- Fixed Apple non-game category dictionary for Ideas workflow. (2026-02-22)
create table if not exists public.app_idea_categories (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null unique,
    order_index integer not null default 0,
    created_at timestamptz not null default now()
);

-- User-level idea pool for Step 2 client spec picker + generated idea lineage. (2026-02-22, 2026-03-15)
create table if not exists public.app_ideas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    category_id uuid not null references public.app_idea_categories(id) on delete restrict,
    idea_source text not null default 'manual' check (idea_source in ('manual', 'generated')),
    status text not null default 'generated' check (status in ('generated', 'used', 'superseded', 'removed')),
    title text not null default '',
    description text not null default '',
    client_spec_current text not null default '',
    alternate_names jsonb not null default '[]'::jsonb
        check (jsonb_typeof(alternate_names) = 'array'),
    idea_family_id uuid not null default gen_random_uuid(),
    version_index integer not null default 1
        check (version_index >= 1),
    spec_revision_index integer not null default 1
        check (spec_revision_index >= 1),
    parent_idea_id uuid references public.app_ideas(id) on delete set null,
    last_generated_output_id uuid,
    edited_after_generation boolean not null default false,
    memory_fingerprint text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists app_ideas_user_id_idx on public.app_ideas (user_id);
create index if not exists app_ideas_user_category_idx on public.app_ideas (user_id, category_id);
create index if not exists app_ideas_user_created_idx on public.app_ideas (user_id, created_at);
create index if not exists app_ideas_user_brand_created_idx on public.app_ideas (user_id, brand_id, created_at desc);
create index if not exists app_ideas_user_source_status_idx on public.app_ideas (user_id, idea_source, status, created_at desc);
create index if not exists app_ideas_family_version_idx on public.app_ideas (idea_family_id, version_index);

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
alter table public.appstore_review_webhooks enable row level security;
alter table public.appstore_review_events enable row level security;
alter table public.app_idea_categories enable row level security;
alter table public.app_ideas enable row level security;
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

create policy "appstore_review_webhooks_select_own" on public.appstore_review_webhooks
    for select using (auth.uid() = user_id);
create policy "appstore_review_webhooks_insert_own" on public.appstore_review_webhooks
    for insert with check (auth.uid() = user_id);
create policy "appstore_review_webhooks_update_own" on public.appstore_review_webhooks
    for update using (auth.uid() = user_id);
create policy "appstore_review_webhooks_delete_own" on public.appstore_review_webhooks
    for delete using (auth.uid() = user_id);

create policy "appstore_review_events_select_own" on public.appstore_review_events
    for select using (auth.uid() = user_id);

create policy "app_idea_categories_select_authenticated" on public.app_idea_categories
    for select using (true);

create policy "app_ideas_select_own" on public.app_ideas
    for select using (auth.uid() = user_id);
create policy "app_ideas_insert_own" on public.app_ideas
    for insert with check (auth.uid() = user_id);
create policy "app_ideas_update_own" on public.app_ideas
    for update using (auth.uid() = user_id);
create policy "app_ideas_delete_own" on public.app_ideas
    for delete using (auth.uid() = user_id);

insert into public.app_idea_categories (slug, name, order_index)
values
    ('books', 'Books', 1),
    ('business', 'Business', 2),
    ('developer-tools', 'Developer Tools', 3),
    ('education', 'Education', 4),
    ('entertainment', 'Entertainment', 5),
    ('finance', 'Finance', 6),
    ('food-drink', 'Food & Drink', 7),
    ('graphics-design', 'Graphics & Design', 8),
    ('health-fitness', 'Health & Fitness', 9),
    ('lifestyle', 'Lifestyle', 10),
    ('kids', 'Kids', 11),
    ('magazines-newspapers', 'Magazines & Newspapers', 12),
    ('medical', 'Medical', 13),
    ('music', 'Music', 14),
    ('navigation', 'Navigation', 15),
    ('news', 'News', 16),
    ('photo-video', 'Photo & Video', 17),
    ('productivity', 'Productivity', 18),
    ('reference', 'Reference', 19),
    ('safari-extensions', 'Safari Extensions', 20),
    ('shopping', 'Shopping', 21),
    ('social-networking', 'Social Networking', 22),
    ('sports', 'Sports', 23),
    ('travel', 'Travel', 24),
    ('utilities', 'Utilities', 25),
    ('weather', 'Weather', 26),
    ('stickers', 'Stickers', 27)
on conflict (slug) do nothing;

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

-- Move an app from one brand to another and migrate brand_id across app-linked tables. (2026-03-02)
create or replace function public.move_app_to_brand(
    p_app_id uuid,
    p_to_brand_id uuid,
    p_new_alias text default null
)
returns public.apps
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_app public.apps;
    v_target_brand public.brands;
    v_alias text;
    v_next_order_index integer;
begin
    if v_user_id is null then
        raise exception 'Unauthorized';
    end if;

    if p_app_id is null then
        raise exception 'App id is required';
    end if;

    if p_to_brand_id is null then
        raise exception 'Target brand id is required';
    end if;

    select *
    into v_app
    from public.apps
    where id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        raise exception 'App not found';
    end if;

    select *
    into v_target_brand
    from public.brands
    where id = p_to_brand_id
      and user_id = v_user_id;

    if not found then
        raise exception 'Target brand not found';
    end if;

    if coalesce(v_target_brand.is_no_brand, false) then
        raise exception 'Target brand must be a regular brand';
    end if;

    v_alias := nullif(btrim(coalesce(p_new_alias, '')), '');
    if v_alias is null then
        v_alias := v_app.alias;
    end if;

    if exists (
        select 1
        from public.apps a
        where a.user_id = v_user_id
          and a.id <> v_app.id
          and lower(a.alias) = lower(v_alias)
    ) then
        raise exception 'Alias already exists for this user';
    end if;

    select coalesce(max(a.order_index), -1) + 1
    into v_next_order_index
    from public.apps a
    where a.user_id = v_user_id
      and a.brand_id = p_to_brand_id
      and a.id <> v_app.id;

    update public.apps
    set
        brand_id = p_to_brand_id,
        alias = v_alias,
        order_index = v_next_order_index
    where id = v_app.id
      and user_id = v_user_id
    returning *
    into v_app;

    update public.app_screenshots
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_screenshot_sets
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_generated_assets
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_asset_picks
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_export_status
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_screenshot_prompts
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    return v_app;
end;
$$;

revoke all on function public.move_app_to_brand(uuid, uuid, text) from public;
grant execute on function public.move_app_to_brand(uuid, uuid, text) to authenticated;

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
    idea_id uuid references public.app_ideas(id) on delete set null,
    base_branch text not null default 'main',
    variables jsonb not null default '{}'::jsonb,
    verify_command text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists connector_app_configs_user_id_idx on public.connector_app_configs (user_id);
create index if not exists connector_app_configs_idea_id_idx on public.connector_app_configs (idea_id);

alter table public.connector_app_configs enable row level security;

create policy "connector_app_configs_select_own" on public.connector_app_configs
    for select using (auth.uid() = user_id);
create policy "connector_app_configs_insert_own" on public.connector_app_configs
    for insert with check (auth.uid() = user_id);
create policy "connector_app_configs_update_own" on public.connector_app_configs
    for update using (auth.uid() = user_id);
create policy "connector_app_configs_delete_own" on public.connector_app_configs
    for delete using (auth.uid() = user_id);

-- Connector legal links current row for generated Privacy/Terms/Support assets. (2026-02-16)
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
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Indexes for app scans and fingerprint checks. (2026-02-16)
create unique index if not exists connector_legal_links_user_app_key
    on public.connector_legal_links (user_id, app_id);
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
create policy "connector_legal_links_update_own" on public.connector_legal_links
    for update using (auth.uid() = user_id);

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
    app_id uuid references public.apps(id) on delete cascade,
    brand_id uuid references public.brands(id) on delete cascade,
    kind text not null check (kind in ('generate', 'fix', 'integration', 'visual_qa', 'screenshots', 'idea_generation')),
    status text not null default 'queued' check (status in ('queued', 'running', 'waiting_for_user', 'succeeded', 'failed', 'canceled')),
    requested_by text,
    input jsonb not null default '{}'::jsonb,
    repo_full_name text not null,
    base_branch text not null default 'main',
    work_branch text,
    result_commit_sha text,
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
    created_at timestamptz not null default now(),
    constraint connector_jobs_scope_check check (
        (kind = 'idea_generation' and brand_id is not null)
        or (kind <> 'idea_generation' and app_id is not null)
    ),
    constraint connector_jobs_downstream_capture_mode_check check (
        kind not in ('visual_qa', 'screenshots')
        or coalesce(input ->> 'capture_mode', '') = 'renders'
    )
);

create index if not exists connector_jobs_status_created_at_idx on public.connector_jobs (status, created_at);
create index if not exists connector_jobs_user_app_created_at_idx on public.connector_jobs (user_id, app_id, created_at);
create index if not exists connector_jobs_user_brand_created_at_idx on public.connector_jobs (user_id, brand_id, created_at desc);
create index if not exists connector_jobs_user_kind_brand_created_at_idx on public.connector_jobs (user_id, kind, brand_id, created_at desc);
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

create table if not exists public.connector_job_artifacts (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.connector_jobs(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    kind text not null check (kind in ('qa_report', 'qa_evidence', 'screenshot_manifest', 'screenshot_image')),
    bucket text not null,
    object_path text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists connector_job_artifacts_job_id_created_at_idx on public.connector_job_artifacts (job_id, created_at desc);
create index if not exists connector_job_artifacts_app_id_created_at_idx on public.connector_job_artifacts (app_id, created_at desc);
create index if not exists connector_job_artifacts_kind_created_at_idx on public.connector_job_artifacts (kind, created_at desc);

alter table public.connector_job_artifacts enable row level security;

create policy "connector_job_artifacts_select_own" on public.connector_job_artifacts
    for select using (
        exists (
            select 1
            from public.connector_jobs jobs
            where jobs.id = connector_job_artifacts.job_id
              and jobs.user_id = auth.uid()
        )
    );

-- Immutable run history for brand/no-brand idea generation. (2026-03-15)
create table if not exists public.idea_generation_runs (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.connector_jobs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    requested_count integer not null check (requested_count between 1 and 50),
    creativity_mix jsonb not null default '{"safe":4,"balanced":3,"wild":3}'::jsonb
        check (jsonb_typeof(creativity_mix) = 'object'),
    suggested_categories jsonb not null default '[]'::jsonb
        check (jsonb_typeof(suggested_categories) = 'array'),
    confirmed_category_ids jsonb not null default '[]'::jsonb
        check (jsonb_typeof(confirmed_category_ids) = 'array'),
    generator_profile_id text,
    template_mix_version text,
    context_summary jsonb not null default '{}'::jsonb
        check (jsonb_typeof(context_summary) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idea_generation_runs_job_id_key on public.idea_generation_runs (job_id);
create index if not exists idea_generation_runs_user_brand_created_at_idx
    on public.idea_generation_runs (user_id, brand_id, created_at desc);

alter table public.idea_generation_runs enable row level security;

create policy "idea_generation_runs_select_own" on public.idea_generation_runs
    for select using (auth.uid() = user_id);
create policy "idea_generation_runs_insert_own" on public.idea_generation_runs
    for insert with check (auth.uid() = user_id);
create policy "idea_generation_runs_update_own" on public.idea_generation_runs
    for update using (auth.uid() = user_id);
create policy "idea_generation_runs_delete_own" on public.idea_generation_runs
    for delete using (auth.uid() = user_id);

-- Immutable generated idea snapshots per run. (2026-03-15)
create table if not exists public.idea_generation_outputs (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.idea_generation_runs(id) on delete cascade,
    job_id uuid not null references public.connector_jobs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    app_idea_id uuid references public.app_ideas(id) on delete set null,
    category_id uuid not null references public.app_idea_categories(id) on delete restrict,
    idea_family_id uuid not null,
    version_index integer not null check (version_index >= 1),
    parent_idea_id uuid references public.app_ideas(id) on delete set null,
    creativity_tier text not null check (creativity_tier in ('safe', 'balanced', 'wild')),
    final_name text not null,
    alternate_names jsonb not null default '[]'::jsonb
        check (jsonb_typeof(alternate_names) = 'array'),
    output_index integer not null
        check (output_index >= 1),
    idea_summary text not null,
    client_spec_generated text not null,
    classification text not null check (classification in ('new_family', 'new_version', 'too_close_surface_repeat')),
    comparison_snapshot jsonb not null default '{}'::jsonb
        check (jsonb_typeof(comparison_snapshot) = 'object'),
    generator_profile_id text,
    template_mix_version text,
    created_at timestamptz not null default now()
);

create index if not exists idea_generation_outputs_run_created_at_idx
    on public.idea_generation_outputs (run_id, created_at asc);
create unique index if not exists idea_generation_outputs_run_output_index_key
    on public.idea_generation_outputs (run_id, output_index);
create index if not exists idea_generation_outputs_user_brand_created_at_idx
    on public.idea_generation_outputs (user_id, brand_id, created_at desc);
create index if not exists idea_generation_outputs_app_idea_id_idx
    on public.idea_generation_outputs (app_idea_id);
create index if not exists idea_generation_outputs_family_version_idx
    on public.idea_generation_outputs (idea_family_id, version_index);

alter table public.idea_generation_outputs enable row level security;

create policy "idea_generation_outputs_select_own" on public.idea_generation_outputs
    for select using (auth.uid() = user_id);
create policy "idea_generation_outputs_insert_own" on public.idea_generation_outputs
    for insert with check (auth.uid() = user_id);
create policy "idea_generation_outputs_update_own" on public.idea_generation_outputs
    for update using (auth.uid() = user_id);
create policy "idea_generation_outputs_delete_own" on public.idea_generation_outputs
    for delete using (auth.uid() = user_id);

-- Link visible idea rows back to their latest immutable generated snapshot. (2026-03-15)
alter table public.app_ideas
    add constraint app_ideas_last_generated_output_id_fkey
    foreign key (last_generated_output_id) references public.idea_generation_outputs(id) on delete set null;

create index if not exists app_ideas_last_generated_output_id_idx on public.app_ideas (last_generated_output_id);

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

create or replace function public.connector_sanitize_variables(
    p_variables jsonb,
    p_strip_legacy_legal_links boolean
)
returns jsonb
language sql
immutable
as $$
    select
        case
            when jsonb_typeof(coalesce(p_variables, '{}'::jsonb)) = 'object' then
                case
                    when coalesce(p_strip_legacy_legal_links, true) then
                        coalesce(p_variables, '{}'::jsonb)
                            - 'company_name'
                            - 'privacy_policy_url'
                            - 'terms_of_use_url'
                            - 'support_form_url'
                    else
                        coalesce(p_variables, '{}'::jsonb)
                            - 'company_name'
                end
            else '{}'::jsonb
        end;
$$;

create or replace function public.connector_sanitize_variables(p_variables jsonb)
returns jsonb
language sql
immutable
as $$
    select public.connector_sanitize_variables(p_variables, true);
$$;

create or replace function public.connector_save_app_config(
    p_app_id uuid,
    p_expected_updated_at timestamptz default null,
    p_project_brief text default '',
    p_idea_id uuid default null,
    p_base_branch text default 'main',
    p_variables jsonb default '{}'::jsonb,
    p_force_overwrite boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_now timestamptz := now();
    v_existing public.connector_app_configs;
    v_saved public.connector_app_configs;
    v_sanitized_variables jsonb;
    v_has_current_legal_links boolean := false;
    v_base_branch text := coalesce(nullif(trim(p_base_branch), ''), 'main');
begin
    if v_user_id is null then
        raise exception 'unauthorized';
    end if;

    perform 1
    from public.apps
    where id = p_app_id
      and user_id = v_user_id;

    if not found then
        raise exception 'app not found';
    end if;

    select exists(
        select 1
        from public.connector_legal_links
        where user_id = v_user_id
          and app_id = p_app_id
          and status = 'succeeded'
    )
    into v_has_current_legal_links;

    v_sanitized_variables := public.connector_sanitize_variables(
        p_variables,
        v_has_current_legal_links
    );

    select *
    into v_existing
    from public.connector_app_configs
    where app_id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        insert into public.connector_app_configs (
            app_id,
            user_id,
            project_kind,
            project_brief,
            idea_id,
            base_branch,
            variables,
            verify_command,
            updated_at
        )
        values (
            p_app_id,
            v_user_id,
            'ios',
            coalesce(p_project_brief, ''),
            p_idea_id,
            v_base_branch,
            v_sanitized_variables,
            null,
            v_now
        )
        returning * into v_saved;

        return jsonb_build_object(
            'status', 'saved',
            'row', to_jsonb(v_saved)
        );
    end if;

    if not coalesce(p_force_overwrite, false)
       and p_expected_updated_at is distinct from v_existing.updated_at then
        return jsonb_build_object(
            'status', 'conflict',
            'row', to_jsonb(v_existing)
        );
    end if;

    update public.connector_app_configs
    set
        project_brief = coalesce(p_project_brief, ''),
        idea_id = p_idea_id,
        base_branch = v_base_branch,
        variables = v_sanitized_variables,
        updated_at = v_now
    where app_id = p_app_id
      and user_id = v_user_id
    returning * into v_saved;

    return jsonb_build_object(
        'status', 'saved',
        'row', to_jsonb(v_saved)
    );
end;
$$;

revoke all on function public.connector_save_app_config(
    uuid, timestamptz, text, uuid, text, jsonb, boolean
) from public;
grant execute on function public.connector_save_app_config(
    uuid, timestamptz, text, uuid, text, jsonb, boolean
) to authenticated;

create or replace function public.connector_get_current_legal_links(
    p_app_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_row public.connector_legal_links;
    v_appstore_name text;
    v_company_name text;
    v_account_email text;
    v_privacy_url text;
    v_terms_url text;
    v_support_url text;
    v_fingerprint text;
    v_privacy_doc_id text := '';
    v_terms_doc_id text := '';
    v_support_form_id text := '';
    v_now timestamptz := now();
begin
    if v_user_id is null or p_app_id is null then
        return null;
    end if;

    select *
    into v_row
    from public.connector_legal_links
    where user_id = v_user_id
      and app_id = p_app_id
      and status = 'succeeded'
    limit 1;

    if found then
        return jsonb_build_object(
            'id', v_row.id,
            'fingerprint', v_row.fingerprint,
            'privacy_policy_url', v_row.privacy_url,
            'terms_of_use_url', v_row.terms_url,
            'support_form_url', v_row.support_url,
            'updated_at', v_row.updated_at,
            'created_at', v_row.created_at
        );
    end if;

    select
        nullif(trim(cfg.variables->>'appstore_name'), ''),
        nullif(trim(acc.company_name), ''),
        nullif(trim(acc.email), ''),
        nullif(trim(cfg.variables->>'privacy_policy_url'), ''),
        nullif(trim(cfg.variables->>'terms_of_use_url'), ''),
        nullif(trim(cfg.variables->>'support_form_url'), '')
    into
        v_appstore_name,
        v_company_name,
        v_account_email,
        v_privacy_url,
        v_terms_url,
        v_support_url
    from public.connector_app_configs cfg
    left join public.appstore_accounts acc
      on acc.app_id = cfg.app_id
     and acc.user_id = cfg.user_id
    where cfg.app_id = p_app_id
      and cfg.user_id = v_user_id
    limit 1;

    if v_appstore_name is null
       or v_company_name is null
       or v_account_email is null
       or v_privacy_url is null
       or v_terms_url is null
       or v_support_url is null then
        return null;
    end if;

    if regexp_replace(v_privacy_url, '/+$', '') = 'https://google.com'
       or regexp_replace(v_terms_url, '/+$', '') = 'https://google.com'
       or regexp_replace(v_support_url, '/+$', '') = 'https://google.com' then
        return null;
    end if;

    v_fingerprint := encode(
        digest(
            concat_ws(
                '|',
                regexp_replace(lower(trim(v_company_name)), '\s+', ' ', 'g'),
                regexp_replace(lower(trim(v_appstore_name)), '\s+', ' ', 'g'),
                regexp_replace(lower(trim(v_account_email)), '\s+', ' ', 'g')
            ),
            'sha256'
        ),
        'hex'
    );

    v_privacy_doc_id := coalesce(substring(v_privacy_url from '/d/([^/?#]+)'), '');
    v_terms_doc_id := coalesce(substring(v_terms_url from '/d/([^/?#]+)'), '');
    v_support_form_id := coalesce(
        substring(v_support_url from '/forms/d/e/([^/?#]+)'),
        substring(v_support_url from '/forms/d/([^/?#]+)'),
        ''
    );

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
        updated_at,
        created_at
    )
    values (
        v_user_id,
        p_app_id,
        v_fingerprint,
        v_company_name,
        v_appstore_name,
        v_account_email,
        v_privacy_doc_id,
        v_privacy_url,
        v_terms_doc_id,
        v_terms_url,
        v_support_form_id,
        v_support_url,
        '{}'::jsonb,
        null,
        false,
        'succeeded',
        null,
        v_now,
        v_now
    )
    on conflict (user_id, app_id)
    do update set
        fingerprint = excluded.fingerprint,
        company_name = excluded.company_name,
        appstore_name = excluded.appstore_name,
        account_email = excluded.account_email,
        privacy_doc_id = excluded.privacy_doc_id,
        privacy_url = excluded.privacy_url,
        terms_doc_id = excluded.terms_doc_id,
        terms_url = excluded.terms_url,
        support_form_id = excluded.support_form_id,
        support_url = excluded.support_url,
        support_schema = excluded.support_schema,
        subtitle_variant = excluded.subtitle_variant,
        regenerated_with_confirmation = excluded.regenerated_with_confirmation,
        status = 'succeeded',
        error = null,
        updated_at = excluded.updated_at
    returning * into v_row;

    update public.connector_app_configs
    set variables = public.connector_sanitize_variables(variables)
    where user_id = v_user_id
      and app_id = p_app_id
      and variables is distinct from public.connector_sanitize_variables(variables);

    return jsonb_build_object(
        'id', v_row.id,
        'fingerprint', v_row.fingerprint,
        'privacy_policy_url', v_row.privacy_url,
        'terms_of_use_url', v_row.terms_url,
        'support_form_url', v_row.support_url,
        'updated_at', v_row.updated_at,
        'created_at', v_row.created_at
    );
end;
$$;

revoke all on function public.connector_get_current_legal_links(uuid) from public;
grant execute on function public.connector_get_current_legal_links(uuid) to authenticated;

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
        updated_at,
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
        p_now,
        p_now
    )
    on conflict (user_id, app_id)
    do update set
        fingerprint = excluded.fingerprint,
        company_name = excluded.company_name,
        appstore_name = excluded.appstore_name,
        account_email = excluded.account_email,
        privacy_doc_id = excluded.privacy_doc_id,
        privacy_url = excluded.privacy_url,
        terms_doc_id = excluded.terms_doc_id,
        terms_url = excluded.terms_url,
        support_form_id = excluded.support_form_id,
        support_url = excluded.support_url,
        support_schema = excluded.support_schema,
        subtitle_variant = excluded.subtitle_variant,
        regenerated_with_confirmation = excluded.regenerated_with_confirmation,
        status = 'succeeded',
        error = null,
        updated_at = excluded.updated_at
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

create or replace function public.appstore_review_webhook_claim_subdomain(
    p_app_id uuid,
    p_requested text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_webhook public.appstore_review_webhooks;
    v_appstore_name text := '';
    v_base text := '';
    v_candidate text := '';
    v_suffix integer := 2;
    v_requested text := nullif(trim(coalesce(p_requested, '')), '');
    v_existing_host text := '';
    v_existing_root text := '.appshelp.cc';
begin
    if v_user_id is null then
        raise exception 'Authentication required.';
    end if;

    insert into public.appstore_review_webhooks (app_id, user_id)
    values (p_app_id, v_user_id)
    on conflict (app_id) do nothing;

    select *
    into v_webhook
    from public.appstore_review_webhooks
    where app_id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        raise exception 'Webhook row not found for app.';
    end if;

    if v_requested is null and nullif(trim(coalesce(v_webhook.public_subdomain, '')), '') is not null then
        return trim(v_webhook.public_subdomain);
    end if;

    select
        coalesce(cfg.variables->>'appstore_name', '')
    into
        v_appstore_name
    from public.apps a
    left join public.connector_app_configs cfg on cfg.app_id = a.id
    where a.id = p_app_id
      and a.user_id = v_user_id;

    if v_requested is null and nullif(trim(coalesce(v_webhook.public_webhook_url, '')), '') is not null then
        v_existing_host := lower(regexp_replace(split_part(split_part(v_webhook.public_webhook_url, '://', 2), '/', 1), ':\d+$', ''));
        if right(v_existing_host, length(v_existing_root)) = v_existing_root then
            v_requested := nullif(trim(left(v_existing_host, length(v_existing_host) - length(v_existing_root))), '');
        end if;
    end if;

    if v_requested is null and nullif(trim(v_appstore_name), '') is null then
        raise exception 'Fill App''s App Store name first.';
    end if;

    v_base := lower(coalesce(v_requested, nullif(trim(v_appstore_name), '')));
    v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
    v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
    v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
    if v_base = '' then
        v_base := 'app';
    end if;
    v_base := left(v_base, 63);
    v_base := regexp_replace(v_base, '-+$', '', 'g');
    if v_base = '' then
        v_base := 'app';
    end if;

    v_candidate := v_base;
    loop
        exit when not exists (
            select 1
            from public.appstore_review_webhooks other
            where other.public_subdomain = v_candidate
              and other.app_id <> p_app_id
        );
        v_candidate := left(v_base, greatest(1, 63 - length(v_suffix::text) - 1));
        v_candidate := regexp_replace(v_candidate, '-+$', '', 'g');
        if v_candidate = '' then
            v_candidate := 'app';
        end if;
        v_candidate := v_candidate || '-' || v_suffix::text;
        v_suffix := v_suffix + 1;
    end loop;

    update public.appstore_review_webhooks
    set
        public_subdomain = v_candidate,
        updated_at = now()
    where app_id = p_app_id
      and user_id = v_user_id;

    return v_candidate;
end;
$$;

revoke all on function public.appstore_review_webhook_claim_subdomain(uuid, text) from public;
grant execute on function public.appstore_review_webhook_claim_subdomain(uuid, text) to authenticated;

create or replace function public.appstore_review_webhook_public_surface(
    p_subdomain text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
    with candidate as (
        select
            w.app_id,
            w.public_subdomain,
            w.public_page_published_at,
            a.name as app_name,
            coalesce(nullif(cfg.variables->>'appstore_name', ''), a.name) as title,
            nullif(cfg.variables->>'appstore_description', '') as description,
            nullif(a.appstore_url, '') as appstore_url,
            coalesce(nullif(links.privacy_url, ''), nullif(cfg.variables->>'privacy_policy_url', '')) as privacy_policy_url,
            coalesce(nullif(links.terms_url, ''), nullif(cfg.variables->>'terms_of_use_url', '')) as terms_of_use_url,
            coalesce(nullif(links.support_url, ''), nullif(cfg.variables->>'support_form_url', '')) as support_form_url,
            (
                select aga.image_path
                from public.app_asset_picks pick
                join public.app_generated_assets aga on aga.id = pick.generated_asset_id
                where pick.app_id = w.app_id
                  and pick.kind = 'icon'
                order by pick.created_at desc
                limit 1
            ) as icon_image_path
        from public.appstore_review_webhooks w
        join public.apps a on a.id = w.app_id
        left join public.connector_app_configs cfg on cfg.app_id = w.app_id
        left join public.connector_legal_links links on links.app_id = w.app_id and links.status = 'succeeded'
        where w.public_subdomain = nullif(trim(p_subdomain), '')
        limit 1
    )
    select
        case
            when exists(select 1 from candidate) then (
                select jsonb_build_object(
                    'app_id', candidate.app_id,
                    'public_subdomain', candidate.public_subdomain,
                    'public_page_published_at', candidate.public_page_published_at,
                    'app_name', candidate.app_name,
                    'title', candidate.title,
                    'description', candidate.description,
                    'appstore_url', candidate.appstore_url,
                    'privacy_policy_url', candidate.privacy_policy_url,
                    'terms_of_use_url', candidate.terms_of_use_url,
                    'support_form_url', candidate.support_form_url,
                    'icon_image_path', candidate.icon_image_path
                )
                from candidate
            )
            else null
        end;
$$;

revoke all on function public.appstore_review_webhook_public_surface(text) from public;
grant execute on function public.appstore_review_webhook_public_surface(text) to service_role;

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

-- Added RPC to explicitly take over a brand lock and move other devices to view-only. (2026-03-23)
create or replace function public.workspace_take_over_brand_lock(
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

    update public.workspace_sessions
    set
        brand_id = null,
        last_seen_at = now(),
        updated_at = now()
    where user_id = v_user_id
      and brand_id = p_brand_id
      and expires_at > now()
      and client_device_id <> p_client_device_id;

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
grant select on public.connector_job_artifacts to authenticated;
grant select, insert, update, delete on public.idea_generation_runs to authenticated;
grant select, insert, update, delete on public.idea_generation_outputs to authenticated;
grant select, insert, update, delete on public.appstore_accounts to authenticated;
grant select, insert, update, delete on public.appstore_review_webhooks to authenticated;
grant select on public.appstore_review_events to authenticated;
grant select on public.app_idea_categories to authenticated;
grant select, insert, update, delete on public.app_ideas to authenticated;
grant select, insert, update, delete on public.workspace_sessions to authenticated;
grant execute on function public.workspace_claim_brand_lock(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_take_over_brand_lock(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_heartbeat_session(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_release_brand_lock(text, uuid) to authenticated;
grant execute on function public.workspace_snapshot(text) to authenticated;
