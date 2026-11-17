-- Album and photo reads were checked one row at a time. media_select and
-- albums_select called event_live, event_perm, is_event_admin and
-- can_view_event_item for every row, and each is SECURITY DEFINER with its own
-- search_path, so Postgres can neither inline nor cache them. The 17 Nov 2026
-- load test measured 7.7 s for one guest to list a 352 photo album, against
-- an 8 s statement timeout: an album of a few hundred photos more would fail
-- for every guest.
--
-- These sets answer the same questions once per query: each policy now asks
-- "is this row's event in the set of events I may see", and Postgres runs the
-- set function once and hashes it. The rules are the same as before:
--
--   event_live(e)             = e is in live_event_ids()
--   event_perm(e, p)          = e is in my_perm_event_ids(p)
--   is_event_admin(e)         = e is in my_admin_event_ids()
--   can_view_event_item(e, _) = e is in my_view_event_ids()
--
-- The old functions stay: other policies and code still call them.
-- Idempotent. lock_timeout so the policy swap does not queue behind uploads.

begin;

set local lock_timeout = '5s';

create or replace function private.live_event_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e where e.deleted_at is null;
$$;

create or replace function private.my_admin_event_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e where private.is_super_admin()
  union
  select m.event_id from public.memberships m
  where m.user_id = auth.uid() and m.role = 'event_admin' and m.status = 'active';
$$;

create or replace function private.my_perm_event_ids(perm text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e
  where e.deleted_at is null
    and (
      private.is_super_admin()
      or exists (
        select 1
        from public.memberships m
        join public.event_roles r on r.id = m.role_id
        where m.event_id = e.id
          and m.user_id = auth.uid()
          and m.status = 'active'
          and (
            r.manage_event
            or (my_perm_event_ids.perm = 'manage_members' and r.manage_members)
            or (my_perm_event_ids.perm = 'manage_albums' and r.manage_albums)
            or (my_perm_event_ids.perm = 'upload' and r.upload)
          )
      )
    );
$$;

create or replace function private.my_view_event_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e
  where e.deleted_at is null
    and (
      e.id in (select private.my_admin_event_ids())
      or e.id in (select private.my_perm_event_ids('manage_albums'))
      or (
        (e.access_ends_at is null or e.access_ends_at > now())
        and exists (
          select 1 from public.memberships m
          where m.event_id = e.id
            and m.user_id = auth.uid()
            and m.status = 'active'
            and m.paused_at is null
            and m.name_review_at is null
        )
      )
    );
$$;

revoke execute on function private.live_event_ids() from public, anon;
revoke execute on function private.my_admin_event_ids() from public, anon;
revoke execute on function private.my_perm_event_ids(text) from public, anon;
revoke execute on function private.my_view_event_ids() from public, anon;
grant execute on function private.live_event_ids() to authenticated;
grant execute on function private.my_admin_event_ids() to authenticated;
grant execute on function private.my_perm_event_ids(text) to authenticated;
grant execute on function private.my_view_event_ids() to authenticated;

drop policy if exists albums_select on public.albums;
create policy albums_select on public.albums
  for select to authenticated
  using (
    deleted_at is null
    and event_id in (select private.live_event_ids())
    and (
      event_id in (select private.my_admin_event_ids())
      or (status = 'published' and visibility = 'members' and event_id in (select private.my_view_event_ids()))
    )
  );

drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to authenticated
  using (
    deleted_at is null
    and event_id in (select private.live_event_ids())
    and (
      event_id in (select private.my_perm_event_ids('manage_albums'))
      or uploaded_by = (select auth.uid())
      or (
        status = 'ready'
        and hidden_at is null
        and event_id in (select private.my_view_event_ids())
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

commit;
