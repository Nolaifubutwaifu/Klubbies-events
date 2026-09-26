# Klubbies Masterfile

Project brief and build guide for Claude Code. Treat this file as the source of truth for scope, naming and architecture. When something here conflicts with an ad hoc instruction in a chat, ask before diverging.

## 1. What we are building

Klubbies is a private media sharing platform for university clubs and, later, any membership based organisation.

A club admin creates a club, uploads a member list, and uploads photos and videos from club events. Members sign in and see only the media belonging to clubs they are a member of. Nobody else can see anything.

The problem it replaces: sharing an unlisted Google Drive folder link, which is ugly, leaks easily, gives no control over who actually opens it, and looks unprofessional.

The feel we want: a private social feed for the club, not a file server.

## 2. Design source of truth

The visual design already exists as a Claude Design file named `Klubbies.dc.html`.

Before writing any UI, place that file at `design/Klubbies.dc.html` in the repo and read it. Extract from it:

* the colour palette, and write it into `tailwind.config.ts` as named tokens
* the type scale and font families
* spacing rhythm, corner radius, shadow and border treatments
* component shapes: buttons, cards, nav, media grid, modals, empty states

Do not invent a new visual language. If a screen is missing from the design file, build it from the existing tokens and components and flag it in the pull request description.

## 3. Product principles

* Access is the product. Every media item must be unreachable without a verified session that carries membership.
* Feels social, not administrative. Members land on a feed of events, not a file tree.
* Admin work is boring and fast. Roster import and bulk upload must survive messy real world spreadsheets.
* Mobile first. Most members will open this on a phone at 11pm after an event.
* Ship v1 narrow. Face recognition is exciting and it is explicitly out of scope for v1.

### Non goals for v1

* No public profiles, no follower graph, no direct messages.
* No comments or likes in v1. Reactions land in v1.1 if members ask for them.
* No payments or subscriptions.
* No native mobile app. Progressive web app behaviour only.
* No face recognition.

## 4. Roles

| Role | Scope | Can do |
| --- | --- | --- |
| `super_admin` | Platform | Manage all clubs, used by Max only |
| `club_admin` | One club | Create and edit the club, manage roster, upload and delete media, create albums, see access logs |
| `club_member` | One club | View and download media for their club, search, filter by album |

A single user account can hold different roles in different clubs. Roles live on the membership record, never on the user record.

## 5. Core journeys

### 5.1 Club admin creates a club
1. Signs in.
2. Creates a club: name, university, short description, logo, accent colour.
3. Gets a club handle, for example `klubbies.app/c/uq-volleyball`.
4. Imports a roster or adds members by hand.
5. Creates an album, for example "Gala Dinner 2026", and uploads media into it.
6. Optionally announces the album, which emails every member on the roster with a link.

### 5.2 Member gets access
1. Member opens the club link or the home page.
2. Enters full name and email address. This is the form the design shows and it stays.
3. Backend checks the email against the roster of every club.
   * If found, it emails a six digit code to that address.
   * If not found, the response is a neutral message: if that address is on a club roster, a code has been sent. Never reveal whether an email exists.
4. Member enters the code and gets a session.
5. On first successful sign in, the supplied full name is stored on the membership record and compared loosely to the roster name for the admin's benefit. A name mismatch never blocks access, it only raises a flag in the admin view.
6. Member lands on the feed for their club. If they belong to several clubs, they land on a club switcher.

Important: the emailed code is what actually authenticates. The name field alone is not a credential, because a name and an email address are both guessable. Keep the design's two field form, add the code step behind it.

### 5.3 Member finds media
* Browses albums in reverse chronological order.
* Opens an album into a masonry grid of photos and video thumbnails.
* Taps an item for a full screen viewer with swipe navigation, download button and item metadata.
* Downloads a single item, or the whole album as a zip, if the album allows it.

### 5.4 Member leaves the club
Admin removes them from the roster. The membership moves to `grace` rather than straight to `revoked`, and `grace_ends_at` is set to 30 days from now.

During the grace window:

* The member can still sign in and can still view and download everything they had access to before.
* A persistent banner tells them the exact date their access ends and offers a download of the whole archive.
* An email goes out on day one, day seven and day twenty nine.
* They cannot see anything uploaded after the removal date. Filter media by `captured_at` and by upload time against the grace start.

