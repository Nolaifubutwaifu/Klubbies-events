# Decisions

Choices made during the v1 build that `docs/masterfile.md` did not settle. Newest at the bottom.

## 2026-09-15 · v1 build

1. **Sign-in codes are minted by Supabase Auth and delivered by Resend.** `request_code` checks the roster with the service role and calls `auth.admin.generateLink` to get the six digit OTP. We email it with a React Email template and do not use Supabase's mailer, so there are no Supabase email rate limits and branding stays consistent. Supabase handles hashing, single use and expiry. We additionally enforce a 10 minute window and 5 attempts in `pending_sign_ins`.
2. **The roster lookup runs after the response (`after()`).** Every `request_code` call returns the same body and status in the same time, whether or not the email is on a roster.
3. **"Start a club" is open to any verified email** (confirmed with Max). The `/start` flow sends a code without a roster check. The creator becomes `club_admin` through the `create_club` RPC.
4. **RLS helpers live in a `private` schema** (`private.is_club_member`, `private.is_club_admin`, `private.can_view_club_item`) so they cannot be called over the REST API. The Supabase security advisor flagged the public versions.
5. **Storage read access mirrors media visibility.** The `storage.objects` select policy joins `public.media`, so signing a URL through the user's own client is itself an authorisation check. The service role never signs member-facing URLs.
6. **Upload derivatives are made in the browser.** `thumb.webp` (400 px), `display.webp` (2000 px) and the video `poster.jpg` are generated client-side, and `/api/media/[id]/finalize` verifies the objects exist before marking the item `ready`. There is no Edge Function worker in v1. If a browser can't decode a file (for example HEVC `.mov` in Chrome), the original still uploads and the grid shows a placeholder. A backfill worker is future work.
7. **Albums are created as `draft`** and published explicitly once uploads finish. This matches the mockup's "album not yet published" state. The masterfile default was `published`.
8. **Added schema beyond §7:**
   - `media.display_path`
   - `media.sort_at` (generated, for keyset navigation)
   - `memberships.name_mismatch` and `grace_notices_sent`
   - `albums.published_at` and `created_by`
   - `clubs.roster_mapping`
   - `roster_imports.status` and `mapping`
   - `club_handle_redirects`
   - `auth_rate_events`
   - `pending_sign_ins`
   - views `album_media_counts` and `club_storage_usage`
9. **Removing a member who never signed in revokes immediately.** They had nothing to keep. Members who have signed in enter the 30 day grace window and get the day 1 email at removal. The daily Vercel Cron job sends day 7 and day 29 and revokes at the end.
10. **Club admins can read `access_events` for their club.** The masterfile says "no client reads", but the admin activity page needs it. Members can never read it, and inserts are server-only.
11. **Roster imports run in three steps.** Preview parses and stores the rows, a dry-run commit shows the counts and problem rows, and the final commit applies. People in grace or revoked who reappear in an import are restored.
12. **Mockup elements not built in v1:**
    - "Chosen members" visibility (decision 3 in the masterfile)
    - "Invite co-admin" (v2)
    - "Find yourself in this album" (v3)
    - the editable slug field (handles are generated, §7.1)
    - greyscale photo treatment (confirmed: real photos in colour)
13. **The unauthenticated `/signin?club=` panel shows only the club name and university.** It doesn't show the mockup's event or photo counts, so a shared link reveals nothing about activity.
14. **Screens not in the mockup were built from the design tokens:**
    - code entry
    - start a club
    - club switcher
    - admin overview
    - albums list
    - album editor (reuses the Upload screen)
    - settings
    - activity log
    - roster mapping dialog
    - privacy page
    - 404
15. **Zip download is deferred to v1.1**, as listed in §14. The grace banner asks members to save what they want via single downloads.
16. **Supabase free plan limit.** Uploads over 50 MB per file are rejected by Storage on the free plan. Clubs uploading video need the Pro plan (the file size limit is configurable up to 500 GB).
17. **Sessions:** the cookie `maxAge` is 30 days and is refreshed by `proxy.ts` on every navigation (rolling). "Sign out of all devices" uses `signOut({ scope: "global" })`.

## 2026-09-16 · Billing (Stripe)

18. **A club must be paid before admins can add members, create albums or upload** (Max chose "gate club creation behind payment"). The club is created first as `unpaid`, then step 2 of 4 is Stripe Checkout. Viewing is never gated, so members of a lapsed club keep seeing existing albums. Enforced in RLS by `private.club_can_write()` on album, media, membership and storage inserts, and repeated in server actions and routes for friendly errors.
19. **Checkout is created server-side from `STRIPE_PRICE_ID`**, not from the Buy Button, so every payment carries the club id in its metadata. Whether the price is one-off or recurring decides `payment` versus `subscription` mode.
20. **The club activates on the `checkout.session.completed` webhook**, and also when the admin lands back on the billing page with the session id. This means local dev works without webhook forwarding. Webhook events are stored in `stripe_events` for idempotency.
21. **Subscription status mapping:**
    - `active` and `trialing` → active
    - `past_due` → past_due (still writable while Stripe retries)
    - `unpaid`, `canceled`, `incomplete_expired` and `paused` → canceled
22. **Clubs that existed before billing were set to `comped`.** Super admins can comp a club with `update clubs set billing_status = 'comped'`.

## 2026-09-17 · v2 (design file `Klubbies v2.dc.html` + feedback doc)

