-- v2: club roles with permissions, album contributions and covers, membership
-- invitations, club feed, and profile fields.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table public.club_roles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  manage_club boolean not null default false,
  manage_members boolean not null default false,
  manage_albums boolean not null default false,
  upload boolean not null default false,
  post_feed boolean not null default false,
  is_default boolean not null default false,
  is_builtin boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, key)
);
create index club_roles_club_idx on public.club_roles (club_id, sort_order);
create trigger set_updated_at before update on public.club_roles
  for each row execute function public.set_updated_at();

alter table public.memberships
  add column role_id uuid references public.club_roles (id) on delete set null,
  add column accepted_at timestamptz,
  add column declined_at timestamptz;

-- Adds the three built-in roles to a club and points memberships at them.
create or replace function public.seed_club_roles(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_member uuid;
begin
  insert into public.club_roles (club_id, key, name, manage_club, manage_members, manage_albums, upload, post_feed, is_default, is_builtin, sort_order)
  values
    (p_club_id, 'admin', 'Admin', true, true, true, true, true, false, true, 0),
    (p_club_id, 'committee', 'Committee', false, true, true, true, true, false, true, 1),
    (p_club_id, 'member', 'Member', false, false, false, false, false, true, true, 2)
  on conflict (club_id, key) do nothing;

  select id into v_admin from public.club_roles where club_id = p_club_id and key = 'admin';
  select id into v_member from public.club_roles where club_id = p_club_id and key = 'member';

  update public.memberships
  set role_id = case when role = 'club_admin' then v_admin else v_member end
  where club_id = p_club_id and role_id is null;
end;
$$;

do $$
declare c record;
begin
  for c in select id from public.clubs loop
    perform public.seed_club_roles(c.id);
  end loop;
end;
$$;

-- Keeps the legacy role column in step with the assigned role's permissions.
create or replace function public.sync_membership_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_manage_club boolean;
begin
  if new.role_id is not null then
    select manage_club into v_manage_club from public.club_roles r where r.id = new.role_id;
    new.role := case when coalesce(v_manage_club, false) then 'club_admin' else 'club_member' end;
  end if;
  return new;
end;
$$;

create trigger sync_membership_role
  before insert or update of role_id on public.memberships
  for each row execute function public.sync_membership_role();

-- ---------------------------------------------------------------------------
-- Albums: contributions and a custom cover
-- ---------------------------------------------------------------------------

alter table public.albums
  add column contributor_scope text not null default 'managers'
    check (contributor_scope in ('managers', 'members')),
  add column cover_path text;

alter table public.albums drop constraint albums_visibility_check;
alter table public.albums add constraint albums_visibility_check
  check (visibility in ('members', 'admins'));

-- ---------------------------------------------------------------------------
-- Club feed
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  author_membership_id uuid references public.memberships (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  album_id uuid references public.albums (id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_club_idx on public.posts (club_id, pinned desc, created_at desc);
create trigger set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  author_membership_id uuid references public.memberships (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create trigger set_updated_at before update on public.post_comments
  for each row execute function public.set_updated_at();

create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '🎉', '❤️', '😂')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, membership_id, emoji)
);
create trigger set_updated_at before update on public.post_reactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

alter table public.users
  add column bio text check (char_length(bio) <= 500),
  add column notify_new_album boolean not null default true,
  add column notify_feed_post boolean not null default true,
  add column notify_access_ending boolean not null default true;

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

create or replace function private.club_perm(club_id uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1
    from public.memberships m
    join public.club_roles r on r.id = m.role_id
    where m.club_id = club_perm.club_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        r.manage_club
        or (club_perm.perm = 'manage_members' and r.manage_members)
        or (club_perm.perm = 'manage_albums' and r.manage_albums)
        or (club_perm.perm = 'upload' and r.upload)
        or (club_perm.perm = 'post_feed' and r.post_feed)
      )
  );
$$;
grant execute on function private.club_perm(uuid, text) to authenticated;

-- May this user add media to this album? Managers always; everyone else only
-- when the album invites contributions.
create or replace function private.can_contribute_to_album(album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.albums a
    where a.id = can_contribute_to_album.album_id
      and (
        private.club_perm(a.club_id, 'manage_albums')
        or (a.contributor_scope = 'members' and private.club_perm(a.club_id, 'upload'))
        or (a.contributor_scope = 'members' and private.is_club_member(a.club_id))
      )
  );
