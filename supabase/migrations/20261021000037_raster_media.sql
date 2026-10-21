-- ---------------------------------------------------------------------------
-- Logos and covers can no longer be pointed at a new SVG from the browser
-- ---------------------------------------------------------------------------
--
-- events.logo_path was granted to authenticated, and events_update lets an
-- event admin change the row. Storage had no MIME allow-list, so that admin
-- could upload an SVG into event_media and set logo_path themselves, skipping
-- setEventLogoAction. Album covers had the same hole: albums_update is not
-- column-scoped, and AlbumEditPanel only checks the file type in the browser.
--
-- logo_path is now written by the service role, after the action has checked
-- the caller runs the event. cover_path stays a normal column for reads, but
-- a trigger refuses changes from the authenticated role. Both columns grow a
-- trigger, not a check constraint: a NOT VALID check still fires on every
-- later UPDATE of a row that already holds an .svg path, including a service
-- role update of an unrelated column (Stripe, backup, retention, notify,
-- scheduled publish, bin restore). The uploader accepted SVG until the logo
-- gate, so those rows may exist. The triggers look at the path only when it
-- is set or changed, and leave an old value in place. They do not null it.
--
-- The cover guard is security invoker and asks current_user, the same as
-- decision 16 and migration 25. A definer function's current role is its
-- owner, so asking the role from inside one would pass every caller.
--
-- The bucket allow-list is every Content-Type the app actually uploads:
--   image/jpeg       photos, video posters, face selfies, JPG logos and covers
--   image/png        PNG logos, covers and avatars
--   image/webp       display/thumb derivatives, logo marks, WebP logos and covers
--   image/heic       iPhone originals (tus metadata contentType, and signed PUT)
--   image/heif       the same originals when the type is reported as HEIF
--   video/mp4        gallery video
--   video/quicktime  .mov gallery video
-- Browsers often send an empty type for HEIC and MOV; the client resolves the
-- extension to one of the types above before the upload, including tus.
-- image/svg+xml is not on the list.
--
-- Ship the app first, then apply this file by hand. The new actions write
-- these columns with the service role; applying this first stops logo saves
-- and cover changes until that code is live.
--
-- Drop the check constraints from an earlier draft of this file, if that
-- draft was applied locally. They are what broke unrelated updates.

alter table public.events drop constraint if exists events_logo_path_raster;
alter table public.albums drop constraint if exists albums_cover_path_raster;

revoke update (logo_path) on table public.events from authenticated;

create or replace function private.guard_event_logo_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Name, billing, backup and retention updates do not touch an old path.
  if tg_op = 'UPDATE' and new.logo_path is not distinct from old.logo_path then
    return new;
  end if;

  if new.logo_path is not null and new.logo_path !~ '\.(png|jpe?g|webp)$' then
    raise exception 'logo_path must be a png, jpg, jpeg or webp' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_event_logo_path() from public, anon, authenticated;

drop trigger if exists guard_event_logo_path on public.events;
create trigger guard_event_logo_path
  before insert or update on public.events
  for each row execute function private.guard_event_logo_path();

-- Replace the earlier security-definer draft, if it was applied locally.
drop trigger if exists guard_album_cover_path on public.albums;
drop function if exists private.guard_album_cover_path();

create function private.guard_album_cover_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.cover_path is not distinct from old.cover_path then
    return new;
  end if;

  -- Creating an album does not set a cover. The client inserts null.
  if tg_op = 'INSERT' and new.cover_path is null then
    return new;
  end if;

  -- Service role and migrations may set a raster path, or clear it.
  if current_user <> 'authenticated' then
    if new.cover_path is not null and new.cover_path !~ '\.(png|jpe?g|webp)$' then
      raise exception 'cover_path must be a png, jpg, jpeg or webp' using errcode = '23514';
    end if;
    return new;
  end if;

  raise exception 'cover_path is set by the server' using errcode = '42501';
end;
$$;

revoke execute on function private.guard_album_cover_path() from public, anon, authenticated;

create trigger guard_album_cover_path
  before insert or update on public.albums
  for each row execute function private.guard_album_cover_path();

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime'
]
where id = 'event_media';
