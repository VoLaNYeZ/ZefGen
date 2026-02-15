-- Connector runner tables + job claim RPC for hosted Codex execution. (2026-02-09)
-- Supabase note:
-- - Run in the Supabase SQL editor as a project owner.
-- - The runner should use the Supabase service role key.

-- App-level non-secret config for runner.
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
-- Note: RLS still applies; service_role bypasses RLS.
revoke select (value) on public.connector_app_secrets from anon, authenticated;
grant select (id, app_id, user_id, key, updated_at, created_at) on public.connector_app_secrets to anon, authenticated;

-- Runner job queue. (2026-02-09)
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

-- Job message log + Q/A transcript. (2026-02-09)
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

-- Atomic job claim RPC for runner. (2026-02-09)
-- Returns a single claimed job row, or NULL if none available.
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

-- Do not allow clients to execute job-claim RPC.
revoke all on function public.connector_claim_next_job(text) from public;
grant execute on function public.connector_claim_next_job(text) to service_role;

-- Table privileges (RLS still applies). (2026-02-09)
grant select, insert, update, delete on public.connector_app_configs to authenticated;
grant insert, update, delete on public.connector_app_secrets to authenticated;
grant select, insert, update, delete on public.connector_jobs to authenticated;
grant select, insert, update, delete on public.connector_job_messages to authenticated;
