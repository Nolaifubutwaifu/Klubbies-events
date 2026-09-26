-- Opt-in face recognition. Rekognition holds the faceprints; Postgres holds
-- ids and decisions only, so there is no pgvector and no biometric data in
-- this database beyond an opaque AWS face id.
--
-- Three things shape the schema:
--
--   * Every face in club media is indexed, not only enrolled members'. That
--     makes deletion hygiene mandatory: a faceprint left in AWS after its row
--     is gone is a compliance failure nothing in Postgres will ever report.
--     face_purge_queue plus a `before delete` trigger is the answer, because
--     an `after` trigger or application cleanup loses the ids the moment a
--     parent row cascades.
--   * Only enrolled members can ever be named, and only to themselves. That
--     guarantee lives in RLS, not in application code: media_faces has no
--     member policy at all, so nobody can correlate face ids across photos to
--     work out who else is in them.
--   * A member's "Not me" has to outlive a re-index. face_matches cascades
--     from media_faces, so re-indexing a photo would forget every rejection
--     and suggest it again. face_rejections is keyed on (profile, media),
--     which survives, and the matcher consults it before writing.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Per-club switch. One row per club that has ever considered the feature.
create table public.club_face_settings (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  enabled boolean not null default false,
  -- {prefix}-club-{clubId}. Kept here rather than derived, so a prefix change
  -- can never orphan a live collection.
  collection_id text,
  notice_accepted_at timestamptz,
  notice_accepted_by uuid references public.users (id) on delete set null,
  notice_version text,
  backfill_status text not null default 'idle'
    check (backfill_status in ('idle', 'queued', 'running', 'done')),
  backfill_queued_at timestamptz,
  backfill_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per face Rekognition found and kept in a club photo. Guests and
-- non-enrolled members have rows here; that is the point of the club notice.
create table public.media_faces (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  -- Denormalised so the purge trigger has everything it needs without
  -- reaching for club_face_settings while a cascade is in flight.
  collection_id text not null,
  rekognition_face_id text not null,
  bounding_box jsonb not null,           -- Left/Top/Width/Height, 0..1
  confidence numeric,
  sharpness numeric,
  brightness numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, rekognition_face_id)
);
create index media_faces_media_idx on public.media_faces (media_id);

-- One row per member who has enrolled, per club. Consent is per club because
-- collections are per club.
create table public.member_face_profiles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  -- Outside the clubs/ prefix on purpose: everything under clubs/ is reachable
  -- by that club's committee, and a selfie is not theirs to see.
  selfie_path text,
  consented_at timestamptz not null default now(),
  consent_version text not null,
  failure_reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id)
);
create index member_face_profiles_user_idx on public.member_face_profiles (user_id, club_id);

-- The faces a profile is matched against: the enrolment selfie, plus every
-- match the member has confirmed. More references, better recognition.
create table public.member_face_references (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.member_face_profiles (id) on delete cascade,
  collection_id text not null,
  rekognition_face_id text not null,
  source text not null check (source in ('selfie', 'confirmed_match')),
  quality numeric,
  media_id uuid references public.media (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (club_id, rekognition_face_id)
);
create index member_face_references_profile_idx
  on public.member_face_references (profile_id, created_at desc);

-- The join between a face in a photo and a member who might be it.
create table public.face_matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  -- Denormalised on purpose: the "Photos of you" grid filters by media_id
  -- constantly and should never join through media_faces to do it.
  media_id uuid not null references public.media (id) on delete cascade,
  media_face_id uuid not null references public.media_faces (id) on delete cascade,
  profile_id uuid not null references public.member_face_profiles (id) on delete cascade,
  similarity numeric not null,
  state text not null default 'suggested'
    check (state in ('confirmed', 'suggested', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_face_id, profile_id)
);
create index face_matches_profile_idx
  on public.face_matches (profile_id, state, created_at desc);
create index face_matches_media_idx on public.face_matches (media_id, state);

-- "Not me", kept on the one pair that survives a re-index. A member saying
-- they are not in a photo is a statement about the photo, not about the face
-- record that happened to trigger the question.
create table public.face_rejections (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.member_face_profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, media_id)
);

