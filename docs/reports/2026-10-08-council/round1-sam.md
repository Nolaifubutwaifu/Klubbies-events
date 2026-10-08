# Round 1: Sam (Organiser and Product Strategist)

**Verdict.** Onboarding is mostly solid: the guided required steps, the Next step card and the overview's QR card get an organiser from signup to a shareable link quickly.
The problems sit in what happens next. Returning organisers land in the wrong place, scheduled albums go live hours late, the poster prints a blurry logo, and the numbers an organiser shows their boss are inflated.
There is also one money bug: after the 12 month deletion we still sell upgrades that unlock nothing. Fix S-1 to S-6 first. All are effort S except part of S-3, and each one protects revenue or the organiser's reputation.

Scope: static read of the organiser funnel (`/start` to `/admin/new` to setup, then the admin area), billing gates, `/events`, EventSwitcher and the marketing conversion path. I skipped things decisions.md already settles, for example the menu staying hidden until the required steps are done (102), one album per photographer link (10), and no per attendee match counts (18).

---

### S-1 Returning organisers land in the attendee gallery, not their admin, and abandoned setups are invisible
- Where: `app/(app)/events/page.tsx:67-69` (every card is `href={/e/${event.handle}}`, including `isAdmin` events); `lib/auth/flow.ts:246` (an organiser with 2 or more events signs in to `/events`); `app/(auth)/signin/page.tsx:19`. Organiser, return visit and sign-in.
- Heuristic / severity / effort: Nielsen #7 Flexibility and efficiency (also #2 match with the user's goal) / 3 / S
- Problem: once an organiser has a second event, which every repeat customer does, signing in shows "Your events". Each card opens the attendee gallery, so the organiser has to find "Organiser view" in the header every time. An event abandoned at the size step, say after a cancelled Checkout, looks the same as a live one and shows "No photos yet". Nothing says "Finish setting up", so the organiser opens an empty gallery as an attendee and the unfinished setup is never recovered.
- Fix: in `events/page.tsx`, point admin cards at `/admin/${handle}`. The admin layout already redirects to `/setup` when required steps are missing. Add a small secondary "Gallery" link on the card. Show a "Setup not finished" or "Next: …" chip from `setupState()` on admin cards. Optionally sort the organiser's own events first.

