-- Club billing: a club must be paid (or comped) before admins can add members,
-- create albums or upload. Viewing is never gated, so members of a lapsed
-- club keep access to what already exists.

alter table public.clubs
  add column billing_status text not null default 'unpaid'
    check (billing_status in ('unpaid', 'active', 'past_due', 'canceled', 'comped')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column stripe_checkout_session_id text,
  add column paid_at timestamptz;

-- Clubs that existed before billing are grandfathered.
update public.clubs set billing_status = 'comped';

-- Webhook idempotency and audit. Server only.
create table public.stripe_events (
  id text primary key,
  type text not null,
  club_id uuid references public.clubs (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.stripe_events
  for each row execute function public.set_updated_at();
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

create or replace function private.club_can_write(club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.clubs c
    where c.id = club_can_write.club_id
      and c.billing_status in ('active', 'past_due', 'comped')
  );
$$;
grant execute on function private.club_can_write(uuid) to authenticated;

drop policy albums_insert on public.albums;
create policy albums_insert on public.albums
  for insert to authenticated
  with check (private.is_club_admin(club_id) and private.club_can_write(club_id));

drop policy media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated
  with check (private.is_club_admin(club_id) and private.club_can_write(club_id));

drop policy memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (private.is_club_admin(club_id) and private.club_can_write(club_id));

drop policy club_media_insert on storage.objects;
create policy club_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club_media'
    and private.is_club_admin(private.storage_club_id(name))
    and (
      name ~ '^clubs/[0-9a-f-]{36}/logo/'
      or private.club_can_write(private.storage_club_id(name))
    )
  );
