-- face_stats is written by the face worker (service role). Migration 038
-- guarded UPDATE only. authenticated still has table-level INSERT on media,
-- so an uploader could insert a row with any face_stats they liked.
--
-- The same function now runs BEFORE INSERT OR UPDATE. An authenticated
-- insert that sets face_stats is refused, the same way an authenticated
-- update already was. service_role is not 'authenticated', so the worker's
-- update still lands. 038 is already applied; this file does not use
-- anything from 039.
--
-- Idempotent. lock_timeout so a busy media table fails fast instead of
-- waiting on the AccessExclusiveLock that DROP/CREATE TRIGGER takes.

set lock_timeout = '5s';

create or replace function private.guard_media_face_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.face_stats is not null then
        raise exception 'face_stats is set by the server' using errcode = '42501';
      end if;
    elsif new.face_stats is distinct from old.face_stats then
      raise exception 'face_stats is set by the server' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_media_face_stats() from public, anon, authenticated;

drop trigger if exists media_face_stats_guard on public.media;
create trigger media_face_stats_guard
  before insert or update on public.media
  for each row execute function private.guard_media_face_stats();
