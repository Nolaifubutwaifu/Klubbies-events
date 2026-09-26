-- Three things the design asks for that the schema had no room for:
--   * an event type on an album, so members can tell a formal from a camp
--   * guest photographer links: upload into one album, see nothing else
--   * removal requests: a member hides a photo, the committee confirms

-- ---------------------------------------------------------------------------
-- Event type
-- ---------------------------------------------------------------------------

alter table public.albums add column event_type text
  check (event_type in ('formal', 'sport', 'social', 'camp', 'night_out', 'other'));

-- ---------------------------------------------------------------------------
-- Guest photographer links
-- ---------------------------------------------------------------------------

-- The token itself is never stored. We keep a sha-256 of it, so a leaked
-- backup can't be turned back into a working upload link.
create table public.album_guest_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.users (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  first_used_at timestamptz,
  last_used_at timestamptz,
  file_count integer not null default 0,
  byte_total bigint not null default 0,
  created_at timestamptz not null default now()
);
create index album_guest_links_club_idx on public.album_guest_links (club_id, created_at desc);
create index album_guest_links_album_idx on public.album_guest_links (album_id);

-- Which link a file came in on. Null means a member or the committee added it,
-- which is what every existing row is.
alter table public.media add column guest_link_id uuid
  references public.album_guest_links (id) on delete set null;
create index media_guest_link_idx on public.media (guest_link_id) where guest_link_id is not null;

alter table public.album_guest_links enable row level security;

-- Guests have no session at all: their route runs with the service role after
-- checking the token, so authenticated policies only need to cover committees.
create policy album_guest_links_select on public.album_guest_links
  for select to authenticated using (private.club_perm(club_id, 'manage_albums'));
create policy album_guest_links_insert on public.album_guest_links
  for insert to authenticated
  with check (private.club_perm(club_id, 'manage_albums') and private.club_can_write(club_id));
create policy album_guest_links_update on public.album_guest_links
  for update to authenticated
  using (private.club_perm(club_id, 'manage_albums'))
  with check (private.club_perm(club_id, 'manage_albums'));
create policy album_guest_links_delete on public.album_guest_links
  for delete to authenticated using (private.club_perm(club_id, 'manage_albums'));

-- ---------------------------------------------------------------------------
-- Removal requests
-- ---------------------------------------------------------------------------

-- Hiding is instant and reversible; deleting is the committee's call. A hidden
-- photo keeps its file, so "put it back" is a single update.
alter table public.media add column hidden_at timestamptz;

create table public.media_removal_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  requested_by uuid references public.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'confirmed', 'restored')),
  requested_at timestamptz not null default now(),
  -- Doing nothing is a decision too: an unanswered request deletes the photo.
  auto_delete_at timestamptz not null default (now() + interval '7 days'),
  resolved_at timestamptz,
  resolved_by uuid references public.users (id) on delete set null
);
-- One open request per photo. A second person asking is the same request.
create unique index media_removal_open_idx on public.media_removal_requests (media_id)
  where status = 'open';
create index media_removal_club_idx on public.media_removal_requests (club_id, status, requested_at desc);
create index media_removal_due_idx on public.media_removal_requests (auto_delete_at) where status = 'open';

alter table public.media_removal_requests enable row level security;

create policy media_removal_select on public.media_removal_requests
  for select to authenticated
  using (private.club_perm(club_id, 'manage_albums') or requested_by = (select auth.uid()));

-- Any member of the club can ask, for a photo they can currently see.
create policy media_removal_insert on public.media_removal_requests
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and private.is_club_member(club_id)
    and exists (
      select 1 from public.media m
      where m.id = media_removal_requests.media_id and m.club_id = media_removal_requests.club_id
    )
  );

create policy media_removal_update on public.media_removal_requests
  for update to authenticated
  using (private.club_perm(club_id, 'manage_albums'))
  with check (private.club_perm(club_id, 'manage_albums'));

-- ---------------------------------------------------------------------------
-- A hidden photo leaves the member view at once
-- ---------------------------------------------------------------------------

drop policy media_select on public.media;
create policy media_select on public.media
  for select to authenticated
  using (
    private.club_perm(club_id, 'manage_albums')
    or (
      status = 'ready'
      and hidden_at is null
      and private.can_view_club_item(club_id, created_at)
      and exists (
        select 1 from public.albums a
        where a.id = media.album_id
          and a.status = 'published'
          and a.visibility = 'members'
      )
    )
  );

-- media_update stays as it was: managers, or the person who uploaded the file.
-- A member's request hides the photo through a server action running with the
-- service role, so asking never becomes a way to edit a media row.

-- ---------------------------------------------------------------------------
-- Club-level switches the settings screen shows
-- ---------------------------------------------------------------------------

alter table public.clubs
  add column allow_removal_requests boolean not null default true,
  add column grace_period_enabled boolean not null default true;
