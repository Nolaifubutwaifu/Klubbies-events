# Review council: UX, UI and bugs, 8 Oct 2026

Four reviewers with different lenses and temperaments read the whole codebase independently, then read, verified and challenged each other's reports, and each ranked a top 10 across all findings. This report is the consensus. Static read only: no `node_modules`, no database, nothing run on a device. The full working (brief, round 1 reports, round 2 debates) is in `2026-10-08-council/`.

## How the council worked

| Member | Temperament | Lens |
| --- | --- | --- |
| Maya, Attendee Advocate | Empathetic, plain spoken, impatient for the user | Guest journey from QR to photos on the phone, photographer upload, microcopy, consent. Nielsen 2, 3, 6, 10 |
| Viktor, Skeptical Engineer | Contrarian, rigorous, devil's advocate | Unhandled states, errors, races, performance, security. Nielsen 1, 5, 9 |
| Ines, Accessibility and Visual Craft | Meticulous, standards driven | WCAG 2.2 AA (measured contrast, focus, targets, semantics), consistency, design system. Nielsen 4, 8 |
| Sam, Organiser and Product Strategist | Pragmatic, commercial, impact per effort | Organiser onboarding, admin, billing, marketing funnel, IA. Nielsen 7 |

Why this shape: heuristic evaluation research finds 3 to 5 independent evaluators catch most issues and that a single evaluator is biased; LLM review panels do better with distinct expert personas, an independent first pass before any discussion, and a judge kept separate from the evaluators. So: round 1 independent (58 findings, each with file:line, heuristic, Nielsen severity 0 to 4, effort), round 2 cross examination (every member opened the cited code for what they endorsed or challenged), then the top 10 lists were scored by rank (10 points for 1st down to 1 for 10th) and the moderator spot checked the leading claims in code.

## Consensus: fix these first

| # | Issue | IDs | Sev | Effort | Votes | Score |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Venue Wi-Fi locks guests out of sign-in | M-1, V-1 | 4 | S | 4 of 4, all ranked it 1st | 40 |
| 2 | Upload failures are hidden and can't be recovered (photographer and organiser) | M-8, M-9, V-3, V-4, V-7, I-7 | 3 | S to M | 4 of 4 | 28 (+13 for V-3 alone) |
| 3 | Zips quietly stop at 150 files, including the pre-deletion email | V-2, M-4, V-11 | 3 to 4 | S | 4 of 4 | 30 |
| 4 | Getting photos onto the phone (Save to Photos) | M-2, M-3, V-9 | 3 | M | 4 of 4 | 27 + M-2 |
| 5 | Scheduled albums go live 10 hours late | V-6, S-2 | 3 | S | 4 of 4 | 22 |
| 6 | Shared Dialog steals focus on every keystroke | I-1 (+ I-3) | 3 | S | 3 of 4 | 14 |
| 7 | Photo opened from Your photos drops you into the full album | M-5 (+ I-6) | 3 | M | 3 of 4 | 9 |
| 8 | "Send a new code" doesn't send one; code boxes lose focus after a wrong code | M-6, I-8 | 3 | S | 2 of 4 | 6 |
| 9 | Returning organisers land in the attendee gallery; deep links lost at sign-in | S-1, V-12, V-14 | 2 | S | 2 of 4 | 6 |
| 10 | Photo viewer keyboard and focus accessibility | I-2, I-3, I-4, I-5 | 3 | S to M | 1 of 4, endorsed by all | 5 |

Next in line, all effort S and endorsed in code by at least two members: **S-5** (billing still sells upgrades after photos are deleted), **V-5** (Undo vanishes in albums under 60 items), **S-4** (poster prints the 96px logo badge), **V-7/V-8** (false "still uploading" states), **S-6** (inflated overview numbers).

### 1. Venue Wi-Fi locks guests out of sign-in (sev 4)

`lib/auth/rate-limit.ts:7-8` limits code requests to 20 per hour and verifications to 60 per hour **per IP**. A conference shares one public IP, so from roughly the 21st guest in an hour codes stop arriving while the screen still says "A code is on its way", and after 60 verifications correct codes are rejected as "didn't match". Refused attempts are still recorded (`hitRateLimit` inserts before returning), so the bucket never drains while people keep retrying. Confirmed by the moderator.

**Fix:** make the existing per email limits (5 per hour, 5 verify attempts per pending code) the real defence. Raise per IP ceilings to a flood guard (hundreds per hour) or key them on IP plus event for `flow: "join"`. Don't record a hit that was refused. Show an honest message when limited ("Too many sign-ins from this network. Wait a minute and try again"). Add a test simulating 200 joins from one IP.

