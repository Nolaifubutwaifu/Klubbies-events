-- face_stats is written by the face worker (service role). Migration 038
-- guarded UPDATE only. authenticated still has table-level INSERT on media,
-- so an uploader could insert a row with any face_stats they liked.
--
-- The same function now runs BEFORE INSERT OR UPDATE. Only service_role,
-- postgres and supabase_admin may set or change face_stats, the same
-- allowlist as the cover_path guard (migration 037). anon and authenticated
-- may insert or update a row only when face_stats stays null / unchanged.
-- 038 is already applied; this file does not use anything from 039.
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
  -- A row that does not touch face_stats is fine for every role.
  if tg_op = 'UPDATE' and new.face_stats is not distinct from old.face_stats then
    return new;
  end if;
  if tg_op = 'INSERT' and new.face_stats is null then
    return new;
  end if;

  -- The face worker connects as service_role. Migrations and the table
  -- owner connect as postgres or supabase_admin. Everyone else is refused.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  raise exception 'face_stats is set by the server' using errcode = '42501';
end;
$$;

revoke execute on function private.guard_media_face_stats() from public, anon, authenticated;

drop trigger if exists media_face_stats_guard on public.media;
create trigger media_face_stats_guard
  before insert or update on public.media
  for each row execute function private.guard_media_face_stats();
