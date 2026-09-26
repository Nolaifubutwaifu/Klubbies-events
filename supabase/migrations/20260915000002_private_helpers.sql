-- Move RLS helper functions out of the exposed API schema so they cannot be
-- called over /rest/v1/rpc. Policies reference functions by OID and keep
-- working after the move; bodies are recreated to point at the new schema.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_super_admin() set schema private;
alter function public.is_event_admin(uuid) set schema private;
alter function public.is_event_member(uuid) set schema private;
alter function public.can_view_event_item(uuid, timestamptz) set schema private;
alter function public.storage_event_id(text) set schema private;
alter function public.storage_media_id(text) set schema private;

create or replace function private.is_event_admin(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.memberships m
    where m.event_id = is_event_admin.event_id
      and m.user_id = auth.uid()
      and m.role = 'event_admin'
      and m.status = 'active'
  );
$$;

create or replace function private.is_event_member(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin() or exists (
    select 1 from public.memberships m
    where m.event_id = is_event_member.event_id
      and m.user_id = auth.uid()
      and (m.status = 'active' or (m.status = 'grace' and m.grace_ends_at > now()))
  );
$$;

create or replace function private.can_view_event_item(event_id uuid, created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_event_admin(can_view_event_item.event_id) or exists (
    select 1 from public.memberships m
    where m.event_id = can_view_event_item.event_id
      and m.user_id = auth.uid()
      and (
        m.status = 'active'
        or (
          m.status = 'grace'
          and m.grace_ends_at > now()
          and can_view_event_item.created_at < m.grace_started_at
        )
      )
  );
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.media_album_same_event() from public, anon, authenticated;
