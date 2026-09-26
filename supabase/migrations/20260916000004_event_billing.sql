-- Event billing: a event must be paid (or comped) before admins can add members,
-- create albums or upload. Viewing is never gated, so members of a lapsed
-- event keep access to what already exists.

alter table public.events
  add column billing_status text not null default 'unpaid'
    check (billing_status in ('unpaid', 'active', 'past_due', 'canceled', 'comped')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column stripe_checkout_session_id text,
  add column paid_at timestamptz;

-- Events that existed before billing are grandfathered.
update public.events set billing_status = 'comped';

-- Webhook idempotency and audit. Server only.
create table public.stripe_events (
  id text primary key,
  type text not null,
  event_id uuid references public.events (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.stripe_events
  for each row execute function public.set_updated_at();
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

create or replace function private.event_can_write(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.events c
    where c.id = event_can_write.event_id
      and c.billing_status in ('active', 'past_due', 'comped')
  );
$$;
grant execute on function private.event_can_write(uuid) to authenticated;

drop policy albums_insert on public.albums;
create policy albums_insert on public.albums
  for insert to authenticated
  with check (private.is_event_admin(event_id) and private.event_can_write(event_id));

drop policy media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated
  with check (private.is_event_admin(event_id) and private.event_can_write(event_id));

drop policy memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (private.is_event_admin(event_id) and private.event_can_write(event_id));

drop policy event_media_insert on storage.objects;
create policy event_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event_media'
    and private.is_event_admin(private.storage_event_id(name))
    and (
      name ~ '^events/[0-9a-f-]{36}/logo/'
      or private.event_can_write(private.storage_event_id(name))
    )
  );
