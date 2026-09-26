-- An enrolling member was queued behind the entire backfill.
--
-- claim_face_jobs ordered strictly by id, so the enrol job created when
-- someone hands over their selfie sat behind every index job queued before
-- it. Turning the feature on for a 110 photo club and enrolling immediately
-- put the enrolment 95 photos deep; on a club with thousands it would be days
-- before the member saw anything, having been told "this takes a minute".
--
-- Enrolment now jumps the queue. It is one Rekognition call and it is the
-- only job a human is actually waiting on — everything else is background
-- work whose whole point is that nobody is watching it.

create or replace function public.claim_face_jobs(batch_size int)
returns setof public.face_jobs
language sql
security definer
set search_path = ''
as $$
  update public.face_jobs
  set status = 'running', attempts = attempts + 1, updated_at = now()
  where id in (
    select id from public.face_jobs
    where (status = 'pending' and run_after <= now())
       or (status = 'running' and updated_at < now() - interval '10 minutes')
    order by (kind <> 'enrol_profile'), id
    limit batch_size
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_face_jobs(int) from public, anon, authenticated;

-- The claim now sorts on kind as well, so give it an index that matches.
create index if not exists face_jobs_priority_idx
  on public.face_jobs ((kind <> 'enrol_profile'), id)
  where status = 'pending';
