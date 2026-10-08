# Round 2: Ines (Accessibility and Visual Craft)

I read all three reports in full and opened every file:line I challenge or endorse. My position is that most of the fixes proposed in round 1 add new UI: toasts, retry lists, countdowns, bulk buttons, sheets and skeletons. Built the way the current undo bar, upload tray and dialog are built, each one would bring back the problems I listed in round 1. So under "Conditions on the proposed fixes" I set the standard they must meet before any of them ships.

---

## Challenges

### C-1 M-11: half of it is wrong, and its fix ("reuse UndoBar") would add two WCAG failures. **Refine; keep at 2.**
- **The toast does not follow you.** Maya says the viewer's `message` "stays on screen as you swipe through other photos" (`Viewer.tsx:133, 309-316`). It doesn't. The viewer lives in the `[mediaId]` dynamic segment (its own `layout.tsx` and `page.tsx`), and a change of param remounts that subtree. Viktor checked the same thing independently ("Viewer state … doesn't leak between photos"). What *is* true is that it never times out on the photo where it appeared. It sits at `bottom-[104px]`, and the bottom bar is 24 + 12 + 52 = 88px tall, so the toast covers the filmstrip, including the current-thumbnail ring. That is a small issue, not "follows you around".
- **UndoBar as it stands must not be reused.** Look at `components/UndoBar.tsx:32-36, 47-52`:
  - It disappears after a fixed 10 seconds, and the timer does not pause while the Undo button is hovered or focused. A screen-reader user hears "Deleted…" (polite) and must then reach a bar at the end of the DOM within 10 seconds. That fails 2.2.1 Timing Adjustable unless there is another route to undo. For deletes there is one (Recently deleted). For face decisions there is **none**.
  - It is `fixed bottom-4 z-50`. On `/me` the tab bar is `fixed bottom-0 z-30` (`MemberTabBar.tsx:73`), about 68px tall, so the bar would sit on top of the tab bar. That obscures it and fails 2.4.11 whenever focus is on a tab.
- **The real accessibility problem in M-11 is one Maya didn't name.** The suggestion cards' buttons are all called "Yes" and "Not me" (`Suggestions.tsx:68-92`): a list of identical, context-free names (2.4.6). After a decision the card unmounts and focus drops to `<body>` (2.4.3). The two buttons are 6px apart (`gap-1.5`), which supports her spacing point.
- **Fix as I'd accept it:**
  - Name the buttons "Yes, this is me in {album} photo" and "Not me" with `aria-describedby` pointing at the album caption.
  - After a decision, move focus to the next card's "Yes", or to the section heading when none are left.
  - Undo goes through the shared status stack (S-A below): pause on hover and focus, at least 20 seconds for an irreversible decision, and placed above the tab bar.
  - The viewer toast clears after 4 seconds and sits above the filmstrip.

### C-2 V-15: **DOWNGRADE to 1.** The disclosure is the designed join screen; keep the suffix, drop the redaction.
`docs/masterfile.md` §6 specifies `/signin?event=<handle>`: "event logo, serif event name, date and venue, host line". That holds in both access modes ("Guest-list mode says 'Use the email you registered with'"). Maya's "keep these" list singles out that letterhead (`AuthShell.tsx:86-96`) as what makes a stranger trust the join screen. Viktor's second fix ("in guest-list mode, show only the name") would remove the event's identity from the very screen where a legitimate guest decides whether this is real or phishing. A random handle suffix is cheap and removes the guessing, so ship that alone. Severity 1, because what leaks (a venue and a date) is printed on the poster on the wall anyway.