-- Work queue. bigint identity rather than uuid so `order by id` in the claim
-- function is a real FIFO.
create table public.face_jobs (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  kind text not null check (kind in ('index_media', 'rematch_media', 'enrol_profile')),
  media_id uuid references public.media (id) on delete cascade,
  profile_id uuid references public.member_face_profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind in ('index_media', 'rematch_media') and media_id is not null and profile_id is null)
    or (kind = 'enrol_profile' and profile_id is not null and media_id is null)
  )
);
-- The drain reads this every run, so it wants to be a single index scan.
create index face_jobs_claim_idx on public.face_jobs (status, run_after, id);
-- The same photo, or the same profile, is never queued twice while its job is
-- still alive. Backfill leans on this: the insert-select is `on conflict do
-- nothing` and re-running it is free.
create unique index face_jobs_media_live_idx on public.face_jobs (media_id, kind)
  where status in ('pending', 'running') and media_id is not null;
create unique index face_jobs_profile_live_idx on public.face_jobs (profile_id)
  where status in ('pending', 'running') and profile_id is not null;
create index face_jobs_club_idx on public.face_jobs (club_id, status);

-- Faceprints awaiting deletion in AWS. Filled by trigger, never by hand, so a
-- cascade cannot lose the ids before anyone notices the rows are gone.
create table public.face_purge_queue (
  id bigint generated always as identity primary key,
  collection_id text not null,
  rekognition_face_id text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, rekognition_face_id)
);

