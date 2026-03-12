-- Allow storing enhanced screenshot outputs alongside generated screenshots. (2026-02-06)
--
-- Supabase note:
-- - The check constraint name can differ per project. This script finds it dynamically.
-- - Run in the Supabase SQL editor as a project owner.

do $$
declare
    constraint_name text;
begin
    -- If the expected name already exists, drop it first so re-running the script is safe.
    alter table public.app_generated_assets
        drop constraint if exists app_generated_assets_kind_check;

    select con.conname
      into constraint_name
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'app_generated_assets'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%kind in (%';

    if constraint_name is not null then
        execute format('alter table public.app_generated_assets drop constraint %I', constraint_name);
    end if;

    alter table public.app_generated_assets
        add constraint app_generated_assets_kind_check
        check (kind in ('icon', 'icon_enhanced', 'screenshot', 'screenshot_enhanced'));
end $$;
