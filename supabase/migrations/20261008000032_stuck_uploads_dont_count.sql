-- An upload that stopped (rejected by Storage, tab closed, connection gone)
-- stays 'processing' until the 14 day sweep. It counted against the photo
-- allowance all that time, as a full minute if it was a video, so a retry
-- could be refused because of the failure it was retrying. Only uploads still
-- moving (touched in the last hour, lib/media/constants.ts STUCK_AFTER_MS)
-- count now, alongside everything that finished.
create or replace function private.event_units_used(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.media_units(m.kind, m.duration_seconds)), 0)::int
  from public.media m
  where m.event_id = p_event_id
    and m.deleted_at is null
    and m.status <> 'failed'
    and (m.status <> 'processing' or m.updated_at > now() - interval '1 hour');
$$;
