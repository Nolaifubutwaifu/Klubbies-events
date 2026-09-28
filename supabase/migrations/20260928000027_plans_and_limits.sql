-- Pricing tiers: plans, the photo allowance and the guest limit
-- (docs/handoff-pricing-tiers.md, phase 1).
--
-- Every event has a plan. New events start on Free (50 guests, 200 photos).
-- Paid tiers are set by the app after payment (public.apply_event_plan), which
-- passes the limits in: lib/billing/plans.ts is the one place the numbers live.
-- Events already paid or comped become 'unlimited', as promised when they paid.
--
-- The limits are enforced here, not only in the app, so no code path (the
-- service role included) can quietly go past them:
--
--   Photos: inserting a media row past photo_limit raises KB001. A photo
--   counts 1; a video 10 per started minute (one minute until its length is
--   known). Failed uploads and anything in Recently deleted don't count.
--
--   Guests: a guest joining (first_seen_at set on an active attendee row)
--   past the included 10% opens a 48 hour overflow window, during which
--   joins continue up to 50% over; past that, or once the window has closed,
--   the join raises KB002. Organisers' own changes (restoring someone,
--   re-importing a list, changing roles) are never refused; they rebalance.
--
--   Pausing: once the window has closed without an upgrade, the guests who
--   joined last, beyond the included 10%, are paused: they stay members but
--   can't see photos. Removing someone lets the earliest paused guest in;
--   an upgrade lets everyone in and starts a fresh window.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.events
  add column plan text not null default 'free'
    check (plan in ('free', 'small', 'medium', 'large', 'custom', 'unlimited')),
  add column plan_rate text check (plan_rate in ('club', 'standard')),
  -- Null means no limit.
  add column guest_limit int default 50 check (guest_limit > 0),
  add column photo_limit int default 200 check (photo_limit > 0),
  -- "About how many guests?" from the tier step; the join rate is measured against it.
  add column expected_guests int check (expected_guests > 0 and expected_guests <= 100000),
  -- When the guest after the included 10% joined. Cleared by an upgrade.
  add column overflow_started_at timestamptz,
  -- When the window closed without an upgrade and guests were paused.
  add column overflow_closed_at timestamptz;

alter table public.memberships
  add column paused_at timestamptz;

create index memberships_paused_idx on public.memberships (event_id) where paused_at is not null;
create index events_overflow_idx on public.events (overflow_started_at) where overflow_started_at is not null and overflow_closed_at is null;

-- Already paid or comped: unlimited, as they were sold. Everything else is Free.
update public.events
set plan = 'unlimited', guest_limit = null, photo_limit = null
where billing_status in ('active', 'past_due', 'comped');

grant update (expected_guests) on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- What counts
-- ---------------------------------------------------------------------------

