-- Enforce current worker support for downstream capture mode on new connector jobs. (2026-03-17)

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.connector_jobs'::regclass
          and conname = 'connector_jobs_downstream_capture_mode_check'
    ) then
        alter table public.connector_jobs
            drop constraint connector_jobs_downstream_capture_mode_check;
    end if;
end $$;

alter table public.connector_jobs
    add constraint connector_jobs_downstream_capture_mode_check
    check (
        kind not in ('visual_qa', 'screenshots')
        or coalesce(input ->> 'capture_mode', '') = 'renders'
    ) not valid;
