-- A claimed job that never finishes was invisible and permanent.
--
-- claim_face_jobs only ever looked at status = 'pending', so a job whose
-- function timed out, was redeployed under, or simply crashed stayed 'running'
-- for ever: never retried, never failed, never reported. Three of them turned
-- up within an hour of the first real backfill.
--
-- A job is now reclaimable once it has sat in 'running' longer than any single
-- run could legitimately take. maxDuration on the cron route is 300 seconds,
-- so ten minutes is comfortably past "still working" and well short of making
-- a stuck photo wait.
--
-- attempts still increments on the reclaim, so a job that reliably kills its
-- worker eventually gives up rather than looping for ever.

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
    order by id
    limit batch_size
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_face_jobs(int) from public, anon, authenticated;

-- The claim index covered (status, run_after, id); reclaiming also reads
-- updated_at for running rows.
create index if not exists face_jobs_stale_idx on public.face_jobs (updated_at)
  where status = 'running';