23. **Roles replace the two fixed roles.** Every club gets Admin, Committee and Member, and admins can add their own (Treasurer and so on). A role carries five permissions: run the club, manage members, manage albums, add photos, post to the feed. `memberships.role` is kept in sync by a trigger so older admin checks keep working, and RLS now asks `private.club_perm(club_id, permission)`.
24. **Member statuses are described, not stored.** "Never logged in" is now shown as "Invited", and "Signed in" comes from `first_seen_at`. The status column keeps pending/active/grace/revoked.
25. **The album page is the member view for everyone.** Admins get "Edit album details" and "Add photos" buttons that open panels on the same page (`?edit=1`, `?add=1`). `/admin/[handle]/albums/[id]` redirects there. Feedback: admins should see what members see.
26. **Switching view keeps the page.** A `kb_area` cookie decides whether the admin nav is shown; the toggle sets it and returns to the same URL instead of bouncing to the overview.
27. **Albums can accept member contributions.** `albums.contributor_scope` is `managers` or `members`; the media insert policy uses `private.can_contribute_to_album()`.
28. **Covers can be uploaded.** `albums.cover_path` holds an uploaded image under `clubs/{club}/covers/`; picking a photo from the album still sets `cover_media_id`.
29. **Invitations are explicit.** A membership is an invitation until `accepted_at` is set. Members accept or decline from the club switcher, the club list or their profile.
30. **Club feed.** `posts`, `post_comments` and `post_reactions`, readable by members, postable by roles with `post_feed`. Comments are open to every member; admins can remove any. Direct messages between members are deliberately not built.
31. **Profile page at `/account`.** Display name, photo (stored under `avatars/{user}/`), bio, club list with "member since", invitations, email preferences, and an optional password.
32. **Password sign-in is optional, codes stay the default.** A member sets a password from their profile; `/api/auth/password_signin` verifies it and is rate limited like code verification.
33. **Per-club accent colour.** `clubs.accent_colour` is turned into an accent ramp at render time (`lib/theme.ts`) and applied to that club's pages only, with a reset to Klubbies red.
34. **Uploads survive navigation.** The upload queue lives in a provider above the pages with a progress tray, so an admin can keep browsing. Closing the tab still stops the transfer: true server-side ingestion is not built.
35. **Roster import can prune.** After a preview, the import lists current members who are missing from the file and offers to remove them, for clubs whose file is a full membership export.
36. **Empty grid cells no longer show as grey blocks.** Photo grids use a transparent background with gaps rather than a divider-coloured backdrop.

## 2026-09-18 · Feedback update

37. **One login button.** The landing page has Start a club and Log in; admins sign in through the same form. The `?admin=1` variant is gone.
38. **Sign up from the login screen.** "First time here? Sign up" uses a new `signup` flow that sends a code to any address and lands on the club list, where invitations wait. A member who isn't on any list is told to ask their committee.
39. **Feed keeps posts and reactions, drops comments** (Max: leave comments out, keep a news feed). The `post_comments` table stays in the schema, unused, in case that changes.
40. **Notification emails.** Publishing an album and posting to the feed email the members who opted in, sent after the response with Resend batches. Every email carries a signed unsubscribe link plus `List-Unsubscribe` headers, and `/unsubscribe` needs one click to confirm so scanners can't switch it off by accident.
41. **Album download.** `/api/albums/[id]/zip` streams the originals as a zip, in parts of 150 files so one request stays inside the function limit. On phones, "Save to Photos" hands batches of eight files to the share sheet, which writes them straight into the Photos app; that only appears where the browser supports sharing files.
42. **Card details on our own page.** `/admin/[handle]/billing/card` uses Stripe Elements with a SetupIntent restricted to cards, then makes the new card the subscription default. Invoices and cancellation still go through Stripe's portal.
43. **Accent colour now reaches Tailwind utilities.** `bg-accent`, `text-accent-700` and friends resolve to the CSS variables, so a club's colour also covers boxes and links, not just the component classes.
44. **The nudge button is gone.**
45. **Visual pass.** Photo tiles zoom slightly on hover, stat cards carry an accent bar, the events page leads with a full-width hero (only when the newest album has a photo), rows alternate with the surface colour, dates sit in accent chips, and empty placeholders are accent-tinted rather than grey.

## 2026-09-18 · Soft theme rollout

46. **The soft theme replaced the modernist one across the product.** `/` is the
    new marketing home, the sign-in flow runs through the restyled `AuthSplit`,
    and everything under `(app)` is wrapped in `.theme-soft`. The old landing is
    kept at `/classic`, and the pre-redesign UI is tagged `design-v1-modernist`.
47. **Pages join the theme by being wrapped, not rewritten.** Two adoption
    layers in `globals.css` re-skin the existing classes inside `.theme-soft`:
    the component classes (`.btn`, `.input`, `.panel`, `.stat`, `.tag`,
    `.table`, `.dialog`, `.dropzone`, `.tile`) and the modernist border
    utilities (`border-2 border-divider` boxes become soft cards, 2px rules
    become hairlines). That is why the admin pages converted without touching
    their markup.
48. **No ghost or outline-only buttons.** `.btn-secondary` and `.btn-ghost` are
    filled tonal buttons in this theme.
49. **Type is Fredoka over DM Sans.** Fredoka carries the wordmark, headings and
    one accent word per heading; DM Sans does body and UI. Archivo stays for
    `/classic` only.
50. **Colour follows 60/30/10:** cream ground, lilac supporting surfaces,
    accent reserved for action. The per-club accent still overrides the ramp,
    so a club's pages take its colour.
