-- App Store review webhook listener config + event history. (2026-03-07)

create table if not exists public.appstore_review_webhooks (
    app_id uuid primary key references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    public_token text not null default encode(gen_random_bytes(16), 'hex'),
    secret text not null default encode(gen_random_bytes(24), 'hex'),
    latest_event_type text,
    latest_review_state text,
    latest_previous_state text,
    latest_event_at timestamptz,
    last_delivery_at timestamptz,
    last_delivery_status text not null default 'idle'
        check (last_delivery_status in ('idle', 'received', 'ignored', 'invalid_signature', 'error')),
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists appstore_review_webhooks_public_token_key
    on public.appstore_review_webhooks (public_token);
create index if not exists appstore_review_webhooks_user_id_idx
    on public.appstore_review_webhooks (user_id);

create table if not exists public.appstore_review_events (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.apps(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null default '',
    payload_type text not null default '',
    state_from text,
    state_to text,
    event_at timestamptz not null default now(),
    delivery_status text not null default 'received'
        check (delivery_status in ('received', 'ignored', 'error')),
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists appstore_review_events_user_app_event_idx
    on public.appstore_review_events (user_id, app_id, event_at desc);
create index if not exists appstore_review_events_app_created_idx
    on public.appstore_review_events (app_id, created_at desc);

alter table public.appstore_review_webhooks enable row level security;
alter table public.appstore_review_events enable row level security;

create policy "appstore_review_webhooks_select_own" on public.appstore_review_webhooks
    for select using (auth.uid() = user_id);
create policy "appstore_review_webhooks_insert_own" on public.appstore_review_webhooks
    for insert with check (auth.uid() = user_id);
create policy "appstore_review_webhooks_update_own" on public.appstore_review_webhooks
    for update using (auth.uid() = user_id);
create policy "appstore_review_webhooks_delete_own" on public.appstore_review_webhooks
    for delete using (auth.uid() = user_id);

create policy "appstore_review_events_select_own" on public.appstore_review_events
    for select using (auth.uid() = user_id);

grant select, insert, update, delete on public.appstore_review_webhooks to authenticated;
grant select on public.appstore_review_events to authenticated;
