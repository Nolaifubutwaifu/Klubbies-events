-- Recently deleted (migration 26), written as a test because a gap here
-- shows a deleted photo to a guest and nobody notices.
--
--   A binned photo, album or event is invisible to guests and organisers
--   alike through the API, storage signing included.
--   A binned event has no members: no uploads, no album inserts, no event row.
--   An uploader who doesn't manage albums can't bin or unbin their own photo.
--
-- Run it against a database with the migrations applied. It rolls back:
--
--   (via the Supabase MCP, or psql -f supabase/tests/bin_rls.sql)
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_guest uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_album2 uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_admin_role uuid;
  v_stamp timestamptz := now();
  n int;
begin
  -- ---------------------------------------------------------------------
  -- Fixtures, as the owner (RLS off)
  -- ---------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (v_org, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bin-org@test.invalid', '', now(), now()),
    (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bin-guest@test.invalid', '', now(), now());

  insert into public.events (id, handle, name, billing_status)
  values (v_event, 'rls_bin_test', 'RLS Bin Test', 'comped');
  perform public.seed_event_roles(v_event);
  select id into v_admin_role from public.event_roles where event_id = v_event and key = 'admin';

  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status)
  values (v_event, v_org, 'bin-org@test.invalid', 'Organiser', 'event_admin', v_admin_role, 'active');
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, status)
  values (v_event, v_guest, 'bin-guest@test.invalid', 'Guest', 'event_member', 'active');
  perform public.seed_event_roles(v_event);

  insert into public.albums (id, event_id, title, status, visibility, contributor_scope)
  values
    (v_album, v_event, 'Keynote', 'published', 'members', 'members'),
    (v_album2, v_event, 'Awards', 'published', 'members', 'members');
  insert into public.media (id, event_id, album_id, kind, storage_path, status, uploaded_by)
  values
    (v_m1, v_event, v_album, 'photo', 'events/' || v_event || '/albums/' || v_album || '/' || v_m1 || '/original.jpg', 'ready', null),
    (v_m2, v_event, v_album, 'photo', 'events/' || v_event || '/albums/' || v_album || '/' || v_m2 || '/original.jpg', 'ready', v_guest),
    (v_m3, v_event, v_album2, 'photo', 'events/' || v_event || '/albums/' || v_album2 || '/' || v_m3 || '/original.jpg', 'ready', null);
  insert into storage.objects (bucket_id, name)
  select 'event_media', storage_path from public.media where event_id = v_event;

  -- ---------------------------------------------------------------------
  -- Nothing binned yet: the guest sees everything
  -- ---------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where event_id = v_event;
  if n <> 3 then raise exception 'guest should see 3 photos before any delete, saw %', n; end if;
  select count(*) into n from storage.objects where name like 'events/' || v_event || '/%';
  if n <> 3 then raise exception 'guest should reach 3 files before any delete, saw %', n; end if;

  -- An uploader who can't manage albums can't bin their own photo.
  begin
    update public.media set deleted_at = now() where id = v_m2;
    raise exception 'guest binned their own photo';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------
  -- One photo binned: gone for the guest, the organiser and storage
  -- ---------------------------------------------------------------------
  reset role;
  update public.media set deleted_at = v_stamp, deleted_by = v_org where id = v_m1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where id = v_m1;
  if n <> 0 then raise exception 'guest can still see a binned photo'; end if;
  select count(*) into n from storage.objects where name like '%/' || v_m1 || '/%';
  if n <> 0 then raise exception 'guest can still reach a binned photo''s file'; end if;
  select count(*) into n from public.album_media_counts where album_id = v_album;
  select photo_count into n from public.album_media_counts where album_id = v_album;
  if n <> 1 then raise exception 'album count should leave the binned photo out, saw %', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where id = v_m1;
  if n <> 0 then raise exception 'organiser pages would show a binned photo'; end if;
  select count(*) into n from public.media where event_id = v_event;
  if n <> 2 then raise exception 'organiser should still see the other 2 photos, saw %', n; end if;

  -- The guest's own photo, binned by the organiser, is hidden from them too.
  reset role;
  update public.media set deleted_at = v_stamp where id = v_m2;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where id = v_m2;
  if n <> 0 then raise exception 'uploader can still see their own binned photo'; end if;
  reset role;
  update public.media set deleted_at = null where id = v_m2;

  -- ---------------------------------------------------------------------
  -- An album binned: gone, and nothing can be uploaded into it
  -- ---------------------------------------------------------------------
  update public.albums set deleted_at = v_stamp where id = v_album2;
  update public.media set deleted_at = v_stamp where album_id = v_album2 and deleted_at is null;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.albums where id = v_album2;
  if n <> 0 then raise exception 'guest can still see a binned album'; end if;
  select count(*) into n from public.media where album_id = v_album2;
  if n <> 0 then raise exception 'guest can still see photos in a binned album'; end if;
  begin
    insert into public.media (event_id, album_id, kind, storage_path, status, uploaded_by)
    values (v_event, v_album2, 'photo', 'x.jpg', 'processing', v_guest);
    raise exception 'guest uploaded into a binned album';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  select count(*) into n from public.albums where id = v_album2;
  if n <> 0 then raise exception 'organiser pages would show a binned album'; end if;

  -- ---------------------------------------------------------------------
  -- The whole event binned: no event, no albums, no photos, no writes
  -- ---------------------------------------------------------------------
  reset role;
  update public.events set deleted_at = v_stamp where id = v_event;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.events where id = v_event;
  if n <> 0 then raise exception 'guest can still see a binned event'; end if;
  select count(*) into n from public.albums where event_id = v_event;
  if n <> 0 then raise exception 'guest can still see albums of a binned event'; end if;
  select count(*) into n from public.media where event_id = v_event;
  if n <> 0 then raise exception 'guest can still see photos of a binned event'; end if;
  select count(*) into n from storage.objects where name like 'events/' || v_event || '/%';
  if n <> 0 then raise exception 'guest can still reach files of a binned event'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  select count(*) into n from public.events where id = v_event;
  if n <> 0 then raise exception 'organiser pages would open a binned event'; end if;
  select count(*) into n from public.media where event_id = v_event;
  if n <> 0 then raise exception 'organiser can still list photos of a binned event'; end if;
  begin
    insert into public.albums (event_id, title) values (v_event, 'Sneaky');
    raise exception 'organiser created an album in a binned event';
  exception when insufficient_privilege then null;
  end;

  -- ---------------------------------------------------------------------
  -- Restored: everything comes back
  -- ---------------------------------------------------------------------
  reset role;
  update public.events set deleted_at = null where id = v_event;
  update public.media set deleted_at = null where album_id = v_album2 and deleted_at = v_stamp;
  update public.albums set deleted_at = null where id = v_album2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where event_id = v_event;
  -- m1 was binned on its own and stays binned; m2 and m3 are back.
  if n <> 2 then raise exception 'after restoring, guest should see 2 photos, saw %', n; end if;

  reset role;
  raise notice 'bin RLS: all checks passed';
end;
$$;

rollback;
