-- Clean public subdomains for App Store review webhooks + public app surface lookup. (2026-03-08)

alter table public.appstore_review_webhooks
    add column if not exists public_subdomain text;

create unique index if not exists appstore_review_webhooks_public_subdomain_key
    on public.appstore_review_webhooks (public_subdomain)
    where public_subdomain is not null;

create or replace function public.appstore_review_webhook_claim_subdomain(
    p_app_id uuid,
    p_requested text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_webhook public.appstore_review_webhooks;
    v_alias text := '';
    v_name text := '';
    v_appstore_name text := '';
    v_base text := '';
    v_candidate text := '';
    v_suffix integer := 2;
    v_requested text := nullif(trim(coalesce(p_requested, '')), '');
    v_existing_host text := '';
    v_existing_root text := '.appshelp.cc';
begin
    if v_user_id is null then
        raise exception 'Authentication required.';
    end if;

    insert into public.appstore_review_webhooks (app_id, user_id)
    values (p_app_id, v_user_id)
    on conflict (app_id) do nothing;

    select *
    into v_webhook
    from public.appstore_review_webhooks
    where app_id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        raise exception 'Webhook row not found for app.';
    end if;

    if v_requested is null and nullif(trim(coalesce(v_webhook.public_subdomain, '')), '') is not null then
        return trim(v_webhook.public_subdomain);
    end if;

    select
        coalesce(a.alias, ''),
        coalesce(a.name, ''),
        coalesce(cfg.variables->>'appstore_name', '')
    into
        v_alias,
        v_name,
        v_appstore_name
    from public.apps a
    left join public.connector_app_configs cfg on cfg.app_id = a.id
    where a.id = p_app_id
      and a.user_id = v_user_id;

    if v_requested is null and nullif(trim(coalesce(v_webhook.public_webhook_url, '')), '') is not null then
        v_existing_host := lower(regexp_replace(split_part(split_part(v_webhook.public_webhook_url, '://', 2), '/', 1), ':\d+$', ''));
        if right(v_existing_host, length(v_existing_root)) = v_existing_root then
            v_requested := nullif(trim(left(v_existing_host, length(v_existing_host) - length(v_existing_root))), '');
        end if;
    end if;

    v_base := lower(coalesce(v_requested, nullif(trim(v_appstore_name), ''), nullif(trim(v_alias), ''), nullif(trim(v_name), ''), 'app'));
    v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
    v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
    v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
    if v_base = '' then
        v_base := 'app';
    end if;
    v_base := left(v_base, 63);
    v_base := regexp_replace(v_base, '-+$', '', 'g');
    if v_base = '' then
        v_base := 'app';
    end if;

    v_candidate := v_base;
    loop
        exit when not exists (
            select 1
            from public.appstore_review_webhooks other
            where other.public_subdomain = v_candidate
              and other.app_id <> p_app_id
        );
        v_candidate := left(v_base, greatest(1, 63 - length(v_suffix::text) - 1));
        v_candidate := regexp_replace(v_candidate, '-+$', '', 'g');
        if v_candidate = '' then
            v_candidate := 'app';
        end if;
        v_candidate := v_candidate || '-' || v_suffix::text;
        v_suffix := v_suffix + 1;
    end loop;

    update public.appstore_review_webhooks
    set
        public_subdomain = v_candidate,
        updated_at = now()
    where app_id = p_app_id
      and user_id = v_user_id;

    return v_candidate;
end;
$$;

revoke all on function public.appstore_review_webhook_claim_subdomain(uuid, text) from public;
grant execute on function public.appstore_review_webhook_claim_subdomain(uuid, text) to authenticated;

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
            a.name as app_name,
            coalesce(nullif(cfg.variables->>'appstore_name', ''), a.name) as title,
            nullif(cfg.variables->>'appstore_description', '') as description,
            nullif(a.appstore_url, '') as appstore_url,
            nullif(cfg.variables->>'privacy_policy_url', '') as privacy_policy_url,
            nullif(cfg.variables->>'terms_of_use_url', '') as terms_of_use_url,
            nullif(cfg.variables->>'support_form_url', '') as support_form_url,
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
        where w.public_subdomain = nullif(trim(p_subdomain), '')
        limit 1
    )
    select
        case
            when exists(select 1 from candidate) then (
                select jsonb_build_object(
                    'app_id', candidate.app_id,
                    'public_subdomain', candidate.public_subdomain,
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

revoke all on function public.appstore_review_webhook_public_surface(text) from public;
grant execute on function public.appstore_review_webhook_public_surface(text) to service_role;
