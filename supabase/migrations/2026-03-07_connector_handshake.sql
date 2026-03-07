-- Connector handshake updates: new job kinds, exact result refs, job artifacts, and app-level base branch. (2026-03-07)

alter table public.connector_app_configs
    add column if not exists base_branch text not null default 'main';

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
    add column if not exists result_commit_sha text;

alter table public.connector_jobs
    add constraint connector_jobs_kind_check
    check (kind in ('generate', 'fix', 'integration', 'visual_qa', 'screenshots'));

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

create index if not exists connector_job_artifacts_job_id_created_at_idx
    on public.connector_job_artifacts (job_id, created_at desc);
create index if not exists connector_job_artifacts_app_id_created_at_idx
    on public.connector_job_artifacts (app_id, created_at desc);
create index if not exists connector_job_artifacts_kind_created_at_idx
    on public.connector_job_artifacts (kind, created_at desc);

alter table public.connector_job_artifacts enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'connector_job_artifacts'
          and policyname = 'connector_job_artifacts_select_own'
    ) then
        create policy "connector_job_artifacts_select_own" on public.connector_job_artifacts
            for select using (
                exists (
                    select 1
                    from public.connector_jobs jobs
                    where jobs.id = connector_job_artifacts.job_id
                      and jobs.user_id = auth.uid()
                )
            );
    end if;
end $$;

grant select on public.connector_job_artifacts to authenticated;