### C-3 V-8: **UPGRADE the fix, keep the severity at 2.** It is also a written design rule, and the tiles are spinners.
`components/ProcessingBanner.tsx:37-62` draws up to 12 tiles, each with a `motion-safe:animate-spin` arc and a bold "Processing" label. The masterfile's minimums say "skeletons not spinners" (§5), and `globals.css:914` repeats it. For 14 days (V-8's point), every attendee sees a dozen spinning tiles at the top of the grid. That is the most visually noisy thing in the attendee product (Nielsen #8). The tiles are also announced as twelve separate "Processing" texts. Viktor's fix (age cutoff, "still uploading" copy) is right. Add: **one** quiet tile-shaped skeleton with "N still uploading" text, no spinner, the `.soft-skeleton` shimmer (which already respects reduced motion), and `aria-hidden` on the placeholder tiles. The count lives in the banner's text only, once.

### C-4 S-7: **Keep at 2, but the fix is incomplete.** The logo drop zone also has an accessibility defect.
I confirmed there are no `onDragOver` or `onDrop` handlers (`settings/LogoUploader.tsx:38-53`). The same element is also a `role="button"` div that *contains* `<img alt="Event logo">` and the error `<span className="notice">` (:47, :51). A button's children are presentational, so its accessible name becomes "Event logo Replace logo PNG or SVG, at least 400px Upload failed. Try again." The upload error is never announced as an error, and Space on the div scrolls the page (no `preventDefault`). This is the same pattern as my I-14 (RosterImport). Sam's two-line drop handler would leave it in place.
**Fix:** One `<FileDrop>` component for all five drop zones (`GuestUploader`, `Uploader`, `RosterImport`, `LogoUploader`, `AlbumEditPanel`). It should be a real `<button>` (or a `<label>` for the file input), have drop handlers, and keep any image and error *outside* the button, with the error in `role="alert"`. On touch devices it should say "Tap to choose" (Maya's M-8 point).

### C-5 M-10: **UPGRADE to 3 is not justified, but I side with Maya against the 27 Sep page walk**, with a condition.
The page walk changed "Favourite" to "Save" to match the "Saved" tab. That fixed one inconsistency and created a worse one: "Save" sits beside "Save to Photos" (`AlbumActions.tsx:467`), and the heart *is* "Favourite" in iOS and Android Photos (Nielsen #4, platform conventions). Keep severity 2 and ship the rename, but don't repeat the current toggle pattern. The viewer button flips its visible text between "Save" and "Saved" and has no `aria-pressed` (`Viewer.tsx:284-295`). For a toggle, the accessible name must stay constant and the state must be exposed: label "Favourite", `aria-pressed={saved}`, filled heart when on, and a `role="status"` line saying "Added to Favourites" or "Removed from Favourites".

### C-6 S-10: **DOWNGRADE to 1.**
Confirmed: `start/page.tsx:60` says "Step 1 of 2" and `CreateEventForm.tsx:56` says "Step 1 of 3". It is a mismatch in a progress chip, and the organiser moves through it in seconds. Fix it (it costs S), but it doesn't belong next to S-2 or S-5 in the triage list.

---

## Endorsements (verified in code)

- **M-1 / V-1 (sev 4).** Confirmed: `rate-limit.ts:7-8` is 20 and 60 per hour per IP, and :29 inserts even when the request is refused. A correct code answered with "That code didn't match" also breaks 3.3.1 (Error Identification): the error describes the wrong problem. When this is fixed, the new "Too many sign-ins from this network" message must go through the existing `role="alert"` paragraph (`CodeForm.tsx:300-304`). It should not clear the boxes, and focus must land on a working control (see my I-8).
- **V-5 (sev 3).** Confirmed: `a/[albumId]/page.tsx:301` uses `key={\`${items.length}-…\`}`. The delete refreshes the page, the count changes, `AlbumGrid` remounts and the `UndoBar` unmounts. This is also why the selection-bar message (my I-7) can never be heard after a delete.
- **S-1 (sev 3).** Confirmed: `events/page.tsx:68` sends every card to `/e/…`. Refinement: the card's `aria-label` (:70) replaces all the card content, so the new "Setup not finished" chip Sam proposes would be invisible to screen readers unless the label includes it. Build the label from the same data, or drop `aria-label` and let the content name the link.
- **V-3 + M-8 / V-4 (sev 3).** I confirm the guest uploader renders `job.error` in the accent colour (`GuestUploader.tsx:113,120`, my I-15) and that neither uploader exposes progress to assistive tech (my I-7). See S-B below for how "Retry all" and the pinned failed rows must be built.
- **M-5 (sev 3).** Refinement from my lens: in "from=me" mode, the viewer's `alt` (`Viewer.tsx:226`), the filmstrip labels (:270) and the grid labels (`AlbumGrid.tsx:145-149`) all say "Photo N of total in {album}" and must change too ("Photo 3 of 14 photos of you"). Otherwise the screen reader contradicts the screen.
- **M-7 (sev 3).** Strong agreement. One correction to the fix: don't keep a disabled "Find my photos" with a hint (`Enrol.tsx:99`). Disabled buttons can't be focused in most browsers, so the hint goes unread. Keep the button enabled. On submit, show errors next to the selfie step and the checkbox (`aria-invalid`, `aria-describedby`, focus the first one). That is 3.3.1 / 3.3.2 done properly.
- **M-13 (sev 2).** Same root cause as my I-7. One `InlineStatus` pattern, specified in S-C.
- **V-13 (sev 2).** Add skeletons, but the existing one is mis-marked: `a/[albumId]/loading.tsx` puts `aria-label="Loading this album"` on a role-less `<div>`, where it is not exposed. New loading files should use a visually hidden `<p role="status">Loading…</p>` plus `aria-hidden` skeleton blocks.
- **S-14 (sev 2).** Agreed, with conditions for the "event logo in email" step:
  - `alt` = the event name, so image-blocking clients (the Outlook default) still show it.
  - Any event colour in an email must come from `readableAccent()`, never the raw hex, because emails can't take the theme's contrast fix.
  - The text "Photos by Klubbies Events" stays as a real underlined link (my I-10).
- **S-11 (sev 2).** QR plus email for the photographer link, yes. The QR is an image of a URL, so it needs `role="img" aria-label="QR code for the photographer upload link"`, with the URL still shown as selectable text and a Copy button that confirms through `role="status"`.

## Duplicates / merges

| Merge | Proposed title |
| --- | --- |
| M-1 + V-1 | Shared-IP limits lock a venue out of sign-in and reject correct codes |
| M-3 + V-9 (+ the "Save to Photos" half of M-2) | "Save to Photos" stops after one batch, saves previews and video stills, and caps at 240 |
| M-4 + V-2 + V-11 + my I-11b | Zip downloads are silently capped at 150, parts are unreachable, and failures return raw JSON |
| M-8 + M-9 + V-4 + V-3 + my I-7 (upload half) + I-15 (accent-coloured "Failed") | Upload failures are hidden, unrecoverable, unannounced and the wrong colour |
| V-6 + S-2 | Scheduled publish times are read as UTC: albums go live 10 hours late |
| M-11 + M-13 + my I-7 (save, cover) | Actions fail or finish silently, and decisions can't be taken back |
| S-14 + my I-10 (email links) | Emails: Klubbies-branded against the promise, with links that don't read as links |
| C-4 (S-7) + my I-14 (RosterImport dropzone) | Drop zones: missing handlers and nested-interactive buttons; build one `FileDrop` |
| V-5 + M-11 (undo) | Undo is unreliable: unmounted by a refresh key, too short, and overlapping the tab bar |

## Revisions to my own findings

- **I-12: split it.** The swipe hint stuck on every photo under Reduce Motion stays at **2**. The `kb-splash` blank-landing risk is a race I reasoned about but did not trace through WKWebView's navigation order the way Viktor would demand. **Downgrade that half to 1** and call it a hardening note.
- **I-11(b):** Viktor's V-9 shows the zip route also slices `only` to 150. So my fix ("return 400 on an empty `only`") must come with the selection cap he proposes. Otherwise the button can be enabled and still quietly drop items. I'm folding the selection-bar Download into the zip merge above.
- **I-6:** extended by M-5. The position wording in tile and viewer labels must follow the browsing context, not always the album.
- **I-15:** `global-error.tsx` matters more than I rated it. Viktor's V-13 notes the root error page already loses the organiser's place. Together, a crash shows an off-brand salmon page, which Sam would rightly call a trust problem. I keep severity 2 but pair it with V-13's segment `error.tsx`.
- **I-1:** unchanged at 3. Re-tracing it after reading V-5: any Dialog parent that refreshes or re-renders mid-flow (AlbumGrid's `pending` during "Deleting…") also throws focus to ✕. So the bug shows up in every destructive confirm, not only the paste dialog.
- Nothing withdrawn.

## Conditions on the proposed fixes

The council is proposing about a dozen new transient surfaces. Today we have three bottom-fixed layers that already collide on a phone: `UndoBar` (z-50, bottom 16px), `UploadTray` (z-40, bottom-right), the selection bar (sticky, bottom 84px) and the tab bar (z-30). None of them reserve space for the others, and none set `scroll-padding-bottom`, so focus can scroll *under* them (2.4.11). These rules are my price for endorsing M-6, M-8, M-11, M-13, V-3, V-4 and S-12:

- **S-A One status stack, not more toasts.**
  - One `<StatusStack>` mounted in `app/(app)/layout.tsx`.
  - Bottom-anchored, offset by the tab bar's height when the tab bar is present.
  - At most two items visible.
  - `role="status"` (polite) for info and `role="alert"` only for failures.
  - Messages with an action (Undo, Retry, Review): no auto-dismiss under 20 seconds, the timer pauses on hover and focus, and a visible close (×) labelled "Dismiss".
  - `html { scroll-padding-bottom: var(--kb-bottom-chrome) }` so focused elements never scroll under it.
  - White-on-ink, with the on-dark focus ring from my I-4.
  - `UndoBar`, the viewer toast, `UploadTray`'s "12 failed · Review" (V-3) and the M-6 "Sent again" all go through it.
- **S-B Retry UI (M-8, V-3, V-4).**
  - "Retry 60 failed" is a real `<button>` whose name includes the count.
  - Each row's Retry is named "Retry {filename}", not 60 identical "Retry" buttons (2.4.6).
  - Failed rows are pinned in a list with its own heading ("Failed (60)").
  - The overall bar is `role="progressbar"` with `aria-valuenow`.
  - Announce state changes only (started, all done, N failed), never every percent.
  - Failure text uses the new `--kb-danger` token, not the event accent.
  - "Show failed only" is a toggle with `aria-pressed`, styled like the album's filter chips once those are standardised (my I-15).
- **S-C Inline errors (M-13, M-7).** One `InlineStatus` component: a message next to the control, linked by `aria-describedby`, `role="alert"` for failures, and focus left on the control that failed. Never re-enable a button silently with no message.
- **S-D Countdowns (M-6 "Send again in 0:24").**
  - The visible countdown text is **not** in a live region, because a screen reader would read it every second.
  - The button stays focusable (`aria-disabled="true"` plus a click guard, not `disabled`, so focus isn't thrown away). This is the same failure as my I-8.
  - One polite announcement when it becomes available ("You can send a new code now").
- **S-E Bulk actions (S-12 "Publish all drafts", V-9 selection caps).**
  - Bulk publish sends emails and can't be undone, so it goes through the (fixed) `Dialog` with a list of the albums and the count of attendees to be emailed.
  - The confirm button names the action ("Publish 5 albums").
  - Use the brand primary there, not danger: it's not destructive.
  - Selection caps are stated before the limit is hit ("Up to 150 at a time", shown in the selection bar) and enforced by `aria-disabled` plus an explanation, not by silently stopping.
- **S-F Sequential share button (M-3, V-9 "Save next 8").**
  - Keep the *same* button element across batches (no key change, no unmount), so keyboard and VoiceOver focus stays on it.
  - Update its label ("Save next 8, 9 to 16 of 120").
  - Report each batch's result through S-A.
- **S-G New sheets and cards (M-7 single card, M-5 context, S-1 chips).**
  - No new bottom sheet ships until I-3's sheet variant of `Dialog` exists.
  - No new chip uses colour alone: "Setup not finished" is text plus the warn token (5.6:1), never a dot.

## My top 10 (across all members)

1. **M-1 / V-1**: an attendee at the venue can't get in at all, and is told their correct code is wrong. That is the product's main moment, broken on the day.
2. **V-2**: the deletion email implies 150 files is the whole album, then the rest is deleted for good. Irreversible data loss.
3. **M-3 / V-9 (+ M-2)**: "Save to Photos" is the main attendee payoff on a phone, and it stops after one batch with downsized copies.
4. **I-1**: the shared Dialog takes focus away on every re-render. Typing a guest list is impossible, and every destructive confirm is affected. One-line root fix.
5. **V-6 / S-2**: albums go live 10 hours late by default. The organiser's promise to attendees breaks silently.
6. **M-8 / M-9 / V-3 / V-4**: upload failures are hidden, wrongly blamed on the link, and can't be retried in bulk. Lost photos from paid photographers.
7. **I-2 + I-3**: in the viewer, focus goes behind the lightbox and the removal sheet drops focus. The privacy flow is unusable without a mouse. WCAG 2.2 AA failure.
8. **M-5**: from "Your photos", the viewer shows strangers and Close goes to the wrong place. It breaks the headline feature's flow.
9. **S-1**: every returning organiser lands in the attendee gallery, and abandoned setups are never recovered. Hits the paying user on every visit.
10. **I-4 + I-5**: the focus ring is invisible on dark surfaces and removed on swatches. A cheap token-level fix that makes the whole viewer and the brand settings keyboard-usable.

Just outside: V-5 (undo vanishes), M-7 (face consent as a hurdle), S-5 (selling upgrades that unlock nothing), I-9 (caption contrast on sand).
