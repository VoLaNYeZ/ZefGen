-- Safe connector saves + current legal-links row. (2026-03-08)

alter table public.connector_legal_links
    add column if not exists updated_at timestamptz;

update public.connector_legal_links
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

alter table public.connector_legal_links
    alter column updated_at set default now();

alter table public.connector_legal_links
    alter column updated_at set not null;

delete from public.connector_legal_links
where status = 'failed';

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, app_id
            order by coalesce(updated_at, created_at) desc, created_at desc, id desc
        ) as rn
    from public.connector_legal_links
)
delete from public.connector_legal_links t
using ranked
where t.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists connector_legal_links_user_app_key
    on public.connector_legal_links (user_id, app_id);

create policy "connector_legal_links_update_own" on public.connector_legal_links
    for update using (auth.uid() = user_id);

create or replace function public.connector_sanitize_variables(p_variables jsonb)
returns jsonb
language sql
immutable
as $$
    select
        case
            when jsonb_typeof(coalesce(p_variables, '{}'::jsonb)) = 'object' then
                coalesce(p_variables, '{}'::jsonb)
                    - 'company_name'
                    - 'privacy_policy_url'
                    - 'terms_of_use_url'
                    - 'support_form_url'
            else '{}'::jsonb
        end;
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
    v_sanitized_variables jsonb := public.connector_sanitize_variables(p_variables);
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

revoke all on function public.connector_save_app_config(
    uuid, timestamptz, text, uuid, text, jsonb, boolean
) from public;

grant execute on function public.connector_save_app_config(
    uuid, timestamptz, text, uuid, text, jsonb, boolean
) to authenticated;

