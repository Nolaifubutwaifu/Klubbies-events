-- A contributing member can INSERT a media row. storage_path, thumb_path,
-- display_path and poster_path were not required to live in that row's own
-- folder, so the row could point at another event's files. Signing with the
-- service role then handed those files out. This requires each path, when
-- set, to be events/{event_id}/albums/{album_id}/{id}/{known name}, with no
-- "..". service_role writes go through the same check: the app already
-- writes that shape.
--
-- The guard is SECURITY DEFINER. As INVOKER it called media_path_owned,
-- whose EXECUTE is revoked, so authenticated writes failed with 42501 and
-- service_role failed with permission denied for schema private. DEFINER
-- runs as the function owner, who can see private. search_path stays empty.
-- EXECUTE stays revoked, and private is not granted to service_role.
--
-- users.avatar_url must be avatars/{id}/<file>. Every role, including
-- service_role, must keep that shape. That check does not call another
-- private function.
--
-- The whole file is one transaction. The pre-check raises, and aborts,
-- before any trigger is dropped, so a bad existing row cannot leave media
-- without its guard. DROP TRIGGER cannot commit unless CREATE TRIGGER does.
--
-- Idempotent. lock_timeout so DROP/CREATE TRIGGER does not wait on media.

begin;

set local lock_timeout = '5s';

do $$
declare
  n int;
begin
  select count(*) into n
  from public.media
  where position('..' in storage_path) > 0
     or album_id is null
     or storage_path is distinct from
        'events/' || event_id::text || '/albums/' || album_id::text || '/' || id::text || '/'
        || regexp_replace(storage_path, '^.*/', '')
     or regexp_replace(storage_path, '^.*/', '') not in (
          'original.jpg', 'original.jpeg', 'original.png', 'original.heic', 'original.heif', 'original.webp',
          'original.mp4', 'original.mov', 'thumb.webp', 'display.webp', 'poster.jpg'
        )
     or (thumb_path is not null and (
          position('..' in thumb_path) > 0
          or thumb_path is distinct from
             'events/' || event_id::text || '/albums/' || album_id::text || '/' || id::text || '/thumb.webp'
        ))
     or (display_path is not null and (
          position('..' in display_path) > 0
          or display_path is distinct from
             'events/' || event_id::text || '/albums/' || album_id::text || '/' || id::text || '/display.webp'
        ))
     or (poster_path is not null and (
          position('..' in poster_path) > 0
          or poster_path is distinct from
             'events/' || event_id::text || '/albums/' || album_id::text || '/' || id::text || '/poster.jpg'
        ));
  if n > 0 then
    raise exception '041 pre-check: % media rows have a path outside their folder', n;
  end if;

  select count(*) into n
  from public.users
  where avatar_url is not null
    and (position('..' in avatar_url) > 0 or avatar_url !~ ('^avatars/' || id::text || '/[^/]+$'));
  if n > 0 then
    raise exception '041 pre-check: % profiles have an avatar_url outside their folder', n;
  end if;
end $$;

create or replace function private.media_object_name_ok(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name in (
    'original.jpg', 'original.jpeg', 'original.png', 'original.heic', 'original.heif', 'original.webp',
    'original.mp4', 'original.mov',
    'thumb.webp', 'display.webp', 'poster.jpg'
  );
$$;

create or replace function private.media_path_owned(
  p_event_id uuid,
  p_album_id uuid,
  p_media_id uuid,
  p_path text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_album_id is not null
    and p_path is not null
    and position('..' in p_path) = 0
    and position('/' in p_path) > 0
    and p_path = 'events/' || p_event_id::text || '/albums/' || p_album_id::text || '/' || p_media_id::text || '/'
      || regexp_replace(p_path, '^.*/', '')
    and private.media_object_name_ok(regexp_replace(p_path, '^.*/', ''));
$$;

create or replace function private.guard_media_object_paths()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.media_path_owned(new.event_id, new.album_id, new.id, new.storage_path)
     or (new.thumb_path is not null and not private.media_path_owned(new.event_id, new.album_id, new.id, new.thumb_path))
     or (new.display_path is not null and not private.media_path_owned(new.event_id, new.album_id, new.id, new.display_path))
     or (new.poster_path is not null and not private.media_path_owned(new.event_id, new.album_id, new.id, new.poster_path))
  then
    raise exception 'media paths must stay in this photo''s folder' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.media_object_name_ok(text) from public, anon, authenticated;
revoke execute on function private.media_path_owned(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.guard_media_object_paths() from public, anon, authenticated;

drop trigger if exists media_object_paths_guard on public.media;
create trigger media_object_paths_guard
  before insert or update on public.media
  for each row execute function private.guard_media_object_paths();

create or replace function private.guard_user_avatar_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.avatar_url is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url then
    return new;
  end if;
  if position('..' in new.avatar_url) = 0
     and new.avatar_url ~ ('^avatars/' || new.id::text || '/[^/]+$')
  then
    return new;
  end if;
  raise exception 'avatar_url must stay under this profile' using errcode = '23514';
end;
$$;

revoke execute on function private.guard_user_avatar_path() from public, anon, authenticated;

drop trigger if exists user_avatar_path_guard on public.users;
create trigger user_avatar_path_guard
  before insert or update on public.users
  for each row execute function private.guard_user_avatar_path();

commit;
