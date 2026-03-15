-- Idea generation jobs, idea lineage fields, and immutable generation history. (2026-03-15)

-- Promote legacy no-brand rows before creating any missing no-brand buckets for idea backfills.
with promoted as (
    update public.brands b
    set is_no_brand = true
    where coalesce(b.is_no_brand, false) = false
      and (
          lower(trim(coalesce(b.slug, ''))) = 'no-brand'
          or lower(trim(coalesce(b.name, ''))) = 'no brand'
      )
      and not exists (
          select 1
          from public.brands existing
          where existing.user_id = b.user_id
            and existing.is_no_brand = true
      )
    returning b.user_id
)
insert into public.brands (
    user_id,
    name,
    slug,
    order_index,
    is_no_brand
)
select
    src.user_id,
    'No Brand',
    'no-brand',
    coalesce(existing.max_order_index, -1) + 1,
    true
from (
    select distinct user_id
    from public.app_ideas
) src
left join lateral (
    select max(order_index) as max_order_index
    from public.brands b
    where b.user_id = src.user_id
) existing on true
left join public.brands no_brand
    on no_brand.user_id = src.user_id
   and no_brand.is_no_brand = true
where no_brand.id is null;

alter table public.app_ideas
    add column if not exists brand_id uuid references public.brands(id) on delete cascade,
    add column if not exists idea_source text not null default 'manual',
    add column if not exists status text not null default 'generated',
    add column if not exists client_spec_current text not null default '',
    add column if not exists alternate_names jsonb not null default '[]'::jsonb,
    add column if not exists idea_family_id uuid not null default gen_random_uuid(),
    add column if not exists version_index integer not null default 1,
    add column if not exists spec_revision_index integer not null default 1,
    add column if not exists parent_idea_id uuid references public.app_ideas(id) on delete set null,
    add column if not exists last_generated_output_id uuid,
    add column if not exists edited_after_generation boolean not null default false,
    add column if not exists memory_fingerprint text;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_idea_source_check'
    ) then
        alter table public.app_ideas
            drop constraint app_ideas_idea_source_check;
    end if;
end $$;

alter table public.app_ideas
    add constraint app_ideas_idea_source_check
    check (idea_source in ('manual', 'generated'));

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_status_check'
    ) then
        alter table public.app_ideas
            drop constraint app_ideas_status_check;
    end if;
end $$;

alter table public.app_ideas
    add constraint app_ideas_status_check
    check (status in ('generated', 'used', 'superseded', 'removed'));

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_alternate_names_array_check'
    ) then
        alter table public.app_ideas
            drop constraint app_ideas_alternate_names_array_check;
    end if;
end $$;

alter table public.app_ideas
    add constraint app_ideas_alternate_names_array_check
    check (jsonb_typeof(alternate_names) = 'array');

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_version_index_positive_check'
    ) then
        alter table public.app_ideas
            drop constraint app_ideas_version_index_positive_check;
    end if;
end $$;

alter table public.app_ideas
    add constraint app_ideas_version_index_positive_check
    check (version_index >= 1);

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_spec_revision_index_positive_check'
    ) then
        alter table public.app_ideas
            drop constraint app_ideas_spec_revision_index_positive_check;
    end if;
end $$;

alter table public.app_ideas
    add constraint app_ideas_spec_revision_index_positive_check
    check (spec_revision_index >= 1);

with assigned_brands as (
    select distinct on (cfg.idea_id)
        cfg.idea_id,
        a.brand_id
    from public.connector_app_configs cfg
    join public.apps a on a.id = cfg.app_id
    where cfg.idea_id is not null
    order by cfg.idea_id, a.created_at asc, a.id asc
)
update public.app_ideas ideas
set brand_id = assigned_brands.brand_id
from assigned_brands
where ideas.id = assigned_brands.idea_id
  and ideas.brand_id is null;

update public.app_ideas ideas
set brand_id = no_brand.id
from public.brands no_brand
where ideas.brand_id is null
  and no_brand.user_id = ideas.user_id
  and no_brand.is_no_brand = true;

update public.app_ideas
set client_spec_current = coalesce(nullif(client_spec_current, ''), description, '')
where coalesce(client_spec_current, '') = '';

alter table public.app_ideas
    alter column brand_id set not null;

create index if not exists app_ideas_user_brand_created_idx
    on public.app_ideas (user_id, brand_id, created_at desc);
create index if not exists app_ideas_user_source_status_idx
    on public.app_ideas (user_id, idea_source, status, created_at desc);
create index if not exists app_ideas_family_version_idx
    on public.app_ideas (idea_family_id, version_index);

alter table public.connector_jobs
    add column if not exists brand_id uuid references public.brands(id) on delete cascade;

update public.connector_jobs jobs
set brand_id = apps.brand_id
from public.apps apps
where jobs.brand_id is null
  and jobs.app_id = apps.id;

alter table public.connector_jobs
    alter column app_id drop not null;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.connector_jobs'::regclass
          and conname = 'connector_jobs_kind_check'
    ) then
        alter table public.connector_jobs
            drop constraint connector_jobs_kind_check;
    end if;
end $$;

