-- Tier checkout, upgrades and the limit emails (docs/handoff-pricing-tiers.md,
-- phase 2).
--
-- A club code switches an event to club prices until its first payment, which
-- fixes its rate for good. Every tier purchase and upgrade is recorded, which
-- is also what the usage view reads for "price paid". Each limit email is
-- sent once per event per plan: the columns below say when, and a plan change
-- clears them so the new tier gets its own.

alter table public.events
  -- UQCLUBS, QUTCLUBS, GRIFFITHCLUBS: checked by the app (lib/billing/club-codes.ts).
  add column club_code text check (club_code ~ '^[A-Z0-9]{3,32}$'),
  add column guests_nearly_full_notified_at timestamptz,
  add column overflow_open_notified_at timestamptz,
  add column overflow_reminder_notified_at timestamptz,
  add column overflow_closed_notified_at timestamptz,
  add column photos_nearly_full_notified_at timestamptz,
  add column photos_full_notified_at timestamptz;

alter table public.memberships
  -- A paused guest was let in (an upgrade, or room made); cleared once emailed.
  add column let_in_at timestamptz;

create index memberships_let_in_idx on public.memberships (event_id) where let_in_at is not null;

create table public.event_purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('tier', 'upgrade', 'keep_year')),
  from_plan text,
  to_plan text,
  rate text check (rate in ('club', 'standard')),
  late boolean not null default false,
  -- What was actually charged, in cents, after any promotion code.
  amount_cents int not null default 0,
  list_amount_cents int not null default 0,
  currency text not null default 'aud',
  club_code text,
  promotion_code text,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);
create index event_purchases_event_idx on public.event_purchases (event_id, created_at);

alter table public.event_purchases enable row level security;
revoke all on public.event_purchases from anon;
-- Organisers read their own event's receipts list; only the server writes.
grant select on public.event_purchases to authenticated;
create policy event_purchases_select on public.event_purchases
  for select to authenticated using (private.is_event_admin(event_id));

-- ---------------------------------------------------------------------------
-- Migration 27's rebalance, now remembering who was let back in
-- ---------------------------------------------------------------------------

create or replace function private.rebalance_event_guests(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_included int;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then
    return;
  end if;

  if v_event.guest_limit is null
     or v_event.overflow_started_at is null
     or now() < v_event.overflow_started_at + interval '48 hours' then
    update public.memberships set paused_at = null, let_in_at = now()
    where event_id = p_event_id and paused_at is not null;
    return;
  end if;

  v_included := floor(v_event.guest_limit * 1.1);

  with ranked as (
    select m.id, row_number() over (order by m.first_seen_at, m.id) as place
    from public.memberships m
    where m.event_id = p_event_id
      and m.status = 'active'
      and m.first_seen_at is not null
      and private.is_counted_guest(m.role, m.role_id)
  )
  update public.memberships m
  set paused_at = case when r.place > v_included then coalesce(m.paused_at, now()) else null end,
      -- Let in now: email them. Paused again before the email went: don't.
      let_in_at = case when r.place > v_included then null else now() end
  from ranked r
  where m.id = r.id
    and (m.paused_at is null) <> (r.place <= v_included);

  update public.memberships m
  set paused_at = null
  where m.event_id = p_event_id
    and m.paused_at is not null
    and not (m.status = 'active' and m.first_seen_at is not null and private.is_counted_guest(m.role, m.role_id));

  update public.events set overflow_closed_at = coalesce(overflow_closed_at, now()) where id = p_event_id;
end;
$$;

create or replace function public.apply_event_plan(
  p_event_id uuid,
  p_plan text,
  p_rate text,
  p_guest_limit int,
  p_photo_limit int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events
  set plan = p_plan,
      plan_rate = p_rate,
      guest_limit = p_guest_limit,
      photo_limit = p_photo_limit,
      overflow_started_at = null,
      overflow_closed_at = null,
      guests_nearly_full_notified_at = null,
      overflow_open_notified_at = null,
      overflow_reminder_notified_at = null,
      overflow_closed_notified_at = null,
      photos_nearly_full_notified_at = null,
      photos_full_notified_at = null
  where id = p_event_id;
  perform private.rebalance_event_guests(p_event_id);
end;
$$;

revoke execute on function public.apply_event_plan(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.apply_event_plan(uuid, text, text, int, int) to service_role;
revoke execute on function private.rebalance_event_guests(uuid) from public, anon, authenticated;

-- let_in_at is the server's, like paused_at.
create or replace function private.guard_membership_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.event_id is distinct from old.event_id
     or new.user_id is distinct from old.user_id
     or new.roster_email is distinct from old.roster_email then
    raise exception 'membership event, user and email cannot be changed' using errcode = '42501';
  end if;

  if new.paused_at is distinct from old.paused_at or new.let_in_at is distinct from old.let_in_at then
    raise exception 'guests are paused and let in by the event''s plan' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_members') then
    return new;
  end if;

  if (new.role, new.role_id, new.status, new.roster_name, new.claimed_name, new.name_mismatch,
      new.invited_at, new.first_seen_at, new.grace_started_at, new.grace_ends_at, new.grace_notices_sent)
     is distinct from
     (old.role, old.role_id, old.status, old.roster_name, old.claimed_name, old.name_mismatch,
      old.invited_at, old.first_seen_at, old.grace_started_at, old.grace_ends_at, old.grace_notices_sent) then
    raise exception 'only organisers can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_membership_update() from public, anon, authenticated;
