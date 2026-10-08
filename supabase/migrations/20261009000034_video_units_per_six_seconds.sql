-- Video counts by length at 1 photo per started 6 seconds (owner decision,
-- 9 Oct 2026). A minute still counts as 10 and two minutes as 20, so the
-- pricing copy holds, but a 4 second clip now counts as 1, not 10. A video
-- whose length isn't known yet counts as a minute until it is.
create or replace function private.media_units(p_kind text, p_duration numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kind = 'video' then greatest(1, ceil(coalesce(p_duration, 60) / 6.0))::int
    else 1
  end;
$$;

-- The insert check can't know a video's length, so it counts a minute. When
-- the upload finishes and the real length arrives, check again: a nine minute
-- video must not slip past the allowance. Only for files still finishing;
-- filling in the length of a file that's already live (the server-side
-- preview job) never takes it away.
create or replace function private.guard_video_length()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_others int;
begin
  if new.kind <> 'video' or old.status = 'ready' or new.status = 'failed' then
    return new;
  end if;
  if private.media_units(new.kind, new.duration_seconds) <= private.media_units(old.kind, old.duration_seconds) then
    return new;
  end if;
  select photo_limit into v_limit from public.events where id = new.event_id;
  if v_limit is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('photos:' || new.event_id::text, 0));
  select coalesce(sum(private.media_units(m.kind, m.duration_seconds)), 0)::int into v_others
  from public.media m
  where m.event_id = new.event_id
    and m.id <> new.id
    and m.deleted_at is null
    and m.status <> 'failed'
    and (m.status <> 'processing' or m.updated_at > now() - interval '1 hour');
  if v_others + private.media_units(new.kind, new.duration_seconds) > v_limit then
    raise exception 'This video is too long for what is left of the photo allowance.' using errcode = 'KB001';
  end if;
  return new;
end;
$$;

drop trigger if exists media_video_length on public.media;
create trigger media_video_length
  before update of duration_seconds on public.media
  for each row execute function private.guard_video_length();
