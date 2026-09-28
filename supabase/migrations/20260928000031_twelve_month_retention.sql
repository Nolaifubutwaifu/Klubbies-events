-- Photos are kept 12 months after the event (docs/handoff-retention-backups.md,
-- phase 3).
--
-- photos_delete_at is the end of the event's last day, Brisbane time, plus 12
-- months, plus 12 more for each "Keep another year" bought. A trigger keeps it
-- right as dates change. The gallery closes for guests at that moment or
-- earlier, never later: access_ends_at defaults to it and is capped by it.
--
-- At photos_delete_at the hourly job deletes the photos, previews, covers,
-- selfies, faceprints, the guest list and the access log, and stamps
-- photos_deleted_at. The event row, organisers, payments and usage totals
-- stay. Organisers are warned 30 and 7 days before.

alter table public.events
  add column photos_delete_at timestamptz,
  add column extra_years int not null default 0 check (extra_years >= 0 and extra_years <= 20),
  add column deletion_warned_30_at timestamptz,
  add column deletion_warned_7_at timestamptz,
  add column photos_deleted_at timestamptz,
  -- Face data went when the gallery closed (privacy page: within 24 hours).
  add column face_data_closed_at timestamptz;

create index events_photos_delete_idx on public.events (photos_delete_at) where photos_deleted_at is null;

-- The end of the event's last day in Brisbane, plus 12 months per year kept.
create or replace function private.photos_delete_at_for(p_last_day date, p_extra_years int)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((p_last_day + 1)::timestamp at time zone 'Australia/Brisbane')
         + make_interval(months => 12 * (1 + coalesce(p_extra_years, 0)));
$$;

create or replace function private.set_photos_delete_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base date := coalesce(new.ends_on, new.starts_on, (coalesce(new.created_at, now()) at time zone 'Australia/Brisbane')::date);
  v_old_delete timestamptz := case when tg_op = 'UPDATE' then old.photos_delete_at else null end;
begin
  -- Once the photos are gone the date is history, not a plan.
  if new.photos_deleted_at is not null then
    return new;
  end if;

  new.photos_delete_at := private.photos_delete_at_for(v_base, new.extra_years);

  if new.photos_delete_at is distinct from v_old_delete then
    -- A new date gets its own warnings.
    new.deletion_warned_30_at := null;
    new.deletion_warned_7_at := null;
  end if;

  -- New events stay open to guests for the whole 12 months. An organiser's
  -- closing date is kept, but never past deletion; one that sat on the old
  -- deletion date (the default) follows the new one.
  if tg_op = 'INSERT'
     or new.access_ends_at is null
     or new.access_ends_at > new.photos_delete_at
     or (v_old_delete is not null and old.access_ends_at = v_old_delete and new.access_ends_at = old.access_ends_at) then
    new.access_ends_at := new.photos_delete_at;
  end if;

  -- Reopened after its face data went: face search starts again from scratch.
  if new.face_data_closed_at is not null and new.access_ends_at > now() then
    new.face_data_closed_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.set_photos_delete_at() from public, anon, authenticated;

create trigger events_photos_delete_at
  before insert or update of starts_on, ends_on, extra_years, access_ends_at, photos_deleted_at on public.events
  for each row execute function private.set_photos_delete_at();

-- Existing events: 12 months from their last day, or from today if that has
-- already passed. A gallery still on the old 90 day default opens for the
-- whole year; a date an organiser picked stays, within the year.
alter table public.events disable trigger events_photos_delete_at;
update public.events e
set photos_delete_at = private.photos_delete_at_for(
      greatest(coalesce(e.ends_on, e.starts_on, (e.created_at at time zone 'Australia/Brisbane')::date), (now() at time zone 'Australia/Brisbane')::date),
      0);
update public.events e
set access_ends_at = case
      when e.access_ends_at is null then e.photos_delete_at
      when coalesce(e.ends_on, e.starts_on) is not null
           and e.access_ends_at = ((coalesce(e.ends_on, e.starts_on) + 91)::timestamp at time zone 'Australia/Brisbane') then e.photos_delete_at
      else least(e.access_ends_at, e.photos_delete_at)
    end,
    access_notice_sent_at = null;