### S-2 Scheduled albums go live about 10 hours late (local time parsed as UTC on the server)
- Where: `app/(app)/admin/actions.ts:405-409` (`createAlbumAction`: `new Date(publishAt)`) and `:811-815` (`scheduleAlbumAction`). Inputs are `datetime-local` in `upload/NewAlbumPanel.tsx:152-162` and `albums/AlbumManager.tsx:398-402`. The same pattern appears in `guest-actions.ts:34` (`${date}T23:59:59`). Organiser, New album and Schedule.
- Heuristic / severity / effort: bug (Nielsen #1 Visibility of system status) / 3 / S
- Problem: `datetime-local` sends a string with no zone, such as `2026-10-09T09:00`. The server action runs on Vercel in UTC, so "tomorrow 9am", the default from `tomorrowMorning()`, is stored as 09:00 UTC, which is 7pm Brisbane. The organiser who promised attendees "photos at 9am" gets an empty gallery all day. The album row only shows the date (`formatLongDate(album.publishAt)`, AlbumManager:348), so they can't see that the time is wrong. `toLocalInput()` then shows 19:00 when they reopen it. Access window dates already use `endOfDayBrisbane` (actions.ts:157); these two paths don't. Guest link expiry has the same bug but it errs late, by 10 hours, so it is harmless.
- Fix: parse with the event's timezone server side, using the same helper as the access window (Brisbane today, or an `Australia/Brisbane` wall-clock to UTC conversion). Or send `new Date(local).toISOString()` from the client. Show date and time in "Goes live …".

### S-3 The size step picks a plan by guests only; Free's 200 photo cap then shuts the photographer out mid-event
- Where: `app/(app)/admin/[handle]/setup/SizeStep.tsx:191-193, 215-224` (`suggestedTier(count)` and `freeFits` only look at guests); `lib/billing/plans.ts:122-126`; the photographer's dead end at `app/g/[token]/page.tsx:33-45` ("This event is full… Ask the organiser to make room"). Organiser at setup, then photographer on the day.
- Heuristic / severity / effort: Nielsen #5 Error prevention / 3 / S (copy and warning), M (photo estimate)
- Problem: the size step asks only "About how many guests?". A 40 guest launch is highlighted as "Fits your guests: Free" and the primary button becomes "Continue with Free". One professional photographer typically delivers 300 to 800 frames. At 200 the upload link turns into "This event is full", in front of a paid supplier and usually after the event, when the organiser isn't watching. The organiser learns about the cap from the photographer. Free is the main acquisition path, so this is the worst moment for the first paywall to appear.
- Fix: on the Free card, state the photo cap as plainly as the guest cap, and warn: "One photographer usually shoots 300+ photos. Free stops at 200." Better: add an optional "Roughly how many photos?" field (or "How many photographers?") and make `suggestedTier` take the larger of the two needs. When usage reaches 90% of photos, make sure the organiser email goes out before uploads stop (decision 62 covers guests; check that photos are covered too).

### S-4 The printed A4 poster uses the 96px logo badge, so the client's logo prints blurry
- Where: `app/(print)/admin/[handle]/share/poster/page.tsx:22-27, 53`. The comment says "The poster wants the full logo, not the 96px badge", but `signLogoMarks()` returns the mark first (`lib/storage/index.ts:132-138`, `LOGO_MARK_SIZE = 96` at :47). Organiser, Share kit, Print A4 poster.
- Heuristic / severity / effort: bug (looks unprofessional at the venue) / 3 / S
- Problem: the logo is drawn 16mm tall, about 190px at 300dpi, from a 96px webp, so it prints soft or pixelated. The poster goes on the registration desk next to sponsors' material. The organiser looks bad and blames us.
- Fix: sign the original `event.logo_path` with `signPaths(...)`, as the Settings page already does (`settings/page.tsx:27-29`). Keep the mark only for small badges.

### S-5 After the 12 month deletion, screens say "Activate, unlocks after payment" and billing still sells upgrades that unlock nothing
- Where: `lib/billing/status.ts:15-17` (`canWrite` is false once `photos_deleted_at` is set). The stale copy is in `components/BillingGate.tsx:10-19`, `components/AppHeader.tsx:93-105`, the overview task `admin/[handle]/page.tsx:143-154`, and `ACTIVATE_MESSAGE` in `lib/billing/status.ts:3`. `billing/page.tsx:216-254` still renders "Pay A$X" offers, and `billing-actions.ts:24-30` (`startCheckoutAction`) does not check `photos_deleted_at`, while `startKeepYearAction` at :45 does. Organiser, past the deletion date.
- Heuristic / severity / effort: bug, money (Nielsen #2 match with reality, #9 error recovery) / 3 / S
- Problem: since the Free tier (decisions 36-37), unpaid events are Free and can write, so "not activated" almost never happens. The main way `canWrite` is false now is the 12 month deletion. In that state, every gate tells the organiser to "Activate event", which links to billing. The organiser can pay for Small to Medium and still not be able to upload. That leads to refunds, chargebacks and angry support mail.
- Fix: branch the gate copy on the reason. When `photos_deleted_at` is set, say "Photos from this event were deleted on X. Nothing new can be added" with no button. Hide `offers` on the billing page and refuse in `startCheckoutAction` when `photos_deleted_at` is set. Replace "after payment" copy everywhere with wording that fits the Free tier.

### S-6 The organiser's headline numbers are inflated or mislabelled, and these are the numbers they report upward
- Where: overview `admin/[handle]/page.tsx:57` ("Attendees joined" counts every active membership with no role filter, including the organiser, co-organisers and account photographers; the `<= 1` at :196 is a workaround for the organiser being counted); `:63-67, 274-278` ("Downloads" includes organisers' own downloads, which are logged with a null membership and shown as "An organiser" at :407); `:267-272` (label "Found their photos", hint "added a selfie": it counts selfies, not people who found anything); `admin/[handle]/attendees/page.tsx:66-67` ("Joined" includes organisers); nav badge `layout.tsx:25-29` (a new event shows "Attendees 1", which is the organiser). Organiser, Overview and Attendees.
- Heuristic / severity / effort: Nielsen #2 Match between system and real world / 2 / S
- Problem: after the event, an organiser screenshots the overview for their boss or sponsor: "212 joined, 340 downloads". Some of that is their own team and their own QA clicks. A co-organiser joining breaks the "nobody has joined" nudge. "Found their photos" overstates what happened. This is the product's proof of value, so it needs to be exact.
- Fix: filter `joined` to the Attendee role, as `setupState` already does with `.neq("role","event_admin")`, and apply the same rule to the nav badge and the Attendees stat. Exclude organiser actions from Downloads, or label it "including your team". Rename the stat "Added a selfie" (as Attendees does) or "Ready to find their photos".

### S-7 The logo drop zone invites a drop but has no drop handler, so dropping a file navigates away from Settings
- Where: `app/(app)/admin/[handle]/settings/LogoUploader.tsx:38-53`. It renders "Drop your logo" with class `dropzone` but has no `onDragOver` or `onDrop` (compare `Uploader.tsx`, which has both). Also `lib/events/setup.ts:387-392`: "Add your logo and colour" links to `#brand` (Logo only) while the colour field is in `#details`, and the step counts as done on the logo alone. Organiser, setup step "Add your logo".
- Heuristic / severity / effort: bug, Nielsen #4 Consistency / 2 / S
- Problem: the first recommended step after setup is the logo. The organiser drags the PNG from their desktop as the UI asks. The browser opens the image in the tab, leaving the app, and nothing is uploaded. Then the colour, which is half of what the step is named for, isn't on the screen they were sent to.
- Fix: add `onDragOver={e => e.preventDefault()}` and `onDrop={e => {e.preventDefault(); onFile(e.dataTransfer.files[0])}}`. Point the step at `#details` or move the colour field into the Logo section and call it "Branding". Mark the step done when a logo or a colour is set, or rename it.

### S-8 Activity log: zips show as "Deleted item", the Downloads filter leaves zips out, and the page promises a view it can't give
- Where: `admin/[handle]/activity/page.tsx:19, 64-66` (the filter only knows `view` and `download`); `:105-111` (rows with no media, which is every `zip` written by `api/albums/[id]/zip/route.ts:46` and `api/events/[id]/me/zip/route.ts:45`, render "Deleted item"); `:53-55` copy: "…and which attendees have never opened anything". Organiser, Activity.
- Heuristic / severity / effort: Nielsen #1 Visibility and #2 Match / 2 / S
- Problem: album zips are the most common download. Each one looks like a deleted photo, which is alarming for a privacy product, and the "Downloads" view undercounts compared with the overview, which counts download plus zip. The copy promises a per-attendee "never opened" view that doesn't exist.
- Fix: render zip rows as "Album zip" or "All their photos (zip)" (log the album id in the row if needed), and include `zip` in the Downloads filter. Either drop the "never opened anything" claim or add a "Joined, never opened" filter on Attendees. That filter would be cheap and is a good nudge list. See F-1 for export.

### S-9 Open removal requests can fall off the Removals page, then auto-delete without the organiser seeing them
- Where: `admin/[handle]/removals/page.tsx:25-31`: `.order("status", { ascending: true }).limit(30)`. Status is text in `('open','confirmed','restored')` (`supabase/migrations/20260919000011_guests_removals_event_types.sql:73`). Organiser, Removals.
- Heuristic / severity / effort: bug / 2 / S
- Problem: alphabetically "confirmed" sorts before "open". Once an event has 30 confirmed requests, which a 1,000 guest conference can reach over 12 months, new open requests are cut off. The nav badge says "3 waiting", the page says "Nothing waiting on you", and the photos are deleted when the 7 days run out. The organiser loses the say the product promises them.
- Fix: run two queries (all `open`, then the latest 30 settled), or order by `status = 'open'` first through a view or RPC.

### S-10 Onboarding step counter contradicts itself: "Step 1 of 2", then "Step 1 of 3", then "Step 3 of 3"
- Where: `app/(auth)/start/page.tsx:60` and `app/(auth)/signin/code/page.tsx:31` ("Step 1 of 2"); `app/(app)/admin/new/CreateEventForm.tsx:56` ("Step {step} of 3"); `setup/page.tsx:65` ("Step 3 of 3"). Organiser, signup.
- Heuristic / severity / effort: Nielsen #1 Visibility of system status / 2 / S
- Problem: the organiser is told the process has 2 steps, finishes step 1, and then starts again at "Step 1 of 3". Progress appears to go backwards at the point where we most need momentum.
- Fix: count email confirmation as step 1 of 4 throughout, or drop the chip on `/start` and the code screen ("First, confirm your email") and keep the 3 event steps.

### S-11 Photographer handoff has dead ends: no album link, a one-time URL with no QR or send option, and silent caps at 40
- Where: `photographers/GuestLinkForm.tsx:70-73` ("Create an album first." is plain text with no link or button); `:119-142` (the link is shown once, Copy only); `photographers/page.tsx:41, 49` (`.limit(40)` on links and albums; the album picker is silently capped); `:52, 88` (links into hidden albums lose their album name because hidden albums are excluded from `albumTitle`). Organiser setting up photographers, often on the day.
- Heuristic / severity / effort: Nielsen #7 Flexibility / #3 User control / 2 / S
- Problem: in the 40 minutes before doors open, the organiser has the photographer standing next to them. They copy a long URL on a laptop and then have to get it onto the photographer's phone or laptop by messaging themselves. If they navigate away before sending it, the link is gone and they have to make another, leaving the first one live. If no album exists yet, they hit a sentence with nothing to click.
- Fix: make "Create an album first" a button to `/upload`, and ideally return to Photographers afterwards. Next to the one-time link, show a QR code of it, which `eventQrSvg`-style code already makes, plus "Email it to the photographer" (one field, sent via Resend). Remove the 40 cap or paginate, and show the album name for hidden albums with "(hidden)".

### S-12 No bulk publish: "3 albums still in draft, Publish" leads to a list with one button per row
- Where: overview task `admin/[handle]/page.tsx:186-194` links to `/albums`; `albums/AlbumManager.tsx:365-374` has one Publish per draft row and no select-all or "Publish all drafts". Organiser, the morning after.
- Heuristic / severity / effort: Nielsen #7 Flexibility and efficiency (bulk actions) / 2 / S
- Problem: the typical flow is that photographers upload into 4 to 6 draft albums overnight and the organiser publishes them all at 9am. That takes 6 clicks, 6 refreshes and 6 "album published" email waves when 1 would do. The overview's "Publish" button sets up an action the next page doesn't offer.
- Fix: add a "Publish all drafts (N)" button in the Albums header when drafts exist, and point the overview task at it. Use one server action that publishes the set and sends one combined "new photos" email per attendee.

### S-13 "Upload" in the menu opens a page titled "New album" that lists only the 6 latest albums to add to
- Where: `components/AdminNav.tsx:270` ("Upload"); `admin/[handle]/upload/page.tsx:27, 32` (`limit: 6`, title "New album"). Organiser adding more photos to an existing album.
- Heuristic / severity / effort: Nielsen #4 Consistency, information architecture / 2 / S
- Problem: an organiser who wants to add 20 more photos to "Keynote" clicks Upload and gets a form to make a new album, with autofocus on the name field. If Keynote isn't one of the 6 newest albums, there is no path from this page. They have to go to Albums, open the album in the attendee view, and find the add control.
- Fix: retitle the page "Upload", put an album picker (all albums, searchable) or the drop zone first, and make "New album" the secondary option. Remove the `limit: 6`.

### S-14 Marketing promises the organiser's brand "on every attendee screen and email", but every email is Klubbies branded
- Where: `lib/copy/site.ts:91-94` (Feature "Your brand, not ours": "…on every attendee screen and email"); `emails/Layout.tsx:18` (header is the text "Klubbies Events" with no event logo or colour). Marketing `/features` leading to attendee emails (album published, closing soon, let in).
- Heuristic / severity / effort: Nielsen #2 Match / trust in the sales promise / 2 / S (copy), M (feature)
- Problem: a corporate buyer picks us because of that line. Their attendees then get emails headed "Klubbies Events". It is a small thing but it breaks the promise, and it matters most to the agencies we want as repeat buyers.
- Fix: now, change the copy to "on every attendee screen, the join page and the poster". Next, put the event logo (long-TTL signed or public mark) and event name in the email header, and keep "Photos by Klubbies Events" in the footer as the credit line.

---

## Where I'd push back (low value for the effort, don't spend on these yet)
- **Attendees 2,000 row cap with client-side search** (`attendees/page.tsx:16, 107-110`): the copy says "Search to narrow the list" but search only covers the loaded rows. It's real, but Large is 1,000 guests and only custom quotes go past it. Fix the copy, not the architecture.
- **Pricing CTAs not carrying the chosen size into `/start`** (`pricing/page.tsx` cards all link to `/start`): the size step asks for headcount anyway. Low value.
- **"Student clubs: A$X" on every pricing card** (`pricing/page.tsx`): it adds noise for corporate buyers, but it's a positioning call for Max, not a defect. Severity 1 at most.
- **Guest list step done when `onList > 1`** (`lib/events/setup.ts:399-401`): adding a co-organiser ticks it. It is an edge case and costs nothing to leave.

## Feature ideas (not defects; ranked by value per effort)
- **F-1 Event report for the client or sponsor (M).** A one-page PDF or CSV from the overview: joined vs invited, selfie rate, downloads, per-album views (already in `album_engagement`), top 10 most downloaded photos, plus a "joined, never opened" list. `/ops/usage` already computes selfie and download rates. This is what makes an agency rebook and lets an organiser justify a paid size.
- **F-2 Send the gallery link to the guest list from the app (M).** In guest list mode we already hold the emails. Offer "Email everyone on the list" and "Remind people who haven't joined" (one click, Resend, Reply-To set to the organiser). The current share kit asks them to paste into another tool, and that's where attendees drop off.
- **F-3 Sponsor branding (M).** A "Presented by" strip with 1 to 4 sponsor logos on the join screen, gallery header, poster and emails. It gives the organiser something to sell and gives us an upsell lever on paid sizes.
- **F-4 Duplicate an event / brand kit (S-M).** "Create from a previous event" copies the logo, colour, access mode, album names and photographer names. Agencies running a series are the best customers and currently start from scratch each time.
- **F-5 Photographer link QR and email (S).** See S-11. This is the cheapest day-of time saver on the list.
- **F-6 Live demo gallery on the marketing site (S-M).** A "See it as an attendee" demo event (the `pnpm demo` seed) linked from the hero. Today "How it works" scrolls to three text cards. Letting buyers try it converts better than a phone mock.
