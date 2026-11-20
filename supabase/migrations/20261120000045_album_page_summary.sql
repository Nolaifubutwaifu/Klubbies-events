-- Everything the album page counts, in one pass over the album's media.
-- The page used to make four calls that each read every row of the album
-- (photo and video counts, zip part sizes, credits, "a photographer" uploads),
-- and RLS checks every row on each of them. With 50 guests opening a 2,158
-- photo album at once that was most of the database's work (20 Nov 2026).
--
-- Security invoker, so RLS decides which rows count, exactly as the four
-- reads it replaces: the counts and sizes are ready files only (as
-- album_media_counts and album_media_sizes), credits and the guest flag look
-- at every visible file (as album_credits and the old head count).
-- Safe to re-run.
begin;
set local lock_timeout = '5s';

create or replace function public.album_page_summary(p_album_id uuid)
returns table (
  photo_count integer,
  video_count integer,
  sizes bigint[],
  photographer_names text[],
  uploader_ids uuid[],
  has_guest_files boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (count(*) filter (where m.status = 'ready' and m.kind = 'photo'))::integer,
    (count(*) filter (where m.status = 'ready' and m.kind = 'video'))::integer,
    coalesce(array_agg(m.byte_size order by m.sort_at, m.id) filter (where m.status = 'ready'), '{}'),
    coalesce(array_agg(distinct btrim(m.photographer_name)) filter (where nullif(btrim(m.photographer_name), '') is not null), '{}'),
    coalesce(array_agg(distinct m.uploaded_by) filter (where m.uploaded_by is not null), '{}'),
    coalesce(bool_or(m.guest_link_id is not null), false)
  from public.media m
  where m.album_id = p_album_id;
$$;
revoke execute on function public.album_page_summary(uuid) from public, anon;
grant execute on function public.album_page_summary(uuid) to authenticated, service_role;

commit;
