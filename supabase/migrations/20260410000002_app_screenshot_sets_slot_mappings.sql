-- Persist screenshot slot mappings per screenshot set so slot-specific UI mode/config
-- survives reloads and does not leak across A/B sets. (2026-04-10)

alter table public.app_screenshot_sets
    add column if not exists slot_mappings jsonb;

update public.app_screenshot_sets
set slot_mappings = '{}'::jsonb
where slot_mappings is null;

alter table public.app_screenshot_sets
    alter column slot_mappings set default '{}'::jsonb;

alter table public.app_screenshot_sets
    alter column slot_mappings set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'app_screenshot_sets_slot_mappings_object_check'
          and conrelid = 'public.app_screenshot_sets'::regclass
    ) then
        alter table public.app_screenshot_sets
            add constraint app_screenshot_sets_slot_mappings_object_check
            check (jsonb_typeof(slot_mappings) = 'object');
    end if;
end $$;
