-- Ensure each app/user pair has exactly one canonical "Original" screenshot set.
-- Older clients could race and create multiple rows named "Original".

with ranked_originals as (
    select
        id,
        user_id,
        app_id,
        row_number() over (
            partition by user_id, app_id
            order by order_index asc, created_at asc, id asc
        ) as rn,
        coalesce(
            max(order_index) over (partition by user_id, app_id),
            0
        ) as max_order_index
    from public.app_screenshot_sets
    where lower(trim(name)) = 'original'
),
renamed_duplicates as (
    update public.app_screenshot_sets target
    set
        name = concat('Original copy ', ranked_originals.rn - 1),
        order_index = ranked_originals.max_order_index + ranked_originals.rn - 1
    from ranked_originals
    where target.id = ranked_originals.id
      and ranked_originals.rn > 1
    returning target.id
)
select count(*) from renamed_duplicates;

create unique index if not exists app_screenshot_sets_one_original_per_app_user
    on public.app_screenshot_sets (user_id, app_id)
    where lower(trim(name)) = 'original';