51. **`EventsBrowser` and the `/preview` routes are gone.** `SoftEvents` is the
    events page for both members and admins.

## 2026-09-19 · Design artifact build-out (Klubbies Design canvas)

52. **The committee app has a rail, the member app has one too.** `AdminNav` is
    a sticky 248px sidebar on desktop (club badge, seven links with live counts,
    plan chip, who you are) and a scrolling row of the same links on a phone.
    `MemberSidebar` is its member twin: every club you're in, Saved, Club feed,
    profile. Below `lg` the member app falls back to `AppHeader` plus
    `MemberTabBar`, a four-tab bottom bar. The app shell widened from 1100px to
    1320px so a rail plus a three-column album grid still fits.
53. **Albums carry an event type.** `albums.event_type` is one of formal, sport,
    social, camp, night_out, other. It is a label, not a filter: it appears as a
    chip on every album card, the album header and the committee's album rows.
54. **Guest photographer links.** `album_guest_links` holds a sha-256 of a
    single-use upload token — never the token itself, so a leaked backup can't
    be replayed. `/g/<token>` is the only signed-out page in the product: one
    album, upload only, no roster and no other albums. The guest has no session,
    so `/api/guest/[token]/ticket` mints per-object signed upload URLs with the
    service role and the browser PUTs straight to storage; `media.guest_link_id`
    records which link a file came in on.
55. **Removal requests hide first and delete later.** A member's "Take it down"
    sets `media.hidden_at` at once (through a server action with the service
    role, so asking never becomes a way to edit a media row) and opens a
    `media_removal_requests` row. The committee confirms or restores within
    seven days; silence deletes it, swept by the same cron that publishes
    scheduled albums. One open request per photo — a second person asking is the
    same request.
56. **Upload is its own screen.** `/admin/[handle]/upload` is the design's New
    album: name, date, type, download and contribution switches, and a go-live
    time, then straight into the album's drop zone. `/admin/[handle]/albums` is
    now purely the list, with views, downloads and members per row from the new
    `album_engagement` view.
57. **Onboarding is a checklist you can come back to.** `/admin/[handle]/setup`
    reads the club's real state — name, handle, logo, roster, first album — and
    shows a progress bar instead of a wizard that traps you.
58. **Billing and settings are one screen**, with the two club-wide privacy
    switches (`clubs.allow_removal_requests`, `clubs.grace_period_enabled`)
    saved per toggle. Stripe's card and receipts stay on `/billing`.
59. **The lightbox is the one dark screen.** It pins itself to the window
    (`fixed inset-0`) so the page behind can't add height underneath, drops the
    rail, the tab bar and the footer, and carries its own filmstrip and four
    actions: Favourite, Original, Details, Take it down.
60. **Loading is a skeleton, never a spinner** (`.soft-skeleton`), in the shape
    the page will keep.
61. **`scripts/demo.ts` builds the design's fictional club** — UniMelb FC,
    @umfc, six albums with real photos from `design/source-photos` — so the
    screens can be checked with content in them. Safe to re-run.

## 2026-09-19 · The last artboards

62. **The sign-in screens follow the design, not the split.** `AuthShell`
    replaces `AuthSplit`: one column, and on the screens someone arrives on
    cold (`/signin`, `/start`) a band of event photos fading into the cream.
    The code step drops the band — by then the photos have done their job.
63. **Eight code boxes, because Supabase mints eight digits.** They advance as
    you type, take a pasted code in any box, and submit themselves once full.
    A wrong code clears the row and returns to the first box.
64. **No "not on the roster" screen.** The neutral reply stays (masterfile
    §5.2.3): an address that is on a list and one that isn't get the same
    answer, which is what stops someone probing a roster. The help that screen
    carried — try your uni email, then ask your committee — now sits on the
    code screen under "Nothing arrived at all?", where it reaches the same
    person without confirming anything.
65. **Members see what is still processing.** RLS only admits `status =
    'ready'` to a member, so the album page counts the unfinished files with
    the service role *after* the membership check and renders a banner plus
    placeholder tiles. A count of files in an album they can already open, and
    no more than that.
66. **Selecting several photos is everyone's.** "Select photos" is no longer
    committee-only. The bar offers Favourite and Download to any member
    (`favouriteManyAction`, and the `?only=` zip), and adds Use as cover and
    Delete for people who can manage albums.
67. **A club with no albums gets its own screen**, not a "no matches" card:
    two empty photo cards and one button that turns on the new-album email
    (`notifyOnNewAlbumsAction`) without sending anyone to their profile.

## 2026-09-20 · First production deploy

68. **The publishing cron is daily, under protest.** Vercel's Hobby plan
    allows one cron run per day, so `vercel.json` is back to `0 23 * * *`
    (9am Melbourne) rather than the hourly pass commit 87cac76 introduced.
    The consequence is real: an album scheduled for Saturday 10am goes live
    on Sunday morning, so the schedule control now offers 9am and the copy
    promises "the first morning after this time" instead of "on the hour".
    Grace expiry and the seven day removal sweep don't mind a daily pass;
    scheduling is the only part that does. Restoring it is a one line change
    in `vercel.json` plus the three strings named in the README, and there is
    a `TODO(vercel-pro)` on the cron route.

## 2026-09-20 · Design system v2

69. **Fredoka stops at 700, so headings must too.** `globals.css` asked for
    `font-weight: 900` on every heading, `.soft-sticker` and `.soft-btn`, and
    `next/font` only loads Fredoka 400–700. Every heading in the app was a
    browser-synthesised faux bold — thickened strokes with the rounded
    terminals smeared off, which is the one thing you should never do to a
    rounded face. All 900s are now 700, and the `font-extrabold`/`font-black`
    utilities sitting on `font-heading` came down with them.
