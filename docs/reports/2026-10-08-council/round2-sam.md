# Round 2: Sam (Organiser and Product Strategist, the council's prioritiser)

My bias, stated up front: I rank by how much damage a problem does to an organiser or attendee on the day, divided by what it costs to fix. A sev 3 that takes an afternoon beats a sev 3 that takes a sprint. A sev 2 that needs a redesign of a deliberate decision goes to the back. I re-opened every file:line I cite below.

## Challenges

**V-15 Handle enumeration: DOWNGRADE to 1 (link mode), keep a narrow S fix for guest-list mode.**
I checked `CreateEventForm.tsx:171-177`: the readable, permanent link is a promise we make to the organiser ("The link is made from the name and never changes, so printed QR codes keep working"). People type this link off a closing slide, so readability is worth money. In link mode, the name, date, venue and logo of the event are already printed on the poster and shown on the projector. "Nothing is public" refers to photos, and photos stay behind the code. Random suffixes on new handles would make every slide URL worse to protect information the organiser publishes anyway. The fair part of V-15 is guest-list mode, where an offsite may want its venue unlisted. Fix only that: show the name alone on `/signin?event=` until a code is verified. That is effort S and sev 2 for that mode only.

**I-15 Design-system drift: DOWNGRADE to 1 as a bundle, but split out two sev 2 items.**
This is ten cosmetic items under one M ticket, which is how polish crowds out work that sells. Only two of them change meaning for a user, and both are one-line fixes. First, the "Delete" confirm is `btn-primary` (`AlbumGrid.tsx:333-336`), the only destructive dialog styled that way. Second, "Failed" is drawn in the event accent (`GuestUploader.tsx:113,120`), so on a green event a failure looks like success to the photographer. Ship those two at sev 2, effort S. Put tokens, the lint rule, `global-error` and the salmon palette in a hygiene backlog at sev 1.

**M-10 Rename "Save" to "Favourite": DOWNGRADE to 1 for the rename, keep the copy fix at 2.**
The 27 Sep page walk deliberately moved from "Favourite" to "Save" (page-walk table, "Viewer, Saved, selection bar"). Flipping it back changes four components and the tab bar, and the next reviewer will want it flipped again. The rename also fixes nothing on its own: once M-2 puts a real "Save to Photos" in the viewer, the conflict is visible and we can decide with evidence. The cheap and true part is the empty state, which promises zips appear under Downloads when they never can (zip rows have no `media_id`). That is the same root cause as my S-8, so I merge them below.

**M-7 Face notice redesign: DOWNGRADE to 2, and do the S parts first.**
The masterfile (§4, "notice acknowledged by every attendee") makes the blocking notice deliberate, and the consent copy is legally sensitive. A one-card redesign means legal review plus M effort for a screen people tap through once. The parts that actually stop people are cheap: the disabled "Find my photos" with no reason (`Enrol.tsx`), the missing "Don't want to be in a photo? Request removal" line, and "enrol" in the copy. Ship those (S). Leave the card restructure until we see drop-off on `/me`. The overview's selfie stat (S-6) will show us that drop-off.

**V-11 Zips skip files silently: DOWNGRADE to 1, keep the `part` parsing fix.**
A failed sign or fetch on one original is rare, and adding `missing.txt` plus background zip jobs is M. The real loss with zips is the hidden 150-file cap (V-2, M-4), and that is where effort should go. Keep the `Number("x") → NaN` part parsing fix because it is one line.

**I-2 Lightbox leaves the page behind it focusable: DOWNGRADE to 2 for ordering, while agreeing it is a real AA failure.**
Most attendees use the viewer on phones with touch. The audience hurt is keyboard and screen-reader users on desktop, which is real but small next to M-1, M-2 and M-8, which hit everyone. It is effort S (`inert` on header, credit line and footer), so it belongs in the same accessibility batch as I-1, I-3 and I-4, not ahead of them.

**I-14 ARIA patterns: keep at 2, but not ahead of the S accessibility fixes.**
Converting `MoreMenu` to a disclosure is the right call, but it is M and touches every organiser screen. `aria-hidden` on `PhoneMock` is a two-minute fix, so pull it out and ship it now.

**V-3: UPGRADE to 3, because it combines with my S-3.**
I checked: `upload_ticket/route.ts` writes "This event has reached its limit of 200 photos…", and the organiser uploader shows only "FAILED". On Free, the first paywall an organiser meets is a column of red with no reason. That turns a good upsell moment ("Upgrade to keep uploading") into apparent breakage. Rendering `job.error` is effort S. This is the cheapest revenue fix on the council's list.

## Endorsements (independently confirmed)

