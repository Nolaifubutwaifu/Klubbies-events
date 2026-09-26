-- Stable ordering key for album grids and viewer navigation: capture time when
-- EXIF provided it, otherwise upload time. Enables keyset pagination.
alter table public.media
  add column sort_at timestamptz generated always as (coalesce(captured_at, created_at)) stored;

drop index if exists public.media_album_idx;
create index media_album_sort_idx on public.media (album_id, sort_at, id);
