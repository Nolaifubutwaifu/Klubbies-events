-- Recently deleted (docs/handoff-retention-backups.md, phase 1).
--
-- Deleting a photo, an album or a whole event used to remove the files at
-- once. Now it only stamps deleted_at: the row and its files stay for 30 days,
-- in the organiser's bin, and the hourly job deletes them for good after that
-- (lib/media/bin.ts). Restoring clears the stamp.
--
-- A binned row is invisible to everyone through the API, organisers included:
-- every ordinary page then leaves it out without a filter of its own. The bin
-- page, restore and purge read and write with the service role after the app
-- has checked the caller runs the event.
--
-- An album takes its photos into the bin with it, stamped with the album's own
-- deleted_at. Restoring the album brings back exactly those photos and not any
-- photo that was binned on its own before.

alter table public.events
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.users (id) on delete set null;
alter table public.albums
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.users (id) on delete set null;
alter table public.media
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.users (id) on delete set null;

create index events_deleted_idx on public.events (deleted_at) where deleted_at is not null;
create index albums_deleted_idx on public.albums (event_id, deleted_at) where deleted_at is not null;
create index media_deleted_idx on public.media (event_id, deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The event exists and isn't in the bin.
create or replace function private.event_live(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = event_live.event_id
      and e.deleted_at is null
  );
$$;
revoke execute on function private.event_live(uuid) from public, anon;
grant execute on function private.event_live(uuid) to authenticated;

-- An event in the bin has no members as far as the API is concerned: guests
-- lose it at once, and so do its logo, covers, face matches and favourites,
-- which all ask this.
create or replace function private.is_event_member(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_live(is_event_member.event_id) and (
    private.is_super_admin() or exists (
      select 1 from public.memberships m
      where m.event_id = is_event_member.event_id
        and m.user_id = auth.uid()
        and (m.status = 'active' or (m.status = 'grace' and m.grace_ends_at > now()))
    )
  );
$$;

-- Nobody manages, uploads to or publishes in a binned event through the API.
-- Restoring it goes through the service role (restoreEventAction).
create or replace function private.event_perm(event_id uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_live(event_perm.event_id) and (
    private.is_super_admin() or exists (
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
    )
  );
$$;

-- Same as migration 22, plus: a binned event shows nothing to anyone.
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
      )
      and exists (
        select 1 from public.events e
        where e.id = can_view_event_item.event_id
          and (e.access_ends_at is null or e.access_ends_at > now())
      )
    )
  );
$$;

-- Nothing can be uploaded into a binned album.
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
        or (a.contributor_scope = 'members' and private.is_event_member(a.event_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies: binned rows are nobody's through the API
-- ---------------------------------------------------------------------------

drop policy events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (deleted_at is null and private.is_event_member(id));

drop policy albums_select on public.albums;
create policy albums_select on public.albums
  for select to authenticated
  using (
    deleted_at is null
    and (
      private.is_event_admin(event_id)
      or (
        status = 'published'
        and visibility = 'members'
        and private.can_view_event_item(event_id, created_at)
      )
    )
    and private.event_live(event_id)
  );

drop policy media_select on public.media;
create policy media_select on public.media
  for select to authenticated
  using (
    deleted_at is null
    and private.event_live(event_id)
    and (
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
            and a.deleted_at is null
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Only organisers, through the app, move things in and out of the bin
-- ---------------------------------------------------------------------------

-- Migration 25's guard, with deleted_at and deleted_by added to what an
-- uploader who doesn't manage albums can't change on their own row.
create or replace function private.guard_media_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.event_id is distinct from old.event_id then
    raise exception 'media cannot move between events' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_albums') then
    return new;
  end if;

  -- An uploader finishing their own file: status, dimensions, derivatives.
  if (new.album_id, new.uploaded_by, new.hidden_at, new.guest_link_id, new.photographer_name,
      new.storage_path, new.content_hash, new.kind, new.deleted_at, new.deleted_by)
     is distinct from
     (old.album_id, old.uploaded_by, old.hidden_at, old.guest_link_id, old.photographer_name,
      old.storage_path, old.content_hash, old.kind, old.deleted_at, old.deleted_by) then
    raise exception 'only organisers can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_media_update() from public, anon, authenticated;
