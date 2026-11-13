-- Two additions. The code that uses them works before this is applied (it
-- falls back, and skips the write), so this can go in before or after deploy.

-- ---------------------------------------------------------------------------
-- 1. Credits without reading every row
--
-- The album page read photographer_name and uploaded_by for up to 1,000 and
-- 400 media rows to build "by Jane Citizen and Sam Lee", and the event home
-- read up to 2,000. Each took about 200 ms on a 965 photo album, and names
-- past the cap were silently missed. These return the distinct values.
-- security invoker: row level security decides what the caller can see,
-- exactly as it did for the plain selects.
-- ---------------------------------------------------------------------------
create or replace function public.album_credits(p_album_id uuid)
returns table (photographer_names text[], uploader_ids uuid[])
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(array_agg(distinct btrim(m.photographer_name)) filter (where nullif(btrim(m.photographer_name), '') is not null), '{}'),
    coalesce(array_agg(distinct m.uploaded_by) filter (where m.uploaded_by is not null), '{}')
  from public.media m
  where m.album_id = p_album_id;
$$;
revoke execute on function public.album_credits(uuid) from public, anon;
grant execute on function public.album_credits(uuid) to authenticated, service_role;

create or replace function public.event_photographers(p_event_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(distinct btrim(m.photographer_name)) filter (where nullif(btrim(m.photographer_name), '') is not null), '{}')
  from public.media m
  where m.event_id = p_event_id;
$$;
revoke execute on function public.event_photographers(uuid) from public, anon;
grant execute on function public.event_photographers(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. What face indexing saw in each photo
--
-- In the first real event only about 15% of photos kept a face, and nothing
-- recorded why the rest kept none: no face at all, too small, too soft, too
-- dark, or refused by Rekognition's own quality filter. This holds the counts
-- (no faceprints, no boxes), so the floors in lib/faces/constants.ts can be
-- tuned on evidence. Written by the face worker with the service role.
--   { "v": 1, "kept": 1, "small": 2, "soft": 0, "dark": 0,
--     "unindexed": 3, "reasons": { "SMALL_BOUNDING_BOX": 2, "LOW_SHARPNESS": 1 } }
-- ---------------------------------------------------------------------------
alter table public.media add column if not exists face_stats jsonb;

create or replace function private.guard_media_face_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.face_stats is distinct from old.face_stats then
    raise exception 'face_stats is set by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_media_face_stats() from public, anon, authenticated;

drop trigger if exists media_face_stats_guard on public.media;
create trigger media_face_stats_guard
  before update on public.media
  for each row execute function private.guard_media_face_stats();