do $$
declare t text;
begin
  foreach t in array array[
    'club_face_settings', 'media_faces', 'member_face_profiles', 'face_matches', 'face_jobs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Purge triggers
-- ---------------------------------------------------------------------------

-- Before, not after: by the time an `after` trigger or the application looks,
-- a cascade from media or clubs has already taken the row and its face id.
create or replace function private.queue_face_for_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.face_purge_queue (collection_id, rekognition_face_id)
  values (old.collection_id, old.rekognition_face_id)
  on conflict (collection_id, rekognition_face_id) do nothing;
  return old;
end;
$$;

create trigger media_faces_purge before delete on public.media_faces
  for each row execute function private.queue_face_for_purge();
create trigger member_face_references_purge before delete on public.member_face_references
  for each row execute function private.queue_face_for_purge();

-- ---------------------------------------------------------------------------
-- Claiming work
-- ---------------------------------------------------------------------------

-- Supabase JS cannot express `for update skip locked`, so the drain claims
-- through this. It lives in public because the service role reaches it over
-- /rest/v1/rpc and the private schema is not exposed there; execute is
-- revoked from everyone else, anon by name (Supabase's default grant is not
-- undone by `revoke from public`).
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
    where status = 'pending' and run_after <= now()
    order by id
    limit batch_size
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_face_jobs(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- "No policy" below means exactly that: RLS is on and nothing matches, so the
-- service role is the only reader. That is what stops a member correlating
-- face ids across photos, and it is the whole privacy guarantee — not a
-- convenience.
-- ---------------------------------------------------------------------------

alter table public.club_face_settings enable row level security;
alter table public.media_faces enable row level security;
alter table public.member_face_profiles enable row level security;
alter table public.member_face_references enable row level security;
alter table public.face_matches enable row level security;
alter table public.face_rejections enable row level security;
alter table public.face_jobs enable row level security;
alter table public.face_purge_queue enable row level security;

-- club_face_settings: members see whether it is on; managers turn it on.
create policy club_face_settings_select on public.club_face_settings
  for select to authenticated using (private.is_club_member(club_id));
create policy club_face_settings_update on public.club_face_settings
  for update to authenticated
  using (private.club_perm(club_id, 'manage_albums'))
  with check (private.club_perm(club_id, 'manage_albums'));

-- The one policy to get exactly right. Both halves are load-bearing: the
-- profile check limits you to your own matches, and the membership check
-- means a revoked or expired member stops seeing them, the way the rest of
-- the app already behaves.
create policy face_matches_select_own on public.face_matches
  for select to authenticated using (
    exists (
      select 1 from public.member_face_profiles p
      where p.id = face_matches.profile_id
        and p.user_id = (select auth.uid())
        and p.revoked_at is null
    )
    and private.is_club_member(face_matches.club_id)
  );

-- Confirming and rejecting are the member's own calls, on their own rows. The
-- state check keeps it to those two verbs: nothing else about a match is
-- editable from a browser.
create policy face_matches_update_own on public.face_matches
  for update to authenticated
  using (
    exists (
      select 1 from public.member_face_profiles p
      where p.id = face_matches.profile_id
        and p.user_id = (select auth.uid())
        and p.revoked_at is null
    )
    and private.is_club_member(face_matches.club_id)
  )
  with check (
    exists (
      select 1 from public.member_face_profiles p
      where p.id = face_matches.profile_id
        and p.user_id = (select auth.uid())
        and p.revoked_at is null
    )
    and state in ('confirmed', 'rejected')
  );

-- A profile is yours to read, create and delete. Deleting is how consent is
-- withdrawn, so it must not need an admin or a support ticket.
create policy member_face_profiles_select_own on public.member_face_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy member_face_profiles_insert_own on public.member_face_profiles
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_club_member(club_id)
    and exists (
      select 1 from public.memberships m
      where m.id = member_face_profiles.membership_id
        and m.user_id = (select auth.uid())
        and m.club_id = member_face_profiles.club_id
    )
    and exists (
      select 1 from public.club_face_settings s
      where s.club_id = member_face_profiles.club_id and s.enabled
    )
  );
create policy member_face_profiles_delete_own on public.member_face_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- Reading your own rejections is how the UI knows not to re-ask; writing one
-- goes through the same server action that updates the match.
create policy face_rejections_select_own on public.face_rejections
  for select to authenticated using (
    exists (
      select 1 from public.member_face_profiles p
      where p.id = face_rejections.profile_id and p.user_id = (select auth.uid())
    )
  );

-- media_faces, member_face_references, face_jobs, face_purge_queue: no policy.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table
  public.club_face_settings, public.media_faces, public.member_face_profiles,
  public.member_face_references, public.face_matches, public.face_rejections,
  public.face_jobs, public.face_purge_queue
from anon;

revoke all on table
  public.media_faces, public.member_face_references,
  public.face_jobs, public.face_purge_queue
from authenticated;

-- A member may say yes or no to a match, and nothing else about it.
revoke insert, delete on table public.face_matches from authenticated;
revoke update on table public.face_matches from authenticated;
grant update (state, decided_at) on table public.face_matches to authenticated;

-- Rejections are written by the server action that decides a match.
revoke insert, update, delete on table public.face_rejections from authenticated;

-- Turning the feature on writes several of these at once, from a server
-- action that has already checked manage_albums.
revoke insert, delete on table public.club_face_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: the enrolment selfie
--
-- Not under clubs/{clubId}/. Every branch of club_media_select that keys off
-- storage_club_id() lets a committee read anything under their own club's
-- prefix, which would make one member's selfie readable by another member of
-- the committee. faces/{membershipId}/selfie.jpg sits outside that prefix and
-- is read and written only with the service role, after the server has
-- checked the membership belongs to the caller.
--
-- The one gap that leaves: storage_club_id() returns null for a faces/ path,
-- and club_perm(null, ...) is true for a super admin, so the platform account
-- could read a selfie. Nothing outside clubs/ was ever meant to match that
-- branch, so it gets the guard it should always have had.
-- ---------------------------------------------------------------------------

drop policy club_media_select on storage.objects;
create policy club_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club_media'
    and (
      name ~ '^avatars/'
      or (
        private.storage_club_id(name) is not null
        and private.club_perm(private.storage_club_id(name), 'manage_albums')
      )
      or exists (
        select 1 from public.media m
        where m.id = private.storage_media_id(name)
          and name like ('clubs/' || m.club_id || '/albums/' || m.album_id || '/' || m.id || '/%')
      )
      or (
        name ~ '^clubs/[0-9a-f-]{36}/(logo|covers)/'
        and private.is_club_member(private.storage_club_id(name))
      )
    )
  );
