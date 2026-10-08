# Round 3: Sam (Organiser and Product Strategist), the live app on an iPhone 11 Pro

**Verdict.** The organiser side holds up on a phone better than I expected: the overview, menu and Needs you card make sense at 375pt, and one-event organisers land in admin as they should.
The money and trust problems are worse live than on paper. A one-day hike with 25 photos and 15 short iPhone clips sits at 175 of 200 on Free, and 20 of those units are two uploads nobody can see. The Plan screen in the app then says only that the size "can't be changed in the iPhone app".
The video download complaint is real and fully explained: in the app, Download hands a 31 MB .mov to a blank Safari sheet and never reaches Photos. The fix is web-only and uses a bridge the app already ships. SL-1, SL-2 and SL-3 are each effort S and should go out this week.

Scope: organiser screens [20]-[27], [48]-[63], album and viewer as organiser [28]-[38], marketing chrome inside the app [03], [08]-[10], [17], plus the code behind each. Read-only. Note on timing: `697d093` (venue Wi-Fi rate limit, Send a new code) is committed, and the Brisbane schedule fix (`lib/format.ts` `brisbaneInputToIso`) and a delayed progress bar in `WebViewController.swift` are uncommitted on this branch. The phone ran production, so none of those were on screen.

---

## Confirmed from the phone

- **S-6** inflated and mislabelled numbers: overview "Attendees joined 2" [21] and Attendees "Joined 2" [54] count Max himself (he is the first row, with no checkbox [55]), while the plan meter says "Guests 1 of 50" [22]. "Found their photos 0 / added a selfie" still counts selfies, not finds [21].
- **S-13** Upload opens "New album" with the keyboard up on the name field [48]; the only existing album is below the fold under "Or add to an existing album" [49].
- **S-10** "STEP 1 OF 2" on Create an event [08]. Still cosmetic, still sev 1.
- **S-3** Free cap: confirmed and worse than I wrote, see SL-2 and SL-3. 175 of 200 after one day [22][62].
- **S-14** Next step card promises "Attendees see your brand on every screen, not ours" [20][21], while every album ends "Photos by Klubbies Events" [31] and the gallery home too. Change the card copy now.
- **S-7** (copy half only): the Next step button "Add your logo" lands on a box that says "Drop your logo" with no visible button [61]. The drop-navigates-away bug can't happen on a phone; see SL-9.
- **V-7 / V-8** no age cutoff: IMG_9382.mov and IMG_9390.mov "started 6 Oct, 7:04 pm" are listed as "didn't finish" in the banner [28] and as "Processing" tiles in the grid 2 days later [30].
- **V-13** no loading state on organiser pages: each menu tap shows the old page for 2.5 to 3s [27]. No `loading.tsx` under `app/(app)/admin/`. The wrapper progress bar now in flight on this branch helps but does not replace a route skeleton.
- **M-2 / M-3 / V-9** getting media onto the phone: confirmed for video and worse, see SL-1 [34]-[37].
- **S-1** (one-event half): opening the app lands on the Rasmus trip overview [20]. Viktor's downgrade to sev 2 was right.

## Not reproduced / wrong

- **S-3, my claim that "the organiser learns about the cap from the photographer"**: wrong as written. The meter is on the overview [22] and Plan [62] and is easy to read. The real problems are that it never changes colour on the way to the cap, the unit maths is opaque, and in the app there is no next step (SL-2, SL-3, SL-5).
- **S-9** Removals missing from the menu [26] is by design: `components/AdminNav.tsx:144` shows it only when there are open requests. Not a contradiction of S-9, which is still untested live (no requests on this event).
- **S-2 / V-6** not testable without publishing a scheduled album. The field shows "09.10.2026 at 09:00" [49]. The fix on this branch hardcodes `+10:00` (`lib/format.ts`), which matches the app's all-Brisbane display. Organisers in NSW or Victoria during daylight saving will see albums go live 1 hour after the time they meant. That's acceptable for now (sev 1) as long as the time shows next to "Goes live".
- **S-11, S-12, S-4, S-5, S-8 (zip rows)** not exercised on the phone. Nothing seen contradicts them.

---

## New findings

