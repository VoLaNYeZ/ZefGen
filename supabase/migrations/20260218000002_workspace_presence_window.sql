-- Decouple presence indicator from strict lock TTL to reduce background-throttle undercount. (2026-02-18)

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
    v_presence_cutoff timestamptz := now() - interval '180 seconds';
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

    -- Presence count uses recent heartbeat recency for stability under browser timer throttling.
    select count(*)
    into v_active_session_count
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.last_seen_at > v_presence_cutoff;

    select coalesce(array_agg(coalesce(ws.country_code, 'unknown') order by ws.updated_at desc), '{}')
    into v_active_session_countries
    from public.workspace_sessions ws
    where ws.user_id = v_user_id
      and ws.last_seen_at > v_presence_cutoff;

    -- Lock boundary stays strict and tied to active lease expiry.
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

grant execute on function public.workspace_snapshot(text) to authenticated;
