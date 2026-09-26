-- Klubbies Events: the one-time version of Klubbies (docs/masterfile.md §7).
--
-- The migrations before this one are Klubbies' own, with "club" renamed to
-- "event". This one turns a long-lived club into a single event: dates and a
-- venue, an access mode, a window after which attendees can no longer open the
-- galleries, a photographer credit on every photo, three fixed roles, and no
-- feed.

-- ---------------------------------------------------------------------------
-- Events: when, where, and who gets in
-- ---------------------------------------------------------------------------

alter table public.events
  add column starts_on date,
  add column ends_on date,
  add column venue text check (char_length(venue) <= 160),
  -- link: anyone with the event link who confirms an email code joins.
  -- guest_list: only addresses on the imported list get a code.
  add column access_mode text not null default 'link' check (access_mode in ('link', 'guest_list')),
  -- After this, attendees see a closed screen. Null keeps it open.
  add column access_ends_at timestamptz,
  -- When attendees were told the gallery closes within a week. Cleared
  -- whenever access_ends_at moves, so a new date gets its own reminder.
  add column access_notice_sent_at timestamptz,
  add constraint events_dates_in_order check (ends_on is null or starts_on is null or ends_on >= starts_on);

-- A one-day event has no members who "leave", so removal revokes at once.
alter table public.events alter column grace_period_enabled set default false;

-- ---------------------------------------------------------------------------
-- Albums and media
-- ---------------------------------------------------------------------------

alter table public.albums drop column event_type;

alter table public.media
  add column photographer_name text check (char_length(photographer_name) <= 120);

-- There are no invitations to accept: being on the list, or joining through
-- the link, is the acceptance.
alter table public.memberships alter column accepted_at set default now();

-- ---------------------------------------------------------------------------
-- No feed
-- ---------------------------------------------------------------------------

drop table public.post_reactions;
drop table public.post_comments;
drop table public.posts;
alter table public.users drop column notify_feed_post;

-- ---------------------------------------------------------------------------
-- Three fixed roles: Organiser, Photographer, Attendee
-- ---------------------------------------------------------------------------

create or replace function private.event_perm(event_id uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1
    from public.memberships m
    join public.event_roles r on r.id = m.role_id
    where m.event_id = event_perm.event_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        r.manage_event
        or (event_perm.perm = 'manage_members' and r.manage_members)
        or (event_perm.perm = 'manage_albums' and r.manage_albums)
        or (event_perm.perm = 'upload' and r.upload)
      )
  );
$$;

alter table public.event_roles drop column post_feed;