When the window closes, a scheduled job flips the status to `revoked`. Sessions for that membership fail on the next request and any signed URLs they still hold expire within the standard window.

A club admin can end the grace window immediately if someone was removed for cause. That action requires typing the member's name to confirm.

## 6. Tech stack

Fixed choices. Do not substitute without asking.

* Next.js with the App Router, TypeScript, React Server Components where sensible
* Tailwind CSS, tokens generated from the design file
* Supabase: Postgres, Storage, Auth (email one time password), Edge Functions
* Row Level Security on every table. No table ships without policies.
* Vercel for hosting
* Resend for transactional email, with React Email templates
* Zod for every input boundary
* Vitest plus Playwright for tests
* pnpm

### Repository layout

```
app/                Next.js routes
  (marketing)/      public landing, pricing later
  (auth)/           sign in, code entry
  (app)/            authenticated shell
    c/[handle]/     club feed, albums, viewer
    admin/          club admin area
components/
lib/
  auth/
  storage/
  roster/
  db/
supabase/
  migrations/
  functions/
design/Klubbies.dc.html
```

## 7. Data model

Postgres, UUID primary keys, `created_at` and `updated_at` on every table.

```sql
users (
  id uuid primary key,          -- mirrors auth.users.id
  email citext unique not null,
  display_name text,
  avatar_url text,
  is_super_admin boolean default false
)

clubs (
  id uuid primary key,
  handle citext unique not null,     -- url slug, generated from name, see 7.1
  name text not null,
  organisation text,                 -- university or parent body
  description text,
  logo_path text,
  accent_colour text,
  created_by uuid references users(id),
  status text default 'active'       -- active | archived
)

memberships (
  id uuid primary key,
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references users(id),  -- null until first sign in
  roster_email citext not null,
  roster_name text not null,
  claimed_name text,                  -- what they typed at sign in
  role text not null default 'club_member',
  status text not null default 'pending', -- pending | active | grace | revoked
  invited_at timestamptz,
  first_seen_at timestamptz,
  grace_started_at timestamptz,
  grace_ends_at timestamptz,
  unique (club_id, roster_email)
)

albums (
  id uuid primary key,
  club_id uuid references clubs(id) on delete cascade,
  title text not null,
  description text,
  event_date date,
  cover_media_id uuid,
  visibility text default 'members',  -- members | admins
  allow_download boolean default true,
  status text default 'published'     -- draft | published
)

media (
  id uuid primary key,
  club_id uuid references clubs(id) on delete cascade,
  album_id uuid references albums(id) on delete set null,
  kind text not null,                 -- photo | video
  storage_path text not null,
  thumb_path text,
  poster_path text,                   -- video poster frame
  width int, height int,
  duration_seconds numeric,
  byte_size bigint,
  mime_type text,
  original_filename text,
  captured_at timestamptz,            -- from EXIF when present
  uploaded_by uuid references users(id),
  status text default 'processing'    -- processing | ready | failed
)

access_events (
  id bigint generated always as identity primary key,
  club_id uuid,
  membership_id uuid,
  media_id uuid,
  action text,                        -- view | download | zip
  ip_hash text,
  user_agent text,
  occurred_at timestamptz default now()
)

roster_imports (
  id uuid primary key,
  club_id uuid,
  filename text,
  row_count int,
  matched_count int,
  added_count int,
  error_count int,
  report jsonb,
  imported_by uuid,
  imported_at timestamptz default now()
)
```

### 7.1 Club handle generation

The admin never types a handle. It is derived from the club name at creation time:

1. Lowercase, strip accents, replace anything that is not a letter or digit with a single underscore, trim leading and trailing underscores.
2. Truncate to 40 characters at a word boundary.
3. If taken, append `_2`, then `_3`, and so on.
4. Show the resulting URL on the creation screen so the admin sees what they are getting.

Handles are immutable once media exists, because links are shared in group chats and must not rot. Changing a handle is a super admin action that leaves a permanent redirect behind.

### Row Level Security rules

* `clubs`: readable if the requester has an active membership in that club, or is super admin.
* `memberships`: a member reads only their own row. A club admin reads all rows for their club.
* `albums` and `media`: readable only through a membership in status `active` or `grace` in the owning club, and for albums with visibility `admins` only by club admins. For a membership in `grace`, the policy additionally requires the item to have been uploaded before `grace_started_at`.
* Writes on `albums`, `media`, `memberships` require `club_admin` for that club.
* `access_events` is insert only from the server. No client reads.