- **M-1 / V-1 venue wifi rate limit.** `rate-limit.ts:7-8` sets 20 code requests and 60 verifies per IP per hour. `hitRateLimit` inserts even when refused (:29). `request_code/route.ts:17-25` answers OK before the check runs in `after()`. Confirmed. This is the worst bug in the review: it fails at the moment the organiser says "scan now, everyone". Refinement: key the per-IP limit on IP+event for `flow: "join"` and set a ceiling of about 500 an hour. Ship that with the distinct verify message before anything else.
- **V-2 deletion-warning zips.** `lib/events/retention.ts:36-37` builds `/api/albums/${id}/zip` with no part. `zip/route.ts:42` serves the first 150, and the filename for part 0 is plain `${title}.zip` (:49), so it looks complete. Permanent data loss for paying organisers, effort S. Refinement: link to an admin "Download everything" page that lists every part, not raw API URLs. That also fixes the signed-out JSON error.
- **V-6 schedule UTC** is the same as my S-2. Confirmed, and V-6 adds the silently dropped past time. Accept.
- **V-5 Undo vanishes.** Confirmed `key={`${items.length}-…`}` at album `page.tsx:301`. Decision 25's promise is broken in the common case. Effort S.
- **V-7 / V-8 no age cutoff.** Confirmed: the album page queries `.neq("status","ready")` with no `STUCK_AFTER_MS` (`page.tsx:57-64`), and processing is counted with no age limit (:92-106). "Remove it" on a live upload is a data-loss trap for the organiser. Effort S.
- **I-1 Dialog steals focus.** Confirmed: the effect deps are `[open, onClose]` and callers pass inline arrows (`Dialog.tsx:20-30`). This breaks "Paste a guest list", which is the guest-list onboarding path (my lens). Sev 3, effort S, ref fix.
- **M-12 name required on sign-in.** Confirmed: `SignInForm.tsx` makes `fullName` required in every code flow, including returning members ("As you gave it when you joined"). That includes returning organisers. Effort S. Also strongly endorse the event name in the code email subject. That is an S fix that improves deliverability and recognition.
- **M-6 "Send a new code"** goes back to an empty form. It compounds M-1. Effort S.
- **I-4 focus ring on dark.** A two-tone ring is one CSS rule that fixes every dark surface at once, which is excellent leverage.

## Duplicates / merges

| Merged title | IDs |
| --- | --- |
| Venue wifi shares one sign-in rate limit; codes silently never arrive and correct codes are rejected | M-1, V-1 |
| Zips cap at 150 files without saying so (deletion email, Your photos, home card "part 1") | V-2, M-4 (+ V-11's `part` parsing) |
| Scheduled album times are parsed as UTC on the server | S-2, V-6 |
| Photographer upload page has no safety net (no unload guard, no retry-all, failures scroll away, expired ticket blamed on link, non-resumable PUT) | M-8, M-9, V-4 |
| Saving to the phone is broken or missing (share-sheet only on album header, stops after 8, saves previews and video stills, 240 cap) | M-2, M-3, V-9 |
| Upload errors are invisible to the organiser, including the plan-limit message (first paywall looks like breakage) | V-3, S-3 (paywall half) |
| Zip downloads logged without `media_id`: "Deleted item" in Activity, never in Saved › Downloads | S-8, M-10 (copy half) |
| Unfinished and processing rows have no age cutoff (false "didn't finish", 14-day "still cooking") | V-7, V-8 |
| Shared `Dialog` broken; viewer sheets should be built on it | I-1, I-3 |
| Returning users lose their place after sign-in (organisers land in the gallery; deep links dropped) | S-1, V-12 |
| Silent failures on bad connections | M-13, V "also noted" (UndoBar and UnfinishedUploads uncaught rejections) |
| Undersized targets (swatches, switcher) | I-13, I-5 (size part) |

## Revisions to my own findings

- **S-2:** merged into V-6. I also accept V-6's addition: refuse a past schedule time instead of ignoring it.
- **S-3:** narrowed and re-pointed. The higher-value fix is V-3 (show the limit error and an Upgrade action in the uploader), effort S. The size-step photo estimate is a sev 2 follow-up, effort M.
- **S-8:** merged with M-10's copy half. One fix: store `album_id` on zip access rows and render them as "Album zip".
- **S-10 (step counter):** DOWNGRADE to 1. It is cosmetic and nobody abandons signup over a chip.
- **S-13 (Upload page):** keep at 2, but it is behind every item in the top 10.
- **S-14:** copy fix only, sev 2, effort S. The branded-email feature moves to the feature list next to F-3.
- I withdraw nothing else. S-1, S-4, S-5 and S-6 stand. Nobody else covered them, and each is effort S.

## My top 10 (impact per unit of effort, UX first)

1. **M-1 / V-1**: sev 4, S. The core moment of the product (scan the QR in the room) fails for everyone after guest 20. Nothing else matters if people can't get in.
2. **V-2 (+ M-4)**: sev 4, S. The deletion email tells organisers to download everything, gives them 150 files, and then deletes the rest permanently. Data loss and trust loss.
3. **M-8 / M-9 / V-4, S parts first**: sev 3, S, then M. Add `beforeunload`, "Retry all failed", pinned failed rows and a ticket refetch on 4xx this week. Chunked upload can wait. Without photos uploaded, nothing else in the product happens.
4. **V-6 / S-2**: sev 3, S. Every scheduled album, using the default "tomorrow 9am", goes live 10 hours late. A one-line offset fix.
5. **V-3 (+ S-3)**: sev 3, S. Organisers see "FAILED" with no reason, including at the Free limit. Rendering `job.error` turns breakage into an upgrade path.
6. **M-2 / M-3 / V-9**: sev 3, M. "Get every photo you're in" is the product, and on a phone that means the camera roll. This is the one M on my list because it is the attendee's whole reason to come.
7. **S-1 (+ V-12)**: sev 3, S. Every return visit by a multi-event organiser starts in the wrong place, and unfinished setups are never recovered.
8. **S-5**: sev 3, S. We can take money for upgrades that unlock nothing after deletion. That means chargebacks. One guard in `startCheckoutAction` and the gate copy.
9. **M-6**: sev 3, S. "Send a new code" should send a code. It is cheap, and together with #1 it decides whether the venue sign-in rush recovers.
10. **I-1 (+ I-3)**: sev 3, S. The guest-list paste dialog can't be typed into, which blocks guest-list onboarding. The same ref fix then gives the viewer's removal sheet proper focus.

Just below the line, each effort S: S-4 (blurry poster logo, a one-line signing fix), V-5 (Undo vanishes), V-7/V-8 (false "didn't finish" and stale "still cooking"), I-4 (two-tone focus ring), S-6 (inflated organiser stats). If the team has one more day after the top 10, those five fit in it.