### SL-1 Downloading a video in the iPhone app opens a blank Safari sheet on a storage URL and never saves to Photos
- Where: [32] → [34] → [35] → [36] (blank for ~20s) → [37] ("IMG_9362.mov, QuickTime movie - 31 MB", "Open in..."). `app/(app)/e/[handle]/a/[albumId]/[mediaId]/Viewer.tsx:297` (Download is a plain link to `/api/media/${id}/download`); `app/api/media/[id]/download/route.ts:36-37` (logs, then 303 to a presigned R2 URL); `ios/KlubbiesEvents/WebViewController.swift:224-238` (any main-frame URL that isn't `events.klubbies.app` is cancelled and handed to `openOutside`, which presents `SFSafariViewController` at :200-205). Attendee and organiser, viewer, Download.
- Heuristic / severity / effort: Nielsen #1 Visibility of system status, #2 Match / 3 / S
- Problem: this is the owner's "a friend says downloading videos doesn't work". The redirect lands on `*.r2.cloudflarestorage.com`. The wrapper treats that as an outside site, so the download path in the wrapper (`decidePolicyFor response` at :242 and the share-sheet hand-off at :212) never runs. The user sees a sheet titled with a Cloudflare hostname (which looks wrong in a privacy product), 20 seconds of white, then a QuickTime icon. Nothing is in Photos. To keep the video they have to find Open in... → Save Video themselves, and most won't. A second tap starts over. Photos go through the same route but load fast enough to look like a preview, so people don't report them. Videos are where it breaks. The share email we hand organisers promises "You can download them at full quality" [58], so the organiser gets the complaint. There's a business cost too: each tap logs a "download" before any file arrives (route.ts:36), so the organiser's Downloads stat counts these failures as successes (see SL-11).
- Fix (web only, no App Store release needed): the app already ships `klubbiesSaveToPhotos` (`ios/KlubbiesEvents/PhotoSaver.swift`). It takes signed URLs, detects `video/quicktime` from the response, and saves `.mov` as a video. R2 objects keep their content type (`lib/backup/r2-core.ts:76`), so detection works.
  1. In `download/route.ts`, when `?as=url` is passed, return `{ url, filename, bytes }` as JSON instead of redirecting.
  2. In `Viewer.tsx`, when `nativeSaveToPhotos()` is non-null, make Download a button: fetch `?as=url`, show "Saving video to Photos… (31 MB)" with a spinner (it really does take 10 to 20s on mobile data), call `postMessage({ urls: [url] })`, then show "Saved to Photos" or the returned error. Label the action "Save to Photos" in the app.
  3. In the wrapper's next release, catch storage hosts (`*.r2.cloudflarestorage.com`, the Supabase storage host) in `decidePolicyFor action` and return `.download` instead of `openOutside`, so any link we miss lands in the share sheet rather than a Safari sheet.
  - Outside the app (mobile Safari, Android, Windows), the same route gives a `.mov`, which iPhone Safari puts in Files, not Photos. iPhone HEVC `.mov` also won't play on stock Windows without the HEVC extension. **Ask the owner which device the friend used.** If it was Android or Windows, the fix is an H.264 MP4 rendition at processing time (effort M, server-side transcode). Don't build that before we know.

### SL-2 Fifteen short phone clips use 150 of Free's 200 photos, because every clip is rounded up to a full minute
- Where: [22] and [62] "Photos 175 of 200" for an album of "25 photos · 13 videos" [28] with clips of 0:04, 0:09, 0:08 [31]. `lib/billing/plans.ts:63-66` and `supabase/migrations/20260928000027_plans_and_limits.sql:78-88` (`10 * greatest(1, ceil(coalesce(duration, 60) / 60))`). Organiser on Free, any event where people film on phones.
- Heuristic / severity / effort: Nielsen #2 Match between system and the real world (and pricing fairness) / 3 / S
- Problem: the numbers add up exactly. 25 photos, plus 13 ready clips and 2 stuck ones at 10 units each, is 175. A 4-second clip costs the same as a 59-second one. Ten seconds of a waterfall is worth 10 photos. iPhone users film lots of 3 to 10 second clips, so a Free event fills after about 18 of them. The organiser sees 25 photos and "175 of 200 photos" and decides our counter is broken; that is the "inconsistent counts" complaint. On the commercial side, Free is the acquisition funnel. An upgrade prompt that feels like a trick costs more in word of mouth than the Small upgrade earns. The marketing line "a 2 minute clip counts as 20" (`lib/copy/site.ts:187`, `pricing/page.tsx:124`) is honest about long clips and silent about short ones.
- Fix: charge per started 6 seconds, 1 unit each: `greatest(1, ceil(coalesce(duration, 60) / 6))`. The minute rate is unchanged (60s = 10, 2 min = 20, so the pricing copy stays true), and a 4s clip costs 1. Change `media_units` in a new migration, `mediaUnits` in `plans.ts`, and `supabase/tests/limits.sql:79`. Copy: "Video counts by length: each minute counts as 10 photos, a 5 second clip as 1". Keep the null-duration default at 60s for the insert guard, but recompute once finalize stores the real length. HEVC clips uploaded from desktop Chrome get no duration (`lib/media/prepare.ts:134-135`), so read the duration server-side from the poster job or `ffprobe` when the client couldn't.

### SL-3 Uploads that never finished still count against the allowance
- Where: [22] "2 uploads didn't finish", [28] the two `.mov` files from 6 Oct, [22] 175 of 200. `supabase/migrations/20260928000027_plans_and_limits.sql:90-101` (`event_units_used` excludes only `status = 'failed'`, so stuck `processing` rows count, with null duration charged as a full minute).
- Heuristic / severity / effort: bug, money / 3 / S
- Problem: two files attendees can't see are using 20 units, 10% of a Free event, and they will for 14 days until the sweeper clears them. When the organiser presses "Upload again" [28], the guard counts the new rows on top of the stuck ones, so an event near its cap can refuse the retry because of the failure it is retrying.
- Fix: in `event_units_used`, count `ready` rows plus `processing` rows younger than `STUCK_AFTER_MS` (1 hour, `lib/media/constants.ts:37`). Mirror that in `actions.ts:561-565`. Then "Remove it" frees room immediately, and "Upload again" never collides with its own failure.

### SL-4 One event, five different counts: the organiser can't tell which number is true
- Where: overview "Photos and videos 38, 2 unfinished" [21]; album "25 photos · 13 videos" [28] with 40 tiles including 2 "Processing" [30]; Albums list "38 files" [23][49]; gallery home "38 photos and videos" [64]; Plan "Photos 175 of 200" [62]. People: "Attendees joined 2" [21], "Joined 2" [54], "Guests 1 of 50" [22]. `admin/[handle]/page.tsx:57, 61, 250-262`; `components/PlanMeters.tsx:58-63`; `private.event_guests_joined` (migration 27:104-117) vs `memberships` count with no role filter.
- Heuristic / severity / effort: Nielsen #4 Consistency, #2 Match / 2 / S
- Problem: each number is defensible alone. Together they look like a broken product to the person who pays, and these are the screens organisers screenshot for a club committee or a client. "Photos 175" with 25 photos on screen is the worst one. A unit is not a photo, and the label says it is.
- Fix: one definition per noun, used everywhere. (a) Rename the meter "Photo allowance" and show the split under it: "25 photos (25) · 15 videos (150)". At the cap, add "2 unfinished uploads use 20" until SL-3 ships. (b) Attendees = counted guests only (`is_counted_guest`), on the overview stat, the Attendees stat, the nav badge and the meter. Show the organiser team as a separate line ("plus 1 organiser"). This is S-6 done properly. (c) The grid should not draw stuck files as "Processing" after `STUCK_AFTER_MS` (V-8): show "Didn't finish" so the 40 tiles match the banner.

### SL-5 The meter gives no warning before the cap, and the in-app Plan page is a dead end
- Where: [22][62] the bar at 87.5% is the same blue as at 5%; `components/PlanMeters.tsx:5` (`tone` changes only at 100%, and then to ink, which looks calmer, not more urgent). [62][63] "The event's size can't be changed in the iPhone app." with nothing after it (`billing/page.tsx:122-124`). The email only goes out at 90% (`lib/billing/notices.ts:28`).
- Heuristic / severity / effort: Nielsen #1 Visibility, #5 Error prevention / 2 / S
- Problem: Max's event is three clips from "Uploads have stopped". Nothing on screen says so. Inside the app we can't sell or link out (Apple 3.1.1 and 3.1.3; outside the US storefront there's no link-out exception), so the sentence is accurate. But it leaves the organiser with no move, and the one move they do have, deleting clips they don't need, isn't mentioned.
- Fix: amber bar and a line at 80% ("25 left. Videos use 10 per minute."), red at 100%. On the in-app Plan page, replace the sentence with things the organiser can do in the app: "Free up room: remove unfinished uploads (2) · see videos, which use the most" (links to the album with the Videos filter). Add a neutral "We'll email you before uploads stop". Send the photo notice at 80% on Free instead of 90%, because one clip is 5% of the allowance. Email is outside the app, so the upgrade link belongs there. I'm not certain where Apple draws the line on "We'll email you about sizes", so keep the in-app copy free of any mention of buying.

### SL-6 In the iPhone app, the legal pages show the Pricing link and "paid sizes from A$49": an App Review risk one tap from the first screen
- Where: [03] sign-in landing "Terms" → [09] Terms rendered inside the WebView with the marketing hamburger → [10] menu with "Pricing" and "Free for up to 50 guests, paid sizes from A$49 per event. No subscription." `components/LegalPage.tsx:59` (`<SiteNav current="privacy" />`, no `inApp`) and `:98` (`<SiteFooter />`, no `inApp`). Compare `components/site/SiteNav.tsx:22, 149` and `SiteFooter.tsx`, which already support `inApp`, and `pricing/page.tsx:27`, which redirects to `/` in the app, so the Pricing link in the app is also a dead end.
- Heuristic / severity / effort: Nielsen #4 Consistency (with our own Apple rule) / 3 (launch blocker if a reviewer finds it) / S
- Problem: the codebase goes to real lengths to keep prices out of the app (the CreditLine, billing page, start page, FAQ and Home all branch on `inApp`). The four legal pages don't, and Terms and Privacy are the first links an App Reviewer taps on the sign-in screen. A rejection costs us a week.
- Fix: make `LegalPage` read `isNativeAppRequest()` and pass `inApp` to both `SiteNav` and `SiteFooter`. Add a test that renders each marketing route with the app user agent and asserts no "A$" and no `/pricing` href. Also check the Refunds page body for amounts while you're there.

### SL-7 "The Max team": the announcement email and gallery header read wrong when the host is a person
- Where: [58] the sign-off "The Max team"; [64] "HOSTED BY MAX". `app/(app)/admin/[handle]/share/page.tsx:30` (`The ${event.organisation} team`); `app/(app)/admin/new/CreateEventForm.tsx:79-89` (the field is labelled "Hosted by" with the placeholder "Company or organisation").
- Heuristic / severity / effort: Nielsen #2 Match / 2 / S
- Problem: the form asks "Hosted by", so a person types their name, and the email template assumes a company. Every uni club treasurer, friend-group trip and solo organiser gets "The Sarah team" in an email they send under their own name. It's the most-copied text we produce, and it makes the organiser look careless.
- Fix: sign off with the bare value on its own line (`Max` or `UQ Volleyball Club`), with no "The … team". Change the placeholder to "Your name, club or company". Keep "Hosted by" on the gallery header; it reads fine.

### SL-8 The Activity card logs one row per photo view, with camera filenames
- Where: [24] five rows of "Rasmus Klaerke viewed IMG_9376.mov … IMG_9368.jpeg" within one minute; `app/(app)/admin/[handle]/page.tsx:396-412`, the full log in `activity/page.tsx`.
- Heuristic / severity / effort: Nielsen #8 Aesthetic and minimalist design, #2 Match / 2 / S to M
- Problem: one guest flicking through an album fills the card, and "IMG_9376.mov" tells the organiser nothing. On a friends' trip, a named per-photo log of what a friend looked at reads as surveillance, not insight. It's sold as a feature ("You can see who opened what", `lib/copy/site.ts:141`). What the organiser actually wants is "who came, and did they get their photos".
- Fix: group by person, album and 30-minute session: "Rasmus Klaerke looked at 14 photos and 3 videos in Mt barney · 7 Oct, 9:15 am", with "downloaded 2" when it applies. Put a thumbnail strip on the full log instead of filenames. This also prepares the data for the F-1 event report.

### SL-9 "Drop your logo", "Drop the guest list": the setup screens are written for a desktop the organiser isn't using
- Where: [61] Settings logo box; [53] Attendees "Drop the guest list" with only "Paste a list instead" visible; [21] the Next step button "Add your logo". `settings/LogoUploader.tsx:37-53` (the whole box is tappable, but it only says "Drop"); `attendees/RosterImport.tsx:148-158`.
- Heuristic / severity / effort: Nielsen #6 Recognition rather than recall, #2 Match / 2 / S
- Problem: the walk shows how organisers really work: from the phone, on the day. There's no drag on a phone. The box works if tapped, but nothing says to tap it, and the guest-list box's only visible button sends people to paste, which is the harder path when you have an Eventbrite CSV in Files.
- Fix: add a visible "Choose a logo" / "Choose a file" button inside each box. Show the "or drop it here" line only under `@media (pointer: fine)`. Apply the same rule to the photographer and organiser upload zones.

### SL-10 After the event, the overview still leads with a setup nag; the real work sits below the fold
- Where: [20] the only primary button on the overview is "Add your logo" (Next step · 2 of 4 done); "Needs you: 2 uploads didn't finish" is two screens down [22]. `admin/[handle]/page.tsx:217-238` ("One primary button per screen: while setup steps remain, it's the Next step's"), Needs you at :282 onwards.
- Heuristic / severity / effort: Nielsen #8, information architecture / 2 / S
- Problem: on 8 Oct, three days after a one-off trip, the organiser's priorities are failed uploads and a cap that's about to bite. A logo for a hike that's over isn't one of them. The Next step card was right during setup and is wrong once photos are live.
- Fix: when any album is published or the event's last day has passed, drop the Next step card to a one-line "Setup 2 of 4 · All steps" under the stats, and render Needs you first, with urgent tasks taking the primary button. Also give the "New album" button its secondary style back.

### SL-11 "Downloads" counts taps, not files delivered, including the organiser's own
- Where: [21] "Downloads 1, single photos and zips"; `app/api/media/[id]/download/route.ts:36` logs before the redirect, so every in-app video tap that ends in the blank sheet [36] counts. Organiser downloads are included (S-6).
- Heuristic / severity / effort: Nielsen #2 Match / 2 / S
- Problem: this is the "proof of value" number. Today it goes up when downloads fail, and it goes up when the organiser checks their own gallery.
- Fix: after SL-1, log `download` from the native save result (`saved > 0`) or from a client ping after the browser download starts, not in the redirect. Exclude `event_admin` memberships and null-membership organiser rows from the stat, or label it "including your team".

### SL-12 The album "…" menu opens off the left edge, cutting off "Unpublish"
- Where: [66] the menu shows "tails and cover", "o Photos", "oad all", "lish, back to draft". `components/AlbumActions.tsx:187` uses `MoreMenu` with the default `align = "end"` (`components/MoreMenu.tsx:18`), but here the button sits at the left of the row.
- Heuristic / severity / effort: Nielsen #4 / 2 / S
- Problem: the organiser's controls for the album (edit, Save to Photos, Download all, Unpublish) are half off screen on a 375pt phone. The destructive item is the one that's hardest to read.
- Fix: `align="start"` at AlbumActions:187. Better, have `MoreMenu` flip alignment when the panel would overflow the viewport, which fixes every instance at once.

Also seen, not mine to own: the viewer says "Photo: Maximilian Umschaden" and "About this photo" for a video [32][38] (Maya); the date inputs overflow cards on Upload, Photographers and Settings [50][52][60] (Ines); [67] landscape is a Device Hub artefact, since the app is portrait-locked (`project.pbxproj:195, 229`).

---

## My top 10 for the fix list

Not ranked, because the work is already committed or in progress on this branch: M-1/V-1 and M-6 (`697d093`) and S-2/V-6 (uncommitted). Deploy those and check them on the phone before anything below.

1. **SL-1** video download in the app: sev 3, S, web-only through a bridge the app already ships. It's the owner's open complaint and the share email promises it.
2. **SL-2 + SL-3** allowance maths (short clips, stuck files): sev 3, S, one migration. Free is the funnel, and the owner's own one-day event is at 87.5%.
3. **V-3 (+ S-3)** show the plan-limit error in the uploader: sev 3, S. At 175 of 200, the next three clips meet the paywall as a red "FAILED" with no reason.
4. **SL-6** prices inside the app on the legal pages: sev 3, S. One reviewer tap from a rejection, and the fix is two props.
5. **V-2 (+ M-4)** zips quietly stop at 150, including in the deletion email: sev 4, S. Permanent data loss. It's ranked below the live issues only because the first deletion is a year away.
6. **M-8 / M-9 / V-4 + V-7 / V-8** upload failures: sev 3, S first. Two `.mov` files have been stuck since 6 Oct, shown as both "Processing" and "didn't finish".
7. **SL-4 + S-6 + SL-11** one set of numbers: sev 2, S. These are the screens organisers forward to a committee or client, and right now they disagree with each other.
8. **SL-5** warn before the cap and give the in-app Plan page a real next step: sev 2, S. It turns the cap from a surprise into a choice.
9. **M-2 / M-3 / V-9** Save to Photos for whole albums, at full quality and including videos: sev 3, M. SL-1 does single files; this is the attendee's whole reason to install the app.
10. **SL-10 + V-13** overview priorities after the event and loading states on organiser pages: sev 2, S. Cheap, and the app feels slow and confused without them.

Just below the line, each effort S: SL-7 ("The Max team"), S-5 (selling upgrades after deletion), SL-12 (cut-off album menu), S-1 (multi-event landing), SL-9 ("Drop" copy on phones).
