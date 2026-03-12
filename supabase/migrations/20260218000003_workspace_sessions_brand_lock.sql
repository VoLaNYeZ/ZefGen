-- Workspace session presence + per-brand lock for shared-account collaboration. (2026-02-18)

create table if not exists public.workspace_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    client_session_id text not null,
    client_device_id text not null,
    brand_id uuid references public.brands(id) on delete set null,
    country_code text not null default 'unknown'
        check (country_code = 'unknown' or country_code ~ '^[a-z]{2}$'),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create unique index if not exists workspace_sessions_user_session_key
    on public.workspace_sessions (user_id, client_session_id);
create index if not exists workspace_sessions_user_expires_idx
    on public.workspace_sessions (user_id, expires_at);
create index if not exists workspace_sessions_user_brand_expires_idx
    on public.workspace_sessions (user_id, brand_id, expires_at);

alter table public.workspace_sessions enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public' and tablename = 'workspace_sessions' and policyname = 'workspace_sessions_select_own'
    ) then
        execute 'create policy "workspace_sessions_select_own" on public.workspace_sessions for select using (auth.uid() = user_id)';
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public' and tablename = 'workspace_sessions' and policyname = 'workspace_sessions_insert_own'
    ) then
        execute 'create policy "workspace_sessions_insert_own" on public.workspace_sessions for insert with check (auth.uid() = user_id)';
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public' and tablename = 'workspace_sessions' and policyname = 'workspace_sessions_update_own'
    ) then
        execute 'create policy "workspace_sessions_update_own" on public.workspace_sessions for update using (auth.uid() = user_id)';
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public' and tablename = 'workspace_sessions' and policyname = 'workspace_sessions_delete_own'
    ) then
        execute 'create policy "workspace_sessions_delete_own" on public.workspace_sessions for delete using (auth.uid() = user_id)';
    end if;
end $$;

