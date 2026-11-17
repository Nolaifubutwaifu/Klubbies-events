-- Videos may be 200 MiB. event_media.file_size_limit is the bucket ceiling.
-- Production was already 500 MiB (524288000), set in the dashboard, not in a
-- migration. This raises a missing or lower limit to 200 MiB and never lowers
-- a higher one, so applying it there changes nothing.
--
-- A bucket limit cannot be higher than the project global file size limit
-- (Dashboard > Storage > Settings). The live bucket is already 500 MiB, so
-- that global limit is already at least 500 MiB. If a future project shows
-- a global limit of 50 MB, raise that first or this column cannot be the
-- thing that lets a 200 MiB upload through.
--
-- Idempotent. lock_timeout so the update does not wait on a busy bucket row.

set lock_timeout = '5s';

update storage.buckets
set file_size_limit = 200 * 1024 * 1024
where id = 'event_media'
  and (file_size_limit is null or file_size_limit < 200 * 1024 * 1024);
