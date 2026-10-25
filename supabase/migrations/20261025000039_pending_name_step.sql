-- After the email code is accepted, a new account still has to give a name.
-- That pending join stays in this row, bound to the auth user, until the name
-- is saved. user_id is null while the code itself is still unused.
--
-- expires_at is the name-step window once the row is bound (7 days). A later
-- code, so someone who signed out can get back in, uses code_attempts and
-- code_expires_at and does not touch the flow, the event, or that window.
alter table public.pending_sign_ins
  add column user_id uuid references public.users (id) on delete cascade,
  add column code_attempts int,
  add column code_expires_at timestamptz;

create index pending_sign_ins_user_id_idx
  on public.pending_sign_ins (user_id)
  where user_id is not null;

-- One claim owns the name. Null, POSIX space (tab, newline, …) and NBSP
-- count as unnamed, which is what JS trim() treats as blank for those
-- characters. The caller that gets true continues; the other gets nothing.
create or replace function public.claim_display_name(p_user_id uuid, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  update public.users
  set display_name = p_name
  where id = p_user_id
    and (
      display_name is null
      or display_name ~ ('^[[:space:]' || chr(160) || ']*$')
    )
  returning id into claimed;
  return claimed is not null;
end;
$$;

revoke all on function public.claim_display_name(uuid, text) from public;
grant execute on function public.claim_display_name(uuid, text) to service_role;
