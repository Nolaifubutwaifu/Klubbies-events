-- Member memories: a member's favourite shots, and knowing what has landed
-- since they last opened the club.

-- ---------------------------------------------------------------------------
-- Last visit
-- ---------------------------------------------------------------------------
alter table public.memberships add column last_seen_at timestamptz;

-- A member can't write to their own membership row (that policy is admin
-- only), so the visit stamp goes through a definer function that can only ever
-- move this one column, on the caller's own live membership.
create or replace function public.touch_club_visit(p_club_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.memberships
     set last_seen_at = now()
   where club_id = touch_club_visit.p_club_id
     and user_id = auth.uid()
     and status in ('active', 'grace');
$$;

revoke all on function public.touch_club_visit(uuid) from public;
grant execute on function public.touch_club_visit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------
create table public.favourites (
  user_id uuid not null references public.users (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  -- Denormalised from media so RLS and the Saved page can filter by club
  -- without joining. Kept honest by the trigger below.
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create index favourites_user_club_idx on public.favourites (user_id, club_id, created_at desc);
create index favourites_media_idx on public.favourites (media_id);

-- The client never supplies club_id: it comes from the media row. A BEFORE
-- trigger fills it in, and the insert policy then checks membership of that
-- club against the finished row.
create or replace function public.favourite_set_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select m.club_id into new.club_id from public.media m where m.id = new.media_id;
  if new.club_id is null then
    raise exception 'favourite references unknown media %', new.media_id;
  end if;
  return new;
end;
$$;

create trigger favourites_set_club before insert on public.favourites
  for each row execute function public.favourite_set_club();

alter table public.favourites enable row level security;

create policy favourites_select on public.favourites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy favourites_insert on public.favourites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_club_member(club_id));

create policy favourites_delete on public.favourites
  for delete to authenticated
  using (user_id = (select auth.uid()));
