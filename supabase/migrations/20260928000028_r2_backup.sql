-- A second copy of every original, its previews and each event logo in
-- Cloudflare R2 (docs/handoff-retention-backups.md, phase 2). The copy is
-- also what guests download from. Keys in R2 are the same paths as in
-- Supabase Storage, so a restore needs no lookup table.
--
-- Selfies and faceprints are never copied: face data exists in one place.

alter table public.media
  -- Every file of this item (original and previews) is in R2.
  add column backed_up_at timestamptz,
  add column backup_attempts int not null default 0,
  add column backup_error text,
  -- Too big to copy inside a web request; `pnpm backup-drain` finishes it.
  add column backup_deferred_at timestamptz;

create index media_backup_pending_idx on public.media (created_at)
  where backed_up_at is null and status = 'ready';

alter table public.events
  -- The logo path that was last copied; a new logo differs and is copied again.
  add column logo_backed_up_path text;

-- When a file leaves Supabase for good, its copy in R2 goes 30 days later, so
-- a mistake found within the month can still be undone from the backup.
create table public.backup_purge_queue (
  key text primary key,
  due_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index backup_purge_queue_due_idx on public.backup_purge_queue (due_at);

alter table public.backup_purge_queue enable row level security;
revoke all on public.backup_purge_queue from anon, authenticated;

-- Organisers never write backup bookkeeping through the API. The media guard
-- (migration 26) already stops uploaders; this stops managers too.
create or replace function private.guard_media_backup_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.backed_up_at, new.backup_attempts, new.backup_error, new.backup_deferred_at)
         is distinct from (old.backed_up_at, old.backup_attempts, old.backup_error, old.backup_deferred_at) then
    raise exception 'backup columns are set by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_media_backup_columns() from public, anon, authenticated;

create trigger media_backup_columns_guard
  before update on public.media
  for each row execute function private.guard_media_backup_columns();

-- The monthly check: which of these event ids no longer exist.
create or replace function public.missing_events(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.event_id from unnest(p_ids) as t(event_id)
  where not exists (select 1 from public.events e where e.id = t.event_id);
$$;
revoke execute on function public.missing_events(uuid[]) from public, anon, authenticated;
grant execute on function public.missing_events(uuid[]) to service_role;
