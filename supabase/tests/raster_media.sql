-- Migration 37: logo_path is not client-writable. cover_path may be set only
-- by service_role, postgres or supabase_admin, and a new path must be a
-- raster extension. anon and authenticated are refused. An SVG already stored
-- does not block updates of other columns.
--
-- Run it against a database that has the migrations applied. It rolls back.
--
--   psql -f supabase/tests/raster_media.sql
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.
-- Do not apply this file to a live database; the transaction rolls back, but
-- it is a test, not a migration.

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_svg_event uuid := gen_random_uuid();
  v_admin_role uuid;
  v_logo text;
  v_cover text;
begin
  if has_column_privilege('authenticated', 'public.events', 'logo_path', 'UPDATE') then
    raise exception 'authenticated must not be able to update events.logo_path';
  end if;

  if not has_column_privilege('authenticated', 'public.events', 'name', 'UPDATE') then
    raise exception 'authenticated must still be able to update events.name';
  end if;

  if exists (
    select 1 from pg_constraint
    where conname in ('events_logo_path_raster', 'albums_cover_path_raster')
  ) then
    raise exception 'raster paths must not be check constraints; those fire on every update';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('guard_event_logo_path', 'guard_album_cover_path')
      and p.prosecdef
  ) then
    raise exception 'raster guards must be security invoker';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'event_media'
      and allowed_mime_types @> array[
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime'
      ]
      and not (allowed_mime_types @> array['image/svg+xml'])
  ) then
    raise exception 'event_media must allow gallery types and refuse SVG';
  end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'raster-media@test.invalid', '');
  insert into public.events (id, handle, name, billing_status)
  values (v_event, 'raster_media_test', 'Raster media', 'unpaid');
  perform public.seed_event_roles(v_event);
  select id into v_admin_role from public.event_roles where event_id = v_event and key = 'admin';
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
  values (v_event, v_user, 'raster-media@test.invalid', 'Organiser', 'event_admin', v_admin_role, 'active', now());
  insert into public.albums (id, event_id, title, status)
  values (v_album, v_event, 'Covers', 'draft');

  -- Plant the SVG the old uploader could store, then turn the guards back on.
  alter table public.events disable trigger guard_event_logo_path;
  alter table public.albums disable trigger guard_album_cover_path;
  update public.events
  set logo_path = 'events/' || v_event || '/logo/logo-1.svg'
  where id = v_event;
  update public.albums
  set cover_path = 'events/' || v_event || '/covers/' || v_album || '-1.svg'
  where id = v_album;
  alter table public.events enable trigger guard_event_logo_path;
  alter table public.albums enable trigger guard_album_cover_path;

  -- The admin client connects as service_role. Other columns must still save.
  set local role service_role;
  update public.events set name = 'Paid' where id = v_event;
  update public.albums set title = 'Scheduled' where id = v_album;
  select logo_path into v_logo from public.events where id = v_event;
  select cover_path into v_cover from public.albums where id = v_album;
  if v_logo not like '%.svg' or v_cover not like '%.svg' then
    raise exception 'an old svg path was rewritten by an unrelated update';
  end if;
  if not exists (select 1 from public.events where id = v_event and name = 'Paid') then
    raise exception 'service role could not rename an event that still has an svg logo';
  end if;
  if not exists (select 1 from public.albums where id = v_album and title = 'Scheduled') then
    raise exception 'service role could not retitle an album that still has an svg cover';
  end if;
  reset role;

  -- An organiser edit is the same shape as the service-role one: other columns,
  -- old svg left untouched.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  update public.events set name = 'Organiser edit' where id = v_event;
  update public.albums set title = 'Organiser album' where id = v_album;
  if not exists (
    select 1 from public.events where id = v_event and name = 'Organiser edit' and logo_path like '%.svg'
  ) then
    raise exception 'an organiser could not rename an event that still has an svg logo';
  end if;
  if not exists (
    select 1 from public.albums where id = v_album and title = 'Organiser album' and cover_path like '%.svg'
  ) then
    raise exception 'an organiser could not retitle an album that still has an svg cover';
  end if;
  reset role;

  set local role service_role;

  begin
    update public.events set logo_path = 'events/' || v_event || '/logo/logo-2.svg' where id = v_event;
    raise exception 'service role stored a new svg logo_path';
  exception
    when check_violation then null;
  end;

  begin
    update public.albums
    set cover_path = 'events/' || v_event || '/covers/' || v_album || '-2.svg'
    where id = v_album;
    raise exception 'service role stored a new svg cover_path';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.events (id, handle, name, billing_status, logo_path)
    values (v_svg_event, 'raster_svg_insert', 'SVG insert', 'unpaid', 'events/' || v_svg_event || '/logo/logo-1.svg');
    raise exception 'insert of an svg logo_path was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.albums (event_id, title, cover_path)
    values (v_event, 'SVG cover', 'events/' || v_event || '/covers/new-1.svg');
    raise exception 'insert of an svg cover_path was accepted';
  exception
    when check_violation then null;
  end;

  update public.events
  set logo_path = 'events/' || v_event || '/logo/logo-2.png'
  where id = v_event;
  update public.albums
  set cover_path = 'events/' || v_event || '/covers/' || v_album || '-2.jpg'
  where id = v_album;
  insert into public.events (handle, name, billing_status, logo_path)
  values ('raster_png_insert', 'PNG insert', 'unpaid', 'events/new/logo/logo-1.png');
  insert into public.albums (event_id, title, cover_path)
  values (v_event, 'PNG cover', 'events/' || v_event || '/covers/new-1.png');
  insert into public.albums (event_id, title)
  values (v_event, 'No cover');

  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  begin
    update public.events
    set logo_path = 'events/' || v_event || '/logo/logo-3.png'
    where id = v_event;
    raise exception 'authenticated was able to update events.logo_path';
  exception
    when insufficient_privilege then null;
  end;

  update public.albums set title = 'Renamed' where id = v_album;
  if not exists (select 1 from public.albums where id = v_album and title = 'Renamed') then
    raise exception 'an organiser must still be able to rename an album';
  end if;

  begin
    update public.albums
    set cover_path = 'events/' || v_event || '/covers/' || v_album || '-3.png'
    where id = v_album;
    raise exception 'authenticated was able to change cover_path';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%cover_path is set by the server%' then
        raise exception 'authenticated was not refused by the cover guard: %', sqlerrm;
      end if;
  end;

  reset role;

  -- Anon has no table grant and no albums policy, so a plain update never
  -- reaches the guard. Grant the write (select is what an update's where
  -- clause needs) and turn row security off for this assertion only, so a
  -- refusal is the trigger and not the grant or RLS.
  grant select, insert, update on table public.albums to anon;
  alter table public.albums disable row level security;
  set local role anon;

  begin
    update public.albums
    set cover_path = 'events/' || v_event || '/covers/' || v_album || '-4.png'
    where id = v_album;
    raise exception 'anon was able to change cover_path';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%cover_path is set by the server%' then
        raise exception 'anon was not refused by the cover guard: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.albums (event_id, title, cover_path)
    values (v_event, 'Anon cover', 'events/' || v_event || '/covers/anon-1.png');
    raise exception 'anon was able to insert a cover_path';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%cover_path is set by the server%' then
        raise exception 'anon insert was not refused by the cover guard: %', sqlerrm;
      end if;
  end;

  -- A null cover and an unchanged path return before the role check.
  -- The cover here is the jpg the service role stored earlier in this test.
  insert into public.albums (event_id, title) values (v_event, 'Anon album');
  update public.albums set title = 'Anon retitle' where id = v_album;
  if not exists (
    select 1 from public.albums
    where id = v_album
      and title = 'Anon retitle'
      and cover_path = 'events/' || v_event || '/covers/' || v_album || '-2.jpg'
  ) then
    raise exception 'anon could not retitle an album while leaving cover_path alone';
  end if;

  reset role;
  alter table public.albums enable row level security;
  raise notice 'raster media: all checks passed';
end;
$$;

rollback;
