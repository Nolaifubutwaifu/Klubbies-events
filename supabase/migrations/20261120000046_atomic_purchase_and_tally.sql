-- Two read-then-write sequences that lost data (audit, 20 Nov 2026).
--
-- 1. "Keep another year" recorded the purchase, then added the year in a
--    second call. If the second call failed, Stripe's retry found the
--    purchase, took it as already applied, and the year was never added.
--    Now both happen in one transaction: either the purchase and the year
--    are both saved, or neither is and the retry does the work.
--
-- 2. A photographer link's upload tally was read, increased by one and
--    written back. Uploads finishing together overwrote each other: the
--    load-test links showed 929 and 930 for 1,000 and 999 photos. Now one
--    UPDATE does the increment. The backfill below raises any tally that
--    fell behind (it never lowers one).
--
-- Apply before the code that calls these goes live. Until then that code
-- fails loudly: the keep-year webhook returns 500 and Stripe retries it.

create or replace function public.apply_keep_year(
  p_event_id uuid,
  p_session_id text,
  p_amount_cents int,
  p_list_amount_cents int,
  p_currency text,
  p_customer_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_purchases (event_id, kind, amount_cents, list_amount_cents, currency, stripe_session_id)
  values (p_event_id, 'keep_year', p_amount_cents, p_list_amount_cents, coalesce(p_currency, 'aud'), p_session_id)
  on conflict (stripe_session_id) do nothing;
  -- Already applied by the webhook or the return from Checkout.
  if not found then
    return false;
  end if;
  -- Too late once the photos are gone: the purchase is still recorded.
  update public.events
     set extra_years = extra_years + 1,
         stripe_customer_id = coalesce(p_customer_id, stripe_customer_id)
   where id = p_event_id
     and photos_deleted_at is null;
  return true;
end;
$$;

create or replace function public.record_guest_upload(p_link_id uuid, p_bytes bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.album_guest_links
     set file_count = file_count + 1,
         byte_total = byte_total + greatest(0, p_bytes),
         first_used_at = coalesce(first_used_at, now()),
         last_used_at = now()
   where id = p_link_id;
$$;

revoke all on function public.apply_keep_year(uuid, text, int, int, text, text) from public, anon, authenticated;
revoke all on function public.record_guest_upload(uuid, bigint) from public, anon, authenticated;
grant execute on function public.apply_keep_year(uuid, text, int, int, text, text) to service_role;
grant execute on function public.record_guest_upload(uuid, bigint) to service_role;

-- Raise tallies that lost counts to what actually landed. Binned files still
-- count (they were uploaded); purged ones are gone and can't be recounted.
update public.album_guest_links l
   set file_count = greatest(l.file_count, c.files),
       byte_total = greatest(l.byte_total, c.bytes)
  from (
    select guest_link_id, count(*)::int as files, coalesce(sum(byte_size), 0)::bigint as bytes
      from public.media
     where guest_link_id is not null
       and status = 'ready'
     group by guest_link_id
  ) c
 where c.guest_link_id = l.id
   and (l.file_count < c.files or l.byte_total < c.bytes);
