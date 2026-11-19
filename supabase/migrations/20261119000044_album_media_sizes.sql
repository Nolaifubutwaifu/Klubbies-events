-- One call for the zip part labels on an album page ("Part 1 of 15, 506 MB"):
-- every ready file's size, in album order. The page used to read media 1,000
-- rows at a time, one request after another: 3 round trips for 2,158 photos,
-- about 1.8 s of a 3.4 s album page with 50 guests at once (18 Nov 2026).
--
-- Security invoker, so RLS decides which rows count, exactly as the select it
-- replaces. Safe to re-run.
begin;
set local lock_timeout = '5s';

create or replace function public.album_media_sizes(p_album_id uuid)
returns bigint[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(m.byte_size order by m.sort_at, m.id), '{}')
  from public.media m
  where m.album_id = p_album_id
    and m.status = 'ready';
$$;
revoke execute on function public.album_media_sizes(uuid) from public, anon;
grant execute on function public.album_media_sizes(uuid) to authenticated, service_role;

commit;
