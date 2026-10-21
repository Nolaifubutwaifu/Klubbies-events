-- Migration 37: logo_path is not client-writable, cover_path changes from the
-- authenticated role are refused, and both paths must be a raster extension.
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
  v_admin_role uuid;
  n int;
begin
  if has_column_privilege('authenticated', 'public.events', 'logo_path', 'UPDATE') then
    raise exception 'authenticated must not be able to update events.logo_path';
  end if;

  if not has_column_privilege('authenticated', 'public.events', 'name', 'UPDATE') then
    raise exception 'authenticated must still be able to update events.name';
  end if;

  select count(*) into n
  from pg_constraint
  where conname = 'events_logo_path_raster'
    and conrelid = 'public.events'::regclass
    and not convalidated;
  if n <> 1 then raise exception 'events_logo_path_raster must exist and be NOT VALID'; end if;

  select count(*) into n
  from pg_constraint
  where conname = 'albums_cover_path_raster'
    and conrelid = 'public.albums'::regclass
    and not convalidated;
  if n <> 1 then raise exception 'albums_cover_path_raster must exist and be NOT VALID'; end if;

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

  update public.events set logo_path = 'events/' || v_event || '/logo/logo-1.png' where id = v_event;
  begin
    update public.events set logo_path = 'events/' || v_event || '/logo/logo-1.svg' where id = v_event;
    raise exception 'an svg logo_path was accepted';
  exception
    when check_violation then null;
  end;

  update public.albums
  set cover_path = 'events/' || v_event || '/covers/' || v_album || '-1.jpg'
  where id = v_album;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  begin
    update public.albums
    set cover_path = 'events/' || v_event || '/covers/' || v_album || '-2.png'
    where id = v_album;
    raise exception 'authenticated was able to change cover_path';
  exception
    when insufficient_privilege then null;
  end;

  update public.albums set title = 'Renamed' where id = v_album;
  if not exists (select 1 from public.albums where id = v_album and title = 'Renamed') then
    raise exception 'an organiser must still be able to rename an album';
  end if;
  reset role;
end;
$$;

rollback;
