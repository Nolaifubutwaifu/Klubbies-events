-- The update guards from migration 23 asked the request's claimed role
-- (auth.role()) whether to check a write. That also caught trusted database
-- functions running on a user's behalf (security definer, so current_user is
-- their owner) and a session that had reset its role but kept its claims.
-- The guard is about what a signed-in person can write through the API, so it
-- now asks the actual database role instead, and runs as the caller (security
-- invoker) so that role is the caller's and not the function owner's. Same
-- rules otherwise.

create or replace function private.guard_membership_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.event_id is distinct from old.event_id
     or new.user_id is distinct from old.user_id
     or new.roster_email is distinct from old.roster_email then
    raise exception 'membership event, user and email cannot be changed' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_members') then
    return new;
  end if;

  -- A member's own row: accept or decline, acknowledge the face notice.
  if (new.role, new.role_id, new.status, new.roster_name, new.claimed_name, new.name_mismatch,
      new.invited_at, new.first_seen_at, new.grace_started_at, new.grace_ends_at, new.grace_notices_sent)
     is distinct from
     (old.role, old.role_id, old.status, old.roster_name, old.claimed_name, old.name_mismatch,
      old.invited_at, old.first_seen_at, old.grace_started_at, old.grace_ends_at, old.grace_notices_sent) then
    raise exception 'only organisers can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_membership_update() from public, anon, authenticated;


create or replace function private.guard_media_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.event_id is distinct from old.event_id then
    raise exception 'media cannot move between events' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_albums') then
    return new;
  end if;

  -- An uploader finishing their own file: status, dimensions, derivatives.
  if (new.album_id, new.uploaded_by, new.hidden_at, new.guest_link_id, new.photographer_name,
      new.storage_path, new.content_hash, new.kind)
     is distinct from
     (old.album_id, old.uploaded_by, old.hidden_at, old.guest_link_id, old.photographer_name,
      old.storage_path, old.content_hash, old.kind) then
    raise exception 'only organisers can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_media_update() from public, anon, authenticated;
