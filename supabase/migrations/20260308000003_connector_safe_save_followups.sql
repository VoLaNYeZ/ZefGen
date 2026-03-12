-- Follow-up safeguards for connector safe saves. (2026-03-08)

create or replace function public.connector_sanitize_variables(
    p_variables jsonb,
    p_strip_legacy_legal_links boolean
)
returns jsonb
language sql
immutable
as $$
    select
        case
            when jsonb_typeof(coalesce(p_variables, '{}'::jsonb)) = 'object' then
                case
                    when coalesce(p_strip_legacy_legal_links, true) then
                        coalesce(p_variables, '{}'::jsonb)
                            - 'company_name'
                            - 'privacy_policy_url'
                            - 'terms_of_use_url'
                            - 'support_form_url'
                    else
                        coalesce(p_variables, '{}'::jsonb)
                            - 'company_name'
                end
            else '{}'::jsonb
        end;
$$;

create or replace function public.connector_sanitize_variables(p_variables jsonb)
returns jsonb
language sql
immutable
as $$
    select public.connector_sanitize_variables(p_variables, true);
$$;

create or replace function public.connector_save_app_config(
    p_app_id uuid,
    p_expected_updated_at timestamptz default null,
    p_project_brief text default '',
    p_idea_id uuid default null,
    p_base_branch text default 'main',
    p_variables jsonb default '{}'::jsonb,
    p_force_overwrite boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_now timestamptz := now();
    v_existing public.connector_app_configs;
    v_saved public.connector_app_configs;
    v_sanitized_variables jsonb;
    v_has_current_legal_links boolean := false;
    v_base_branch text := coalesce(nullif(trim(p_base_branch), ''), 'main');
begin
    if v_user_id is null then
        raise exception 'unauthorized';
    end if;

    perform 1
    from public.apps
    where id = p_app_id
      and user_id = v_user_id;

    if not found then
        raise exception 'app not found';
    end if;

    select exists(
        select 1
        from public.connector_legal_links
        where user_id = v_user_id
          and app_id = p_app_id
          and status = 'succeeded'
    )
    into v_has_current_legal_links;

    v_sanitized_variables := public.connector_sanitize_variables(
        p_variables,
        v_has_current_legal_links
    );

    select *
    into v_existing
    from public.connector_app_configs
    where app_id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        insert into public.connector_app_configs (
            app_id,
            user_id,
            project_kind,
            project_brief,
            idea_id,
            base_branch,
            variables,
            verify_command,
            updated_at
        )
        values (
            p_app_id,
            v_user_id,
            'ios',
            coalesce(p_project_brief, ''),
            p_idea_id,
            v_base_branch,
            v_sanitized_variables,
            null,
            v_now
        )
        returning * into v_saved;

        return jsonb_build_object(
            'status', 'saved',
            'row', to_jsonb(v_saved)
        );
    end if;

    if not coalesce(p_force_overwrite, false)
       and p_expected_updated_at is distinct from v_existing.updated_at then
        return jsonb_build_object(
            'status', 'conflict',
            'row', to_jsonb(v_existing)
        );
    end if;

    update public.connector_app_configs
    set
        project_brief = coalesce(p_project_brief, ''),
        idea_id = p_idea_id,
        base_branch = v_base_branch,
        variables = v_sanitized_variables,
        updated_at = v_now
    where app_id = p_app_id
      and user_id = v_user_id
    returning * into v_saved;

    return jsonb_build_object(
        'status', 'saved',
        'row', to_jsonb(v_saved)
    );
end;
$$;