70. **Archivo is gone, and it was not unused.** `--font-heading` pointed at
    Archivo, so the seven `font-heading` utilities in ClubSwitcher, BillingGate,
    LegalPage, the feed and AlbumEditPanel were rendering a third typeface
    nobody intended, inside pages set in Fredoka. `--font-heading` now points
    at Fredoka and `--font-body` at DM Sans, so the Tailwind aliases mean what
    they say.
71. **One warm ink at four depths, replacing two neutral systems.** The
    Tailwind `neutral` scale was hardcoded hex from the deleted Modernist
    theme, so `text-neutral-700` emitted a cold `#605d5d` and ignored
    `.theme-soft`'s warm override — three different inks were rendering on the
    club home at once. The scale now points at the CSS variables, `ink` is
    theme-aware, and `text-ink / ink-70 / ink-55 / ink-35` replaced every
    `text-neutral-*` across 21 files.
72. **60 / 30 / 10, with a brand colour that is not the accent.** Cream is the
    60 and the club's own accent keeps the 30 — it still drives headline
    emphasis, chips, eyebrows and section bands. The 10 is a new global violet
    `--brand: #5b2bd6`, used for primary buttons, checked controls and focus
    rings and nothing else. It is the lilac's own ink `#43335c` at full
    saturation, so it already belonged to the family. It also fixes a real
    failure: the old primary gradient started at `#ff563c`, which is 3.16:1
    with white text and below AA. The violet runs 7.6:1.
    *Consequence:* the club colour no longer drives primary buttons, so the
    Settings copy that promises "buttons, tags and highlights" needs a pass.
73. **Three button tiers, all solid fills.** No outlines and no transparent
    buttons — they separate on colour, size and weight, so the ladder survives
    greyscale. Tier 1 is brand violet at 48px, tier 2 the club accent mixed to
    55% with white (accent-800 ink on it clears 4.5:1) at 44px, tier 3 the
    lilac deepened to `#ded0f4` at 40px, 44px on a coarse pointer. The honest
    limit: on a cream ground no pale fill can clear WCAG's 3:1 for a control
    edge — tier 3 reaches 1.45:1, up from the old `#f1e9fb`'s 1.12:1. So the
    rule is **a tier-3 button is never the only button in a group**; a lone
    action is tier 2 or higher.
74. **Native controls are styled on the element, not per component.** One block
    inside `.theme-soft` restyles every `select`, `checkbox`, `radio` and date
    input in the app, which is why the inline `accentColor`/`width`/`height`
    styles came out of thirteen components. The native element is kept in all
    cases, so mobile still gets the OS picker wheel and date sheet.
75. **The club home opens on content, not chrome.** On a 375px screen the first
    album used to start at 470px of 812, behind a greeting, a search field, two
    buttons and a date filter on three separate rows. The club name now takes
    the H1 (the greeting folds into the meta line, since a member in four clubs
    needs to know which one this is), the date filter shares the search row,
    *Saved* leaves the header because it is already in the sidebar and the tab
    bar, and *New album* becomes a floating button on phones. The grid is 2-up
    at 4:5 on mobile. First album now lands at ~250px.
76. **TODO — the second display voice is still unresolved.** The audit found
    that the emphasised word in every headline is marked by colour alone, which
    disappears in greyscale and competes with the category chips using the same
    red. The fix is a second display face applied to that word via a
    `--font-accent` token and the existing `.soft-word` class. Fraunces,
    Syne, Big Shoulders Display, Unbounded, Archivo Black, Familjen Grotesk and
    Instrument Serif were all rejected on looks. **Nothing has been implemented
    — `.soft-word` is still colour-only.** Pick a face, add it to
    `app/layout.tsx`, and give `.soft-word` a `font-family`. Until then the
    headline emphasis carries one signal where it should carry two.
77. **The red is Klubbies', the quiet layer is the club's.** The club colour
    used to drive `--color-accent`, so a club that picked blue got blue
    headlines, blue tags and blue eyebrows and stopped looking like Klubbies.
    Vermillion is now fixed in every club — headline emphasis, tags, eyebrows,
    section bands and the tier-2 button — and what a club picks styles the
    *quiet* layer instead: the tier-3 button, the accessory labels and the
    supporting surfaces. `accentStyle()` is now `clubToneStyle()` and emits
    only `--tone-support`, `--tone-support-deep` and `--tone-support-ink`.
    The tones mix the club's hue into the lilac rather than into white, which
    keeps them calm enough to sit under a warm accent and, as a side effect,
    lands the quiet tier at ~1.9:1 against white instead of the flat lilac's
    1.45:1 — so this is a contrast gain as well as a brand one. Worst label
    contrast across the ten swatches is 5.17:1.
    *Gotcha:* `.theme-soft` sits above the element `clubToneStyle` is applied
    to, so these tokens cannot be declared as `color-mix(… var(--color-accent) …)`
    on `.theme-soft` — custom properties substitute at the declaring element,
    not where they are read. They are computed in JS in `lib/theme.ts` for that
    reason. The stylesheet keeps the neutral lilac as the no-club default.
78. **Settings says "club tone", not "club colour",** because it no longer
    changes the buttons and tags the old copy promised. The preview now shows
    the two things that actually change beside the two that never do, and the
    swatches are round with a check on the selected one instead of a hairline
    square.
