-- Views, downloads and how many members actually opened an album. The design
-- shows all three on every album row, and counting them per row at request
-- time meant one query per album.

create or replace view public.album_engagement
with (security_invoker = true)
as
select
  m.album_id,
  m.club_id,
  count(*) filter (where e.action = 'view') as view_count,
  count(*) filter (where e.action = 'download') as download_count,
  count(distinct e.membership_id) as member_count
from public.access_events e
join public.media m on m.id = e.media_id
where m.album_id is not null
group by m.album_id, m.club_id;

-- security_invoker means the view reads with the caller's policies, so this is
-- only ever a committee's own club. Anonymous callers get nothing.
revoke all on public.album_engagement from anon;
grant select on public.album_engagement to authenticated;