Write a Postgres helper function `is_club_member(club_id uuid)` and `is_club_admin(club_id uuid)` and use them in every policy so the logic lives in one place.

## 8. Storage and media access

* One private Supabase Storage bucket named `club_media`. Public access is off, permanently.
* Path convention: `clubs/{club_id}/albums/{album_id}/{media_id}/original.{ext}` with siblings `thumb.webp` and `poster.jpg`.
* The browser never receives a raw storage path. Every image and video is served through a short lived signed URL issued by a server route that first checks membership.
* Signed URL lifetime: 10 minutes for thumbnails and grid images, 60 minutes for a video stream, 5 minutes for a download link.
* Batch signing: the feed route signs a page of items in one call so the grid does not fire one request per tile.
* Zip download runs in a background job, writes the zip into a temporary path and emails a signed link when it is ready. Large albums are split into numbered parts of roughly 2 GB each rather than being refused.

### 8.1 Storage volume

Clubs upload as many full quality files as they like. There is no per club cap, no forced downscaling and no silent compression in v1. The original file is always kept byte for byte, because a member downloading a headshot must get the same file the photographer produced.

Design consequences:

* Every layer must treat storage as unbounded and growing. No operation may load a whole album into memory, and no query may return an unpaginated media list.
* Derivatives are cheap and disposable: a `thumb.webp` at roughly 400 pixels on the long edge for grids, and a `display.webp` at roughly 2000 pixels for the viewer. Only a deliberate download touches the original. This is what keeps the bandwidth bill sane while the originals sit untouched.
* Record `byte_size` on every item and maintain a running total per club in a `club_storage_usage` view so cost per club is visible from day one, even though nothing is enforced.
* Keep the storage layer behind `lib/storage` with a narrow interface. If Supabase Storage becomes expensive at scale, swapping the backing store for S3 or Cloudflare R2 should touch one module, not the whole application.
* Set a lifecycle rule that moves originals older than twelve months to infrequent access storage once the platform is on a provider that offers it. Retrieval is slower, which is acceptable for a photo from two years ago.

## 9. Upload and processing pipeline

1. Admin drops files into the upload area. Accept jpg, jpeg, png, heic, webp, mp4, mov.
2. Client requests an upload ticket per file, then uploads straight to Supabase Storage. The Next.js server never proxies file bytes.
3. Client extracts image dimensions and generates a thumbnail before upload where possible, to keep the free tier cheap.
4. A Supabase Edge Function or a small worker finishes the job: reads EXIF for `captured_at`, converts heic to webp, extracts a video poster frame, writes `thumb_path` and `poster_path`, then flips `media.status` to `ready`.
5. Video in v1 is plain progressive mp4 playback. Transcoding and adaptive streaming are deferred. Warn the admin if a single video exceeds 500 MB.
6. Uploads are resumable. A failed file shows a retry button and never blocks the rest of the batch.

## 10. Roster import

This is the feature most likely to frustrate admins, so build it carefully.

* Accept `.csv`, `.xlsx` and manual entry of one member per line.
* Parse with SheetJS. Do not assume the header row is row one. Scan the first 10 rows for a row that looks like headers.
* Column mapping screen: show the detected columns and let the admin map them to `full_name` and `email`. Remember the mapping per club for next time.
* Normalise emails: trim, lowercase. Reject anything that fails a strict email check and list it in the error report.
* Deduplicate on email within the file and against the existing roster.
* Show a preview before commit: X new members, Y already present, Z rows with problems, with the problem rows listed and downloadable.
* Import is additive by default. Removing members is a separate explicit action with a confirmation that names how many people lose access.
* Store the outcome in `roster_imports` so the admin can see the history.

## 11. Route map

Pages:

```
/                         landing
/signin                   name and email form
/signin/code              code entry
/clubs                    club switcher for multi club members
/c/[handle]               club feed, albums newest first
/c/[handle]/a/[albumId]   album grid
/c/[handle]/a/[albumId]/[mediaId]  full screen viewer
/admin/[handle]           admin dashboard
/admin/[handle]/members   roster
/admin/[handle]/albums    albums and uploads
/admin/[handle]/settings  club settings
/admin/[handle]/activity  access log
```

API and server actions:

