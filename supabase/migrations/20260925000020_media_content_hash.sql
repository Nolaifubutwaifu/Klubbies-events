-- The same file, once per album.
--
-- The first real club's library had 29 of its first 60 photos twice: the
-- same DSC files uploaded a second time after a batch that had already gone
-- through. That inflated the photo count, the zip, storage and every face
-- match ("6 photos of you" was 3 photos twice).
--
-- The browser now hashes each file before asking for an upload ticket, and
-- the ticket route answers "already here" instead of minting a second row.
-- The index makes that true under a race too: two tabs dropping the same
-- file at once get one row between them.
--
-- Rows uploaded before this have no hash, so the index doesn't see them.
-- scripts/dedupe-media.ts fills the column in for those and removes the
-- extra copies (dry run by default).

alter table public.media add column content_hash text;

comment on column public.media.content_hash is
  'SHA-256 of the original file, computed in the uploader''s browser (sampled for very large videos, prefixed "s:"). Null for rows uploaded before 2026-09-25 until backfilled.';

create unique index media_album_content_hash_key
  on public.media (album_id, content_hash)
  where content_hash is not null and album_id is not null;
