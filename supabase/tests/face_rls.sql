-- The gates for steps 2 and 9 of the face recognition build, written as a
-- test rather than a look, because a mistake in either stays invisible until
-- it matters.
--
--   Step 2: member B cannot read member A's matches, faces or profile.
--   Step 9: member B cannot fetch member A's enrolment selfie.
--
-- Run it against a database with the face migrations applied. Everything
-- happens inside a transaction that rolls back, so it leaves no rows behind:
--
--   (via the Supabase MCP, or psql -f supabase/tests/face_rls.sql)
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();   -- signed in, not in this event
  v_mem_a uuid;
  v_mem_b uuid;
  v_media uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_face uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_match_a uuid;
  n int;
begin
  -- ---------------------------------------------------------------------
  -- Fixtures, as the owner (RLS off)
  -- ---------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid', '', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid', '', now(), now()),
    (v_out, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-out@test.invalid', '', now(), now());
  -- public.users is filled by the on_auth_user_created trigger.

  insert into public.events (id, handle, name, billing_status)
  values (v_event, 'rls_face_test', 'RLS Face Test', 'comped');

  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, status)
  values (v_event, v_a, 'rls-a@test.invalid', 'Member A', 'event_member', 'active')
  returning id into v_mem_a;
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, status)
  values (v_event, v_b, 'rls-b@test.invalid', 'Member B', 'event_member', 'active')
  returning id into v_mem_b;

  insert into public.albums (id, event_id, title, status, visibility)
  values (v_album, v_event, 'Test album', 'published', 'members');
  insert into public.media (id, event_id, album_id, kind, storage_path, status)
  values (v_media, v_event, v_album, 'photo', 'events/x/albums/y/z/original.jpg', 'ready');

  -- New events already get a settings row from the faces-on-by-default trigger.
  insert into public.event_face_settings (event_id, enabled, collection_id)
  values (v_event, true, 'klubbies-test-event-x')
  on conflict (event_id) do update set enabled = true, collection_id = excluded.collection_id;

  insert into public.media_faces (event_id, media_id, collection_id, rekognition_face_id, bounding_box)
  values (v_event, v_media, 'klubbies-test-event-x', 'face-1', '{"Left":0.1,"Top":0.1,"Width":0.2,"Height":0.2}')
  returning id into v_face;

  insert into public.member_face_profiles (event_id, membership_id, user_id, status, consent_version, selfie_path)
  values (v_event, v_mem_a, v_a, 'ready', 'test', 'faces/' || v_mem_a || '/selfie.jpg')
  returning id into v_profile_a;
  insert into public.member_face_profiles (event_id, membership_id, user_id, status, consent_version, selfie_path)
  values (v_event, v_mem_b, v_b, 'ready', 'test', 'faces/' || v_mem_b || '/selfie.jpg')
  returning id into v_profile_b;

  insert into public.member_face_references (event_id, profile_id, collection_id, rekognition_face_id, source)
  values (v_event, v_profile_a, 'klubbies-test-event-x', 'ref-a', 'selfie');

  insert into public.face_matches (event_id, media_id, media_face_id, profile_id, similarity, state, bounding_box)
  values (v_event, v_media, v_face, v_profile_a, 97.5, 'confirmed', '{"Left":0.1,"Top":0.1,"Width":0.2,"Height":0.2}')
  returning id into v_match_a;

  insert into public.face_jobs (event_id, media_id, kind) values (v_event, v_media, 'index_media');
  insert into public.face_purge_queue (collection_id, rekognition_face_id) values ('klubbies-test-event-x', 'dead-1');

  -- A's selfie as a storage object, so the storage policy can be exercised.
  insert into storage.objects (bucket_id, name, owner)
  values ('event_media', 'faces/' || v_mem_a || '/selfie.jpg', v_a);

  -- ---------------------------------------------------------------------
  -- As member A: sees their own match, and nothing structural
  -- ---------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.face_matches;
  if n <> 1 then raise exception 'A should see exactly their own match, saw %', n; end if;

  select count(*) into n from public.member_face_profiles;
  if n <> 1 then raise exception 'A should see exactly their own profile, saw %', n; end if;

  -- The correlation guarantee: nobody reads media_faces, not even about a
  -- photo they are matched in. These four tables have no member policy AND
  -- no grant, so the answer is a privilege error rather than an empty set —
  -- two independent locks, and the test asserts the outer one.
  begin
    select count(*) into n from public.media_faces;
    raise exception 'A must not read media_faces, saw %', n;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.member_face_references;
    raise exception 'A must not read member_face_references, saw %', n;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.face_jobs;
    raise exception 'A must not read face_jobs, saw %', n;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.face_purge_queue;
    raise exception 'A must not read face_purge_queue, saw %', n;
  exception when insufficient_privilege then null;
  end;

  -- A may answer their own suggestion, and nothing else about it.
  update public.face_matches set state = 'rejected', decided_at = now() where id = v_match_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A should be able to reject their own match'; end if;

  begin
    update public.face_matches set similarity = 1 where id = v_match_a;
    raise exception 'A must not be able to edit similarity';
  exception when insufficient_privilege then null;
  end;

  -- The WITH CHECK clause refuses rather than silently matching nothing, so
  -- "yes or no, and nothing else" is enforced loudly.
  begin
    update public.face_matches set state = 'suggested' where id = v_match_a;
    raise exception 'A must not be able to put a match back to suggested';
  exception when insufficient_privilege then null;
  end;

  update public.face_matches set state = 'confirmed', decided_at = now() where id = v_match_a;

  -- ---------------------------------------------------------------------
  -- As member B: same event, sees none of A's
  -- ---------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.face_matches;
  if n <> 0 then raise exception 'B must not see A''s matches, saw %', n; end if;

  select count(*) into n from public.member_face_profiles where id = v_profile_a;
  if n <> 0 then raise exception 'B must not see A''s profile, saw %', n; end if;

  begin
    select count(*) into n from public.media_faces;
    raise exception 'B must not read media_faces, saw %', n;
  exception when insufficient_privilege then null;
  end;

  update public.face_matches set state = 'rejected' where id = v_match_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B must not be able to decide A''s match'; end if;

  delete from public.member_face_profiles where id = v_profile_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B must not be able to delete A''s profile'; end if;

  -- Step 9: B cannot fetch A's selfie.
  select count(*) into n from storage.objects
  where bucket_id = 'event_media' and name = 'faces/' || v_mem_a || '/selfie.jpg';
  if n <> 0 then raise exception 'B must not be able to read A''s selfie, saw %', n; end if;

  -- ---------------------------------------------------------------------
  -- As a signed-in stranger: nothing at all
  -- ---------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
  select count(*) into n from public.face_matches;
  if n <> 0 then raise exception 'a non-member must see no matches, saw %', n; end if;
  select count(*) into n from public.event_face_settings;
  if n <> 0 then raise exception 'a non-member must not see the event switch, saw %', n; end if;

  -- ---------------------------------------------------------------------
  -- A revoked membership stops seeing matches, the way the rest of the app
  -- already behaves. This is the second half of face_matches_select_own.
  -- ---------------------------------------------------------------------
  reset role;
  update public.memberships set status = 'revoked' where id = v_mem_a;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.face_matches;
  if n <> 0 then raise exception 'a revoked member must stop seeing matches, saw %', n; end if;

  reset role;
  raise notice 'face RLS: all checks passed';
end;
$$;

rollback;
