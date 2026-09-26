-- Face recognition for every event.
--
-- Until now it was admin opt-in per event (DECISIONS 80 onwards). Max has
-- decided it is on everywhere: every existing event that never made a choice,
-- and every event from here on. A event whose admin has turned it off keeps it
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
-- collection the first time it works for a event and records it
-- (lib/faces/jobs.ts), so nothing here calls AWS.

-- Existing events that never decided: on, with their library queued.
with rolled_out as (
  insert into public.event_face_settings (event_id, enabled, notice_version, backfill_status, backfill_queued_at)
  select c.id, true, 'klubbies-rollout-2026-09-25', 'queued', now()
  from public.events c
  where not exists (select 1 from public.event_face_settings s where s.event_id = c.id)
  returning event_id
)
insert into public.face_jobs (event_id, media_id, kind)
select m.event_id, m.id, 'index_media'
from public.media m
join rolled_out r on r.event_id = m.event_id
where m.status = 'ready'
  and m.kind = 'photo'
  and not exists (
    select 1 from public.face_jobs j
    where j.media_id = m.id and j.kind = 'index_media' and j.status in ('pending', 'running')
  );

-- Every new event starts with it on. A trigger rather than a change to
-- create_event, so any path that makes a event is covered.
create or replace function private.event_faces_on_by_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_face_settings (event_id, enabled, notice_version)
  values (new.id, true, 'klubbies-rollout-2026-09-25')
  on conflict (event_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.event_faces_on_by_default() from public, anon, authenticated;

create trigger events_faces_on_by_default
  after insert on public.events
  for each row execute function private.event_faces_on_by_default();
