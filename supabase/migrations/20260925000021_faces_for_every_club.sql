-- Face recognition for every club.
--
-- Until now it was admin opt-in per club (DECISIONS 80 onwards). Max has
-- decided it is on everywhere: every existing club that never made a choice,
-- and every club from here on. A club whose admin has turned it off keeps it
-- off; that row already exists with enabled = false and is left alone, and the
-- switch in Billing & settings still works both ways.
--
-- notice_version records that Klubbies turned it on rather than a committee
-- accepting the notice (notice_accepted_by stays null). Members are still told
-- and must acknowledge before anything else (DECISIONS 100), and enrolment is
-- still each member's own choice.
--
-- collection_id stays null here because the Rekognition prefix is an
-- environment variable the database can't see. The job drain creates the
-- collection the first time it works for a club and records it
-- (lib/faces/jobs.ts), so nothing here calls AWS.

-- Existing clubs that never decided: on, with their library queued.
with rolled_out as (
  insert into public.club_face_settings (club_id, enabled, notice_version, backfill_status, backfill_queued_at)
  select c.id, true, 'klubbies-rollout-2026-09-25', 'queued', now()
  from public.clubs c
  where not exists (select 1 from public.club_face_settings s where s.club_id = c.id)
  returning club_id
)
insert into public.face_jobs (club_id, media_id, kind)
select m.club_id, m.id, 'index_media'
from public.media m
join rolled_out r on r.club_id = m.club_id
where m.status = 'ready'
  and m.kind = 'photo'
  and not exists (
    select 1 from public.face_jobs j
    where j.media_id = m.id and j.kind = 'index_media' and j.status in ('pending', 'running')
  );

-- Every new club starts with it on. A trigger rather than a change to
-- create_club, so any path that makes a club is covered.
create or replace function private.club_faces_on_by_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_face_settings (club_id, enabled, notice_version)
  values (new.id, true, 'klubbies-rollout-2026-09-25')
  on conflict (club_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.club_faces_on_by_default() from public, anon, authenticated;

create trigger clubs_faces_on_by_default
  after insert on public.clubs
  for each row execute function private.club_faces_on_by_default();
