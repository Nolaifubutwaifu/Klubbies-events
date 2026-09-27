-- Signed-in users could rewrite their own rows through the REST API.
--
-- `authenticated` holds table-wide UPDATE on memberships and media, and the
-- self-update policies (memberships_update_self, memberships_ack_face_notice,
-- media_update's uploaded_by branch) only check whose row it is. So an
-- attendee could PATCH their membership to the organiser role, set a revoked
-- membership back to active, or move it into another event; and an uploader
-- could un-hide a photo someone asked to have taken down.
--
-- Column grants can't separate the two audiences (they apply to every policy),
-- so these triggers do: the service role and migrations pass untouched,
-- people who manage the event keep today's rights, everyone else may only
-- touch the columns the app writes for them.

create or replace function private.guard_membership_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
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

create trigger guard_membership_update
  before update on public.memberships
  for each row execute function private.guard_membership_update();

create or replace function private.guard_media_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
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

create trigger guard_media_update
  before update on public.media
  for each row execute function private.guard_media_update();
