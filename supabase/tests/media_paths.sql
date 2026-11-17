-- Migration 041: a media row cannot point at another event's files, and an
-- avatar cannot point outside avatars/{that user}/. Rolls back.
--
--   psql -f supabase/tests/media_paths.sql

begin;

create function pg_temp.check_media_paths(
  p_event uuid,
  p_other uuid,
  p_album uuid,
  p_user uuid,
  p_role text
) returns void
language plpgsql
as $$
declare
  v_ok uuid := gen_random_uuid();
begin
  if p_role = 'authenticated' then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  else
    execute 'set local role service_role';
  end if;

  insert into public.media (id, event_id, album_id, kind, storage_path, status, uploaded_by)
  values (
    v_ok, p_event, p_album, 'photo',
    'events/' || p_event || '/albums/' || p_album || '/' || v_ok || '/original.jpg',
    'processing',
    case when p_role = 'authenticated' then p_user else null end
  );
  update public.media set status = 'ready' where id = v_ok;
  if (select status from public.media where id = v_ok) is distinct from 'ready' then
    raise exception '% status-only update did not land', p_role;
  end if;

  begin
    update public.media
    set storage_path = 'events/' || p_other || '/albums/' || p_album || '/' || v_ok || '/original.jpg'
    where id = v_ok;
    raise exception '% cross-event storage_path was accepted', p_role;
  exception
    when check_violation then
      if sqlerrm not like '%media paths must stay%' then
        raise;
      end if;
  end;

  execute 'reset role';
end;
$$;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_album uuid := gen_random_uuid();
  v_media uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-paths@test.invalid', '');
  insert into public.events (id, handle, name, billing_status)
  values (v_event, 'media_paths_' || left(v_event::text, 8), 'Path event', 'unpaid');
  insert into public.events (id, handle, name, billing_status)
  values (v_other, 'media_other_' || left(v_other::text, 8), 'Other event', 'unpaid');
  insert into public.albums (id, event_id, title, status)
  values (v_album, v_event, 'Album', 'draft');

  insert into public.media (id, event_id, album_id, kind, storage_path, status)
  values (
    v_media, v_event, v_album, 'photo',
    'events/' || v_event || '/albums/' || v_album || '/' || v_media || '/original.jpg',
    'processing'
  );

  begin
    insert into public.media (id, event_id, album_id, kind, storage_path, status)
    values (
      gen_random_uuid(), v_event, v_album, 'photo',
      'events/' || v_other || '/albums/' || v_album || '/' || v_media || '/original.jpg',
      'ready'
    );
    raise exception 'cross-event storage_path was accepted';
  exception
    when check_violation then
      if sqlerrm not like '%media paths must stay%' then
        raise;
      end if;
  end;

  begin
    update public.media
    set thumb_path = 'events/' || v_other || '/albums/' || v_album || '/' || v_media || '/thumb.webp',
        status = 'ready'
    where id = v_media;
    raise exception 'cross-event thumb_path was accepted';
  exception
    when check_violation then
      if sqlerrm not like '%media paths must stay%' then
        raise;
      end if;
  end;

  update public.media
  set thumb_path = 'events/' || v_event || '/albums/' || v_album || '/' || v_media || '/thumb.webp',
      display_path = 'events/' || v_event || '/albums/' || v_album || '/' || v_media || '/display.webp',
      status = 'ready'
  where id = v_media;

  begin
    update public.users
    set avatar_url = 'events/' || v_other || '/albums/' || v_album || '/' || v_media || '/original.jpg'
    where id = v_user;
    raise exception 'avatar pointing at another event was accepted';
  exception
    when check_violation then
      if sqlerrm not like '%avatar_url must stay%' then
        raise;
      end if;
  end;

  update public.users set avatar_url = 'avatars/' || v_user || '/avatar-1.jpg' where id = v_user;

  -- authenticated and service_role both have to pass the definer guard:
  -- a real insert, a status-only update, and a cross-event path.
  perform public.seed_event_roles(v_event);
  insert into public.memberships (event_id, user_id, roster_email, roster_name, role, role_id, status, first_seen_at)
  select v_event, v_user, 'media-paths@test.invalid', 'Organiser', 'event_admin', r.id, 'active', now()
  from public.event_roles r
  where r.event_id = v_event and r.key = 'admin';

  perform pg_temp.check_media_paths(v_event, v_other, v_album, v_user, 'authenticated');
  perform pg_temp.check_media_paths(v_event, v_other, v_album, v_user, 'service_role');
end $$;

rollback;