79. **The date filter rides inside the search field.** It cost a whole row —
    about 70px of an 812px phone screen — for a control most members never
    touch. With that and the header changes the first album moved from 470px
    to roughly 146px.

## 2026-09-20 · Face recognition (AWS Rekognition, opt-in)

Built from the spec in `Untitled.md`. Three forks were settled before the
build and each is load-bearing: every detected face is indexed (not only
enrolled members'), rollout is admin opt-in per club, and enabling a club
backfills its whole library.

80. **Rekognition, not pgvector.** Postgres holds ids and decisions; AWS holds
    the faceprints. One collection per club, `{prefix}-club-{clubId}`, holding
    media faces and reference faces together and telling them apart by
    `ExternalImageId` (`media:` / `ref:`). Two collections would look tidier
    and break the design: `SearchFaces` only searches the collection its
    `FaceId` lives in, so splitting them forces an image-bytes search per face.
81. **The privacy guarantee lives in RLS, not in application code.**
    `media_faces` has no member policy and no grant, which is what stops a
    member correlating face ids across photos to work out who else is in them.
    `face_matches_select_own` has two halves — your own profile, and a live
    membership — so a revoked member stops seeing their matches the way the
    rest of the app already behaves. 17 checks in
    `supabase/tests/face_rls.sql`, run inside a transaction that rolls back.
82. **"Not me" is keyed on (profile, photo), not on the face row.** The spec
    put rejections in `face_matches.state` and claimed the unique constraint
    made them permanent. It does not: `face_matches` cascades from
    `media_faces`, so re-indexing a photo would forget every rejection, and
    the constraint stops duplicate rows rather than a state being flipped
    back. `face_rejections` survives a re-index, the matcher consults it
    before writing, and every insert is `ignoreDuplicates` so a decided
    pairing is never quietly re-suggested.
83. **A confirmed match is promoted by reusing its faceprint, not by indexing
    a crop.** Strictly less biometric data for the same result. The cost is a
    lifetime problem — the faceprint belongs to a photo — so
    `member_face_references.media_face_id` is a real FK with cascade, and a
    `check` constraint says a selfie reference has none and a promoted one
    always does.
84. **The bounding box is copied onto `face_matches`.** "Is this you?" crops
    client-side and needs the box, but `media_faces` is the table nobody may
    read. The box discloses nothing — it says where, in a photo already shown
    to this member, their own face is — and copying it keeps "Photos of you" a
    plain RLS query instead of a service-role read inside a page.
85. **The selfie lives outside `clubs/`.** Every branch of
    `club_media_select` keyed off `storage_club_id()` lets a committee read
    anything under their club's prefix. `faces/{membershipId}/selfie.jpg` is
    outside it and is read and written only with the service role. While
    there: that branch now requires `storage_club_id(name) is not null`,
    because `club_perm(null, …)` was true for a super admin, which handed the
    platform account a read on every non-club path.
86. **The drain is callable from three places** — the daily cron,
    fire-and-forget at the end of both finalize routes, and an admin "Run
    now". Without the second, "Photos of you" lags up to 24 hours on Hobby and
    reads as broken. `claim_face_jobs` uses `for update skip locked`, so two
    running at once take different work.
87. **Revocation drains the purge queue inline.** On Hobby a queue-only purge
    lands exactly on the 24 hours the consent copy promises, which is not a
    promise worth testing. Photo and album deletes drain inline too, so "the
    faceprint goes when the photo goes" is true in the same request.
88. **One rule covers every way a membership ends.** Deleting a membership
    cascades; a membership that merely changes to `revoked` does not, and the
    profile would outlive the access it was granted under.
    `revokeOrphanedProfiles()` in the drain handles both, including ways added
    later.
89. **`.soft-btn` got a `:disabled` style.** The design system never had one.
    Both consent gates are a filled primary button that cannot be pressed
    until a box is ticked, and with no visual difference that reads as a
    broken screen rather than as "tick the box".

*Not done, and deliberately:* the thresholds in `lib/faces/constants.ts` are
starting points, not findings. Step 13 of the spec — backfill the demo club,
review the matches against the bands, tune, re-run as `rematch` — has to come
from real photos, and needs AWS credentials this deployment does not have yet.

## 2026-09-23 · Face recognition thresholds, tuned against real photos

Step 13 of the spec, done properly. Ground truth came from Lightroom Classic:
335 face names a human had *confirmed* in the catalog (`userPick = 1` — the
other 401 named faces are Lightroom's own unconfirmed suggestions, and using
those would have measured Rekognition against Adobe's guesses). 274 unique
photos, ARW and DNG converted through `sips`. Each Rekognition face was
labelled by overlapping its box with the Lightroom box, which located 97% of
the confirmed faces. Every labelled face was then used as a search probe, and
each hit scored against the human's name.

90. **The similarity threshold barely matters. The minimum face size does
    almost all the work.** Per-photo recall was flat at ~96% from similarity
    82 all the way to 94 — moving it changed nothing. What changed everything
    was `minBoundingBoxWidth`: at the spec's 4% the tuning set produced about
    50 cross-person false positives; at 6% it produced **zero**, at every
    threshold tested. `minBoundingBoxWidth` is now 0.06.
91. **The worst false positive was a 99.9% match between two different
    people** — a face 5.2% of the image wide, small and blurred, against a
    clear frontal photo of someone else. That is the failure mode the floor
    exists to prevent, and 4% did not prevent it. A face that small carries
    too little signal to identify but plenty to be confidently wrong.
92. **The floor costs about a fifth of a person's photos** — those where they
    appear small — and is still the right trade. At 4%: 205 of 213 findable
    photos matched, plus ~50 wrong ones. At 6%: 182 of 184, plus none. Twenty
    fewer correct photos against fifty fewer wrong ones, and the spec's own
    stated bias is that a wrong confirmed match costs more trust than a miss.
93. **92 / 85 stay, now with evidence instead of a guess behind them.** At the
    6% floor, 98.5% of genuine matches land at 92 or above, 1.0% in the
    suggested band, 0.5% below 85. The bands cost almost nothing and the
    suggested strip stays as a cheap safety valve for the uncertain 1%.

*What this does not cover:* six people, one photographer, one camera, mostly
daylight and travel. Club photography is dim rooms, crowds and motion blur,
which is harder — so read these as a ceiling on quality, not a floor. Re-run
the survey against a real club's library before trusting the numbers there.

The tuning photos and their Rekognition collection were deleted immediately
after the run. The method is in `docs/face-tuning.md`; the `tuning-photos/` folder it uses is gitignored.

## 2026-09-23 · Face matching, from per-face to per-batch

94. **Matching now runs once per batch, in whichever direction is cheaper.**
    `indexMedia` used to search Rekognition once per detected face, so a photo
    cost one IndexFaces plus one SearchFaces per face — about 3.2 calls on a
    library averaging 2.2 kept faces, not the 1 the spec's cost estimate
    assumed. That put a 50,000 photo club nearer US$160 than US$50.

    Similarity is symmetric, so searching from each reference face returns the
    same pairs as searching from each media face. `lib/faces/match.ts` counts
    both sides and takes the smaller: a single upload with three faces still
    searches per face, while a nightly drain of hundreds of photos searches
    once per enrolled reference instead. Measured on the demo club: 22 photos,
    49 faces, one reference — **1 search instead of 49**, and 23 Rekognition
    calls for the pass instead of 71.

95. **Indexing and matching are separate steps, and that is load-bearing.** A
    failed match now leaves the faces indexed, so the retry costs a search
    rather than a re-index. It also means `rematch_media` has nothing to do
    but confirm the faces exist — the batch matcher re-scores whatever it is
    handed, however the photo got into the batch.

96. **Enrolment shares the same matcher.** The back-catalogue sweep was a
    second, near-identical implementation of matching; it is now the
    per-reference direction with the batch set to the whole club, which is one
    search for a newly enrolled member either way. One matching path, one
    place for the bands and the rejection check to be honoured.

## 2026-09-23 · Face recognition, second pass on the copy

Reviewing the three pieces of copy against what the code actually does turned
up three claims that were not true. Fixed regardless of what a lawyer later
says about the rest.

97. **"Neither can we" is gone.** The notice and the privacy policy both said
    no one at Klubbies could search a club's photos for a person. The service
    role bypasses every policy in this schema and `SearchFacesByImage` is in
    the IAM policy, so that was a claim about intent dressed up as a claim
    about capability. It now says there is no such feature and none has been
    built, which is true and still reassuring.
98. **The consent tickbox said less than it did.** It covered "a faceprint
    from my selfie", when by the time a member sees it a faceprint of their
    face usually already exists from the club's photos. The screen disclosed
    that two paragraphs up; the sentence people actually tick now says what it
    is for.
99. **The committee is no longer told it carries the responsibility.** "You
    are responsible for telling your members" reads as moving a legal duty
    onto a student committee, and a tickbox does not move it — Klubbies is the
    entity making and holding the faceprints. It now says members should know,
    and that we show them a notice ourselves.

100. **Every member of a face-enabled club is now told, and has to
     acknowledge it.** A dismissible banner inviting enrolment was the only
     thing a non-enrolling member ever saw, and a faceprint is made of their
     face either way. `memberships.face_notice_ack_at` records the
     acknowledgement — on the membership, not the profile, because it applies
     to the members who never create a profile, which is most of them.

     It is shown at the door and inside: joining a face-enabled club puts the
     notice in the invite card with the Accept button disabled until it is
     ticked, and a member who joined before the club switched it on gets a
     persistent (not dismissible, not modal) notice on the club page until
     they acknowledge. The notice outranks the enrol prompt — told first,
     invited second.

     It is an acknowledgement, not consent, and the column names and copy both
     say so. Consent is enrolment, which stays entirely optional. This closes
     the disclosure gap for members. It does **not** close the consent gap for
     guests and plus-ones, who never see a Klubbies screen at all — that one
     is a question for a lawyer, and it is the question that decides whether
     this design ships as built.

## 2026-09-23 · What the first real backfill taught

101. **A claimed job that never finished was invisible and permanent.**
     `claim_face_jobs` only looked at `status = 'pending'`, so a job whose
     function timed out stayed `running` for ever: never retried, never
     failed, never surfaced. Three appeared within an hour of the first real
     backfill. Ten minutes in `running` — past the 300s any run can
     legitimately take — now makes a job reclaimable, and `attempts` still
     increments so a photo that reliably kills its worker eventually gives up.

102. **`settleBackfills` could not re-open a finished backfill.** It only
     examined clubs already marked queued or running, so a reclaimed job or a
     later rematch left the panel claiming the library was done while photos
     sat unprocessed. Every enabled club is checked now, in both directions.

103. **The admin panel was a snapshot.** Turn it on, then nothing moves until
     you reload — which on a 191 photo library reads as broken. It polls every
     four seconds while work remains, shows a pulsing dot, the running face
     count and the progress, and stops polling on its own. The tell that this
     was wrong came from using it, not from reading it.

104. **"Photos of you" is stacked by album.** A flat run of forty thumbnails
     from four different nights reads as a pile; nobody remembers their photos
     as a chronology, they remember them as the ball, then the grand final.
     Same shape the Saved page already uses, one signing call for the page,
     and each album links through to itself.

## 2026-09-23 · The bug sweep after the first real club

105. **The drain claimed one batch and stopped.** 25 jobs, then nothing asked
     for the next batch — so 110 photos needed five separate triggers, and on
     a daily Hobby cron that is five days. It now claims until the queue is
     empty or a time budget expires: 240s under the cron's 300s maxDuration,
     60s behind "Run now" (a button, not a spinner), 15s on the kick that
     rides inside an upload request.

106. **Enrolment was queued behind the entire backfill.** Strict `order by id`
     put the job created when a member hands over their selfie 95 photos deep
     on a club switched on minutes earlier — having just told them it would
     take a minute. Enrol jobs now sort first. One call, and the only job a
     human is actually waiting on.

107. **One match per member per photo is a constraint now, not a habit.** The
     unique was `(media_face_id, profile_id)`, which allows two rows for one
     member in one photo if two faces match them. `matchForMedia` used
     `maybeSingle()`, which answers "nothing here" on two rows — so "Not me"
     would have vanished exactly when somebody wanted it. Replaced with
     `(profile_id, media_id)`, and the query takes the best row rather than
     insisting there is only one.

108. **The rail never showed club logos.** `MemberSidebar` drew initials
     unconditionally though `listMyClubs` had already fetched `logoPath`, and
     the switcher's dropdown did the same while the button above it showed the
     logo correctly. Both fixed, one signing call each.

109. **Three places lied about how long things take or how much there is.**
     "Come back in a minute" while thousands of photos are still being read;
     a suggestion strip capped at 24 with no hint the other 40 exist; and a
     "Photos of you" page that silently stopped at 60. All three now say what
     is actually true.

## 2026-09-25 · QA audit fixes (KB-01 to KB-25)

A read-only pass over the live site found 25 problems. The ones that needed a
choice, rather than just a fix:

110. **Photos of you reaches phones, and so does the admin area.** The rail was
     the only way to either, and the rail doesn't exist below `lg`. The tab bar
     grows a fifth tab where the feature is on and the member has enrolled;
     the club switcher gets an "In this club" section (Photos of you, Admin
     view); the profile page, which is the "You" tab, links each club's admin
     area. The rail's admin link now asks for `manage_club`, the permission
     every `/admin` page checks, instead of sending a media officer to a 404.
111. **Face recognition off is a state, not a 404.** `/c/[handle]/me` says so,
     with a way into Settings for admins.
112. **"Is this you?" crops on the server, per request, and stores nothing.**
     `/api/faces/[matchId]/crop` cuts a 240px square from the display copy
     with sharp and returns it `private`. The old CSS crop compared a fraction
     of the width with a fraction of the height, so a landscape photo came out
     shrunk into a grey square, and each 105px tile downloaded the full 2000px
     image. Decision 84 still holds: no crop is ever written to storage.
113. **One photo, one row per album, enforced by a content hash.** The browser
     hashes each file before asking for a ticket (SHA-256; over 96 MB, the size
     plus first and last 8 MB, prefixed `s:`), and the ticket route answers
     "already here" for a finished copy or resumes a stuck one rather than
     adding a second row. `media.content_hash` has a partial unique index per
     album. Rows from before the column are covered by
     `scripts/dedupe-media.ts`, and until that runs the face pages collapse
     duplicates by filename and byte size.
114. **Unfinished uploads are surfaced after an hour and cleared after 14
     days.** The dashboard's Needs you lists them; the daily cron deletes rows
     and objects still unfinished a fortnight on.
115. **One counting rule: published albums, finished files.** Drafts get their
     own label for the committee instead of inflating the number members see.
116. **EXIF time is wall-clock time.** `DateTimeOriginal` is read as a raw
     string and pinned to `OffsetTimeOriginal` when the camera wrote one, else
     to Brisbane, the zone every date in the app is shown in. Separately, the
     viewer formatted times on the server without a zone, which on Vercel is
     UTC: that was the "8:01 am" on a night photo.
117. **The profile name wins everywhere.** `personName()` in
     `lib/auth/display-name.ts` is the rule: profile display name, then the
     name signed in under, then the roster name. The profile page already
     promised this.
118. **Signed URLs are reused, not lengthened.** Every page load used to sign
     afresh, so the browser could never reuse an image. `signPaths` now hands
     back an already-issued URL to the same session (keyed by a hash of the
     access token, never the user id) while it has at least 40% of its life
     left. Lifetimes are unchanged from masterfile §8. Because a URL can now
     be reused, avatars, album covers and logos are uploaded under a new name
     each time and the replaced file is deleted, so nobody sees a stale image.
119. **Logos get a 96px mark.** `setClubLogoAction` makes `mark-*.webp` beside
     the upload, and every badge signs the mark, falling back to the original
     for logos that predate it (`scripts/logo-marks.ts` backfills them).
     `ClubMark` is the one badge component, so a club no longer shows red in
     one place and as a black square in another.
120. **Thumbnails are sized by their short edge.** `thumb.webp` is now at least
     400px on its short side (capped at 900 on the long side), up from 400 on
     the long side, which left 3:2 photos soft under a 186px square tile.
     Existing thumbnails keep their old size.

## 2026-09-25 · Face recognition for every club

121. **On by default, everywhere.** Max's call, replacing the per-club opt-in
     from decision 80. `20260925000021_faces_for_every_club.sql` switches on
     every club that had never decided and queues its library; a trigger on
     `clubs` does the same for every new club. A club an admin turned off
     stays off, and the switch in Billing & settings still works both ways.
     The rollout is recorded as `notice_version = 'klubbies-rollout-2026-09-25'`
     with no `notice_accepted_by`, so the record says honestly that Klubbies
     turned it on rather than a committee.
122. **What did not change:** every member still sees the face notice and must
     acknowledge it before anything else (decision 100), and enrolment stays
     each member's own choice. The open question in decision 100, consent for
     guests and plus-ones who never see a Klubbies screen, now applies to every
     club rather than two.
123. **The drain makes the collection.** The migration can't call AWS or read
     the Rekognition prefix, so `runFaceJobs` creates a club's collection the
     first time it works on that club and records its id. For the same reason
     uploads now queue as soon as a club is enabled, without waiting for a
     collection id.

## 2026-09-25 · Repository tidy

124. **Docs live in `docs/`.** The masterfile, this file, the design notes and
     the face tuning method moved there from the repo root, `design/` and
     `tuning-photos/`. `README.md` is the map. `FavouriteButton` was unused
     and is gone. `main` is the only branch.

## 2026-09-26 · The design audit, built

Built from the "Klubbies Design Audit" canvas and its handoff. What was
followed as written is in the code; these are the places this build chose
differently, and why.

125. **One accent.** Ember `#CF2E12` is the only brand colour; ink carries
     everything secondary. Purple, lilac and salmon are gone, and every old
     token name in `globals.css` now points at the new values, so no call
     site can reach a retired colour. The club's own colour survives only in
     the quiet layer (avatars, muted chips), mixed into sand and ink.
126. **Two buttons, and a More menu.** Primary (ember) and secondary (white,
     ink border); the old tier names all resolve to one of the two. Each
     screen shows its one or two main actions and puts the rest behind
     `MoreMenu`. Destructive confirms use `btn-danger`, never the primary.
127. **Nothing under 14px, no text set with opacity.** The ink ramp is three
     solid colours. Input edges use `#968990` rather than the canvas's
     `#CDBDB6`, because form fields need 3:1 against white (WCAG 1.4.11) and
     `#CDBDB6` is 1.8:1.
128. **Face recognition gets its own Home section**, straight after the
     problem it solves. The canvas's decorative photo band made way for it,
     keeping Home at nine sections.
129. **No "That email isn't on the list" error.** The code request is
     deliberately neutral so nobody can test whether an address is on a
     club's roster; the handoff's error would leak exactly that.
130. **No club photo on the public login page.** The canvas showed the club's
     cover; the product promises that nothing about a club's photos shows to
     anyone off the list. The club is named and shown by its logo.
131. **Start asks for you, then the club.** The club is created after the
     email is confirmed, so the club name stays on step 2 rather than being
     carried through verification.
132. **"Nothing is charged until you publish your first album" was never
     true** (payment unlocks adding members and uploading). Every page now
     says so from one copy source, `lib/copy/site.ts`, which also lists what
     was checked against the code and what is deliberately not claimed.
133. **Face jobs survive the response.** The drain that rides on an upload or
     an enrolment was a bare promise, which Vercel may freeze once the
     response is sent. It now runs inside `after()`. The "Looking now" card
     also polls and nudges the queue, so a throttled enrolment no longer
     waits for the daily cron.

## 2026-09-27 · Vercel Pro

134. **The cron is hourly again.** Pro takes `0 * * * *`, so decision 68 is
     undone: a scheduled album goes live on the hour after its time, the new
     album panel offers Saturday 10am again, and the face queue, revoked
     faceprints and throttled jobs get picked up within the hour instead of
     the next morning. Every job in the pass was already safe to repeat.
135. **Album zips get 800 seconds**, Pro's ceiling, up from 300. A part that
     runs out of time mid-stream arrives as a corrupt zip. The cron stays at
     300: `claim_face_jobs` reclaims a job after ten minutes on the
     assumption that no run lasts longer, and hourly passes make a longer
     budget unnecessary.

## 2026-09-27 · iPhone app

136. **The iPhone app is a native Swift shell around the live site**, in
     `ios/`, not Capacitor. The site is server rendered, so either way the
     app shows a web view of www.klubbies.app; plain Swift means no Node, no
     `cap sync` and no plugins between editing and pressing Run. What the
     shell adds is what a web view lacks: confirm dialogs, downloads, Save to
     Photos written straight into the library, pull to refresh, an offline
     screen, and outside links in an in-app Safari sheet.
137. **No payment controls inside the app.** Apple requires in-app purchase
     for digital subscriptions sold in an iPhone app and forbids pointing
     people at another way to pay. The app adds `KlubbiesApp/<version>` to
     its user agent; the billing page then shows the club's status and no
     buttons, and the card page redirects back to it. Clubs pay on the web.
138. **Save to Photos in the app skips the share sheet.** The page hands the
     app signed URLs through `window.webkit.messageHandlers
     .klubbiesSaveToPhotos`, and the app adds each file to Photos with
     add-only access, so it can never read the library.
139. **The album page reads in two rounds, not eight.** Its dozen queries were
     awaited one after another; the independent ones now start together.
     Warm render time on the demo album went from about 0.73s to 0.57s.