$$;
grant execute on function private.can_contribute_to_album(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (private.club_perm(club_id, 'manage_members') and private.club_can_write(club_id));

drop policy memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (private.club_perm(club_id, 'manage_members'))
  with check (private.club_perm(club_id, 'manage_members'));

drop policy memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated using (private.club_perm(club_id, 'manage_members'));

-- A member may accept or decline their own invitation.
create policy memberships_update_self on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy albums_insert on public.albums;
create policy albums_insert on public.albums
  for insert to authenticated
  with check (private.club_perm(club_id, 'manage_albums') and private.club_can_write(club_id));

drop policy albums_update on public.albums;
create policy albums_update on public.albums
  for update to authenticated
  using (private.club_perm(club_id, 'manage_albums'))
  with check (private.club_perm(club_id, 'manage_albums'));

drop policy albums_delete on public.albums;
create policy albums_delete on public.albums
  for delete to authenticated using (private.club_perm(club_id, 'manage_albums'));

drop policy media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated
  with check (
    album_id is not null
    and private.can_contribute_to_album(album_id)
    and private.club_can_write(club_id)
  );

drop policy media_update on public.media;
create policy media_update on public.media
  for update to authenticated
  using (private.club_perm(club_id, 'manage_albums') or uploaded_by = (select auth.uid()))
  with check (private.club_perm(club_id, 'manage_albums') or uploaded_by = (select auth.uid()));

drop policy media_delete on public.media;
create policy media_delete on public.media
  for delete to authenticated
  using (private.club_perm(club_id, 'manage_albums') or uploaded_by = (select auth.uid()));

drop policy club_media_insert on storage.objects;
create policy club_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club_media'
    and (
      (name ~ '^clubs/[0-9a-f-]{36}/logo/' and private.club_perm(private.storage_club_id(name), 'manage_club'))
      or (name ~ '^avatars/' and name like ('avatars/' || auth.uid() || '/%'))
      or (
        private.club_can_write(private.storage_club_id(name))
        and (
          private.club_perm(private.storage_club_id(name), 'upload')
          or private.is_club_member(private.storage_club_id(name))
        )
      )
    )
  );

drop policy club_media_update on storage.objects;
create policy club_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club_media'
    and (
      private.club_perm(private.storage_club_id(name), 'manage_albums')
      or private.club_perm(private.storage_club_id(name), 'manage_club')
      or (name ~ '^avatars/' and name like ('avatars/' || auth.uid() || '/%'))
      or owner = (select auth.uid())
    )
  )
  with check (bucket_id = 'club_media');

drop policy club_media_delete on storage.objects;
create policy club_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club_media'
    and (
      private.club_perm(private.storage_club_id(name), 'manage_albums')
      or private.club_perm(private.storage_club_id(name), 'manage_club')
      or (name ~ '^avatars/' and name like ('avatars/' || auth.uid() || '/%'))
      or owner = (select auth.uid())
    )
  );

-- Avatars are visible to any signed-in member; club media keeps its own rule.
drop policy club_media_select on storage.objects;
create policy club_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'club_media'
    and (
      name ~ '^avatars/'
      or private.club_perm(private.storage_club_id(name), 'manage_albums')
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

alter table public.club_roles enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;

create policy club_roles_select on public.club_roles
  for select to authenticated using (private.is_club_member(club_id));
create policy club_roles_write on public.club_roles
  for all to authenticated
  using (private.club_perm(club_id, 'manage_club'))
  with check (private.club_perm(club_id, 'manage_club'));

create policy posts_select on public.posts
  for select to authenticated using (private.can_view_club_item(club_id, created_at));
create policy posts_insert on public.posts
  for insert to authenticated with check (private.club_perm(club_id, 'post_feed'));
create policy posts_update on public.posts
  for update to authenticated
  using (private.club_perm(club_id, 'manage_club') or author_membership_id in (
    select id from public.memberships where user_id = (select auth.uid())
  ))
  with check (private.is_club_member(club_id));
create policy posts_delete on public.posts
  for delete to authenticated
  using (private.club_perm(club_id, 'manage_club') or author_membership_id in (
    select id from public.memberships where user_id = (select auth.uid())
  ));

create policy post_comments_select on public.post_comments
  for select to authenticated using (private.is_club_member(club_id));
create policy post_comments_insert on public.post_comments
  for insert to authenticated with check (private.is_club_member(club_id));
create policy post_comments_delete on public.post_comments
  for delete to authenticated
  using (private.club_perm(club_id, 'manage_club') or author_membership_id in (
    select id from public.memberships where user_id = (select auth.uid())
  ));

create policy post_reactions_select on public.post_reactions
  for select to authenticated using (private.is_club_member(club_id));
create policy post_reactions_write on public.post_reactions
  for all to authenticated
  using (membership_id in (select id from public.memberships where user_id = (select auth.uid())))
  with check (
    private.is_club_member(club_id)
    and membership_id in (select id from public.memberships where user_id = (select auth.uid()))
  );

revoke all on public.club_roles, public.posts, public.post_comments, public.post_reactions from anon;

-- Members may see each other's display names and photos, which the feed needs.
create policy users_select_club_mates on public.users
  for select to authenticated
  using (
    exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.club_id = mine.club_id
      where mine.user_id = (select auth.uid())
        and mine.status in ('active', 'grace')
        and theirs.user_id = users.id
        and theirs.status in ('active', 'grace')
    )
  );

-- New clubs get the built-in roles, and the creator becomes Admin.
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
  v_admin_role uuid;
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

  perform public.seed_club_roles(v_club.id);
  select id into v_admin_role from public.club_roles where club_id = v_club.id and key = 'admin';

  insert into public.memberships (
    club_id, user_id, roster_email, roster_name, role, role_id, status, invited_at, first_seen_at, accepted_at
  ) values (
    v_club.id, v_uid, v_user.email::text,
    coalesce(nullif(v_user.display_name, ''), split_part(v_user.email::text, '@', 1)),
    'club_admin', v_admin_role, 'active', now(), now(), now()
  );

  return v_club;
end;
$$;

revoke execute on function public.seed_club_roles(uuid), public.sync_membership_role() from public, anon, authenticated;
grant execute on function public.create_club(text, text, text, text) to authenticated;

-- Memberships that predate invitations count as already accepted.
update public.memberships set accepted_at = coalesce(first_seen_at, created_at) where user_id is not null and accepted_at is null;
