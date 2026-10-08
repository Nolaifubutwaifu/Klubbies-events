# Round 1: Viktor (Skeptical Engineer)

**Verdict.** Most of what will hurt this product is unhandled state, not visual polish. Two findings can do real harm on the day: the auth rate limits lock out a whole venue's wifi, and the "download before deletion" email hands over 150 files and implies that is the album.
The upload stack is well built underneath (dedupe, resumable TUS, plan limits in the database), but its error reporting is poor. The organiser uploader never shows the error text it already has. The photographer page has no unload guard and misreads expired tokens. Undo, scheduling and bulk save each fail silently in a common case.
Every finding below follows a real caller through to the failure. I left out anything I could not trace, and the "Checked, not a bug" section lists those.

---

### V-1 Venue wifi locks attendees out of sign-in (shared-IP rate limits)
- **Where:** `lib/auth/rate-limit.ts:7-8`, `lib/auth/request.ts:48`, `lib/auth/flow.ts:130-134`, `app/api/auth/verify_code/route.ts:55-57`. Attendee, QR join → email code → code screen, on venue wifi or a carrier's CGNAT.
- **Heuristic / severity / effort:** #9 + #5, bug. **4**. S.
- **Problem:** Code requests are capped at 20 an hour **per IP**, and code checks at 60 an hour per IP. At a conference, hundreds of phones share one public IP. Attendee 21 in that hour gets the neutral "we've sent a code" message (`request_code` answers before the limit is checked, inside `after()`), but no email ever comes. "Send a new code" fails the same way. When the venue passes 60 code checks, every attendee gets `CODE_REJECTED` ("That code didn't match") **for a correct code**. They will blame themselves and retype. `hitRateLimit` also inserts a row on every hit, including rejected ones (`rate-limit.ts:29`), so each retry keeps the window full. This breaks the product's main moment, scanning the poster at the event.
- **Fix:** Make the per-email limit the main defence. Raise the per-IP ceilings by one to two orders of magnitude, or key them on IP+event, or IP+UA. Don't record a hit once the caller is already over the limit. On verify, return a distinct message such as "Too many attempts from this network. Wait a few minutes." That reveals nothing about any roster. Add a test that simulates 200 joins from one IP.

### V-2 "Download before deletion" email gives the organiser 150 files per album, or a JSON 404
- **Where:** `lib/events/retention.ts:36-37` (url = `/api/albums/<id>/zip`, no `part`), `app/api/albums/[id]/zip/route.ts:111,137`, `lib/media/zip.ts:156` (PART_SIZE 150), `proxy.ts:70` (`/api` not protected). Organiser, 30/7-day deletion warning email.
- **Heuristic / severity / effort:** #9 + #5, bug / data loss. **4**. S.
- **Problem:** The email says "Download anything you want to keep… After that nothing can be recovered" and links each album to its zip. The link has no `part`, so the route serves part 0, the first 150 files by `sort_at`. An organiser with a 600-photo album gets one zip and assumes they have everything. Then the 12-month job deletes the rest for good. If they open the email signed out (phone, expired session), the route's RLS read returns nothing and they see raw `{"error":"Not found"}`.
- **Fix:** Point the email at a signed-in page (for example `/admin/<handle>/albums?export=1`) that lists every part of every album, with a sign-in redirect that comes back to it. Or list every part link in the email (`?part=0..n`) with counts ("part 1 of 4, photos 1 to 150"). Either way, the email must say how many files each album has.

### V-3 Organiser uploader throws away the error text: "FAILED" with no reason, and failures vanish
- **Where:** `app/(app)/admin/[handle]/albums/[albumId]/Uploader.tsx:228-246` (renders status only, never `job.error`), `lib/media/upload-queue.ts:398-399,443` (error is set), `Uploader.tsx:216` (`slice(-40)`), `app/(app)/UploadTray.tsx:87`. Organiser or co-organiser, album upload.
- **Heuristic / severity / effort:** #9, #1. **3**. S.
- **Problem:** `UploadQueue` builds good messages. The server even writes one about the plan limit: "This event has reached its limit of 200 photos. Delete some, or change the event's plan" (`upload_ticket/route.ts:89-93`). There are also "Your session expired. Refresh the page and retry." and "Connection lost…". The organiser view never renders any of them. They see a column of red "FAILED" and a Retry button that fails again. Only the last 40 rows are shown, so an early failure in a 300-file drop has no visible Retry. The tray that "follows you around the app" returns `null` once nothing is busy. An organiser who has moved to another page never learns that 12 files failed.
- **Fix:** Render `job.error` under the row, as `GuestUploader.tsx:353-359` already does. Pin failed rows above the `slice` window and add "Retry all failed". When something has failed, keep the tray on screen with "12 failed · Review", linking back to the album with `?add=1`. Don't hide it just because `busy === 0`.

