-- The tier limits (migration 27), written as a test because the rules only
-- bite at the edges: the 201st photo, the 12th guest, the 49th hour.
--
-- The event here has a guest limit of 10, so 11 are included (10%), the
-- window runs to 15 (50%), and the 12th guest opens it.
--
-- Run it against a database with the migrations applied. It rolls back:
--
--   (via the Supabase MCP, or psql -f supabase/tests/limits.sql)
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_admin_role uuid;
  v_member_role uuid;
  v_guests uuid[] := '{}';
  v_user uuid;
  v_m uuid;
  v_first_media uuid;
  n int;
  v_state text;
  i int;
begin
  -- ---------------------------------------------------------------------
  -- Fixtures
  -- ---------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_org, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lim-org@test.invalid', '');
  insert into public.events (id, handle, name, billing_status) values (v_event, 'rls_limits_test', 'Limits Test', 'unpaid');
  perform public.seed_event_roles(v_event);
  select id into v_admin_role from public.event_roles where event_id = v_event and key = 'admin';
  select id into v_member_role from public.event_roles where event_id = v_event and key = 'member';
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
  values (v_event, v_org, 'lim-org@test.invalid', 'Organiser', 'event_admin', v_admin_role, 'active', now());
  insert into public.albums (id, event_id, title, status, visibility)
  values (v_album, v_event, 'All', 'published', 'members');

  select plan, guest_limit, photo_limit into v_state, n, i from public.events where id = v_event;
  if v_state <> 'free' or n <> 50 or i <> 200 then
    raise exception 'a new event should start on Free with 50 guests and 200 photos, got % % %', v_state, n, i;
  end if;
  if not exists (select 1 from public.events where id = v_event and private.event_can_write(id)) then
    raise exception 'a Free event should be writable without paying';
  end if;

  -- ---------------------------------------------------------------------
  -- Photos: 200 on Free; the bin and failed uploads don't count
  -- ---------------------------------------------------------------------
  for i in 1..200 loop
    insert into public.media (event_id, album_id, kind, storage_path, status)
    values (v_event, v_album, 'photo', 'p' || i || '.jpg', 'ready')
    returning id into v_m;
    if i = 1 then v_first_media := v_m; end if;
  end loop;

  begin
    insert into public.media (event_id, album_id, kind, storage_path, status) values (v_event, v_album, 'photo', 'over.jpg', 'ready');
    raise exception 'the 201st photo on Free was accepted';
  exception when sqlstate 'KB001' then null;
  end;

  update public.media set deleted_at = now() where id = v_first_media;
  insert into public.media (event_id, album_id, kind, storage_path, status) values (v_event, v_album, 'photo', 'room.jpg', 'ready');

  -- Five photos out: five units free, but a video needs ten.
  update public.media set status = 'failed'
  where id in (select id from public.media where event_id = v_event and deleted_at is null and status = 'ready' limit 5);
  begin
    insert into public.media (event_id, album_id, kind, storage_path, status) values (v_event, v_album, 'video', 'v.mp4', 'processing');
    raise exception 'a video fitted into five photos of room';
  exception when sqlstate 'KB001' then null;
  end;
  if private.media_units('video', 4) <> 1 or private.media_units('video', 61) <> 11 or private.media_units('video', 60) <> 10 or private.media_units('video', null) <> 10 then
    raise exception 'a video should count 10 per started minute';
  end if;

  -- ---------------------------------------------------------------------
  -- Guests: limit 10, so 11 included and up to 15 in the window
  -- ---------------------------------------------------------------------
  perform public.apply_event_plan(v_event, 'custom', 'standard', 10, null);

  for i in 1..16 loop
    v_user := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
    values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lim-g' || i || '@test.invalid', '');
    begin
      insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
      values (v_event, v_user, 'lim-g' || i || '@test.invalid', 'Guest ' || i, 'event_member', v_member_role, 'active',
              now() + make_interval(secs => i));
      if i = 16 then raise exception 'guest 16 joined past the 50%% ceiling'; end if;
      v_guests := v_guests || v_user;
    exception when sqlstate 'KB002' then
      if i <> 16 then raise exception 'guest % was refused', i; end if;
    end;
    if i = 11 and exists (select 1 from public.events where id = v_event and overflow_started_at is not null) then
      raise exception 'the window opened within the included 10%%';
    end if;
    if i = 12 and not exists (select 1 from public.events where id = v_event and overflow_started_at is not null) then
      raise exception 'guest 12 should open the window';
    end if;
  end loop;

  -- Organisers and photographers never count.
  if private.event_guests_joined(v_event) <> 15 then
    raise exception 'expected 15 guests joined, got %', private.event_guests_joined(v_event);
  end if;

  -- ---------------------------------------------------------------------
  -- The window closes without an upgrade: 12 to 15 are paused
  -- ---------------------------------------------------------------------
  update public.events set overflow_started_at = now() - interval '49 hours' where id = v_event;
  perform public.close_overflow_windows();

  select count(*) into n from public.memberships where event_id = v_event and paused_at is not null;
  if n <> 4 then raise exception 'expected 4 paused guests, got %', n; end if;
  if exists (select 1 from public.memberships where user_id = v_guests[11] and paused_at is not null) then
    raise exception 'guest 11 was inside the included 10%% and should not be paused';
  end if;

  -- A paused guest sees no photos; an included one does.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guests[15], 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where event_id = v_event;
  if n <> 0 then raise exception 'a paused guest can see % photos', n; end if;
  begin
    update public.memberships set paused_at = null where user_id = v_guests[15];
    if found then raise exception 'a guest unpaused themselves'; end if;
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guests[1], 'role', 'authenticated')::text, true);
  select count(*) into n from public.media where event_id = v_event;
  if n = 0 then raise exception 'an included guest can see no photos'; end if;

  -- The organiser can't unpause anyone by hand either.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  begin
    update public.memberships set paused_at = null where user_id = v_guests[12];
    raise exception 'the organiser unpaused a guest by hand';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Nobody new joins once the window has closed.
  v_user := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lim-late@test.invalid', '');
  begin
    insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
    values (v_event, v_user, 'lim-late@test.invalid', 'Late', 'event_member', v_member_role, 'active', now());
    raise exception 'someone joined after the window closed';
  exception when sqlstate 'KB002' then null;
  end;

  -- ---------------------------------------------------------------------
  -- Making room: removing an included guest lets guest 12 in
  -- ---------------------------------------------------------------------
  update public.memberships set status = 'revoked' where user_id = v_guests[3];
  if exists (select 1 from public.memberships where user_id = v_guests[12] and paused_at is not null) then
    raise exception 'guest 12 should have been let in when guest 3 was removed';
  end if;
  if not exists (select 1 from public.memberships where user_id = v_guests[13] and paused_at is not null) then
    raise exception 'guest 13 should still be paused';
  end if;
  if not exists (select 1 from public.memberships where user_id = v_guests[12] and let_in_at is not null) then
    raise exception 'guest 12 should be marked as let in, for their email';
  end if;

  -- The organiser restoring guest 3 is never refused; guest 12 goes back to waiting.
  update public.memberships set status = 'active' where user_id = v_guests[3];
  if not exists (select 1 from public.memberships where user_id = v_guests[12] and paused_at is not null) then
    raise exception 'restoring guest 3 should pause guest 12 again';
  end if;
  if exists (select 1 from public.memberships where user_id = v_guests[12] and let_in_at is not null) then
    raise exception 'guest 12 is paused again and should not get a let-in email';
  end if;

  -- ---------------------------------------------------------------------
  -- An upgrade lets everyone in and starts a fresh window
  -- ---------------------------------------------------------------------
  perform public.apply_event_plan(v_event, 'custom', 'standard', 20, null);
  select count(*) into n from public.memberships where event_id = v_event and paused_at is not null;
  if n <> 0 then raise exception 'after the upgrade % guests are still paused', n; end if;
  if exists (select 1 from public.events where id = v_event and (overflow_started_at is not null or overflow_closed_at is not null)) then
    raise exception 'the upgrade should clear the window';
  end if;
  select join_state into v_state from public.event_plan_usage(v_event);
  if v_state <> 'open' then raise exception 'after the upgrade joining should be open, got %', v_state; end if;

  raise notice 'limits: all checks passed';
end;
$$;

rollback;
