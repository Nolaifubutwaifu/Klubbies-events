-- Name review (migration 36) stayed off the membership update guard
-- (migration 38). A held guest could clear it themselves.
--
--   As a held member, clearing name_review_at fails with 42501.
--   As a held member, setting name_approved_at fails with 42501.
--   can_view_event_item stays false, and the two columns stay as they were.
--   Accept, decline, the face notice and last seen still work.
--   An organiser approving still works, and the guest can then see photos.
--   An organiser rejecting (status revoked) still works.
--   The service role can still place a hold and clear one, which is how
--   sign-in (lib/auth/flow.ts) and approveNameAction write these columns.
--
-- Run it against a database with the migrations applied. It rolls back:
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/name_review_rls.sql
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_guest uuid := gen_random_uuid();
  v_signin uuid := gen_random_uuid();
  v_reject uuid := gen_random_uuid();
  v_admin_role uuid;
  v_member_role uuid;
  v_held uuid;
  v_pending uuid;
  v_removed uuid;
  v_stamp timestamptz := timestamptz '2026-10-01 00:00:00+00';
  v_state text;
  v_msg text;
  v_review timestamptz;
  v_approved timestamptz;
  v_status text;
  v_view boolean;
begin
  -- ---------------------------------------------------------------------
  -- Fixtures, as the owner (RLS off)
  -- ---------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (v_org, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-org@test.invalid', '', now(), now()),
    (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-guest@test.invalid', '', now(), now()),
    (v_signin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-signin@test.invalid', '', now(), now()),
    (v_reject, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-reject@test.invalid', '', now(), now());

  insert into public.events (id, handle, name, billing_status)
  values (v_event, 'rls_name_review', 'Name Review Test', 'comped');
  perform public.seed_event_roles(v_event);
  select id into v_admin_role from public.event_roles where event_id = v_event and key = 'admin';
  select id into v_member_role from public.event_roles where event_id = v_event and key = 'member';

  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
  values (v_event, v_org, 'review-org@test.invalid', 'Organiser', 'event_admin', v_admin_role, 'active', v_stamp);

  insert into public.memberships (
    event_id, user_id, roster_email, roster_name, claimed_name, name_mismatch,
    role, role_id, status, first_seen_at, accepted_at, name_review_at
  ) values (
    v_event, v_guest, 'review-guest@test.invalid', 'Serena Higgins', 'Not Serena', true,
    'event_member', v_member_role, 'active', v_stamp, null, v_stamp
  ) returning id into v_held;

  -- Not joined yet: sign-in attaches the user and opens the hold.
  insert into public.memberships (event_id, roster_email, roster_name, role, role_id, status)
  values (v_event, 'review-signin@test.invalid', 'Listed Name', 'event_member', v_member_role, 'pending')
  returning id into v_pending;

  insert into public.memberships (
    event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at, name_review_at
  ) values (
    v_event, v_reject, 'review-reject@test.invalid', 'Rejected Guest', 'event_member', v_member_role, 'active', v_stamp, v_stamp
  ) returning id into v_removed;

  -- ---------------------------------------------------------------------
  -- Held guest: the two writes that used to clear the hold, and both at once
  -- ---------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);

  select private.can_view_event_item(v_event, now()) into v_view;
  if v_view then raise exception 'held member could see photos before trying to clear the hold'; end if;

  v_state := null;
  v_msg := null;
  begin
    update public.memberships set name_review_at = null where id = v_held;
    raise exception 'held member cleared name_review_at';
  exception
    when insufficient_privilege then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  if v_state is distinct from '42501' then
    raise exception 'clearing name_review_at should fail with 42501, got % (%)', coalesce(v_state, 'no error'), v_msg;
  end if;
  if v_msg not like '%only organisers can change that%' then
    raise exception 'clearing name_review_at should hit the membership guard, got %', v_msg;
  end if;
  raise notice 'held member clear name_review_at: % %', v_state, v_msg;

  v_state := null;
  v_msg := null;
  begin
    update public.memberships set name_approved_at = now() where id = v_held;
    raise exception 'held member set name_approved_at';
  exception
    when insufficient_privilege then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  if v_state is distinct from '42501' then
    raise exception 'setting name_approved_at should fail with 42501, got % (%)', coalesce(v_state, 'no error'), v_msg;
  end if;
  if v_msg not like '%only organisers can change that%' then
    raise exception 'setting name_approved_at should hit the membership guard, got %', v_msg;
  end if;
  raise notice 'held member set name_approved_at: % %', v_state, v_msg;

  v_state := null;
  v_msg := null;
  begin
    update public.memberships set name_review_at = null, name_approved_at = now() where id = v_held;
    raise exception 'held member cleared the hold and approved themselves in one update';
  exception
    when insufficient_privilege then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  if v_state is distinct from '42501' then
    raise exception 'clearing both columns should fail with 42501, got % (%)', coalesce(v_state, 'no error'), v_msg;
  end if;

  select name_review_at, name_approved_at into v_review, v_approved from public.memberships where id = v_held;
  if v_review is distinct from v_stamp or v_approved is not null then
    raise exception 'hold columns changed after the refused updates: review % approved %', v_review, v_approved;
  end if;
  select private.can_view_event_item(v_event, now()) into v_view;
  if v_view then raise exception 'can_view_event_item flipped true for a held member'; end if;
  raise notice 'held member can_view_event_item stayed false';

  -- ---------------------------------------------------------------------
  -- The writes the app actually does for a member still land
  -- ---------------------------------------------------------------------
  update public.memberships set declined_at = timestamptz '2026-10-02 00:00:00+00' where id = v_held;
  if (select declined_at from public.memberships where id = v_held) is distinct from timestamptz '2026-10-02 00:00:00+00' then
    raise exception 'decline did not set declined_at';
  end if;
  update public.memberships
  set accepted_at = timestamptz '2026-10-03 00:00:00+00',
      declined_at = null,
      face_notice_ack_at = timestamptz '2026-10-03 00:00:00+00',
      face_notice_version = 'events-2026-09-27'
  where id = v_held;
  update public.memberships
  set face_notice_ack_at = timestamptz '2026-10-04 00:00:00+00',
      face_notice_version = 'events-2026-09-27'
  where id = v_held;
  update public.memberships set last_seen_at = timestamptz '2026-10-05 00:00:00+00' where id = v_held;
  perform public.touch_event_visit(v_event);

  if (select accepted_at from public.memberships where id = v_held) is distinct from timestamptz '2026-10-03 00:00:00+00' then
    raise exception 'accept did not set accepted_at';
  end if;
  if (select declined_at from public.memberships where id = v_held) is not null then
    raise exception 'accept did not clear declined_at';
  end if;
  if (select face_notice_ack_at from public.memberships where id = v_held) is distinct from timestamptz '2026-10-04 00:00:00+00'
     or (select face_notice_version from public.memberships where id = v_held) is distinct from 'events-2026-09-27' then
    raise exception 'face notice acknowledgement did not stick';
  end if;
  if (select last_seen_at from public.memberships where id = v_held) is null
     or (select last_seen_at from public.memberships where id = v_held) = timestamptz '2026-10-05 00:00:00+00' then
    raise exception 'touch_event_visit did not move last_seen_at';
  end if;
  if (select name_review_at from public.memberships where id = v_held) is distinct from timestamptz '2026-10-01 00:00:00+00' then
    raise exception 'a normal member update cleared the hold';
  end if;
  select private.can_view_event_item(v_event, now()) into v_view;
  if v_view then raise exception 'normal member updates made a held guest visible'; end if;
  raise notice 'member accept, face notice and last seen succeeded; hold stayed';

  -- ---------------------------------------------------------------------
  -- Organiser: approve the held guest, and reject someone else
  -- ---------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  update public.memberships
  set name_review_at = null, name_approved_at = now()
  where event_id = v_event and id = v_held;
  select name_review_at, name_approved_at into v_review, v_approved from public.memberships where id = v_held;
  if v_review is not null or v_approved is null then
    raise exception 'organiser approve did not clear the hold (review % approved %)', v_review, v_approved;
  end if;

  update public.memberships set status = 'revoked' where id = v_removed;
  select status into v_status from public.memberships where id = v_removed;
  if v_status is distinct from 'revoked' then
    raise exception 'organiser reject did not revoke the membership, status %', v_status;
  end if;
  raise notice 'organiser approve and reject succeeded';

  perform set_config('request.jwt.claims', json_build_object('sub', v_guest, 'role', 'authenticated')::text, true);
  select private.can_view_event_item(v_event, now()) into v_view;
  if not v_view then raise exception 'approved member still cannot see photos'; end if;

  -- ---------------------------------------------------------------------
  -- Service role: the sign-in hold, then the approve action
  -- ---------------------------------------------------------------------
  reset role;
  set local role service_role;
  update public.memberships
  set user_id = v_signin,
      claimed_name = 'Not The List',
      name_mismatch = true,
      name_review_at = timestamptz '2026-10-06 00:00:00+00',
      first_seen_at = timestamptz '2026-10-06 00:00:00+00',
      status = 'active'
  where id = v_pending;
  if not exists (
    select 1 from public.memberships
    where id = v_pending
      and user_id = v_signin
      and status = 'active'
      and claimed_name = 'Not The List'
      and name_mismatch
      and name_review_at = timestamptz '2026-10-06 00:00:00+00'
      and first_seen_at = timestamptz '2026-10-06 00:00:00+00'
  ) then
    raise exception 'service role could not open a name-review hold';
  end if;

  update public.memberships
  set name_review_at = null, name_approved_at = timestamptz '2026-10-07 00:00:00+00'
  where id = v_pending;
  select name_review_at, name_approved_at into v_review, v_approved from public.memberships where id = v_pending;
  if v_review is not null or v_approved is distinct from timestamptz '2026-10-07 00:00:00+00' then
    raise exception 'service role could not approve a held member';
  end if;
  raise notice 'service role hold and approve succeeded';

  reset role;
  raise notice 'name review guard: all checks passed';
end;
$$;

rollback;
