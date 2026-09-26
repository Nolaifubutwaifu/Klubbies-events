-- Keep the new helpers off the REST API.
-- A trigger function has no business being callable as an RPC, so it moves to
-- `private` like the other helpers. And Supabase's default grants hand EXECUTE
-- to anon and authenticated on every new public function, which a `revoke from
-- public` does not undo — anon has to be named.

drop trigger favourites_set_club on public.favourites;
drop function public.favourite_set_club();

create or replace function private.favourite_set_club()
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
  for each row execute function private.favourite_set_club();

revoke execute on function public.touch_club_visit(uuid) from anon;
