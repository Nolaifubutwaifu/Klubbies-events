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

-- One claim owns the name. Null, POSIX space (tab, newline, …), NBSP and
-- U+FEFF count as unnamed, which is what JS trim() treats as blank. A name
-- that is only those characters is rejected, and so is one outside 1 to 200
-- characters. The caller that gets true continues; the other gets nothing.
--
-- Supabase grants execute on a new public function to anon and authenticated.
-- `revoke from public` does not remove those grants, and this function is
-- security definer with the user id as an argument. Same revoke as
-- claim_face_jobs (migration 13).
create or replace function public.claim_display_name(p_user_id uuid, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  if coalesce(length(p_name), 0) not between 1 and 200
     or p_name ~ ('^[[:space:]' || chr(160) || chr(65279) || ']*$') then
    return false;
  end if;
  update public.users
  set display_name = p_name
  where id = p_user_id
    and (
      display_name is null
      or display_name ~ ('^[[:space:]' || chr(160) || chr(65279) || ']*$')
    )
  returning id into claimed;
  return claimed is not null;
end;
$$;

revoke execute on function public.claim_display_name(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_display_name(uuid, text) to service_role;

-- Counts one guess against the live code. The increment and the cap are the
-- same update, so two guesses at once cannot both pass a counter they read
-- as 4. Five is MAX_VERIFY_ATTEMPTS in lib/auth/flow.ts. A bound row counts
-- code_attempts and must still be inside the name-step window. An unbound
-- row counts attempts. There is no citext = text operator, so a text
-- parameter would cast the column to text and compare case-sensitively.
-- Cast the parameter to citext instead. Tables stay schema-qualified.
create or replace function public.spend_sign_in_attempt(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  spent text;
begin
  update public.pending_sign_ins
  set code_attempts = code_attempts + 1
  where email = p_email::extensions.citext
    and user_id is not null
    and expires_at >= now()
    and code_expires_at is not null
    and code_expires_at >= now()
    and code_attempts < 5
  returning email::text into spent;
  if spent is not null then
    return true;
  end if;

  update public.pending_sign_ins
  set attempts = attempts + 1
  where email = p_email::extensions.citext
    and user_id is null
    and expires_at >= now()
    and attempts < 5
  returning email::text into spent;
  return spent is not null;
end;
$$;

revoke execute on function public.spend_sign_in_attempt(text) from public, anon, authenticated;
grant execute on function public.spend_sign_in_attempt(text) to service_role;