create or replace function public.connector_get_current_legal_links(
    p_app_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_row public.connector_legal_links;
    v_variables jsonb;
    v_appstore_name text;
    v_company_name text;
    v_account_email text;
    v_privacy_url text;
    v_terms_url text;
    v_support_url text;
    v_fingerprint text;
    v_privacy_doc_id text := '';
    v_terms_doc_id text := '';
    v_support_form_id text := '';
    v_now timestamptz := now();
begin
    if v_user_id is null or p_app_id is null then
        return null;
    end if;

    select *
    into v_row
    from public.connector_legal_links
    where user_id = v_user_id
      and app_id = p_app_id
      and status = 'succeeded'
    limit 1;

    if found then
        return jsonb_build_object(
            'id', v_row.id,
            'fingerprint', v_row.fingerprint,
            'privacy_policy_url', v_row.privacy_url,
            'terms_of_use_url', v_row.terms_url,
            'support_form_url', v_row.support_url,
            'updated_at', v_row.updated_at,
            'created_at', v_row.created_at
        );
    end if;

    select
        cfg.variables,
        nullif(trim(cfg.variables->>'appstore_name'), ''),
        nullif(trim(acc.company_name), ''),
        nullif(trim(acc.email), ''),
        nullif(trim(cfg.variables->>'privacy_policy_url'), ''),
        nullif(trim(cfg.variables->>'terms_of_use_url'), ''),
        nullif(trim(cfg.variables->>'support_form_url'), '')
    into
        v_variables,
        v_appstore_name,
        v_company_name,
        v_account_email,
        v_privacy_url,
        v_terms_url,
        v_support_url
    from public.connector_app_configs cfg
    left join public.appstore_accounts acc
      on acc.app_id = cfg.app_id
     and acc.user_id = cfg.user_id
    where cfg.app_id = p_app_id
      and cfg.user_id = v_user_id
    limit 1;

    if v_appstore_name is null
       or v_company_name is null
       or v_account_email is null
       or v_privacy_url is null
       or v_terms_url is null
       or v_support_url is null then
        return null;
    end if;

    if regexp_replace(v_privacy_url, '/+$', '') = 'https://google.com'
       or regexp_replace(v_terms_url, '/+$', '') = 'https://google.com'
       or regexp_replace(v_support_url, '/+$', '') = 'https://google.com' then
        return null;
    end if;

    v_fingerprint := encode(
        digest(
            concat_ws(
                '|',
                regexp_replace(lower(trim(v_company_name)), '\s+', ' ', 'g'),
                regexp_replace(lower(trim(v_appstore_name)), '\s+', ' ', 'g'),
                regexp_replace(lower(trim(v_account_email)), '\s+', ' ', 'g')
            ),
            'sha256'
        ),
        'hex'
    );

    v_privacy_doc_id := coalesce(substring(v_privacy_url from '/d/([^/?#]+)'), '');
    v_terms_doc_id := coalesce(substring(v_terms_url from '/d/([^/?#]+)'), '');
    v_support_form_id := coalesce(
        substring(v_support_url from '/forms/d/e/([^/?#]+)'),
        substring(v_support_url from '/forms/d/([^/?#]+)'),
        ''
    );

    insert into public.connector_legal_links (
        user_id,
        app_id,
        fingerprint,
        company_name,
        appstore_name,
        account_email,
        privacy_doc_id,
        privacy_url,
        terms_doc_id,
        terms_url,
        support_form_id,
        support_url,
        support_schema,
        subtitle_variant,
        regenerated_with_confirmation,
        status,
        error,
        updated_at,
        created_at
    )
    values (
        v_user_id,
        p_app_id,
        v_fingerprint,
        v_company_name,
        v_appstore_name,
        v_account_email,
        v_privacy_doc_id,
        v_privacy_url,
        v_terms_doc_id,
        v_terms_url,
        v_support_form_id,
        v_support_url,
        '{}'::jsonb,
        null,
        false,
        'succeeded',
        null,
        v_now,
        v_now
    )
    on conflict (user_id, app_id)
    do update set
        fingerprint = excluded.fingerprint,
        company_name = excluded.company_name,
        appstore_name = excluded.appstore_name,
        account_email = excluded.account_email,
        privacy_doc_id = excluded.privacy_doc_id,
        privacy_url = excluded.privacy_url,
        terms_doc_id = excluded.terms_doc_id,
        terms_url = excluded.terms_url,
        support_form_id = excluded.support_form_id,
        support_url = excluded.support_url,
        support_schema = excluded.support_schema,
        subtitle_variant = excluded.subtitle_variant,
        regenerated_with_confirmation = excluded.regenerated_with_confirmation,
        status = 'succeeded',
        error = null,
        updated_at = excluded.updated_at
    returning * into v_row;

    update public.connector_app_configs
    set variables = public.connector_sanitize_variables(variables)
    where user_id = v_user_id
      and app_id = p_app_id
      and variables is distinct from public.connector_sanitize_variables(variables);

    return jsonb_build_object(
        'id', v_row.id,
        'fingerprint', v_row.fingerprint,
        'privacy_policy_url', v_row.privacy_url,
        'terms_of_use_url', v_row.terms_url,
        'support_form_url', v_row.support_url,
        'updated_at', v_row.updated_at,
        'created_at', v_row.created_at
    );
end;
$$;

revoke all on function public.connector_get_current_legal_links(uuid) from public;
grant execute on function public.connector_get_current_legal_links(uuid) to authenticated;

create or replace function public.connector_commit_legal_links_success(
    p_user_id uuid,
    p_app_id uuid,
    p_fingerprint text,
    p_company_name text,
    p_appstore_name text,
    p_account_email text,
    p_privacy_doc_id text,
    p_privacy_url text,
    p_terms_doc_id text,
    p_terms_url text,
    p_support_form_id text,
    p_support_url text,
    p_support_schema jsonb default '{}'::jsonb,
    p_subtitle_variant text default null,
    p_regenerated_with_confirmation boolean default false,
    p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_run_id uuid;
begin
    insert into public.connector_legal_links (
        user_id,
        app_id,
        fingerprint,
        company_name,
        appstore_name,
        account_email,
        privacy_doc_id,
        privacy_url,
        terms_doc_id,
        terms_url,
        support_form_id,
        support_url,
        support_schema,
        subtitle_variant,
        regenerated_with_confirmation,
        status,
        error,
        updated_at,
        created_at
    )
    values (
        p_user_id,
        p_app_id,
        p_fingerprint,
        p_company_name,
        p_appstore_name,
        p_account_email,
        p_privacy_doc_id,
        p_privacy_url,
        p_terms_doc_id,
        p_terms_url,
        p_support_form_id,
        p_support_url,
        coalesce(p_support_schema, '{}'::jsonb),
        p_subtitle_variant,
        coalesce(p_regenerated_with_confirmation, false),
        'succeeded',
        null,
        p_now,
        p_now
    )
    on conflict (user_id, app_id)
    do update set
        fingerprint = excluded.fingerprint,
        company_name = excluded.company_name,
        appstore_name = excluded.appstore_name,
        account_email = excluded.account_email,
        privacy_doc_id = excluded.privacy_doc_id,
        privacy_url = excluded.privacy_url,
        terms_doc_id = excluded.terms_doc_id,
        terms_url = excluded.terms_url,
        support_form_id = excluded.support_form_id,
        support_url = excluded.support_url,
        support_schema = excluded.support_schema,
        subtitle_variant = excluded.subtitle_variant,
        regenerated_with_confirmation = excluded.regenerated_with_confirmation,
        status = 'succeeded',
        error = null,
        updated_at = excluded.updated_at
    returning id into v_run_id;

    return v_run_id;
end;
$$;

create or replace function public.appstore_review_webhook_public_surface(
    p_subdomain text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
    with candidate as (
        select
            w.app_id,
            w.public_subdomain,
            w.public_page_published_at,
            a.name as app_name,
            coalesce(nullif(cfg.variables->>'appstore_name', ''), a.name) as title,
            nullif(cfg.variables->>'appstore_description', '') as description,
            nullif(a.appstore_url, '') as appstore_url,
            coalesce(nullif(links.privacy_url, ''), nullif(cfg.variables->>'privacy_policy_url', '')) as privacy_policy_url,
            coalesce(nullif(links.terms_url, ''), nullif(cfg.variables->>'terms_of_use_url', '')) as terms_of_use_url,
            coalesce(nullif(links.support_url, ''), nullif(cfg.variables->>'support_form_url', '')) as support_form_url,
            (
                select aga.image_path
                from public.app_asset_picks pick
                join public.app_generated_assets aga on aga.id = pick.generated_asset_id
                where pick.app_id = w.app_id
                  and pick.kind = 'icon'
                order by pick.created_at desc
                limit 1
            ) as icon_image_path
        from public.appstore_review_webhooks w
        join public.apps a on a.id = w.app_id
        left join public.connector_app_configs cfg on cfg.app_id = w.app_id
        left join public.connector_legal_links links on links.app_id = w.app_id and links.status = 'succeeded'
        where w.public_subdomain = nullif(trim(p_subdomain), '')
        limit 1
    )
    select
        case
            when exists(select 1 from candidate) then (
                select jsonb_build_object(
                    'app_id', candidate.app_id,
                    'public_subdomain', candidate.public_subdomain,
                    'public_page_published_at', candidate.public_page_published_at,
                    'app_name', candidate.app_name,
                    'title', candidate.title,
                    'description', candidate.description,
                    'appstore_url', candidate.appstore_url,
                    'privacy_policy_url', candidate.privacy_policy_url,
                    'terms_of_use_url', candidate.terms_of_use_url,
                    'support_form_url', candidate.support_form_url,
                    'icon_image_path', candidate.icon_image_path
                )
                from candidate
            )
            else null
        end;
$$;