create or replace function public.seed_event_roles(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_member uuid;
begin
  insert into public.event_roles (event_id, key, name, manage_event, manage_members, manage_albums, upload, is_default, is_builtin, sort_order)
  values
    (p_event_id, 'admin', 'Organiser', true, true, true, true, false, true, 0),
    (p_event_id, 'photographer', 'Photographer', false, false, false, true, false, true, 1),
    (p_event_id, 'member', 'Attendee', false, false, false, false, true, true, 2)
  on conflict (event_id, key) do nothing;

  select id into v_admin from public.event_roles where event_id = p_event_id and key = 'admin';
  select id into v_member from public.event_roles where event_id = p_event_id and key = 'member';

  update public.memberships
  set role_id = case when role = 'event_admin' then v_admin else v_member end
  where event_id = p_event_id and role_id is null;
end;
$$;
revoke execute on function public.seed_event_roles(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The access window, enforced where every photo read is decided
-- ---------------------------------------------------------------------------

-- Albums, media and (through media) storage objects all ask this. Organisers
-- and anyone who manages albums always see everything; attendees only while
-- the event's window is open. The grace branch is gone with the grace period.
create or replace function private.can_view_event_item(event_id uuid, created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_event_admin(can_view_event_item.event_id)
    or private.event_perm(can_view_event_item.event_id, 'manage_albums')
    or (
      exists (
        select 1 from public.memberships m
        where m.event_id = can_view_event_item.event_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
      and exists (
        select 1 from public.events e
        where e.id = can_view_event_item.event_id
          and (e.access_ends_at is null or e.access_ends_at > now())
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- create_event takes the event's details
-- ---------------------------------------------------------------------------

drop function public.create_event(text, text, text, text);

create or replace function public.create_event(
  p_name text,
  p_handle_base text,
  p_organisation text,
  p_description text,
  p_starts_on date default null,
  p_ends_on date default null,
  p_venue text default null,
  p_access_mode text default 'link'
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.users;
  v_handle text;
  v_n int := 1;
  v_event public.events;
  v_admin_role uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_user from public.users where id = v_uid;
  if v_user.id is null then
    raise exception 'user profile missing' using errcode = '42501';
  end if;

  if p_handle_base !~ '^[a-z0-9]+(_[a-z0-9]+)*$' then
    raise exception 'invalid handle base';
  end if;

  v_handle := p_handle_base;
  while exists (select 1 from public.events c where c.handle::text = v_handle)
     or exists (select 1 from public.event_handle_redirects r where r.old_handle::text = v_handle) loop
    v_n := v_n + 1;
    v_handle := p_handle_base || '_' || v_n;
  end loop;

  insert into public.events (
    handle, name, organisation, description, created_by, starts_on, ends_on, venue, access_mode, access_ends_at
  )
  values (
    v_handle, p_name, nullif(trim(p_organisation), ''), nullif(trim(p_description), ''), v_uid,
    p_starts_on, p_ends_on, nullif(trim(p_venue), ''), coalesce(p_access_mode, 'link'),
    -- 90 days after the last day, at the end of that day in Brisbane.
    case
      when coalesce(p_ends_on, p_starts_on) is null then null
      else ((coalesce(p_ends_on, p_starts_on) + 91)::timestamp at time zone 'Australia/Brisbane')
    end
  )
  returning * into v_event;

  perform public.seed_event_roles(v_event.id);
  select id into v_admin_role from public.event_roles where event_id = v_event.id and key = 'admin';

  insert into public.memberships (
    event_id, user_id, roster_email, roster_name, role, role_id, status, invited_at, first_seen_at, accepted_at
  ) values (
    v_event.id, v_uid, v_user.email::text,
    coalesce(nullif(v_user.display_name, ''), split_part(v_user.email::text, '@', 1)),
    'event_admin', v_admin_role, 'active', now(), now(), now()
  );

  return v_event;
end;
$$;

revoke execute on function public.create_event(text, text, text, text, date, date, text, text) from public, anon;
grant execute on function public.create_event(text, text, text, text, date, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Joining through the event link
-- ---------------------------------------------------------------------------

-- "join" is a code request made from an event's own link. For an event in
-- link mode the address needn't be on any list; verifying the code creates
-- the attendee row. event_id remembers which event the code was for.
alter table public.pending_sign_ins drop constraint pending_sign_ins_flow_check;
alter table public.pending_sign_ins add constraint pending_sign_ins_flow_check
  check (flow in ('member', 'create', 'signup', 'join'));
alter table public.pending_sign_ins
  add column event_id uuid references public.events (id) on delete cascade;

-- New events start with face recognition on, as Klubbies clubs do, recorded
-- as the product's default rather than an organiser's acceptance. The
-- organiser can switch it off in Settings, which deletes every faceprint.
create or replace function private.event_faces_on_by_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_face_settings (event_id, enabled, notice_version)
  values (new.id, true, 'events-default-2026-09-27')
  on conflict (event_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photographers with an account upload anywhere in their event
-- ---------------------------------------------------------------------------

-- In Klubbies the upload permission only reached albums open to member
-- contributions. An event's Photographer role exists to upload, so it reaches
-- every album; attendees still only reach albums that invite them.
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
      and (
        private.event_perm(a.event_id, 'manage_albums')
        or private.event_perm(a.event_id, 'upload')
        or (a.contributor_scope = 'members' and private.is_event_member(a.event_id))
      )
  );
$$;

-- An uploader can read their own rows while they are still processing, which
-- is what lets the finalize step (and storage signing, which joins media)
-- work for someone who can't manage albums.
drop policy media_select on public.media;
create policy media_select on public.media
  for select to authenticated
  using (
    private.event_perm(event_id, 'manage_albums')
    or uploaded_by = (select auth.uid())
    or (
      status = 'ready'
      and hidden_at is null
      and private.can_view_event_item(event_id, created_at)
      and exists (
        select 1 from public.albums a
        where a.id = media.album_id
          and a.status = 'published'
          and a.visibility = 'members'
      )
    )
  );
