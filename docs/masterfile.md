# Klubbies Events: masterfile

The source of truth for what Klubbies Events is, how every page looks, and what was kept, dropped or added from Klubbies. Decisions made while building are in `docs/decisions.md`. The Klubbies history this started from is in `docs/klubbies-masterfile.md` and `docs/klubbies-decisions.md`.

## 1. The product in one paragraph

Klubbies Events is the one-time version of Klubbies, for corporate events, conferences, launches and meetups. The organiser creates an event, hands upload links to the designated photographers, and shares one link or QR code with attendees. Attendees verify their email, take a selfie if they want, and get every photo they appear in, ready to download. Nothing is public. The organiser sees who joined and what was downloaded, and handles removal requests.

Klubbies is a club's archive that lives for years with a changing committee. An event is one day, one team and hundreds of people who never met the organiser. That difference drives every change below.

## 2. Who uses it

| Person | Account | What they need |
| --- | --- | --- |
| Organiser | Yes | Set up in ten minutes, look professional in front of their client or boss, know the photos reached people |
| Co-organiser | Yes | Same rights as the organiser (agency staff, client contact) |
| Photographer | No, a link | Upload from a laptop at the venue or the day after, into the right album, credited |
| Attendee | Yes, email code | Find *their* photos fast, download at full quality, ask for one to come down |

## 3. Access model

An event is private. Two modes, chosen by the organiser and switchable any time:

1. **Anyone with the event link** (default). Scanning the QR or opening the link, entering a name and email and confirming the emailed code makes you an attendee. The email code is still what authenticates, so every view and download is tied to a real address.
2. **Guest list only.** Only addresses on the imported list (CSV or XLSX from Eventbrite, Humanitix, Luma, a spreadsheet) get a code. The answer to a code request stays neutral, so the list can't be probed.

