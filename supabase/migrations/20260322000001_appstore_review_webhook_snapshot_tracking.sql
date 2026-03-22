-- Track Apple status snapshot checks separately from webhook deliveries. (2026-03-22)

alter table public.appstore_review_webhooks
    add column if not exists last_snapshot_at timestamptz;

do $$
declare
    v_constraint_name text;
begin
    select conname
    into v_constraint_name
    from pg_constraint
    where conrelid = 'public.appstore_review_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%delivery_status%';

    if v_constraint_name is not null then
        execute format('alter table public.appstore_review_events drop constraint %I', v_constraint_name);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'appstore_review_events_delivery_status_check'
    ) then
        alter table public.appstore_review_events
            add constraint appstore_review_events_delivery_status_check
            check (delivery_status in ('received', 'ignored', 'error', 'snapshot'));
    end if;
end $$;
