-- Client GitHub publish target fields + publish job kind. (2026-04-10)

alter table public.apps
    add column if not exists client_github_repo_url text,
    add column if not exists client_github_repo_full_name text,
    add column if not exists client_github_repo_published_at timestamptz,
    add column if not exists client_github_repo_updated_at timestamptz;

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
end
$$;

alter table public.connector_jobs
    add constraint connector_jobs_kind_check
    check (kind in ('generate', 'fix', 'integration', 'visual_qa', 'screenshots', 'idea_generation', 'publish_client_repo'));