### V-4 Photographer upload page: no unload guard, hidden failures, and stale tokens blamed on the link
- **Where:** `app/g/[token]/GuestUploader.tsx` (no `beforeunload`; the only one in the repo is `UploadTray.tsx:19`), `GuestUploader.tsx:332` (`jobs.slice(-30)`), `lib/media/guest-queue.ts:177-178,199-214` (Retry reuses `job.ticket.signed`), `guest-queue.ts:57`, `guest-queue.ts:146-163`. Photographer (signed out), `/g/[token]`.
- **Heuristic / severity / effort:** #5, #9, #1. **3**. M.
- **Problem:**
  1. The page says "Keep this tab open until the list says done", but nothing stops a photographer closing the laptop lid or the tab mid-batch. The organiser's uploader has this guard. The page for people who have no account and can't see the gallery afterwards does not.
  2. Only the last 30 rows render, so with 400 files a failure early on has no reachable Retry. The summary only says "· 3 failed".
  3. Retry skips the ticket step whenever `job.ticket` exists, and PUTs with the original signed upload tokens. Supabase signed upload URLs last 2 hours. A photographer who retries after lunch gets a 400/403 "…expired…" response, and `friendlyError` turns that into **"The link stopped working. Ask the organiser for a new one."** The link is fine. Only the per-file token expired.
  4. Originals go up as one XHR PUT, not resumable. A 500 MB video that drops at 90% starts again from 0.
- **Fix:** Add the same `beforeunload` guard while `busy`. Always render failed rows and add "Retry all". On Retry, drop `job.ticket` when the original isn't done, or on any 4xx from storage, so a fresh ticket is fetched. Only show "the link stopped working" when the **ticket route** answers 403. For videos over ~50 MB, use TUS with a signed-upload token, or split the upload into chunks.

### V-5 Undo after deleting photos disappears instantly in any album under 60 items
- **Where:** `app/(app)/e/[handle]/a/[albumId]/page.tsx:301` (`key={`${items.length}-…`}`), `components/AlbumGrid.tsx` delete handler (`setUndo(...)` then `router.refresh()`), `app/(app)/admin/actions.ts:547-549` (revalidatePath), `lib/media/queries.ts:8` (MEDIA_PAGE_SIZE 60). Organiser, album → Select → Delete.
- **Heuristic / severity / effort:** #3/#9 (recovery), bug. **3**. S.
- **Problem:** `undo` is local state inside `AlbumGrid`. The delete refreshes the page, both through the action's `revalidatePath` and the explicit `router.refresh()`. That gives the server page a shorter first page of items, so `items.length` changes, so the `key` changes. React then unmounts `AlbumGrid` and the `UndoBar` with it. Decision 25 promises "Undo for 10 seconds". In practice the bar flashes or never appears for every album under 60 items, and on the last page of larger ones. Loaded "Load more" pages are lost the same way after any refresh that changes the count.
- **Fix:** Key `AlbumGrid` on `album.id` (plus cover if that is really needed). Sync `initialItems` into state with an effect, or move undo state up into a context above the page, as `DeletedUndo` does through the URL.

