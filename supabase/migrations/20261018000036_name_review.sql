-- ---------------------------------------------------------------------------
-- Organiser approval when the name typed at sign-in doesn't match the list
-- ---------------------------------------------------------------------------
--
-- The emailed code proves the inbox; the name is how the organiser knows who
-- that is. When someone on the list signs in under a name that doesn't
-- loosely match theirs ("higgi" for "Serena"), they wait: no photos and no
-- uploads until an organiser approves them or removes them.

alter table public.memberships
  add column name_review_at timestamptz,
  add column name_approved_at timestamptz;

comment on column public.memberships.name_review_at is
  'Set when the sign-in name did not match the list; photos stay hidden until an organiser approves.';
comment on column public.memberships.name_approved_at is
  'An organiser confirmed this person despite the name: later sign-ins are not held again.';

create index memberships_name_review_idx on public.memberships (event_id) where name_review_at is not null;

-- Migration 27's version, plus: the member branch needs no name review open.
create or replace function private.can_view_event_item(event_id uuid, created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_live(can_view_event_item.event_id) and (
    private.is_event_admin(can_view_event_item.event_id)
    or private.event_perm(can_view_event_item.event_id, 'manage_albums')
    or (
      exists (
        select 1 from public.memberships m
        where m.event_id = can_view_event_item.event_id
          and m.user_id = auth.uid()
          and m.status = 'active'
          and m.paused_at is null
          and m.name_review_at is null
      )
      and exists (
        select 1 from public.events e
        where e.id = can_view_event_item.event_id
          and (e.access_ends_at is null or e.access_ends_at > now())
      )
    )
  );
$$;

-- Migration 27's version, plus: someone waiting for approval adds nothing.
create or replace function private.can_contribute_to_album(album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.albums a
    where a.id = can_contribute_to_album.album_id
      and a.deleted_at is null
      and (
        private.event_perm(a.event_id, 'manage_albums')
        or private.event_perm(a.event_id, 'upload')
        or (
          a.contributor_scope = 'members'
          and private.is_event_member(a.event_id)
          and not exists (
            select 1 from public.memberships m
            where m.event_id = a.event_id
              and m.user_id = auth.uid()
              and (m.paused_at is not null or m.name_review_at is not null)
          )
        )
      )
  );
$$;
