-- Committee tools: schedule an album to go live, hide one without deleting it,
-- and put albums in a deliberate order.

-- Queue a draft to publish itself. The cron picks these up; nothing else reads
-- it, so a null means "publish by hand".
alter table public.albums add column publish_at timestamptz;

-- Explicit ordering, falling back to event date when everything is 0 (which is
-- every existing album, so nothing reorders on deploy).
alter table public.albums add column sort_order integer not null default 0;

-- "Hidden" is a third state, not a flag: the members' select policy only
-- admits status = 'published', so a hidden album disappears from the club
-- without touching a single file.
alter table public.albums drop constraint albums_status_check;
alter table public.albums add constraint albums_status_check
  check (status in ('draft', 'published', 'hidden'));

-- The scheduler's working set: drafts with a due date, and nothing else.
create index albums_publish_due_idx on public.albums (publish_at)
  where status = 'draft' and publish_at is not null;

create index albums_sort_idx on public.albums (club_id, sort_order desc, event_date desc);
