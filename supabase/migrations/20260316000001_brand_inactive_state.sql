-- Add a persisted inactive state for brands and keep No Brand always visible. (2026-03-16)

alter table public.brands
    add column if not exists is_inactive boolean not null default false;

update public.brands
set is_inactive = false
where coalesce(is_no_brand, false)
  and is_inactive;

do $$
begin
    alter table public.brands
        drop constraint if exists brands_no_brand_not_inactive;

    alter table public.brands
        add constraint brands_no_brand_not_inactive
        check (not (is_no_brand and is_inactive));
exception
    when duplicate_object then null;
end $$;
