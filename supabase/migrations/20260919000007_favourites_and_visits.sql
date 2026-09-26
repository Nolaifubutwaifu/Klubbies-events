-- Member memories: a member's favourite shots, and knowing what has landed
-- since they last opened the event.

-- ---------------------------------------------------------------------------
-- Last visit
-- ---------------------------------------------------------------------------
alter table public.memberships add column last_seen_at timestamptz;

-- A member can't write to their own membership row (that policy is admin
-- only), so the visit stamp goes through a definer function that can only ever
-- move this one column, on the caller's own live membership.
create or replace function public.touch_event_visit(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.memberships
     set last_seen_at = now()
   where event_id = touch_event_visit.p_event_id
     and user_id = auth.uid()
     and status in ('active', 'grace');
$$;

revoke all on function public.touch_event_visit(uuid) from public;
grant execute on function public.touch_event_visit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------
create table public.favourites (
  user_id uuid not null references public.users (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  -- Denormalised from media so RLS and the Saved page can filter by event
  -- without joining. Kept honest by the trigger below.
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create index favourites_user_event_idx on public.favourites (user_id, event_id, created_at desc);
create index favourites_media_idx on public.favourites (media_id);

-- The client never supplies event_id: it comes from the media row. A BEFORE
-- trigger fills it in, and the insert policy then checks membership of that
-- event against the finished row.
create or replace function public.favourite_set_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select m.event_id into new.event_id from public.media m where m.id = new.media_id;
  if new.event_id is null then
    raise exception 'favourite references unknown media %', new.media_id;
  end if;
  return new;
end;
$$;

create trigger favourites_set_event before insert on public.favourites
  for each row execute function public.favourite_set_event();

alter table public.favourites enable row level security;

create policy favourites_select on public.favourites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy favourites_insert on public.favourites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_event_member(event_id));

create policy favourites_delete on public.favourites
  for delete to authenticated
  using (user_id = (select auth.uid()));
