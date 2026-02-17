-- Atomic commit helper for legal links success writes. (2026-02-17)
-- Keeps connector_app_configs.variables and connector_legal_links success row in one transaction.

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
    update public.connector_app_configs
    set
        variables = coalesce(variables, '{}'::jsonb) || jsonb_build_object(
            'privacy_policy_url', p_privacy_url,
            'terms_of_use_url', p_terms_url,
            'support_form_url', p_support_url
        ),
        updated_at = p_now
    where user_id = p_user_id
      and app_id = p_app_id;

    if not found then
        raise exception 'connector_app_configs row not found for user/app';
    end if;

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
        p_now
    )
    returning id into v_run_id;

    return v_run_id;
end;
$$;

revoke all on function public.connector_commit_legal_links_success(
    uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, timestamptz
) from public;

grant execute on function public.connector_commit_legal_links_success(
    uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, timestamptz
) to service_role;