### 2. Upload failures are hidden and unrecoverable (sev 3)

*Photographer page, `app/g/[token]`:* no `beforeunload` guard, only the last 30 rows render so failures scroll away, no auto retry or "Retry all", and Retry reuses an expired upload ticket, so after a long stall it says "The link stopped working. Ask the organiser for a new one" when the link is fine (M-8, M-9, V-4). Failures are drawn in the event's own colour, so a green event shows a green "Failed" (I-15).
*Organiser uploader:* shows "FAILED" without the error text it already holds, including the plan limit message, so the first paywall looks like a broken upload (V-3, upgraded to 3 by Sam). Live uploads are listed as "didn't finish" and "Remove it" can kill them (V-7).

**Fix:** pin failed rows above the window, add "Retry all failed", auto retry network errors with backoff, drop the ticket on any storage 4xx and fetch a new one, blame the link only when the ticket route itself returns 403, add the `beforeunload` guard, and render `job.error` as `GuestUploader` already does. Build it to Ines's conditions: one shared status stack that clears the tab bar, retry buttons named after their file, failures in a new `--kb-danger` token, polite live region announcing state changes only, progress bars with `role="progressbar"`.

### 3. Zips quietly stop at 150 files (sev 3, 4 for the deletion email)

The pre-deletion email links each album to `/api/albums/<id>/zip` with no `part` (`lib/events/retention.ts:37`, confirmed), so the organiser's last chance to keep their photos downloads the first 150 per album, and a signed out click returns raw JSON "Not found". "Download all" on Your photos also stops at 150 and part 2 is reachable nowhere (M-4). Zips skip failed files silently (V-11). Maya argued the email case is rarer than the sign-in bug and should be 3; the others kept it high because the loss is permanent.

**Fix:** email links to a signed in export page listing every part of every album (with a sign-in redirect back to it), with counts per album. Reuse AlbumActions' parts list on Your photos and the home card. Add `missing.txt` to zips that skipped files. Redirect browser navigations to a small HTML error page instead of JSON.

### 4. Getting photos onto the phone (sev 3, needs one iPhone test)

"Download" saves to Files, not Photos; only the album header has "Save to Photos" (M-2). That button calls the share sheet in a loop, which iOS Safari will likely block after the first batch because each share needs a fresh tap; it also stops at a hidden 240 item cap and shares 2000px WebP previews and video poster frames rather than originals (M-3, V-9). Viktor flagged the Safari behaviour as unverified; everyone agreed the cap and the preview files are real.

**Fix:** one tap per batch ("Save 1 to 8", then "Save next 8 (9 to 16 of 120)") on the same button element so focus stays put, prefetching before the tap; share originals or full size JPEG and the real video file; default to the guest's own matches ("Save your 14 photos"); extract a shared `SaveToPhone` control for the viewer, Your photos, the home card and Saved. Viktor's downgrade of M-2 to sev 2 (Files is normal web behaviour) was outvoted on impact: saving to the phone is the attendee's main job.

### 5. Scheduled albums go live 10 hours late (sev 3)

`admin/actions.ts:405-409` (and the edit path near 811) does `new Date(publishAt)` on a `datetime-local` string on a UTC server, so "9:00" Brisbane publishes at 19:00 and shows as 19:00 when reopened. Confirmed by the moderator.

**Fix:** convert on the client with `new Date(value).toISOString()` before submitting, or attach the event's offset on the server the way `endOfDayBrisbane` does. Reject past times with an error rather than ignoring them, and show date and time in "Goes live".

### 6. Shared Dialog steals focus (sev 3)

`components/Dialog.tsx:20-30` runs its focus effect on `[open, onClose]`, and every caller passes a new `onClose` each render, so focus jumps to the close button after every keystroke. In "Paste a guest list" (`RosterImport.tsx`) you can type one character. Maya noted this hits mouse and touch users too, not only keyboard users. Confirmed by the moderator.

**Fix:** keep `onClose` in a ref and depend on `[open]` only; focus the first field in the body rather than the ✕; add a Tab wrap or `inert` on the app root; `aria-labelledby` the heading. Then rebuild the viewer's "More" and "Request removal" sheets on it (I-3) and use `btn-danger` for the album delete confirm.

### 7. Viewer opened from Your photos (sev 3)

Opening one of your matches drops you into the whole album: swiping shows strangers, and Close returns to an album you never visited (M-5). **Fix:** carry `?from=me` or `?from=saved`; in that mode the sequence and filmstrip are your photos, the counter reads "3 of 14 photos of you", and Close goes back.

### 8. Code screen recovery (sev 3)

