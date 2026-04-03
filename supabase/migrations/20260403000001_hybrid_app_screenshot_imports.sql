alter table public.app_screenshots
    add column if not exists source_kind text not null default 'upload',
    add column if not exists artifact_id uuid,
    add column if not exists imported_from_job_id uuid,
    add column if not exists capture_variant text,
    add column if not exists theme text,
    add column if not exists viewport text,
    add column if not exists target_id text;

update public.app_screenshots
set source_kind = 'upload'
where source_kind is null;

alter table public.app_screenshots
    drop constraint if exists app_screenshots_source_kind_check,
    add constraint app_screenshots_source_kind_check
        check (source_kind in ('upload', 'runner')),
    drop constraint if exists app_screenshots_capture_variant_check,
    add constraint app_screenshots_capture_variant_check
        check (capture_variant is null or capture_variant in ('render', 'simulator'));

create unique index if not exists app_screenshots_artifact_id_unique
    on public.app_screenshots (artifact_id)
    where artifact_id is not null;

create table if not exists public.app_screenshot_artifact_ignores (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    artifact_id uuid not null,
    created_at timestamptz not null default now()
);

create unique index if not exists app_screenshot_artifact_ignores_user_app_artifact_key
    on public.app_screenshot_artifact_ignores (user_id, app_id, artifact_id);
create index if not exists app_screenshot_artifact_ignores_user_id_idx
    on public.app_screenshot_artifact_ignores (user_id);
create index if not exists app_screenshot_artifact_ignores_app_id_idx
    on public.app_screenshot_artifact_ignores (app_id);

alter table public.app_screenshot_artifact_ignores enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'app_screenshot_artifact_ignores'
          and policyname = 'app_screenshot_artifact_ignores_select_own'
    ) then
        create policy "app_screenshot_artifact_ignores_select_own" on public.app_screenshot_artifact_ignores
            for select using (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'app_screenshot_artifact_ignores'
          and policyname = 'app_screenshot_artifact_ignores_insert_own'
    ) then
        create policy "app_screenshot_artifact_ignores_insert_own" on public.app_screenshot_artifact_ignores
            for insert with check (auth.uid() = user_id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'app_screenshot_artifact_ignores'
          and policyname = 'app_screenshot_artifact_ignores_delete_own'
    ) then
        create policy "app_screenshot_artifact_ignores_delete_own" on public.app_screenshot_artifact_ignores
            for delete using (auth.uid() = user_id);
    end if;
end $$;