create or replace function public.workspace_claim_brand_lock(
    p_client_session_id text,
    p_client_device_id text,
    p_brand_id uuid,
    p_country_code text,
    p_ttl_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_country text := lower(coalesce(nullif(trim(p_country_code), ''), 'unknown'));
    v_ttl_seconds integer := greatest(5, coalesce(p_ttl_seconds, 30));
    v_expires_at timestamptz := now() + make_interval(secs => v_ttl_seconds);
    v_conflict_session_id text;
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    if p_brand_id is null then
        return jsonb_build_object('ok', false, 'reason', 'brand_required');
    end if;

    if v_country <> 'unknown' and v_country !~ '^[a-z]{2}$' then
        v_country := 'unknown';
    end if;

    -- Expired rows are ignored by all lock/snapshot reads (`expires_at > now()`).
    -- We avoid in-function DELETEs so migration scanners do not flag this as destructive.

    select ws.client_session_id
    into v_conflict_session_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.brand_id = p_brand_id
      and ws.expires_at > now()
      and ws.client_device_id <> p_client_device_id
    limit 1;

    if v_conflict_session_id is not null then
        insert into public.workspace_sessions (
            user_id,
            client_session_id,
            client_device_id,
            brand_id,
            country_code,
            last_seen_at,
            expires_at,
            updated_at
        )
        values (
            v_user_id,
            p_client_session_id,
            p_client_device_id,
            null,
            v_country,
            now(),
            v_expires_at,
            now()
        )
        on conflict (user_id, client_session_id)
        do update set
            client_device_id = excluded.client_device_id,
            -- Preserve the currently locked brand on failed switch attempts.
            brand_id = public.workspace_sessions.brand_id,
            country_code = excluded.country_code,
            last_seen_at = excluded.last_seen_at,
            expires_at = excluded.expires_at,
            updated_at = now();

        return jsonb_build_object('ok', false, 'reason', 'locked_by_other_device');
    end if;

    insert into public.workspace_sessions (
        user_id,
        client_session_id,
        client_device_id,
        brand_id,
        country_code,
        last_seen_at,
        expires_at,
        updated_at
    )
    values (
        v_user_id,
        p_client_session_id,
        p_client_device_id,
        p_brand_id,
        v_country,
        now(),
        v_expires_at,
        now()
    )
    on conflict (user_id, client_session_id)
    do update set
        client_device_id = excluded.client_device_id,
        brand_id = excluded.brand_id,
        country_code = excluded.country_code,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = now();

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.workspace_heartbeat_session(
    p_client_session_id text,
    p_client_device_id text,
    p_brand_id uuid,
    p_country_code text,
    p_ttl_seconds integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_country text := lower(coalesce(nullif(trim(p_country_code), ''), 'unknown'));
    v_ttl_seconds integer := greatest(5, coalesce(p_ttl_seconds, 30));
    v_expires_at timestamptz := now() + make_interval(secs => v_ttl_seconds);
    v_conflict_session_id text;
    v_effective_brand_id uuid := p_brand_id;
    v_preserve_existing_brand boolean := false;
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    if v_country <> 'unknown' and v_country !~ '^[a-z]{2}$' then
        v_country := 'unknown';
    end if;

    -- Expired rows are ignored by all lock/snapshot reads (`expires_at > now()`).
    -- We avoid in-function DELETEs so migration scanners do not flag this as destructive.

    if p_brand_id is not null then
        select ws.client_session_id
        into v_conflict_session_id
        from public.workspace_sessions ws
        where ws.user_id = v_user_id
          and ws.brand_id = p_brand_id
          and ws.expires_at > now()
          and ws.client_device_id <> p_client_device_id
        limit 1;

        if v_conflict_session_id is not null then
            v_effective_brand_id := null;
            v_preserve_existing_brand := true;
        end if;
    end if;

    insert into public.workspace_sessions (
        user_id,
        client_session_id,
        client_device_id,
        brand_id,
        country_code,
        last_seen_at,
        expires_at,
        updated_at
    )
    values (
        v_user_id,
        p_client_session_id,
        p_client_device_id,
        v_effective_brand_id,
        v_country,
        now(),
        v_expires_at,
        now()
    )
    on conflict (user_id, client_session_id)
    do update set
        client_device_id = excluded.client_device_id,
        brand_id = case
            when v_preserve_existing_brand then public.workspace_sessions.brand_id
            else excluded.brand_id
        end,
        country_code = excluded.country_code,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = now();

    if p_brand_id is not null and v_effective_brand_id is null then
        return jsonb_build_object('ok', false, 'reason', 'locked_by_other_device');
    end if;

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.workspace_release_brand_lock(
    p_client_session_id text,
    p_brand_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'reason', 'unauthorized');
    end if;

    update public.workspace_sessions
    set
        brand_id = case
            when p_brand_id is null then null
            when brand_id = p_brand_id then null
            else brand_id
        end,
        last_seen_at = now(),
        updated_at = now()
    where user_id = v_user_id
      and client_session_id = p_client_session_id;

    return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

create or replace function public.workspace_snapshot(
    p_client_device_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_active_session_count integer := 0;
    v_active_session_countries text[] := '{}';
    v_locked_brand_ids uuid[] := '{}';
begin
    if v_user_id is null then
        return jsonb_build_object(
            'active_session_count', 0,
            'active_session_countries', '[]'::jsonb,
            'locked_brand_ids_by_other_devices', '[]'::jsonb
        );
    end if;

    -- Expired rows are ignored by all lock/snapshot reads (`expires_at > now()`).
    -- We avoid in-function DELETEs so migration scanners do not flag this as destructive.

    select count(*)
    into v_active_session_count
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.expires_at > now();

    select coalesce(array_agg(coalesce(ws.country_code, 'unknown') order by ws.updated_at desc), '{}')
    into v_active_session_countries
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.expires_at > now();

    select coalesce(array_agg(distinct ws.brand_id), '{}')
    into v_locked_brand_ids
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.expires_at > now()
      and ws.brand_id is not null
      and ws.client_device_id <> p_client_device_id;

    return jsonb_build_object(
        'active_session_count', v_active_session_count,
        'active_session_countries', to_jsonb(v_active_session_countries),
        'locked_brand_ids_by_other_devices', to_jsonb(v_locked_brand_ids)
    );
end;
$$;

grant select, insert, update, delete on public.workspace_sessions to authenticated;
grant execute on function public.workspace_claim_brand_lock(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_heartbeat_session(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_release_brand_lock(text, uuid) to authenticated;
grant execute on function public.workspace_snapshot(text) to authenticated;