-- An attendee: not an organiser, co-organiser or photographer.
create or replace function private.is_counted_guest(p_role text, p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = 'event_member' and (
    p_role_id is null
    or exists (select 1 from public.event_roles r where r.id = p_role_id and r.key = 'member')
  );
$$;

-- A photo counts 1, a video 10 per started minute (one minute until its
-- length is known).
create or replace function private.media_units(p_kind text, p_duration numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kind = 'video' then 10 * greatest(1, ceil(coalesce(p_duration, 60) / 60.0))::int
    else 1
  end;
$$;

create or replace function private.event_units_used(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.media_units(m.kind, m.duration_seconds)), 0)::int
  from public.media m
  where m.event_id = p_event_id
    and m.deleted_at is null
    and m.status <> 'failed';
$$;

create or replace function private.event_guests_joined(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.memberships m
  where m.event_id = p_event_id
    and m.status = 'active'
    and m.first_seen_at is not null
    and private.is_counted_guest(m.role, m.role_id);
$$;

-- ---------------------------------------------------------------------------
-- The guest limit
-- ---------------------------------------------------------------------------

-- 'open': room within the included 10%. 'overflow': the next guest joins in
-- the 48 hour window (or opens it). 'full': nobody new can join.
create or replace function private.guest_join_state(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_joined int;
  v_included int;
  v_ceiling int;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null or v_event.guest_limit is null then
    return 'open';
  end if;
  v_joined := private.event_guests_joined(p_event_id);
  v_included := floor(v_event.guest_limit * 1.1);
  v_ceiling := floor(v_event.guest_limit * 1.5);
  if v_joined < v_included then
    return 'open';
  end if;
  if v_joined < v_ceiling
     and (v_event.overflow_started_at is null or now() < v_event.overflow_started_at + interval '48 hours') then
    return 'overflow';
  end if;
  return 'full';
end;
$$;

-- Pauses or lets in guests so that, once the window has closed, only the
-- first joiners up to the included 10% can see photos. Before the window
-- closes, or with no limit, nobody is paused. Idempotent.
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
    update public.memberships set paused_at = null
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
  set paused_at = case when r.place > v_included then coalesce(m.paused_at, now()) else null end
  from ranked r
  where m.id = r.id
    and (m.paused_at is null) <> (r.place <= v_included);

  -- Anyone no longer counted (removed, made a photographer) isn't paused.
  update public.memberships m
  set paused_at = null
  where m.event_id = p_event_id
    and m.paused_at is not null
    and not (m.status = 'active' and m.first_seen_at is not null and private.is_counted_guest(m.role, m.role_id));

  update public.events set overflow_closed_at = coalesce(overflow_closed_at, now()) where id = p_event_id;
end;
$$;

-- A guest joining: refused when full, and opens the window when it's the
-- first guest past the included 10%. Serialised per event so two joins at the
-- same moment can't both take the last place.
create or replace function private.guard_guest_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  if new.status <> 'active'
     or new.first_seen_at is null
     or (tg_op = 'UPDATE' and old.first_seen_at is not null)
     or not private.is_counted_guest(new.role, new.role_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('guests:' || new.event_id::text, 0));
  v_state := private.guest_join_state(new.event_id);
  if v_state = 'full' then
    raise exception 'This event is full right now.' using errcode = 'KB002';
  end if;
  if v_state = 'overflow' then
    update public.events set overflow_started_at = now()
    where id = new.event_id and overflow_started_at is null;
  end if;
  return new;
end;
$$;

create trigger memberships_guest_join
  before insert or update of first_seen_at, status on public.memberships
  for each row execute function private.guard_guest_join();

-- After the window has closed, any change to who counts reshuffles who is paused.
create or replace function private.rebalance_after_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
begin
  if exists (select 1 from public.events e where e.id = v_event_id and e.overflow_closed_at is not null) then
    perform private.rebalance_event_guests(v_event_id);
  end if;
  return null;
end;
$$;

create trigger memberships_rebalance_guests
  after insert or delete or update of status, role, role_id, first_seen_at on public.memberships
  for each row execute function private.rebalance_after_membership_change();

-- ---------------------------------------------------------------------------
-- The photo allowance
-- ---------------------------------------------------------------------------

create or replace function private.guard_photo_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
begin
  select photo_limit into v_limit from public.events where id = new.event_id;
  if v_limit is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('photos:' || new.event_id::text, 0));
  if private.event_units_used(new.event_id) + private.media_units(new.kind, new.duration_seconds) > v_limit then
    raise exception 'This event has used its photo allowance.' using errcode = 'KB001';
  end if;
  return new;
end;
$$;

create trigger media_photo_allowance
  before insert on public.media
  for each row execute function private.guard_photo_allowance();

-- ---------------------------------------------------------------------------
-- Paused guests see no photos and add none
-- ---------------------------------------------------------------------------

-- Migration 26's version, plus: the member branch needs an unpaused row.
create or replace function private.can_view_event_item(event_id uuid, created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_live(can_view_event_item.event_id) and (
    private.is_event_admin(can_view_event_item.event_id)
    or private.event_perm(can_view_event_item.event_id, 'manage_albums')
    or (
      exists (
        select 1 from public.memberships m
        where m.event_id = can_view_event_item.event_id
          and m.user_id = auth.uid()
          and m.status = 'active'
          and m.paused_at is null
      )
      and exists (
        select 1 from public.events e
        where e.id = can_view_event_item.event_id
          and (e.access_ends_at is null or e.access_ends_at > now())
      )
    )
  );
$$;

create or replace function private.can_contribute_to_album(album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.albums a
    where a.id = can_contribute_to_album.album_id
      and a.deleted_at is null
      and (
        private.event_perm(a.event_id, 'manage_albums')
        or private.event_perm(a.event_id, 'upload')
        or (
          a.contributor_scope = 'members'
          and private.is_event_member(a.event_id)
          and not exists (
            select 1 from public.memberships m
            where m.event_id = a.event_id and m.user_id = auth.uid() and m.paused_at is not null
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Writing: Free events work without paying; limits do the gating
-- ---------------------------------------------------------------------------

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
      and (c.plan = 'free' or c.billing_status in ('active', 'past_due', 'comped'))
  );
$$;

-- Migration 25's membership guard, plus: nobody pauses or unpauses a guest
-- through the API, organisers included. Only the rules above do.
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

  if new.paused_at is distinct from old.paused_at then
    raise exception 'guests are paused and let in by the event''s plan' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_members') then
    return new;
  end if;

  -- A member's own row: accept or decline, acknowledge the face notice.
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

-- ---------------------------------------------------------------------------
-- For the app (service role only)
-- ---------------------------------------------------------------------------

-- Everything the app shows about an event's limits in one read.
create or replace function public.event_plan_usage(p_event_id uuid)
returns table (
  plan text,
  plan_rate text,
  guest_limit int,
  photo_limit int,
  guests_joined int,
  guests_paused int,
  units_used int,
  join_state text,
  overflow_started_at timestamptz,
  overflow_closed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan, e.plan_rate, e.guest_limit, e.photo_limit,
    private.event_guests_joined(e.id),
    (select count(*)::int from public.memberships m where m.event_id = e.id and m.paused_at is not null),
    private.event_units_used(e.id),
    private.guest_join_state(e.id),
    e.overflow_started_at, e.overflow_closed_at
  from public.events e
  where e.id = p_event_id;
$$;

-- Moves an event onto a plan after payment (or by hand, for a quote). Clears
-- the overflow window, so the new tier gets its own, and lets paused guests in.
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
      overflow_closed_at = null
  where id = p_event_id;
  perform private.rebalance_event_guests(p_event_id);
end;
$$;

-- The hourly pass: closes windows that have run their 48 hours.
create or replace function public.close_overflow_windows()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  for v_event in
    select id from public.events
    where overflow_started_at is not null
      and overflow_closed_at is null
      and overflow_started_at + interval '48 hours' <= now()
  loop
    perform private.rebalance_event_guests(v_event);
    return next v_event;
  end loop;
end;
$$;

revoke execute on function public.event_plan_usage(uuid) from public, anon, authenticated;
revoke execute on function public.apply_event_plan(uuid, text, text, int, int) from public, anon, authenticated;
revoke execute on function public.close_overflow_windows() from public, anon, authenticated;
grant execute on function public.event_plan_usage(uuid) to service_role;
grant execute on function public.apply_event_plan(uuid, text, text, int, int) to service_role;
grant execute on function public.close_overflow_windows() to service_role;

revoke execute on function private.guard_guest_join() from public, anon, authenticated;
revoke execute on function private.rebalance_after_membership_change() from public, anon, authenticated;
revoke execute on function private.guard_photo_allowance() from public, anon, authenticated;
revoke execute on function private.rebalance_event_guests(uuid) from public, anon, authenticated;
