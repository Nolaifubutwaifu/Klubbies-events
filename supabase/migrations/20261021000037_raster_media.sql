-- ---------------------------------------------------------------------------
-- Logos and covers can no longer be pointed at an SVG from the browser
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
-- NOT VALID check so a path has to end in png, jpg, jpeg or webp. NOT VALID
-- leaves rows already stored (an old .svg logo) in place; the next update of
-- that row will fail until the path is cleared or replaced.
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

revoke update (logo_path) on table public.events from authenticated;

alter table public.events
  add constraint events_logo_path_raster
  check (logo_path ~ '\.(png|jpe?g|webp)$') not valid;

alter table public.albums
  add constraint albums_cover_path_raster
  check (cover_path ~ '\.(png|jpe?g|webp)$') not valid;

create or replace function private.guard_album_cover_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role and migrations pass. Signed-in clients do not set the path.
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.cover_path is not null then
      raise exception 'cover_path is set by the server' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.cover_path is distinct from old.cover_path then
    raise exception 'cover_path is set by the server' using errcode = '42501';
  end if;

  return new;
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