alter table public.events enable trigger events_photos_delete_at;

-- Organisers can't move the deletion date themselves; Keep another year does.
-- (events updates are granted per column; none of these are granted.)

-- Usage totals stop refreshing once an event's photos are gone, so the saved
-- figures are the event's last (migration 30's function, plus that one line).
create or replace function public.refresh_event_usage()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.event_usage as u (
    event_id, guests_joined, selfies, photos, videos, video_seconds, units, original_bytes, backed_up_bytes,
    views, downloads, zips, guests_downloaded, first_photo_at, first_published_at, refreshed_at
  )
  select
    e.id,
    private.event_guests_joined(e.id),
    (select count(*) from public.member_face_profiles p where p.event_id = e.id and p.status = 'ready'),
    coalesce(m.photos, 0), coalesce(m.videos, 0), coalesce(m.video_seconds, 0), coalesce(m.units, 0),
    coalesce(m.original_bytes, 0), coalesce(m.backed_up_bytes, 0),
    coalesce(a.views, 0), coalesce(a.downloads, 0), coalesce(a.zips, 0), coalesce(a.guests_downloaded, 0),
    m.first_photo_at,
    (select min(al.published_at) from public.albums al where al.event_id = e.id and al.deleted_at is null),
    now()
  from public.events e
  left join lateral (
    select
      count(*) filter (where md.kind = 'photo') as photos,
      count(*) filter (where md.kind = 'video') as videos,
      coalesce(sum(md.duration_seconds) filter (where md.kind = 'video'), 0) as video_seconds,
      coalesce(sum(private.media_units(md.kind, md.duration_seconds)), 0) as units,
      coalesce(sum(md.byte_size), 0) as original_bytes,
      coalesce(sum(md.byte_size) filter (where md.backed_up_at is not null), 0) as backed_up_bytes,
      min(md.created_at) as first_photo_at
    from public.media md
    where md.event_id = e.id and md.deleted_at is null and md.status = 'ready'
  ) m on true
  left join lateral (
    select
      count(*) filter (where ae.action = 'view') as views,
      count(*) filter (where ae.action = 'download') as downloads,
      count(*) filter (where ae.action = 'zip') as zips,
      count(distinct ae.membership_id) filter (where ae.action in ('download', 'zip')) as guests_downloaded
    from public.access_events ae
    where ae.event_id = e.id
  ) a on true
  where e.photos_deleted_at is null
  on conflict (event_id) do update set
    guests_joined = excluded.guests_joined,
    selfies = excluded.selfies,
    photos = excluded.photos,
    videos = excluded.videos,
    video_seconds = excluded.video_seconds,
    units = excluded.units,
    original_bytes = excluded.original_bytes,
    backed_up_bytes = excluded.backed_up_bytes,
    views = excluded.views,
    downloads = excluded.downloads,
    zips = excluded.zips,
    guests_downloaded = excluded.guests_downloaded,
    first_photo_at = excluded.first_photo_at,
    first_published_at = excluded.first_published_at,
    refreshed_at = excluded.refreshed_at;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.refresh_event_usage() from public, anon, authenticated;
grant execute on function public.refresh_event_usage() to service_role;

-- The monthly R2 check: which of these events are past their deletion date
-- plus the 30 days the copies are kept.
create or replace function public.events_past_backup_keep(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e
  where e.id = any(p_ids)
    and e.photos_deleted_at is not null
    and coalesce(e.photos_deleted_at, e.photos_delete_at) + interval '30 days' < now();
$$;
revoke execute on function public.events_past_backup_keep(uuid[]) from public, anon, authenticated;
grant execute on function public.events_past_backup_keep(uuid[]) to service_role;

-- Nothing new goes into an event whose photos were deleted at 12 months
-- (migration 27's rule, plus that).
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
      and c.photos_deleted_at is null
      and (c.plan = 'free' or c.billing_status in ('active', 'past_due', 'comped'))
  );
$$;
