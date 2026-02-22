-- App ideas pool + fixed Apple non-game category dictionary + connector idea selection persistence. (2026-02-22)

create table if not exists public.app_idea_categories (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null unique,
    order_index integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.app_idea_categories enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'app_idea_categories'
          and policyname = 'app_idea_categories_select_authenticated'
    ) then
        create policy "app_idea_categories_select_authenticated" on public.app_idea_categories
            for select using (true);
    end if;
end;
$$;

grant select on public.app_idea_categories to authenticated;

insert into public.app_idea_categories (slug, name, order_index)
values
    ('books', 'Books', 1),
    ('business', 'Business', 2),
    ('developer-tools', 'Developer Tools', 3),
    ('education', 'Education', 4),
    ('entertainment', 'Entertainment', 5),
    ('finance', 'Finance', 6),
    ('food-drink', 'Food & Drink', 7),
    ('graphics-design', 'Graphics & Design', 8),
    ('health-fitness', 'Health & Fitness', 9),
    ('lifestyle', 'Lifestyle', 10),
    ('kids', 'Kids', 11),
    ('magazines-newspapers', 'Magazines & Newspapers', 12),
    ('medical', 'Medical', 13),
    ('music', 'Music', 14),
    ('navigation', 'Navigation', 15),
    ('news', 'News', 16),
    ('photo-video', 'Photo & Video', 17),
    ('productivity', 'Productivity', 18),
    ('reference', 'Reference', 19),
    ('safari-extensions', 'Safari Extensions', 20),
    ('shopping', 'Shopping', 21),
    ('social-networking', 'Social Networking', 22),
    ('sports', 'Sports', 23),
    ('travel', 'Travel', 24),
    ('utilities', 'Utilities', 25),
    ('weather', 'Weather', 26),
    ('stickers', 'Stickers', 27)
on conflict (slug) do nothing;

create table if not exists public.app_ideas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid not null references public.app_idea_categories(id) on delete restrict,
    description text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists app_ideas_user_id_idx on public.app_ideas (user_id);
create index if not exists app_ideas_user_category_idx on public.app_ideas (user_id, category_id);
create index if not exists app_ideas_user_created_idx on public.app_ideas (user_id, created_at);

alter table public.app_ideas enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'app_ideas'
          and policyname = 'app_ideas_select_own'
    ) then
        create policy "app_ideas_select_own" on public.app_ideas
            for select using (auth.uid() = user_id);
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'app_ideas'
          and policyname = 'app_ideas_insert_own'
    ) then
        create policy "app_ideas_insert_own" on public.app_ideas
            for insert with check (auth.uid() = user_id);
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'app_ideas'
          and policyname = 'app_ideas_update_own'
    ) then
        create policy "app_ideas_update_own" on public.app_ideas
            for update using (auth.uid() = user_id);
    end if;
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'app_ideas'
          and policyname = 'app_ideas_delete_own'
    ) then
        create policy "app_ideas_delete_own" on public.app_ideas
            for delete using (auth.uid() = user_id);
    end if;
end;
$$;

grant select, insert, update, delete on public.app_ideas to authenticated;

alter table public.connector_app_configs
    add column if not exists idea_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'connector_app_configs_idea_id_fkey'
          and conrelid = 'public.connector_app_configs'::regclass
    ) then
        alter table public.connector_app_configs
            add constraint connector_app_configs_idea_id_fkey
                foreign key (idea_id) references public.app_ideas(id) on delete set null;
    end if;
end;
$$;

create index if not exists connector_app_configs_idea_id_idx on public.connector_app_configs (idea_id);
