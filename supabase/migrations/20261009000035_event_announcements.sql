-- The announcement email, sent by us for the organiser (paid sizes). Each
-- send is recorded, so the share page can show what went out and the limit
-- per event can be enforced, and anyone can opt out of an event's
-- announcements from the email itself, account or not.
create table public.event_announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sent_by uuid references public.users(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 4000),
  recipient_count int not null default 0,
  sent_at timestamptz not null default now()
);
create index event_announcements_event on public.event_announcements (event_id, sent_at desc);

alter table public.event_announcements enable row level security;
create policy "organisers read their event's announcements"
  on public.event_announcements for select to authenticated
  using (private.event_perm(event_id, 'manage_event'));
-- Writes go through the server with the service role, after its own checks.

create table public.announcement_optouts (
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, email)
);
alter table public.announcement_optouts enable row level security;
-- No policies: only the service role reads or writes opt-outs.
