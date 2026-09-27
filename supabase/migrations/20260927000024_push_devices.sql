-- iPhone push notifications. One row per app install that said yes to
-- notifications. The app hands its APNs token to the site, which stores it
-- against the signed-in person; new albums are then pushed to
-- every device of every member who wants that kind of notice.
--
-- Written and read only with the service role, after the route has checked
-- who is signed in, so RLS is on with no policies. Deleting the person
-- deletes their devices.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null unique,
  -- Debug builds talk to Apple's sandbox, TestFlight and App Store builds to
  -- production. A token only works against the one it came from.
  environment text not null check (environment in ('sandbox', 'production')),
  platform text not null default 'ios' check (platform in ('ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_devices_user_id_idx on public.push_devices (user_id);

alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;
