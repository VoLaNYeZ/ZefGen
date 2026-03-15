-- Add deterministic output ordering for idempotent idea-generation persistence. (2026-03-15)

alter table public.idea_generation_outputs
    add column if not exists output_index integer;

with numbered as (
    select
        id,
        row_number() over (
            partition by run_id
            order by created_at asc, id asc
        ) as next_output_index
    from public.idea_generation_outputs
)
update public.idea_generation_outputs target
set output_index = numbered.next_output_index
from numbered
where target.id = numbered.id
  and target.output_index is null;

alter table public.idea_generation_outputs
    alter column output_index set not null;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conrelid = 'public.idea_generation_outputs'::regclass
          and conname = 'idea_generation_outputs_output_index_positive_check'
    ) then
        alter table public.idea_generation_outputs
            drop constraint idea_generation_outputs_output_index_positive_check;
    end if;
end $$;

alter table public.idea_generation_outputs
    add constraint idea_generation_outputs_output_index_positive_check
    check (output_index >= 1);

create unique index if not exists idea_generation_outputs_run_output_index_key
    on public.idea_generation_outputs (run_id, output_index);