**Access window.** Galleries stay open to attendees until `events.access_ends_at` (default: 90 days after the event's last day, organiser can change it or clear it). After that attendees see a "this gallery has closed" screen; organisers keep full access. This replaces Klubbies' 30-day grace period, which only makes sense for a club you leave.

Removing an attendee revokes them immediately. There is no grace window.

## 4. What changed from Klubbies

### Kept, re-labelled

| Klubbies | Events | Notes |
| --- | --- | --- |
| Club | Event | Same row, now with dates, venue and access settings |
| Members, roster import | Attendees, guest list import | Same parser; the import is only needed in guest-list mode |
| Committee / admin | Organisers | Fixed roles: Organiser, Photographer, Attendee |
| Guest photographer links | Photographer links | Named per photographer, credited on each photo |
| Albums | Albums | Keynote, Networking, Awards, Headshots. Dates optional |
| Photos of you | Your photos | The headline feature, first thing an attendee sees |
| Saved | Saved | Unchanged |
| Removal requests | Removal requests | Unchanged: hide first, organiser decides within 7 days |
| Activity log | Activity | Unchanged |
| Stripe subscription | One payment per event | Checkout in `payment` mode; the code already supports it |
| Face recognition (AWS Rekognition) | Same | On by default, notice acknowledged by every attendee, selfie optional |
| iPhone app shell | Klubbies Events app | Plus a native QR scanner to join an event |

### Dropped

| Feature | Why |
| --- | --- |
| Club feed, posts, reactions | Nobody posts notices to a one-day event |
| Custom roles, handover, past seasons | No committee turnover. Three fixed roles |
| Invitations with accept/decline | Attendees came to the event; being on the list is enough |
| 30-day grace period | Replaced by the event-wide access window |
| "On this day" anniversaries | An event has one date |
| Album event types (formal, sport, night out) | Club vocabulary |
| Club switcher dropdown | Replaced by a plain "Your events" page |
| `/how-it-works`, `/classic` | One marketing page carries it |

### Added

| Feature | What it does |
| --- | --- |
| Share kit | Event link, QR code (SVG and PNG), a printable A4 poster, and a ready-to-paste announcement email |
| Open-link joining | Attendees self-register with an email code when the event is in link mode |
| Access window | Galleries close on a date; enforced in RLS, not just the UI |
| Event details | Start and end date, venue, host organisation, shown on every attendee screen |
| Photographer credit | `media.photographer_name`, set from the upload link or the uploader, shown in the viewer |
| Download all your photos | One zip of every photo you are matched in |
| Event branding | The event's colour becomes the accent on its pages, contrast-checked so text stays readable |
| Native QR join (iPhone) | Scan the poster from inside the app and land on the event's join screen |

## 5. Design language

Klubbies is warm and playful: cream, a rounded display face, ember red, pill buttons. Events is for a room of people in lanyards, so it moves to calm and editorial, and lets the photos do the talking.

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#f7f7f5` | Page background |
| Surface | `#ffffff` | Cards, inputs |
| Mist | `#efefec` | Alternate sections, info boxes, placeholders |
| Line | `#e4e4df` | Borders, dividers |
| Line strong | `#c9c9c2` | Secondary button borders |
| Input edge | `#8a8a82` | Field borders (3:1 on white) |
| Ink | `#16181d` | Headings, primary buttons |
| Ink 2 | `#4a4d55` | Body |
| Ink 3 | `#6b6e76` | Captions (4.9:1 on white) |
| Accent (default) | `#2b4acb` | Links, active nav, chips, focus halo. Replaced per event by the event colour, darkened until it clears 4.5:1 on white |

* **Type.** Geist for everything functional (UI, body, numbers). Instrument Serif for display moments only: event names, page titles on the attendee side, the marketing headline. Organiser screens are all Geist.
* **Shape.** 10px cards, 8px inputs and buttons, 6px photos. No pills except status chips.
* **Buttons.** Primary is solid ink with white text, one per screen. Secondary is white with a line-strong border. Danger is white with red text. The event colour never fills a big button, so a client's neon brand can't make the product unreadable.
* **Photos.** Tight 4px grid gaps, no hover zoom on attendee grids (it reads as consumer), a quiet 150ms fade instead. The lightbox stays near-black.
* **Density.** Organiser screens are denser than Klubbies: tables over cards, 14 to 15px text, a 232px left rail.
* **Minimums kept from Klubbies:** nothing under 14px, no text set with opacity, 44px touch targets, skeletons not spinners.

## 6. Pages

### Public

**`/` Home (organisers).** Top bar: wordmark "Klubbies Events", Sign in, Create an event. Hero: serif headline "Every photo from your event, in every attendee's hands." One line under it, primary "Create an event", secondary "See how it works". Right side: a phone mock of the attendee "Your photos" screen. Then: three-step how it works (Set up, Shoot, Share), the attendee experience (scan, verify, selfie, download), what organisers get (branding, guest list or open link, photographer links, activity, removals), privacy and consent in plain words, pricing (one price per event), FAQ, closing CTA.

**`/signin`.** One column. Title "Sign in", name and email, Continue. With `?event=<handle>` it becomes the event's join screen: event logo, serif event name, date and venue, host line, then the same two fields and "Get my photos". Link mode says "Use the email you'd like your photos under." Guest-list mode says "Use the email you registered with."

**`/signin/code`.** Eight code boxes, auto-submit, "Nothing arrived?" help with the right advice for the event's mode.

**`/start`.** "Create an event": your name, work email, code, then the event form.

**`/g/[token]` Photographer upload.** Event logo and name, "Uploading as Jane Citizen", album picker (the link's album by default), a large drop zone, a live list of files with progress, and "Uploads keep going while this tab is open." Closed, expired and unpaid states each explain themselves.

**Legal:** `/privacy`, `/terms`, `/refunds` rewritten for events and attendees.

### Attendee

**`/events` Your events.** List of events you can open, newest first: logo, name, date, host, "Organiser" tag where it applies. Empty state explains that an organiser shares a link or QR.

**`/e/[handle]` Event home.** Branded header band: logo, serif event name, date range, venue, "Hosted by …". Directly under it, the Your photos card:
* not enrolled: "Find the photos you're in" with a selfie button and one line on how it works;
* enrolled and matched: a strip of your first photos, "23 photos of you", "See all" and "Download all";
* still looking: a live progress line.
Then the albums as a grid of cover cards (title, count, date if set). If the event has one album, its photos show inline instead of a single lonely card. The face notice, where needed, sits above everything until acknowledged. Closed events show the closed screen instead.

**`/e/[handle]/a/[albumId]` Album.** Title, count, photographer credits, Download album, Select. Grid with an "All / You" toggle when you have matches.

**`/e/[handle]/a/[albumId]/[mediaId]` Viewer.** Near-black, filmstrip, actions: Save, Download original, Details (time, camera, photographer), Request removal.

**`/e/[handle]/me` Your photos.** Selfie enrolment with consent, then results stacked by album, "Is this you?" suggestions, "Not me", Download all, and delete my face data.

**`/e/[handle]/saved` Saved.** Favourites and downloads.

**`/account` Profile.** Name, avatar, email preferences (new album published), your events, sign out everywhere, delete face data per event.

Navigation: on desktop a slim top bar (event mark and name, Photos, Your photos, Saved, account menu). On phones a four-tab bar: Photos, Your photos, Saved, You.

### Organiser

A left rail on desktop (event mark, name, status chip, then: Overview, Albums, Upload, Photographers, Attendees, Share, Removals (only when open), Activity, Settings, and at the bottom the plan box and your name). A scrolling row of the same links on phones.

**`/admin/new` Create event.** Event name, host organisation, start date, optional end date, venue or city, access mode (two radio cards). Shows the resulting link. Then payment, then the checklist.

**`/admin/[handle]/setup` Checklist.** Details, logo and colour, add a photographer, choose access (and import a list in guest-list mode), create the first album, download the QR. Progress bar, each row links to its screen.

**`/admin/[handle]` Overview.** Status line (Not activated / Ready / Live / Closed on date). Four numbers: photos, attendees joined, attendees who found themselves, downloads. "Needs you" (removal requests, unfinished uploads, no photographer yet). Share card with the QR thumbnail and Copy link. Latest uploads strip. Recent activity.

**`/admin/[handle]/albums`, `/upload`.** Album table (title, photos, views, downloads, status) and the New album screen (name, optional date, downloads on or off, attendees can add photos, publish now or at a time), straight into the drop zone.

**`/admin/[handle]/photographers`.** One row per link: name, album, files and size uploaded, last upload, Copy link, Revoke. "Add photographer" asks for a name, an album and an expiry (default 14 days).

**`/admin/[handle]/attendees`.** Access mode switch at the top. Table: name, email, joined (yes/no, when), photos found, role. Add one, import a list, remove. Co-organisers are made here by changing a row's role.

**`/admin/[handle]/share`.** The event link with Copy, the QR at poster size with PNG and SVG download, "Print poster" (opens `/admin/[handle]/share/poster`, an A4 print page with logo, event name, QR and three steps), and the announcement email text with Copy.

**`/admin/[handle]/removals`, `/activity`.** As in Klubbies.

**`/admin/[handle]/settings`.** Event details (name, host, dates, venue, description), branding (logo, colour with live preview), access (mode, access window date), privacy (face recognition, removal requests), danger zone.

**`/admin/[handle]/billing`.** One payment per event, what it unlocks, status and receipt. Hidden actions inside the iPhone app, as in Klubbies.

## 7. Data model changes (from Klubbies' schema)

Applied as the Klubbies migrations with `club` renamed to `event` (this is a fresh database), plus `20260927000022_events.sql`:

* `events` gains `starts_on date`, `ends_on date`, `venue text`, `access_mode text` (`link` or `guest_list`, default `link`), `access_ends_at timestamptz`.
* `albums.event_date` is `album_date`; `albums.event_type` is dropped.
* `media` gains `photographer_name text`.
* `memberships.accepted_at` defaults to now(): there are no pending invitations.
* `events.grace_period_enabled` defaults to false and is no longer shown.
* `posts`, `post_reactions`, `post_comments` are dropped.
* `private.can_view_event_item` also requires the access window to be open unless the viewer manages albums.
* New events get three roles: Organiser (everything), Photographer (upload), Attendee (view).

## 8. Stack and infrastructure

Same as Klubbies: Next.js 16, Tailwind 4, Supabase (Sydney), AWS Rekognition, Stripe, Resend, Vercel (`syd1`). Separate Supabase project, separate Vercel project, separate Rekognition prefix (`klubbies-events-*`, which the existing IAM policy `collection/klubbies-*` already covers). Email from the verified `klubbies.app` domain as `Klubbies Events <events@klubbies.app>`.
