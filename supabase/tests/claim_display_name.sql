-- claim_display_name is security definer and takes a user id, so only the
-- service role may execute it. Anon and authenticated must not: Supabase's
-- default grant on a new public function is not undone by revoke from public.
-- spend_sign_in_attempt has the same grant, and its counter stops at five.
--
-- Run it against a database with the migrations applied. It rolls back:
--
--   (via the Supabase MCP, or psql -f supabase/tests/claim_display_name.sql)
--
-- Each check raises on failure, so silence plus the final NOTICE is a pass.

begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_ok boolean;
  v_name text;
  v_attempts int;
  i int;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'claim-name@test.invalid', '');

  if has_function_privilege('anon', 'public.claim_display_name(uuid, text)', 'execute') then
    raise exception 'anon can execute claim_display_name';
  end if;
  if has_function_privilege('authenticated', 'public.claim_display_name(uuid, text)', 'execute') then
    raise exception 'authenticated can execute claim_display_name';
  end if;
  if not has_function_privilege('service_role', 'public.claim_display_name(uuid, text)', 'execute') then
    raise exception 'service_role cannot execute claim_display_name';
  end if;

  if has_function_privilege('anon', 'public.spend_sign_in_attempt(text)', 'execute') then
    raise exception 'anon can execute spend_sign_in_attempt';
  end if;
  if has_function_privilege('authenticated', 'public.spend_sign_in_attempt(text)', 'execute') then
    raise exception 'authenticated can execute spend_sign_in_attempt';
  end if;
  if not has_function_privilege('service_role', 'public.spend_sign_in_attempt(text)', 'execute') then
    raise exception 'service_role cannot execute spend_sign_in_attempt';
  end if;

  set local role anon;
  begin
    perform public.claim_display_name(v_user, 'Pwned');
    raise exception 'anon executed claim_display_name';
  exception
    when insufficient_privilege then null;
  end;
  reset role;

  set local role authenticated;
  begin
    perform public.claim_display_name(v_user, 'Pwned');
    raise exception 'authenticated executed claim_display_name';
  exception
    when insufficient_privilege then null;
  end;
  reset role;

  set local role anon;
  begin
    perform public.spend_sign_in_attempt('claim-name@test.invalid');
    raise exception 'anon executed spend_sign_in_attempt';
  exception
    when insufficient_privilege then null;
  end;
  reset role;

  select display_name into v_name from public.users where id = v_user;
  if v_name is not null then
    raise exception 'a refused call wrote a name: %', v_name;
  end if;

  set local role service_role;
  select public.claim_display_name(v_user, '') into v_ok;
  if v_ok then raise exception 'an empty name was claimed'; end if;
  select public.claim_display_name(v_user, repeat('a', 201)) into v_ok;
  if v_ok then raise exception 'a 201-character name was claimed'; end if;
  select public.claim_display_name(v_user, 'Ada Lovelace') into v_ok;
  if not v_ok then raise exception 'service_role could not claim a blank name'; end if;
  reset role;

  select display_name into v_name from public.users where id = v_user;
  if v_name <> 'Ada Lovelace' then
    raise exception 'service_role claim stored %, not Ada Lovelace', v_name;
  end if;

  set local role service_role;
  select public.claim_display_name(v_user, 'Pwned') into v_ok;
  reset role;
  if v_ok then raise exception 'a second claim overwrote the name'; end if;
  select display_name into v_name from public.users where id = v_user;
  if v_name <> 'Ada Lovelace' then raise exception 'the name changed to %', v_name; end if;

  -- U+FEFF is blank, the same as JS trim().
  update public.users set display_name = chr(65279) where id = v_user;
  set local role service_role;
  select public.claim_display_name(v_user, 'Ada Lovelace') into v_ok;
  reset role;
  if not v_ok then raise exception 'a FEFF-only name should count as blank'; end if;
  select display_name into v_name from public.users where id = v_user;
  if v_name <> 'Ada Lovelace' then raise exception 'FEFF blank was not replaced, got %', v_name; end if;

  insert into public.pending_sign_ins (email, flow, attempts, expires_at)
  values ('attempt@test.invalid', 'member', 0, now() + interval '10 minutes');
  set local role service_role;
  for i in 1..5 loop
    select public.spend_sign_in_attempt('attempt@test.invalid') into v_ok;
    if not v_ok then raise exception 'unbound spend % should be allowed', i; end if;
  end loop;
  select public.spend_sign_in_attempt('attempt@test.invalid') into v_ok;
  if v_ok then raise exception 'the sixth unbound spend was allowed'; end if;
  reset role;
  select attempts into v_attempts from public.pending_sign_ins where email = 'attempt@test.invalid';
  if v_attempts <> 5 then raise exception 'unbound attempts is %', v_attempts; end if;

  insert into public.pending_sign_ins (email, flow, attempts, expires_at, user_id, code_attempts, code_expires_at)
  values ('bound@test.invalid', 'member', 5, now() + interval '6 days', v_user, 0, now() + interval '10 minutes');
  set local role service_role;
  for i in 1..5 loop
    select public.spend_sign_in_attempt('bound@test.invalid') into v_ok;
    if not v_ok then raise exception 'bound spend % should be allowed', i; end if;
  end loop;
  select public.spend_sign_in_attempt('bound@test.invalid') into v_ok;
  if v_ok then raise exception 'the sixth bound spend was allowed'; end if;
  reset role;
  select code_attempts into v_attempts from public.pending_sign_ins where email = 'bound@test.invalid';
  if v_attempts <> 5 then raise exception 'bound code_attempts is %', v_attempts; end if;

  update public.pending_sign_ins
  set expires_at = now() - interval '8 days', code_attempts = 0, code_expires_at = now() + interval '10 minutes'
  where email = 'bound@test.invalid';
  set local role service_role;
  select public.spend_sign_in_attempt('bound@test.invalid') into v_ok;
  reset role;
  if v_ok then raise exception 'a code was accepted after the name-step window'; end if;
  select code_attempts into v_attempts from public.pending_sign_ins where email = 'bound@test.invalid';
  if v_attempts <> 0 then raise exception 'an expired window still counted a guess: %', v_attempts; end if;

  raise notice 'claim_display_name: all checks passed';
end;
$$;

rollback;
