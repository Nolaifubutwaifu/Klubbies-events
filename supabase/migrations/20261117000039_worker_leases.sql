-- Single-flight drains and a global Rekognition cap.
--
-- Session advisory locks do not span a drain: PostgREST borrows a pooled
-- connection for each call and returns it when the call ends. A row with an
-- expiry does. Until this file is applied, the app logs once and keeps the
-- previous overlapping behaviour, so a deploy does not have to wait on it.
--
-- Apply in the Supabase SQL editor (project yfdglvhhakbuahyfrihs). Do not
-- apply it from the app, and do not apply 037 or 038 as part of this unless
-- you mean to: this file does not depend on them.

create table public.worker_leases (
  name text primary key,
  holder uuid not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.worker_leases enable row level security;
revoke all on table public.worker_leases from public, anon, authenticated;

-- One row per in-flight Rekognition call. A crashed function holds its slot
-- only until expires_at, then the next acquire deletes it.
create table public.rekognition_slots (
  holder uuid primary key,
  expires_at timestamptz not null
);

alter table public.rekognition_slots enable row level security;
revoke all on table public.rekognition_slots from public, anon, authenticated;

-- True when this holder owns the lease (including a renewal). False when
-- another holder still has it. The same holder may extend it.
create or replace function public.try_worker_lease(p_name text, p_holder uuid, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  got uuid;
begin
  if p_name is null or length(p_name) = 0 or length(p_name) > 64 then
    raise exception 'invalid lease name';
  end if;
  if p_seconds < 5 or p_seconds > 120 then
    raise exception 'lease seconds out of range';
  end if;
  insert into public.worker_leases as l (name, holder, locked_until)
  values (p_name, p_holder, now() + p_seconds * interval '1 second')
  on conflict (name) do update
    set holder = excluded.holder,
        locked_until = excluded.locked_until,
        updated_at = now()
    where l.locked_until < now()
       or l.holder = excluded.holder
  returning l.holder into got;
  return got is not distinct from p_holder;
end;
$$;

create or replace function public.release_worker_lease(p_name text, p_holder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.worker_leases
  set locked_until = now(), updated_at = now()
  where name = p_name and holder = p_holder;
end;
$$;

-- True when this call may talk to Rekognition. Expired slots are dropped
-- first, under a transaction lock so two callers can't both see a free seat.
create or replace function public.try_rekognition_slot(p_holder uuid, p_max int, p_ttl_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_max < 1 or p_max > 32 or p_ttl_seconds < 5 or p_ttl_seconds > 180 then
    raise exception 'slot arguments out of range';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rekognition-slots', 0));
  delete from public.rekognition_slots where expires_at < now();
  select count(*) into n from public.rekognition_slots;
  if n >= p_max and not exists (select 1 from public.rekognition_slots s where s.holder = p_holder) then
    return false;
  end if;
  insert into public.rekognition_slots (holder, expires_at)
  values (p_holder, now() + p_ttl_seconds * interval '1 second')
  on conflict (holder) do update set expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.release_rekognition_slot(p_holder uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rekognition_slots where holder = p_holder;
$$;

revoke all on function public.try_worker_lease(text, uuid, int) from public, anon, authenticated;
revoke all on function public.release_worker_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.try_rekognition_slot(uuid, int, int) from public, anon, authenticated;
revoke all on function public.release_rekognition_slot(uuid) from public, anon, authenticated;

grant execute on function public.try_worker_lease(text, uuid, int) to service_role;
grant execute on function public.release_worker_lease(text, uuid) to service_role;
grant execute on function public.try_rekognition_slot(uuid, int, int) to service_role;
grant execute on function public.release_rekognition_slot(uuid) to service_role;
