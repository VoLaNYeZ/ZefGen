-- Merge duplicate No Brand rows per user and normalize the surviving bucket. (2026-03-15)

create temporary table tmp_no_brand_candidates on commit drop as
select
    b.id,
    b.user_id,
    b.order_index,
    b.created_at,
    row_number() over (
        partition by b.user_id
        order by
            case
                when coalesce(b.is_no_brand, false) then 0
                when lower(trim(coalesce(b.slug, ''))) = 'no-brand' then 1
                when lower(trim(coalesce(b.slug, ''))) ~ '^no-brand(-[0-9]+)?$' then 2
                when lower(trim(coalesce(b.name, ''))) = 'no brand' then 3
                when lower(trim(coalesce(b.name, ''))) ~ '^no brand( [0-9]+)?$' then 4
                else 5
            end,
            coalesce(b.order_index, 2147483647),
            b.created_at asc,
            b.id asc
    ) as rank_in_user
from public.brands b
where coalesce(b.is_no_brand, false)
   or lower(trim(coalesce(b.slug, ''))) ~ '^no-brand(-[0-9]+)?$'
   or lower(trim(coalesce(b.name, ''))) ~ '^no brand( [0-9]+)?$';

create temporary table tmp_no_brand_canonical on commit drop as
select
    c.user_id,
    c.id as canonical_brand_id
from tmp_no_brand_candidates c
where c.rank_in_user = 1;

create temporary table tmp_no_brand_merge_map on commit drop as
select
    canonical.user_id,
    canonical.canonical_brand_id,
    duplicate.id as duplicate_brand_id
from tmp_no_brand_canonical canonical
join tmp_no_brand_candidates duplicate
  on duplicate.user_id = canonical.user_id
 and duplicate.id <> canonical.canonical_brand_id;

update public.apps target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_ideas target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.brand_references target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_screenshot_prompts target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_screenshots target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_screenshot_sets target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_generated_assets target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_asset_picks target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.app_export_status target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.connector_jobs target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.idea_generation_runs target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.idea_generation_outputs target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

update public.workspace_sessions target
set brand_id = map.canonical_brand_id
from tmp_no_brand_merge_map map
where target.user_id = map.user_id
  and target.brand_id = map.duplicate_brand_id;

delete from public.brands target
using tmp_no_brand_merge_map map
where target.id = map.duplicate_brand_id;

update public.brands target
set
    name = 'No Brand',
    slug = 'no-brand',
    is_no_brand = true,
    order_index = coalesce(regular.max_regular_order_index, -1) + 1
from tmp_no_brand_canonical canonical
left join lateral (
    select max(b.order_index) as max_regular_order_index
    from public.brands b
    where b.user_id = canonical.user_id
      and b.id <> canonical.canonical_brand_id
      and not coalesce(b.is_no_brand, false)
      and lower(trim(coalesce(b.slug, ''))) !~ '^no-brand(-[0-9]+)?$'
      and lower(trim(coalesce(b.name, ''))) !~ '^no brand( [0-9]+)?$'
) regular on true
where target.id = canonical.canonical_brand_id;
