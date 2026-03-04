alter table public.app_ideas
    add column if not exists title text not null default '';
