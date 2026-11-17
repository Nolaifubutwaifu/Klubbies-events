-- Migration 041: a media row cannot point at another event's files, and an
-- avatar cannot point outside avatars/{that user}/. Rolls back.
--
--   psql -f supabase/tests/media_paths.sql

begin;

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
end $$;

rollback;