```
POST /api/auth/request_code      body: fullName, email
POST /api/auth/verify_code       body: email, code
POST /api/media/sign             body: mediaIds[]  returns signed urls
POST /api/media/upload_ticket    body: albumId, filename, mimeType, byteSize
POST /api/albums/[id]/zip        queues a zip job
POST /api/roster/preview         multipart file, returns parsed preview
POST /api/roster/commit          body: importId, mapping
```

Every route validates input with Zod and re checks authorisation server side. Never trust a club id supplied by the client without verifying membership.

## 12. Security requirements

* Rate limit `request_code` to 5 attempts per email per hour and 20 per IP per hour.
* Codes are six digits, valid for 10 minutes, single use, hashed at rest, with a maximum of 5 verification attempts.
* Sessions last 30 days with rolling refresh. Members can sign out of all devices.
* Do not leak roster membership through error messages, timing or status codes.
* Log every media view and download into `access_events`. Admins can see who opened what. Tell members this in the privacy notice, because it is a surveillance surface and they should know.
* Watermarking is not in v1, but keep `media` extensible for it.

## 13. Privacy and legal notes

Max is in Queensland, so the Australian Privacy Act applies once the business grows past the small business threshold, and clubs may be bound by their university policies regardless.

* Publish a plain English privacy policy before the first real club onboards.
* Members must be able to request deletion of media they appear in. Build a simple report and takedown flow in v1.1: a member flags an item, the club admin sees the flag and can hide or delete it.
* Face recognition creates biometric information, which is sensitive information under Australian law and needs express, informed, opt in consent from each person, not just from the club. Design phase 3 around consent from the start.
* Store nothing outside the chosen region. Pin Supabase to the Sydney region.

## 14. Phases

**v1, the thing that must exist**
Club creation, roster import, member sign in with code, albums, photo and video upload, private feed, viewer, download, access log, admin basics.

**v1.1**
Reactions, comments toggled per club, report and takedown, zip download, album announcement emails, member self service name correction, club branding.

**Later, unscheduled**
Committee only albums. The `albums.visibility` column exists in v1 and the policies already honour it, so every album simply ships as `members` and no interface exposes the choice. Building this later is a screen and a toggle, not a migration.

**v2**
Multiple admins per club, invite links with expiry, storage quotas and a paid tier, tags and search, Google and Microsoft sign in for university accounts.

Joint events also land here: one album owned by two or more clubs, visible to the union of both rosters, with a single upload surface and either club able to add media. The v1 schema already anticipates it, since `albums.club_id` can later be joined by an `album_clubs` table without a destructive migration. Do not build it in v1, but do not hard code the assumption that an album has exactly one club anywhere outside the database column itself.

**v3, face recognition**
Opt in only. Member uploads a reference selfie, embeddings computed with a face embedding model, stored in pgvector, matched against embeddings extracted from club media at upload time. Members can find themselves; nobody can search for another person by face. Deleting the reference selfie deletes every embedding derived from it. Treat this as a separate design document when we get there.

## 15. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      server only, never exposed
RESEND_API_KEY
APP_URL
SIGNED_URL_SECRET
```

## 16. Working agreement for Claude Code

* Read this file and `design/Klubbies.dc.html` before starting any task.
* One migration file per schema change, in `supabase/migrations`, never edit a migration that has already run.
* Every new table ships with its RLS policies in the same migration.
* TypeScript strict mode on. No `any`.
* Write a Playwright test for each of these paths before calling a milestone done: non member is refused, member sees only their club, revoked member loses access, signed URL expires.
* Seed script that creates two clubs, three members and a dozen sample media items so the UI can be developed without manual setup.
* Keep a running `docs/decisions.md` with any choice made that this file did not cover.

## 17. Decisions already made

These are settled. Do not reopen them without asking Max.

1. **Joint events across clubs**: deferred to v2. Keep the schema open to it as described in section 14.
2. **Departing members**: 30 day grace window with view and download access to everything uploaded before their removal, then full revocation. Detailed in section 5.4.
3. **Committee only albums**: not in v1 and not scheduled. The column and policies stay in the schema so it costs nothing to add later, but no interface for it gets built until Max asks.
4. **Storage**: unlimited in practice. Clubs upload as many full quality files as they want, originals preserved untouched, cost controlled through derivatives rather than through limits on the club. Section 8.1.
5. **Club handle**: generated from the club name, immutable once media exists. Section 7.1.

## 18. Still open

Nothing blocking. Raise anything new in `docs/decisions.md`.
