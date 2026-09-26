-- Klubbies v1 schema: tables, helpers, RLS, storage bucket and policies.

create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext unique not null,
  display_name text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  handle extensions.citext unique not null
    check (handle::text ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(handle::text) <= 48),
  name text not null check (char_length(name) between 1 and 120),
  organisation text check (char_length(organisation) <= 160),
  description text check (char_length(description) <= 1000),
  logo_path text,
  accent_colour text check (accent_colour ~ '^#[0-9a-fA-F]{6}$'),
  roster_mapping jsonb,
  created_by uuid references public.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Left behind when a super admin changes a handle, so shared links never rot.
create table public.club_handle_redirects (
  old_handle extensions.citext primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  roster_email extensions.citext not null,
  roster_name text not null check (char_length(roster_name) between 1 and 200),
  claimed_name text,
  name_mismatch boolean not null default false,
  role text not null default 'club_member' check (role in ('club_admin', 'club_member')),
  status text not null default 'pending' check (status in ('pending', 'active', 'grace', 'revoked')),
  invited_at timestamptz,
  first_seen_at timestamptz,
  grace_started_at timestamptz,
  grace_ends_at timestamptz,
  grace_notices_sent smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, roster_email)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_email_idx on public.memberships (roster_email);
create index memberships_grace_idx on public.memberships (grace_ends_at) where status = 'grace';

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  event_date date,
  cover_media_id uuid,
  visibility text not null default 'members' check (visibility in ('members', 'admins')),
  allow_download boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index albums_club_idx on public.albums (club_id, event_date desc nulls last, created_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  album_id uuid references public.albums (id) on delete set null,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  thumb_path text,
  display_path text,
  poster_path text,
  width int,
  height int,
  duration_seconds numeric,
  byte_size bigint,
  mime_type text,
  original_filename text,
  captured_at timestamptz,
  uploaded_by uuid references public.users (id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_album_idx on public.media (album_id, captured_at, created_at);
create index media_club_idx on public.media (club_id, created_at);

alter table public.albums
  add constraint albums_cover_media_fk foreign key (cover_media_id)
  references public.media (id) on delete set null;

create table public.access_events (
  id bigint generated always as identity primary key,
  club_id uuid references public.clubs (id) on delete cascade,
  membership_id uuid references public.memberships (id) on delete set null,
  media_id uuid references public.media (id) on delete set null,
  action text not null check (action in ('view', 'download', 'zip')),
  ip_hash text,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index access_events_club_idx on public.access_events (club_id, occurred_at desc);

create table public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  filename text,
  status text not null default 'preview' check (status in ('preview', 'committed')),
  row_count int,
  matched_count int,
  added_count int,
  error_count int,
  report jsonb,
  mapping jsonb,
  imported_by uuid references public.users (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index roster_imports_club_idx on public.roster_imports (club_id, imported_at desc);

-- Server-only support tables for the sign-in flow.
create table public.auth_rate_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auth_rate_events_lookup_idx on public.auth_rate_events (bucket, key_hash, occurred_at);

create table public.pending_sign_ins (
  email extensions.citext primary key,
  claimed_name text,
  flow text not null check (flow in ('member', 'create')),
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'clubs', 'club_handle_redirects', 'memberships', 'albums', 'media',
    'access_events', 'roster_imports', 'auth_rate_events', 'pending_sign_ins'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.media_album_same_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.album_id is not null and not exists (
    select 1 from public.albums a where a.id = new.album_id and a.club_id = new.club_id
  ) then
    raise exception 'album does not belong to this club';
  end if;
  return new;
end;
$$;

create trigger media_album_same_club
  before insert or update of album_id, club_id on public.media
  for each row execute function public.media_album_same_club();

-- ---------------------------------------------------------------------------
-- Authorisation helpers. Every policy goes through these.
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_super_admin from public.users u where u.id = auth.uid()), false);
$$;

create or replace function public.is_club_admin(club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.memberships m
    where m.club_id = is_club_admin.club_id
      and m.user_id = auth.uid()
      and m.role = 'club_admin'
      and m.status = 'active'
  );
$$;

create or replace function public.is_club_member(club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.memberships m
    where m.club_id = is_club_member.club_id
      and m.user_id = auth.uid()
      and (m.status = 'active' or (m.status = 'grace' and m.grace_ends_at > now()))
  );
$$;

-- True when the requester may see a club item created at `created_at`:
-- admins and active members always, grace members only for items that
-- existed before their removal.
create or replace function public.can_view_club_item(club_id uuid, created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_club_admin(can_view_club_item.club_id) or exists (
    select 1 from public.memberships m
    where m.club_id = can_view_club_item.club_id
      and m.user_id = auth.uid()
      and (
        m.status = 'active'
        or (
          m.status = 'grace'
          and m.grace_ends_at > now()
          and can_view_club_item.created_at < m.grace_started_at
        )
      )
  );
$$;

create or replace function public.storage_club_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^clubs/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then (string_to_array(object_name, '/'))[2]::uuid
  end;
$$;

create or replace function public.storage_media_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when object_name ~ '^clubs/[0-9a-f-]{36}/albums/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then (string_to_array(object_name, '/'))[5]::uuid
  end;
$$;

-- Club creation: any signed-in user, who becomes the club's first admin.
-- The handle base is generated in TypeScript (lib/roster/handle.ts); this
-- function only resolves collisions with _2, _3, ...
create or replace function public.create_club(
  p_name text,
  p_handle_base text,
  p_organisation text,
  p_description text
)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.users;
  v_handle text;
  v_n int := 1;
  v_club public.clubs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_user from public.users where id = v_uid;
  if v_user.id is null then
    raise exception 'user profile missing' using errcode = '42501';
  end if;

  if p_handle_base !~ '^[a-z0-9]+(_[a-z0-9]+)*$' then
    raise exception 'invalid handle base';
  end if;

  v_handle := p_handle_base;
  while exists (select 1 from public.clubs c where c.handle::text = v_handle)
     or exists (select 1 from public.club_handle_redirects r where r.old_handle::text = v_handle) loop
    v_n := v_n + 1;
    v_handle := p_handle_base || '_' || v_n;
  end loop;

  insert into public.clubs (handle, name, organisation, description, created_by)
  values (v_handle, p_name, nullif(trim(p_organisation), ''), nullif(trim(p_description), ''), v_uid)
  returning * into v_club;

  insert into public.memberships (
    club_id, user_id, roster_email, roster_name, role, status, invited_at, first_seen_at
  ) values (
    v_club.id, v_uid, v_user.email::text,
    coalesce(nullif(v_user.display_name, ''), split_part(v_user.email::text, '@', 1)),
    'club_admin', 'active', now(), now()
  );

  return v_club;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.club_storage_usage
with (security_invoker = true) as
select
  m.club_id,
  count(*)::bigint as item_count,
  coalesce(sum(m.byte_size), 0)::bigint as total_bytes
from public.media m
group by m.club_id;

create view public.album_media_counts
with (security_invoker = true) as
select
  m.album_id,
  count(*) filter (where m.kind = 'photo')::int as photo_count,
  count(*) filter (where m.kind = 'video')::int as video_count,
  (array_agg(m.id order by coalesce(m.captured_at, m.created_at)))[1] as first_media_id
from public.media m
where m.status = 'ready' and m.album_id is not null
group by m.album_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.clubs enable row level security;
alter table public.club_handle_redirects enable row level security;
alter table public.memberships enable row level security;
alter table public.albums enable row level security;
alter table public.media enable row level security;
alter table public.access_events enable row level security;
alter table public.roster_imports enable row level security;
alter table public.auth_rate_events enable row level security;
alter table public.pending_sign_ins enable row level security;

-- users
create policy users_select_self on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- clubs
create policy clubs_select on public.clubs
  for select to authenticated using (public.is_club_member(id));
create policy clubs_update on public.clubs
  for update to authenticated
  using (public.is_club_admin(id)) with check (public.is_club_admin(id));

-- memberships
create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_club_admin(club_id));
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy memberships_update on public.memberships
  for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy memberships_delete on public.memberships
  for delete to authenticated using (public.is_club_admin(club_id));

-- albums
create policy albums_select on public.albums
  for select to authenticated
  using (
    public.is_club_admin(club_id)
    or (
      status = 'published'
      and visibility = 'members'
      and public.can_view_club_item(club_id, created_at)
    )
  );
create policy albums_insert on public.albums
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy albums_update on public.albums
  for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy albums_delete on public.albums
  for delete to authenticated using (public.is_club_admin(club_id));

-- media
create policy media_select on public.media
  for select to authenticated
  using (
    public.is_club_admin(club_id)
    or (
      status = 'ready'
      and public.can_view_club_item(club_id, created_at)
      and exists (
        select 1 from public.albums a
        where a.id = media.album_id
          and a.status = 'published'
          and a.visibility = 'members'
      )
    )
  );
create policy media_insert on public.media
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy media_update on public.media
  for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy media_delete on public.media
  for delete to authenticated using (public.is_club_admin(club_id));

-- access_events: inserted by the server only; club admins read their log.
create policy access_events_select_admin on public.access_events
  for select to authenticated using (public.is_club_admin(club_id));

-- roster_imports
create policy roster_imports_select on public.roster_imports
  for select to authenticated using (public.is_club_admin(club_id));
create policy roster_imports_insert on public.roster_imports
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy roster_imports_update on public.roster_imports
  for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- club_handle_redirects, auth_rate_events, pending_sign_ins: no client policies.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

revoke insert, update, delete on public.users from authenticated;
grant update (display_name, avatar_url) on public.users to authenticated;

revoke insert, update, delete on public.clubs from authenticated;
grant update (name, organisation, description, logo_path, accent_colour, roster_mapping)
  on public.clubs to authenticated;

revoke all on public.access_events from authenticated;
grant select on public.access_events to authenticated;

revoke all on public.club_handle_redirects, public.auth_rate_events, public.pending_sign_ins
  from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_super_admin(),
  public.is_club_admin(uuid),
  public.is_club_member(uuid),
  public.can_view_club_item(uuid, timestamptz),
  public.storage_club_id(text),
  public.storage_media_id(text),
  public.create_club(text, text, text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, access mirrors media visibility.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('club_media', 'club_media', false)
on conflict (id) do update set public = false;

create policy club_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club_media'
    and (
      public.is_club_admin(public.storage_club_id(name))
      or exists (
        select 1 from public.media m
        where m.id = public.storage_media_id(name)
          and name like ('clubs/' || m.club_id || '/albums/' || m.album_id || '/' || m.id || '/%')
      )
      or (
        name ~ '^clubs/[0-9a-f-]{36}/logo/'
        and public.is_club_member(public.storage_club_id(name))
      )
    )
  );

create policy club_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club_media' and public.is_club_admin(public.storage_club_id(name)));

create policy club_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'club_media' and public.is_club_admin(public.storage_club_id(name)))
  with check (bucket_id = 'club_media' and public.is_club_admin(public.storage_club_id(name)));

create policy club_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'club_media' and public.is_club_admin(public.storage_club_id(name)));