### V-6 Scheduled publish times are read as UTC: "9:00" goes live at 19:00 Brisbane and shows as 19:00 when reopened
- **Where:** `app/(app)/admin/actions.ts:405-409` (createAlbumAction), `actions.ts:812-815` (scheduleAlbumAction), `upload/NewAlbumPanel.tsx:84-89,145-156`, `albums/AlbumManager.tsx:18-23` (toLocalInput). Organiser, New album / Schedule.
- **Heuristic / severity / effort:** bug, #1. **3**. S.
- **Problem:** `<input type="datetime-local">` sends a time with no zone, for example `2026-10-09T09:00`. The server action runs `new Date(publishAt)`, which on Vercel (UTC) means 09:00Z, which is 19:00 in Brisbane. The default is "tomorrow at 9am", so the common case is wrong by 10 hours. The "attendees who asked are emailed" email then goes out in the evening. Reopening Schedule shows the stored time in browser-local time (19:00), so the organiser sees a time they never chose. The code already knows the server is UTC: `endOfDayBrisbane` uses `+10:00` (`actions.ts:181-182`). Also, `createAlbumAction` silently drops a time that is already past (`:407-408`) after a button that said "Schedule and start uploading". The album stays a plain draft with no message.
- **Fix:** Turn the time into an ISO string with an offset on the client (`new Date(value).toISOString()`) before sending. Or append `+10:00` on the server, the same way as `endOfDayBrisbane`. Return an error for a past time instead of ignoring it.

