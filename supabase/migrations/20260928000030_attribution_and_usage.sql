-- Where events come from, and what each one uses (docs/handoff-pricing-tiers.md,
-- phase 3: §5.8 and §5.9).
--
-- An event remembers the tracked link its organiser first arrived through
-- (?src=flyer-uq-union, 30 days, first tag wins) and their answer to "How did
-- you hear about us?". Club and partner codes are already on the event and
-- its purchases.
--
-- event_usage holds each event's running totals. It is refreshed by the hourly
-- job and kept after the event's photos are deleted at 12 months, so invoices
-- and cost figures survive. Face search calls are counted as they are made.

alter table public.events
  add column source text check (source ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add column heard_from text check (heard_from in ('flyer', 'social', 'email', 'event', 'photographer', 'club', 'other'));

create table public.event_usage (
  event_id uuid primary key references public.events (id) on delete cascade,
  guests_joined int not null default 0,
  selfies int not null default 0,
  photos int not null default 0,
  videos int not null default 0,
  video_seconds numeric not null default 0,
  units int not null default 0,
  original_bytes bigint not null default 0,
  backed_up_bytes bigint not null default 0,
  views int not null default 0,
  downloads int not null default 0,
  zips int not null default 0,
  guests_downloaded int not null default 0,
  face_calls int not null default 0,
  first_photo_at timestamptz,
  first_published_at timestamptz,
  refreshed_at timestamptz not null default now()
);

alter table public.event_usage enable row level security;
revoke all on public.event_usage from anon, authenticated;

-- Rekognition calls, counted by the face jobs as they happen.
create or replace function public.count_face_calls(p_event_id uuid, p_calls int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.event_usage (event_id, face_calls) values (p_event_id, greatest(p_calls, 0))
  on conflict (event_id) do update set face_calls = public.event_usage.face_calls + excluded.face_calls;
$$;

-- Recomputes every event's totals in one pass (face calls are left alone).
-- Photos in Recently deleted are left out, as they are from the allowance.
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

revoke execute on function public.count_face_calls(uuid, int) from public, anon, authenticated;
revoke execute on function public.refresh_event_usage() from public, anon, authenticated;
grant execute on function public.count_face_calls(uuid, int) to service_role;
grant execute on function public.refresh_event_usage() to service_role;
