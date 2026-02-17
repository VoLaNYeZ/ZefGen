-- Connector legal links history for generated Privacy/Terms/Support assets. (2026-02-16)

create table if not exists public.connector_legal_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    app_id uuid not null references public.apps(id) on delete cascade,
    fingerprint text not null,
    company_name text not null,
    appstore_name text not null,
    account_email text not null,
    privacy_doc_id text not null,
    privacy_url text not null,
    terms_doc_id text not null,
    terms_url text not null,
    support_form_id text not null,
    support_url text not null,
    support_schema jsonb not null default '{}'::jsonb,
    subtitle_variant text,
    regenerated_with_confirmation boolean not null default false,
    status text not null check (status in ('succeeded', 'failed')),
    error text,
    created_at timestamptz not null default now()
);

-- Indexes for app history scans and fingerprint checks. (2026-02-16)
create index if not exists connector_legal_links_user_app_created_idx
    on public.connector_legal_links (user_id, app_id, created_at desc);
create index if not exists connector_legal_links_app_fingerprint_created_idx
    on public.connector_legal_links (app_id, fingerprint, created_at desc);

-- Per-user access only; append-only from the client role. (2026-02-16)
alter table public.connector_legal_links enable row level security;

create policy "connector_legal_links_select_own" on public.connector_legal_links
    for select using (auth.uid() = user_id);
create policy "connector_legal_links_insert_own" on public.connector_legal_links
    for insert with check (auth.uid() = user_id);

grant select, insert on public.connector_legal_links to authenticated;