alter table public.connector_jobs
    add constraint connector_jobs_kind_check
    check (kind in ('generate', 'fix', 'integration', 'visual_qa', 'screenshots', 'idea_generation'));

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.connector_jobs'::regclass
          and conname = 'connector_jobs_scope_check'
    ) then
        alter table public.connector_jobs
            drop constraint connector_jobs_scope_check;
    end if;
end $$;

alter table public.connector_jobs
    add constraint connector_jobs_scope_check
    check (
        (kind = 'idea_generation' and brand_id is not null)
        or (kind <> 'idea_generation' and app_id is not null)
    );

create index if not exists connector_jobs_user_brand_created_at_idx
    on public.connector_jobs (user_id, brand_id, created_at desc);
create index if not exists connector_jobs_user_kind_brand_created_at_idx
    on public.connector_jobs (user_id, kind, brand_id, created_at desc);

create table if not exists public.idea_generation_runs (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.connector_jobs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    brand_id uuid not null references public.brands(id) on delete cascade,
    requested_count integer not null check (requested_count between 1 and 50),
    creativity_mix jsonb not null default '{"safe":4,"balanced":3,"wild":3}'::jsonb,
    suggested_categories jsonb not null default '[]'::jsonb,
    confirmed_category_ids jsonb not null default '[]'::jsonb,
    generator_profile_id text,
    template_mix_version text,
    context_summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint idea_generation_runs_creativity_mix_object_check check (jsonb_typeof(creativity_mix) = 'object'),
    constraint idea_generation_runs_suggested_categories_array_check check (jsonb_typeof(suggested_categories) = 'array'),
    constraint idea_generation_runs_confirmed_category_ids_array_check check (jsonb_typeof(confirmed_category_ids) = 'array'),
    constraint idea_generation_runs_context_summary_object_check check (jsonb_typeof(context_summary) = 'object')
);

create unique index if not exists idea_generation_runs_job_id_key
    on public.idea_generation_runs (job_id);
create index if not exists idea_generation_runs_user_brand_created_at_idx
    on public.idea_generation_runs (user_id, brand_id, created_at desc);

alter table public.idea_generation_runs enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_runs'
          and policyname = 'idea_generation_runs_select_own'
    ) then
        create policy "idea_generation_runs_select_own" on public.idea_generation_runs
            for select using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_runs'
          and policyname = 'idea_generation_runs_insert_own'
    ) then
        create policy "idea_generation_runs_insert_own" on public.idea_generation_runs
            for insert with check (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_runs'
          and policyname = 'idea_generation_runs_update_own'
    ) then
        create policy "idea_generation_runs_update_own" on public.idea_generation_runs
            for update using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_runs'
          and policyname = 'idea_generation_runs_delete_own'
    ) then
        create policy "idea_generation_runs_delete_own" on public.idea_generation_runs
            for delete using (auth.uid() = user_id);
    end if;
end $$;

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
    alternate_names jsonb not null default '[]'::jsonb,
    idea_summary text not null,
    client_spec_generated text not null,
    classification text not null check (classification in ('new_family', 'new_version', 'too_close_surface_repeat')),
    comparison_snapshot jsonb not null default '{}'::jsonb,
    generator_profile_id text,
    template_mix_version text,
    created_at timestamptz not null default now(),
    constraint idea_generation_outputs_alternate_names_array_check check (jsonb_typeof(alternate_names) = 'array'),
    constraint idea_generation_outputs_comparison_snapshot_object_check check (jsonb_typeof(comparison_snapshot) = 'object')
);

create index if not exists idea_generation_outputs_run_created_at_idx
    on public.idea_generation_outputs (run_id, created_at asc);
create index if not exists idea_generation_outputs_user_brand_created_at_idx
    on public.idea_generation_outputs (user_id, brand_id, created_at desc);
create index if not exists idea_generation_outputs_app_idea_id_idx
    on public.idea_generation_outputs (app_idea_id);
create index if not exists idea_generation_outputs_family_version_idx
    on public.idea_generation_outputs (idea_family_id, version_index);

alter table public.idea_generation_outputs enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_outputs'
          and policyname = 'idea_generation_outputs_select_own'
    ) then
        create policy "idea_generation_outputs_select_own" on public.idea_generation_outputs
            for select using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_outputs'
          and policyname = 'idea_generation_outputs_insert_own'
    ) then
        create policy "idea_generation_outputs_insert_own" on public.idea_generation_outputs
            for insert with check (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_outputs'
          and policyname = 'idea_generation_outputs_update_own'
    ) then
        create policy "idea_generation_outputs_update_own" on public.idea_generation_outputs
            for update using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'idea_generation_outputs'
          and policyname = 'idea_generation_outputs_delete_own'
    ) then
        create policy "idea_generation_outputs_delete_own" on public.idea_generation_outputs
            for delete using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.app_ideas'::regclass
          and conname = 'app_ideas_last_generated_output_id_fkey'
    ) then
        alter table public.app_ideas
            add constraint app_ideas_last_generated_output_id_fkey
            foreign key (last_generated_output_id) references public.idea_generation_outputs(id) on delete set null;
    end if;
end $$;

create index if not exists app_ideas_last_generated_output_id_idx
    on public.app_ideas (last_generated_output_id);

grant select, insert, update, delete on public.idea_generation_runs to authenticated;
grant select, insert, update, delete on public.idea_generation_outputs to authenticated;
