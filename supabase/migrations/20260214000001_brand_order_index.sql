-- Brand ordering via order_index. (2026-02-14)

alter table public.brands add column if not exists order_index integer;

with ranked as (
  select
    id,
    user_id,
    row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.brands
)
update public.brands b
set order_index = r.rn
from ranked r
where b.id = r.id
  and b.order_index is null;

alter table public.brands alter column order_index set default 0;
alter table public.brands alter column order_index set not null;

create index if not exists brands_user_order_idx on public.brands (user_id, order_index);

