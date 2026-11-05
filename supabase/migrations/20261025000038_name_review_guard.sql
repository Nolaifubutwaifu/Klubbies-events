-- A guest held for name review could clear their own hold.
--
-- Migration 36 added name_review_at and name_approved_at. Photos stay hidden
-- while name_review_at is set (private.can_view_event_item). The self-update
-- policy still allows a member to update any column of their own row, and
-- private.guard_membership_update, last replaced in migration 29, never
-- learned the two new columns. As authenticated, with their own JWT, a held
-- guest could set name_review_at back to null or stamp name_approved_at, and
-- the next read of can_view_event_item would let them in. Stamping
-- name_approved_at would also make the next sign-in (lib/auth/flow.ts) drop
-- the hold, because an approved name is not held again.
--
-- Same rules as migration 29. The service role and anyone who manages
-- members still pass; everyone else may not change these two columns.
-- Sign-in writes name_review_at with the service role. Approve writes both
-- columns with the service role (approveNameAction), after the app has
-- checked the caller runs the event. Remove, the reject button beside
-- Approve, still updates status through the organiser's own JWT.

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

  if new.paused_at is distinct from old.paused_at or new.let_in_at is distinct from old.let_in_at then
    raise exception 'guests are paused and let in by the event''s plan' using errcode = '42501';
  end if;

  if private.event_perm(old.event_id, 'manage_members') then
    return new;
  end if;

  -- A member's own row: accept or decline, acknowledge the face notice,
  -- stamp last seen. Not the name-review hold, and not an approval of it.
  if (new.role, new.role_id, new.status, new.roster_name, new.claimed_name, new.name_mismatch,
      new.name_review_at, new.name_approved_at,
      new.invited_at, new.first_seen_at, new.grace_started_at, new.grace_ends_at, new.grace_notices_sent)
     is distinct from
     (old.role, old.role_id, old.status, old.roster_name, old.claimed_name, old.name_mismatch,
      old.name_review_at, old.name_approved_at,
      old.invited_at, old.first_seen_at, old.grace_started_at, old.grace_ends_at, old.grace_notices_sent) then
    raise exception 'only organisers can change that' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_membership_update() from public, anon, authenticated;