"Send a new code" links back to a blank form to retype name and email (M-6). After a wrong code the boxes are still disabled when refocus runs, so iOS closes the keyboard (I-8). **Fix:** make it a button that resends to the stored email with "Sent again" and a 30 second cooldown; use `readOnly` plus `aria-busy` instead of `disabled`, or refocus in an effect after `pending` clears.

### 9. Organiser landing and lost deep links (sev 2)

"Your events" sends organisers with several events into the attendee gallery with no sign a setup was left unfinished (S-1; Viktor downgraded to 2 since single event organisers already land in admin). Email links lose the album at sign-in (V-12), and a refused join lands on an empty "Your events" (V-14). **Fix:** admin cards go to `/admin/<handle>` with a "Setup not finished" chip from `setupState()` and a secondary Gallery link; carry a same origin `next` through sign-in; send refused joins to `/e/<handle>` so the layout explains why.

### 10. Viewer accessibility (sev 3)

The header, credit line and footer stay focusable under the full screen viewer (WCAG 2.2 2.4.11, I-2). The blue focus ring is 2.65:1 on the viewer's near black and 2.49:1 on ink surfaces, under the 3:1 minimum (I-4). Inline `outline: none` hides focus on the colour swatches, which are announced as hex codes (I-5). **Fix:** `inert` the chrome while the viewer is mounted, a two tone focus ring (`outline` brand colour plus a white `box-shadow`), and swatches as a named radiogroup.

## Where the council disagreed

| Topic | Positions | Outcome |
| --- | --- | --- |
| V-15, guessable handles reveal event details | Viktor: sev 2 security. Sam and Ines: readable links are a promise and the masterfile requires the event letterhead on the join screen. Maya: hiding the name makes the code email look like phishing | Downgraded to 1. Optional random suffix on new handles; no redaction of the join screen |
| M-7, face notice blocks Find my photos | Maya: sev 3, folded details and no "not now". Viktor and Sam: the order is deliberate consent design | Sev 2. Keep the order, ship Maya's copy fixes (facts visible, plain words, "Not now", how to request removal) |
| M-10, "Save" means three things | Maya: rename the heart to Favourite. Sam: reverses the 27 Sep page walk decision | Rename deferred to the owner. Fix the Saved page copy that promises zip downloads it can't show |
| M-11, no undo on face match answers | Maya: reuse UndoBar. Ines: UndoBar as is fails WCAG 2.2.1 and covers the tab bar | Agreed need, built on the shared status stack, not the current UndoBar |
| S-3, Free plan's 200 photo cap | Sam: ask photo count at signup. Maya: no extra question. Viktor: the cap is already on the card | Sev 2. Warn at 90% and surface the limit message in the uploader (fixed by item 2) |
| Line numbers | Viktor and Maya found several citations pointing past the end of files | Problems stand; line numbers in round 1 reports should be rechecked before fixing |

## Other findings worth doing (sev 2, mostly effort S)

* **Organiser:** logo drop zone navigates away on drop (S-7); activity log shows zips as "Deleted item" (S-8); open removal requests can fall off the Removals page and auto delete unseen (S-9); photographer link dead ends, no QR or email for the one time link (S-11); no "Publish all drafts" (S-12); "Upload" opens "New album" with only 6 albums (S-13); marketing promises organiser branding on every email, emails are Klubbies branded (S-14, change the copy now).
* **Attendee:** name field required on every sign-in and the code email doesn't name the event (M-12); silent failures on bad connections (M-13); closed gallery is a dead end (M-14).
* **Bugs:** re-uploading a photo that is in Recently deleted fails or falsely reports done (V-10); no `loading.tsx` or `error.tsx` on organiser pages (V-13).
* **Accessibility and craft:** status changes not announced (I-7); album tiles hide status from screen readers (I-6); caption grey 4.43:1 on sand, use `#66696f` (I-9); links distinguished by colour only on the landing and in emails (I-10); viewer arrow keys skip photos instead of seeking a focused video, and the "disabled" Download still fires from the keyboard (I-11); swipe hint never clears under reduced motion (I-12); touch targets under the masterfile's own 44px rule (I-13); misapplied ARIA menus and nested buttons (I-14); `--kb-mist` undefined, `global-error.tsx` still on the retired palette (I-15).
* **To verify once dependencies are installed:** `app/error.tsx` uses a `retry` prop rather than `reset` (check against this Next version's docs); react-email's default link colour (I-10).

## Feature ideas (not defects, from Sam)

Event report for clients and sponsors; emailing the guest list from the app; sponsor branding (Maya: never on the join screen); duplicate an event; photographer link QR and email; a live demo gallery on the marketing site.
