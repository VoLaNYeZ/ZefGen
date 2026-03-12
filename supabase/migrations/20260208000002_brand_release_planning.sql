-- Brand-level release planning metadata (target countries, keywords, notes). (2026-02-08)
--
-- Supabase note:
-- - Run in the Supabase SQL editor as a project owner.
-- - This script is idempotent and safe to re-run.

alter table public.brands
    add column if not exists target_countries text[] not null default '{}',
    add column if not exists keywords text not null default '',
    add column if not exists release_strategy_notes text not null default '',
    add column if not exists release_strategy_updated_at timestamptz;

do $$
begin
    alter table public.brands
        drop constraint if exists brands_keywords_max_len_check;

    alter table public.brands
        add constraint brands_keywords_max_len_check
        check (char_length(keywords) <= 100);
end $$;