### V-7 In-flight uploads are labelled "didn't finish", and "Remove it" kills a live upload
- **Where:** `app/(app)/e/[handle]/a/[albumId]/page.tsx:57-64` (every `status != ready` row, no age cutoff) vs `app/(app)/admin/[handle]/page.tsx:26-28` (overview uses `STUCK_AFTER_MS`), `components/UnfinishedUploads.tsx:104-116`, `app/api/media/[id]/finalize/route.ts:132-133`. Organiser browsing while the upload tray runs.
- **Heuristic / severity / effort:** #1, #5, bug. **3**. S.
- **Problem:** The tray tells organisers to keep browsing. When they come back to the album, or anything refreshes it (Publish, an action's revalidate), every file still uploading is listed under "N files didn't finish uploading. Upload them again, or remove them". "Remove it" moves a row that is being written right now into the bin. When that upload finishes, `finalize` reads through RLS, which hides binned rows (decision 22). It returns 404, and the job fails with "Not found", which V-3 then hides anyway. "Remove it" also ignores errors and gives no feedback.
- **Fix:** Use the overview's rule here (`created_at < now - STUCK_AFTER_MS`, or `status = 'failed'`). Leave out rows whose `mediaId` is in this browser's `UploadQueue`. Make "Remove it" show its result.

### V-8 Attendees see "still cooking, usually 2–5 minutes" for up to 14 days
- **Where:** `app/(app)/e/[handle]/a/[albumId]/page.tsx:95-106` (counts every `status = processing` row, no age limit), `components/ProcessingBanner.tsx:153-154`, `components/AlbumGrid.tsx:283` (up to 12 spinner tiles), `lib/media/constants.ts:37-39`, `lib/media/upload-queue.ts:379-381`. Attendee, album page on a phone.
- **Heuristic / severity / effort:** #1 (false status). **2**. S.
- **Problem:** No processing happens on the server. Previews are made in the uploader's browser before the row is finished. "Processing" really means "someone's browser is still uploading". If that person closed the tab, the row stays `processing` until the 14-day sweep. All that time every attendee gets a spinning banner and spinner tiles at the top of the grid, plus a promise ("2–5 minutes") the system can't keep.
- **Fix:** Count only rows newer than `STUCK_AFTER_MS` (an hour). Change the copy to "N more photos are still uploading". Drop the time estimate.

### V-9 Bulk save and download stop at a hidden cap, and "Save to Photos" saves previews and video stills
- **Where:** `app/(app)/e/[handle]/a/[albumId]/page.tsx:66-72` (`readyIds … .limit(240)` → `AlbumActions mediaIds`), `components/AlbumActions.tsx:75-118`, `app/api/media/sign/route.ts:30` (display variant = `display_path`, or `poster_path` for video), `app/api/albums/[id]/zip/route.ts:114-118` (`only` sliced to 150), `app/(app)/e/[handle]/actions.ts:78` (favourites sliced to 200) vs the `AlbumGrid` select bar marking every selected item as saved. Attendee, mostly on iPhone.
- **Heuristic / severity / effort:** #1, #9, bug. **3**. M.
- **Problem:**
  - "Save to Photos" walks `mediaIds`, which is capped at 240, so a 600-photo album saves 240 and says "Done".
  - It asks for the `display` variant: a 2000 px WebP, not the full-quality original the product promises. For a **video** it saves the poster JPEG, a still frame named `klubbies-xxxx.jpg`.
  - It calls `navigator.share` once per batch of 8 inside a loop, after several `await fetch`es. Web Share needs transient user activation, so on iOS Safari it will very likely throw `NotAllowedError` after the first batch, or even on the first if the fetches are slow. The user then sees "Saving stopped. You can also use Download all." (This needs one device test, but the activation rule is well documented.)
  - Selecting 300 photos and choosing Download zips 150. Save marks all 300 as saved in the UI while the server stored 200.
- **Fix:** Fetch the full id list, paged, or let the server stream batches. Use originals, or at least JPEG at full size, and skip videos or route them to download. Batch the share behind a "Save next 8" button tap, so every share has a fresh gesture. Cap selection at the server limits, with a message ("You can select up to 150 at a time").

### V-10 Re-uploading a photo that is in the bin fails with "Could not start the upload", or says "done" when it isn't
- **Where:** `supabase/migrations/20260925000020_media_content_hash.sql:22-24` (unique `(album_id, content_hash)` includes binned rows), `lib/media/dedupe.ts:28-34`, `app/api/media/upload_ticket/route.ts:84-95`, `app/api/guest/[token]/ticket/route.ts:51-53`. Organiser and photographer.
- **Heuristic / severity / effort:** bug, #9. **2**. S.
- **Problem:** An organiser deletes a photo by mistake and drops it in again rather than going to Settings → Recently deleted. `findExistingUpload` uses the user's client, where RLS hides binned rows, so it returns null. The insert hits the unique index (23505), and the "winner" lookup is null for the same reason. The code falls through to a 500 "Could not start the upload", which V-3 then hides. The photographer path uses the service role, sees the binned row, and answers `duplicate`. The photographer sees "Done" for a photo nobody can see.
- **Fix:** In the ticket routes, look up with the admin client and include `deleted_at`. If the match is binned, either restore it (organiser) or say "This photo is in Recently deleted. Restore it from Settings." Or make the unique index partial on `deleted_at is null`.

### V-11 Zips silently skip files and cut off without any warning
- **Where:** `lib/media/zip.ts:187-191` (`continue` on a failed sign or fetch), `zip.ts:202-205` (`archive.abort()` on error), `app/api/albums/[id]/zip/route.ts:111`, `app/api/events/[id]/me/zip/route.ts:241` (`Number("x")` → NaN part). Attendee or organiser, Download all / Your photos.
- **Heuristic / severity / effort:** #9, bug. **2**. M.
- **Problem:** Any original that fails to sign or fetch is left out with no trace. The user gets a smaller zip and no clue. A failure in the middle of the stream aborts the archive and the browser keeps a corrupt zip, which the route comment itself mentions. Nothing in the zip says how many files should be there.
- **Fix:** Add a `README.txt` or `missing.txt` entry listing skipped files, and send the expected count in a header. Read `part` with `z.coerce.number().int().min(0)`. Longer term, build the zip in the background job and email a link when it's ready.

### V-12 Sign-in drops the deep link: email links land on the event home, not the album
- **Where:** `proxy.ts:95-96` (`url.search = ""`, no return path), `proxy.ts:70,97-98` (`/e/` isn't in `PROTECTED`, so the `event` branch never runs), `app/(app)/e/[handle]/layout.tsx:23`, `lib/auth/flow.ts:234-246`, `lib/notify.ts:56`. Attendee from the "album published" email or push; organiser from any admin link.
- **Heuristic / severity / effort:** #7/#1, bug. **2**. S.
- **Problem:** The "Keynote is up" email links to `/e/<handle>/a/<albumId>`. A signed-out attendee (new phone, cleared cookies, in-app browser) is sent to `/signin?event=<handle>`. After the code, `verifyCode` can only redirect to `/e/<handle>`, so the album is lost. Organiser links to `/admin/<handle>/removals` and similar land on `/signin` with no `event` and no return path.
- **Fix:** Carry a `next` parameter, limited to same-origin relative paths, through proxy → signin → code → `verifyCode`. Redirect there once the membership check passes.

### V-13 No loading or error boundaries outside two attendee routes
- **Where:** Only `app/(app)/e/[handle]/loading.tsx` and `…/a/[albumId]/loading.tsx` exist. There is no `loading.tsx` under `admin/[handle]`, `events`, `account`, `e/[handle]/me` or `saved`, and no segment-level `error.tsx`. Organiser nav, attendee "Your photos" tab.
- **Heuristic / severity / effort:** #1. **2**. S.
- **Problem:** Organiser pages run many queries per render, but a nav click shows nothing until the server payload arrives, so people click twice. "Your photos" (face queries) behaves the same from the tab bar. A thrown error on any admin page replaces the whole shell with the root `error.tsx`. That page has no organiser nav and the wrong brand ("klubbies"), so the organiser loses their place.
- **Fix:** Add a skeleton `loading.tsx` at `admin/[handle]`, `e/[handle]/me`, `e/[handle]/saved`, `events` and `account`. The masterfile asks for "skeletons not spinners". Add an `error.tsx` under `admin/[handle]` that renders inside the layout, with "Try again" and "Back to overview".

### V-14 A join refused at code time drops the attendee on an empty "Your events" page
- **Where:** `lib/auth/flow.ts:195-200` (a `joinByLink` result of `"full"` or `"refused"` is dropped), `flow.ts:246`. Attendee, link-mode join when the event fills between code request and verify, or someone the organiser removed.
- **Heuristic / severity / effort:** #9. **2**. S.
- **Problem:** The person typed a correct code and is now signed in. They get `/events` with the empty state ("an organiser shares a link…") and no word on what happened. The event's own door already has the right "full" and "removed" copy, but this path never reaches it.
- **Fix:** When `pending.flow === "join"`, always redirect to `/e/<handle>`, so the layout's full, closed or join screen explains it. Or return `redirectTo: /e/<handle>?join=full`.

### V-15 Event details can be enumerated: guessable handle shows name, host, dates, venue and logo, even in guest-list mode
- **Where:** `lib/roster/handle.ts` (handle = slug of the event name, `_2` on collision), `lib/auth/session.ts:194-215` (`getPublicEvent`), `app/(auth)/signin/page.tsx:27`, `app/(app)/e/[handle]/layout.tsx:27-43`. Organiser of a private or guest-list event.
- **Heuristic / severity / effort:** security. **2**. M.
- **Problem:** The comment says this is "what anyone holding the event link may know". But the link is not a secret: `/signin?event=acme_leadership_offsite_2026` can be guessed from the name. A guest-list-only corporate offsite then shows its venue, dates, host and logo to anyone who tries. That contradicts "Nothing is public".
- **Fix:** Add a short random suffix to new handles (`acme_offsite_k7q2`). In guest-list mode, show only the name until a code is verified.

---

## Also noted (low severity, 1)
- `app/(app)/e/[handle]/me/LookingNow.tsx:15-31` polls every 4 s with no limit. If face jobs stall, "Checking for matches" shows on the phone forever. After about 2 minutes, stop and show "Still working. We'll email you."
- `app/api/guest/[token]/finalize/[mediaId]/route.ts:157-173` doesn't check whether the row is already `ready`. A retried finalize, after a lost response, runs `recordGuestUpload` again and inflates the link's file and byte counts on the Photographers page.
- Server JSON parsing in both queues (`upload-queue.ts:397`, `guest-queue.ts:190`) does `await res.json()` with no catch. A Vercel HTML 504 page surfaces as "Unexpected token '<'…" (cut to 160 characters).
- `UnfinishedUploads.tsx:108-113` and `UndoBar.tsx:38-44` don't catch a rejected server action. A network blip throws into the transition and can surface the root error page.

## Checked, not a bug (so nobody re-reports them)
- Viewer state (`saved`, `asked`, `matched`) doesn't leak between photos. The `[mediaId]` segment remounts on a param change.
- Double submit on the code screen and sign-in form is guarded (`disabled={pending}`, inputs disabled while pending). Roster commit is idempotent (`status !== "preview"` → 409).
- The two-tab same-file race in `upload_ticket` is handled through the unique index and the "winner" lookup, except for the binned case in V-10.
- `error.tsx` and `global-error.tsx` take a `retry` prop rather than the `reset` I know from older versions. This is Next 16.3.5 and node_modules isn't installed, so I'm **not** calling it a bug. Someone should check it against `node_modules/next/dist/docs` once dependencies are installed.
