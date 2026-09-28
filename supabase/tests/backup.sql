-- The R2 bookkeeping (migration 28): only the server records a copy, and the
-- monthly check can tell which event folders no longer have an event.
--
--   (via the Supabase MCP, or psql -f supabase/tests/backup.sql)

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_media uuid := gen_random_uuid();
  v_admin_role uuid;
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_org, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bk-org@test.invalid', '');
  insert into public.events (id, handle, name) values (v_event, 'rls_backup_test', 'Backup Test');
  perform public.seed_event_roles(v_event);
  select id into v_admin_role from public.event_roles where event_id = v_event and key = 'admin';
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
  values (v_event, v_org, 'bk-org@test.invalid', 'Organiser', 'event_admin', v_admin_role, 'active', now());
  insert into public.albums (id, event_id, title) values (v_album, v_event, 'A');
  insert into public.media (id, event_id, album_id, kind, storage_path, status)
  values (v_media, v_event, v_album, 'photo', 'x.jpg', 'ready');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  begin
    update public.media set backed_up_at = now() where id = v_media;
    raise exception 'an organiser marked a photo as backed up';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.backup_purge_queue;
    raise exception 'an organiser can read the backup purge queue';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into n from public.missing_events(array[v_event, gen_random_uuid()]);
  if n <> 1 then raise exception 'missing_events should find exactly the made-up id, found %', n; end if;

  raise notice 'backup: all checks passed';
end;
$$;

rollback;
