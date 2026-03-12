-- Add No Brand support and app move RPC across brand-scoped tables. (2026-03-02)

alter table public.brands
    add column if not exists is_no_brand boolean not null default false;

create unique index if not exists brands_one_no_brand_per_user
    on public.brands (user_id)
    where is_no_brand;

alter table public.apps
    add column if not exists icon_prompt text not null default '';

create or replace function public.move_app_to_brand(
    p_app_id uuid,
    p_to_brand_id uuid,
    p_new_alias text default null
)
returns public.apps
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_app public.apps;
    v_target_brand public.brands;
    v_alias text;
    v_next_order_index integer;
begin
    if v_user_id is null then
        raise exception 'Unauthorized';
    end if;

    if p_app_id is null then
        raise exception 'App id is required';
    end if;

    if p_to_brand_id is null then
        raise exception 'Target brand id is required';
    end if;

    select *
    into v_app
    from public.apps
    where id = p_app_id
      and user_id = v_user_id
    for update;

    if not found then
        raise exception 'App not found';
    end if;

    select *
    into v_target_brand
    from public.brands
    where id = p_to_brand_id
      and user_id = v_user_id;

    if not found then
        raise exception 'Target brand not found';
    end if;

    if coalesce(v_target_brand.is_no_brand, false) then
        raise exception 'Target brand must be a regular brand';
    end if;

    v_alias := nullif(btrim(coalesce(p_new_alias, '')), '');
    if v_alias is null then
        v_alias := v_app.alias;
    end if;

    if exists (
        select 1
        from public.apps a
        where a.user_id = v_user_id
          and a.brand_id = p_to_brand_id
          and a.id <> v_app.id
          and a.alias = v_alias
    ) then
        raise exception 'Alias already exists in target brand';
    end if;

    select coalesce(max(a.order_index), -1) + 1
    into v_next_order_index
    from public.apps a
    where a.user_id = v_user_id
      and a.brand_id = p_to_brand_id
      and a.id <> v_app.id;

    update public.apps
    set
        brand_id = p_to_brand_id,
        alias = v_alias,
        order_index = v_next_order_index
    where id = v_app.id
      and user_id = v_user_id
    returning *
    into v_app;

    update public.app_screenshots
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_screenshot_sets
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_generated_assets
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_asset_picks
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_export_status
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    update public.app_screenshot_prompts
    set brand_id = p_to_brand_id
    where user_id = v_user_id
      and app_id = v_app.id;

    return v_app;
end;
$$;

revoke all on function public.move_app_to_brand(uuid, uuid, text) from public;
grant execute on function public.move_app_to_brand(uuid, uuid, text) to authenticated;
