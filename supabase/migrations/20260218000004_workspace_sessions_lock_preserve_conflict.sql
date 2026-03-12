-- Preserve existing lock when a cross-device conflict blocks brand switching. (2026-02-18)

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
    v_existing_session_device_id text;
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

    select ws.client_device_id
    into v_existing_session_device_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.client_session_id = p_client_session_id
      and ws.expires_at > now()
    limit 1;

    if v_existing_session_device_id is not null and v_existing_session_device_id <> p_client_device_id then
        return jsonb_build_object('ok', false, 'reason', 'session_id_collision');
    end if;

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
    v_existing_session_device_id text;
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

    select ws.client_device_id
    into v_existing_session_device_id
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.client_session_id = p_client_session_id
      and ws.expires_at > now()
    limit 1;

    if v_existing_session_device_id is not null and v_existing_session_device_id <> p_client_device_id then
        return jsonb_build_object('ok', false, 'reason', 'session_id_collision');
    end if;

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

grant execute on function public.workspace_claim_brand_lock(text, text, uuid, text, integer) to authenticated;
grant execute on function public.workspace_heartbeat_session(text, text, uuid, text, integer) to authenticated;
