-- The 12 month deletion date (migration 31): set from the event's last day,
-- moved by Keep another year, and never passed by the gallery's closing date.
--
--   (via the Supabase MCP, or psql -f supabase/tests/retention.sql)

begin;

do $$
declare
  v_event uuid := gen_random_uuid();
  v_delete timestamptz;
  v_access timestamptz;
begin
  insert into public.events (id, handle, name, starts_on, ends_on)
  values (v_event, 'rls_retention_test', 'Retention Test', '2026-10-09', '2026-10-10');
  select photos_delete_at, access_ends_at into v_delete, v_access from public.events where id = v_event;
  if v_delete <> '2027-10-11 00:00:00+10'::timestamptz then
    raise exception 'deletion should be the end of the last day plus 12 months, got %', v_delete;
  end if;
  if v_access <> v_delete then raise exception 'a new gallery should stay open until deletion, closes %', v_access; end if;

  -- Keep another year: both move, the gallery with it because it sat on the default.
  update public.events set extra_years = 1 where id = v_event;
  select photos_delete_at, access_ends_at into v_delete, v_access from public.events where id = v_event;
  if v_delete <> '2028-10-11 00:00:00+10'::timestamptz or v_access <> v_delete then
    raise exception 'Keep another year should move deletion and closing to 2028, got % and %', v_delete, v_access;
  end if;

  -- An organiser's earlier closing date stays; a later one is capped; none means until deletion.
  update public.events set access_ends_at = '2026-12-01 00:00:00+10' where id = v_event;
  select access_ends_at into v_access from public.events where id = v_event;
  if v_access <> '2026-12-01 00:00:00+10'::timestamptz then raise exception 'an earlier closing date should stay, got %', v_access; end if;
  update public.events set ends_on = '2026-10-12' where id = v_event;
  select photos_delete_at, access_ends_at into v_delete, v_access from public.events where id = v_event;
  if v_delete <> '2028-10-13 00:00:00+10'::timestamptz or v_access <> '2026-12-01 00:00:00+10'::timestamptz then
    raise exception 'moving the event should move deletion but keep the chosen closing date, got % and %', v_delete, v_access;
  end if;
  update public.events set access_ends_at = '2031-01-01 00:00:00+10' where id = v_event;
  select access_ends_at into v_access from public.events where id = v_event;
  if v_access <> v_delete then raise exception 'a closing date past deletion should be capped, got %', v_access; end if;
  update public.events set access_ends_at = null where id = v_event;
  select access_ends_at into v_access from public.events where id = v_event;
  if v_access <> v_delete then raise exception 'no closing date should mean until deletion, got %', v_access; end if;

  -- Once photos are deleted the date is fixed.
  update public.events set photos_deleted_at = now(), ends_on = '2026-12-31' where id = v_event;
  select photos_delete_at into v_access from public.events where id = v_event;
  if v_access <> v_delete then raise exception 'the deletion date moved after the photos were deleted'; end if;

  raise notice 'retention: all checks passed';
end;
$$;

rollback;
