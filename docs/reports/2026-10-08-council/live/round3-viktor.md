# Round 3: Viktor (Skeptical Engineer), the live app on an iPhone 11 Pro

**Verdict.** "Downloading videos doesn't work" is two separate bugs, and the database shows which one the friend hit. The attendee was in Instagram's in-app browser, tapped Download on IMG_9359.mov, and was back on the same video 14 seconds later with nothing saved. In our own iPhone app, the wrapper cancels the download's redirect and opens a blank Safari sheet on the storage host (shots 34 to 37).
The video data is worse than the walk suggests. The two "Processing" videos are the only two over 50 MB (72.4 MB and 53.6 MB), and the Supabase org is on the Free plan, which rejects any file over 50 MB. The app promises 500 MB, so every longer iPhone clip will fail the same way, "Upload again" included. The 10 posterless videos also have no duration and no dimensions, which means the uploader's browser could not decode them at all. Nothing on the server ever generates a poster, so they stay grey for good.
I was wrong on one call in round 2: inside the app, M-2 is not "normal web behaviour". The Download button never reaches Files or Photos there. I withdraw my downgrade.

Evidence base: shots in `shots/`, the code at the lines cited, read-only SQL on project `yfdglvhhakbuahyfrihs` (tables `media`, `storage.objects`, `storage.buckets`, `access_events`), and the Supabase org plan (`free`). I did not see the attendee's screen. Their part of the story comes from `access_events` timestamps and user agents.

---

## The video download complaint, traced end to end

**Viewer button.** `Viewer.tsx:297` is a plain `<a href="/api/media/<id>/download">`, with no `download` attribute and no in-app branch.

**Server.** `app/api/media/[id]/download/route.ts:31-37` logs a "download" (`:36`) and then answers **303** to a presigned URL:
- the R2 copy when `backed_up_at` is set, which is true for all 13 videos (`lib/backup/r2.ts:256-269`);
- otherwise the Supabase signed URL.

That URL carries `response-content-disposition: attachment` (`lib/backup/r2-core.ts:154-169`), and the object keeps its `video/quicktime` type (`r2-core.ts` around line 76).

**Path 1: our iPhone app (shots 34 to 37).**
- WebKit asks `decidePolicyFor navigationAction` again for the redirect target, `<account>.r2.cloudflarestorage.com`. That is not an app host, so `WebViewController.swift:236-239` cancels the navigation and calls `openOutside`, which presents an `SFSafariViewController` (`:201-210`).
- The response policy that would have spotted `attachment` and started a `WKDownload` (`:242-249`) never runs. The download delegate (`:324-337`, commented "album zips, roster exports") is never reached for single items.
- What the user sees:
  - about 20 s of blank white with a 2 px bar (shots 35, 36);
  - then QuickLook's "IMG_9362.mov, QuickTime movie, 31 MB, Open in…" (shot 37);
  - then they still need Open in…, then Save Video.
- Photos take the same path, because the cancel is host based, not type based.
- `access_events` logged both taps as downloads (07:34:50 and 07:35:24 UTC), although nothing was saved.

**Path 2: what the friend actually hit (Instagram in-app browser).**
- One attendee membership, every row with an `Instagram 448.0.0.39.66 … iOS 26_6_2` user agent:
  - viewed IMG_9358.mov at 23:14:00;
  - viewed IMG_9359.mov at 23:14:08;
  - **download** at 23:14:18;
  - viewed IMG_9359.mov **again** at 23:14:32;
  - then browsed 8 more items and never tapped Download again.
- Instagram's web view gets the same 303 to an `attachment` URL and has no download handling. The return to the same video 14 s later fits "nothing happened". I can't see their screen, so treat the exact symptom as likely, not proven.
- The site never detects in-app browsers (no `Instagram`/`FBAN`/`FBAV` check anywhere in `app/`, `components/`, `lib/`).

**Path 3: plain Safari.** This one works, but the file goes to Files or Downloads, not Photos (M-2).

**Fix (both paths, details in VL-1 and VL-2):**
- In the app, Download becomes "Save to Photos" through the native bridge, using the original file, with progress and a "Saved" confirmation.
- In Instagram and Facebook web views, Download explains how to open the page in Safari instead of failing silently.

---

## Confirmed from the phone

- **V-3** (organiser uploader hides the error text). Shot 28 says only "2 files didn't finish uploading". The DB shows both are over the 50 MB Storage limit. `friendlyError` (`lib/media/upload-queue.ts:59`) built "This file is larger than your storage plan allows per file" on 6 Oct, and the organiser never saw it.
- **V-8** (members told "still cooking" for days). The two rows have been `status = 'processing'` since 6 Oct 09:04 UTC.
  - `page.tsx:95-112` counts them for members, so `ProcessingBanner.tsx:28-29` tells attendees "2 videos still cooking. Usually 2–5 minutes" and draws two spinner tiles.
  - The organiser view shows them as "Processing" in shot 30.
  - The attendee banner itself wasn't screenshotted. Data and code confirm it.
- **V-7** (one "stuck" rule, contradictory copy). The organiser banner says "They aren't visible to members" (`UnfinishedUploads.tsx:30`), and "Needs you" says "Attendees can't see them" (`admin/[handle]/page.tsx:169`, shot 22). Both are false: see V-8.
- **V-9** (Save to Photos saves stills, not videos). Not tapped live, but now proven with live data.
  - In the app, `AlbumActions.tsx:84-95` sends the `display` variant to the native bridge, and for a video that is `poster_path` (`api/media/sign/route.ts:30`).
  - 10 of 13 videos have no poster, so they are dropped silently and the count reads low.
  - The other 3 save as JPEG stills. No path in the app saves a video.
- **V-13** (no loading states on organiser pages). The walk measured 2.5 to 3 s per organiser menu tap, with the old page showing and no indicator (shot 27).
  - The wrapper's new slow-load bar (`WebViewController.swift:89-104`, uncommitted) only watches `isLoading`, which client-side router navigations never set. So it can't cover this.
  - `loading.tsx` is still the fix.
- **M-2** (Download goes to Files). In the app it's worse than reported: see the trace above. I withdraw my round 2 C-4 downgrade.
- **S-6** (overview numbers disagree). Shot 22 shows "Attendees joined 2" above "Guests 1 of 50". I didn't trace which one is right; Sam owns it.

## Not reproduced / wrong

- **Shot 67, "the app rotated to landscape".** Not an app bug.
  - The status bar rotated together with the portrait content, so iOS never rotated the UI. Device Hub rotated the mirror frame.
  - The app is portrait-locked: `INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait` (`project.pbxproj:195,229`, moved there from `Info.plist` in the working tree).
  - Check that this pbxproj change is committed before the next TestFlight build, or the lock (and every usage string) goes with it.
- **Shot 01, "plain white screen".** This is the launch screen colour `LaunchBackground` (#F7F7F5, the same as the splash), not a failed load. It's cosmetic at most.
- **My C-4 (M-2 down to 2).** Wrong for the app. Restored to 3 and merged into VL-1.
- **My C-5, "the share-sheet loop failing is speculative".** Still untested, and now less relevant. In the app, `canShareSnapshot` takes the native bridge (`AlbumActions.tsx:18`), so the `navigator.share` loop runs only in Safari.
- **V-1 and M-6.** Commit `697d093` targets both. The phone walk didn't test sign-in under load, so they're unverified live, not refuted.

---

## New findings

### VL-1 In the iPhone app, Download opens a blank Safari sheet on the storage host and never saves anything
- **Where:** shots 34, 35, 36, 37.
  - `Viewer.tsx:297` (plain anchor);
  - `api/media/[id]/download/route.ts:31-37` (303 to R2);
  - `ios/KlubbiesEvents/WebViewController.swift:236-239` (a non-app host is cancelled and opened outside);
  - `:201-210` (`SFSafariViewController`);
  - `:242-249` and `:324-337` (download handling that is never reached).
- **Who and when:** every attendee and organiser in the app, Download on any photo or video.
- **Heuristic / severity / effort:** #1, #9, bug. **3**. S (wrapper) to M (native save with progress).
- **Problem:**
  - The redirect to `*.r2.cloudflarestorage.com` (or `*.supabase.co`) is a new main-frame navigation to a foreign host, and the wrapper sends those to Safari.
  - The user gets about 20 s of white with a 2 px bar, then a QuickLook card with "Open in…". It never reaches Photos, and a second tap repeats the whole thing.
  - The presigned URL also shows in an address bar with a Share button: a 5-minute bearer link to a private file, one tap from being forwarded (minor, 1).
- **Fix:**
  1. **Web.**
     - When `nativeSaveToPhotos()` exists, render Download as a button labelled "Save to Photos".
     - It calls a new `POST /api/media/<id>/original` that returns the same presigned URL as JSON. Factor that out of the download route and keep `logAccess` there.
     - It then posts `{ urls: [url] }` to `klubbiesSaveToPhotos`.
     - Show "Saving video… 31 MB" while it runs, then "Saved to Photos" or the bridge's error, in the viewer's existing `role="status"` pill (`Viewer.tsx:311`).
  2. **Wrapper.**
     - Have `PhotoSaver.save` (`PhotoSaver.swift:46-62`) report progress: post `{saved, failed, bytes}` back, or use `URLSession` with a delegate.
     - Keep `.video`/`.photo` from the MIME type. It is right for R2 copies, which keep `video/quicktime`.
  3. **Wrapper safety net, for any other attachment link.** In `decidePolicyFor navigationAction`, when the previous main-frame request was `/api/media/*/download` and the target is a storage host, return `.download` instead of `openOutside`, so it lands in the existing `WKDownload` path.

### VL-2 The friend's case: in Instagram's in-app browser, Download does nothing, and nothing tells them why
- **Where:** `access_events` for the one Instagram membership: download at 2026-10-06 23:14:18 UTC, back on the same video at 23:14:32, no retry. Also `Viewer.tsx:297` and the download route's 303.
- **Who and when:** attendees who open the event link from an Instagram or Facebook DM or story. That is how links travel at uni clubs.
- **Heuristic / severity / effort:** #9, #1. **3**. S.
- **Problem:**
  - Social apps' web views don't handle `Content-Disposition: attachment`. The tap ends in nothing, or in a preview with no save.
  - The site never detects these browsers, so the attendee concludes "downloading doesn't work". That is literally the complaint.
  - The same web views also block the album's "Save to Photos" share loop, so no route out works.
- **Fix:**
  - Add `isSocialInAppBrowser(ua)` next to `isNativeAppUserAgent` (`lib/native-app.ts`), matching `Instagram`, `FBAN`, `FBAV`, `FB_IAB`, `TikTok`, `musical_ly` and `Snapchat`.
  - In the viewer and album actions, replace Download and Save with a sheet: "Instagram can't save files. Tap ⋯ then Open in browser, or get the Klubbies Events app." Add a Copy link button.
  - Show a one-line banner on the event home in those browsers.
  - Don't log a "download" there.

### VL-3 Any video over 50 MB is rejected by Storage; the app promises 500 MB, and "Upload again" fails the same way
- **Where:**
  - Shots 22, 28, 30.
  - DB: IMG_9390.mov is 72,441,135 bytes and IMG_9382.mov is 53,592,068 bytes, both `processing` with **no object in storage**. Every other video is 46.2 MB or less and uploaded fine.
  - The Supabase org plan is `free`, and `storage.buckets.event_media.file_size_limit` is null, so the project's global limit applies (50 MB on Free).
  - The repo's own `docs/klubbies-decisions.md:48` says "Uploads over 50 MB per file are rejected by Storage on the free plan".
  - Versus `lib/billing/plans.ts:41` (`MAX_VIDEO_BYTES = 500 MB`) and the copy in `lib/media/constants.ts:26` ("Videos can be up to 500 MB").
- **Who and when:** organisers and photographers uploading iPhone video. 4K HEVC runs at about 2 to 3 MB a second, so roughly any clip over 20 to 25 s fails.
- **Heuristic / severity / effort:** bug, #9, #5. **4**. S to unblock, M to do properly.
- **Problem:**
  - `upload_ticket` checks 500 MB and inserts the row. tus then gets a 413 at creation and doesn't retry 4xx, and the job fails client side.
  - The organiser sees "FAILED" with no reason (V-3), then "didn't finish" banners.
  - "Upload again" resumes into the same row (`upload_ticket/route.ts:60-64`, `lib/media/dedupe.ts`) and hits the same 413, forever.
  - The photographer queue uses the same endpoint, so the same failure applies there.
  - At a real event this loses most of the video.
- **Fix:**
  1. **Today:**
     - Upgrade the Supabase org to Pro, set the global upload limit to 500 MB, and set `file_size_limit` on `event_media` to 500 MB, so the limit lives in config and not only in the plan.
     - Until then, reject in `upload_ticket` against a `STORAGE_MAX_BYTES` env var, with the true limit in the message. Then the organiser learns before uploading, not after.
  2. **Later:** upload originals straight to R2 with presigned multipart. The R2 copy already exists for downloads.
  3. **Either way:** add a test that tickets a 60 MB `video/quicktime` against the configured limit.

### VL-4 A failed upload is never reported to the server: rows sit "processing", members are told "2 to 5 minutes", and the Free cap counts files that don't exist
- **Where:**
  - `lib/media/upload-queue.ts:254-256`: catch sets the job to failed client side only. Same in `guest-queue.ts`.
  - `api/media/[id]/finalize/route.ts:35-38`: the `failed: true` branch. Nothing in the repo ever sends it (grep confirms).
  - `e/[handle]/a/[albumId]/page.tsx:95-112` and `ProcessingBanner.tsx:28-29`.
  - Migration `20260928000027_plans_and_limits.sql:90-103`: `event_units_used` counts `status <> 'failed'`.
  - Shots 22, 28, 30.
- **Who and when:** attendees viewing the album; organisers reading usage.
- **Heuristic / severity / effort:** #1, #9. **3**. S.
- **Problem:**
  - A job that died on a 413, a revoked session or a crash leaves its row `processing` until the 14-day sweep (`lib/media/unfinished.ts`).
  - Members see spinners and "usually 2–5 minutes" for two weeks, while the organiser is told members can't see them.
  - `175 of 200` (shot 22) is 25 photos + 13 × 10 + **2 × 10 for the two rejected videos**: 10% of the Free allowance spent on nothing.
- **Fix:**
  - In both queues' catch: when the ticket exists, POST `finalize` with `{ failed: true }` (best effort, `keepalive: true`). Then `failed` rows drop out of the cap and the member count.
  - Server side: in `ProcessingBanner`'s count, only count rows younger than `STUCK_AFTER_MS`.
  - Fix both copies (`UnfinishedUploads.tsx:30`, `admin/[handle]/page.tsx:169`) to say what attendees actually see.
  - Show the stored reason in the banner. That needs a `failure_reason` column, written by finalize.

### VL-5 Posters, durations and sizes come only from the uploader's browser; 10 of 13 videos have none, permanently and silently
- **Where:**
  - DB: 10 `ready` videos with `poster_path`, `thumb_path`, `width`, `height` and `duration_seconds` all null. The 3 with posters (IMG_9364 to 9366) are 2160×3840 with durations.
  - Shots 30, 31, 32.
  - `lib/media/prepare.ts:112-140`, and `:121` (waits for `loadeddata` before reading anything);
  - `upload-queue.ts:53` (`CONCURRENCY = 3`);
  - `finalize/route.ts:58-60`;
  - `AlbumGrid.tsx:29,34` ("No preview", "Video" with no length);
  - `Viewer.tsx:212-218` (`preload="metadata"`, no poster, so a black stage).
- **Who and when:** everyone browsing an album with phone video, and the organiser's billing (VL-6).
- **Heuristic / severity / effort:** #1, consistency. **3**. M.
- **Problem:**
  - Duration is null too, so these jobs failed at or before `loadeddata` (decode error, or the 20 s timeout), not at the seek.
  - Which of those it was I can't prove from here. Candidates:
    - the uploading browser couldn't decode that HEVC or HDR profile (the code's own comment names HEVC in Chrome);
    - WebKit not decoding a detached, never-played 4K element while two other jobs prepare and upload.
  - One device test settles it.
  - What is certain:
    - there is no server fallback;
    - the catch returns an empty result and the row is marked `ready` as if it were fine;
    - even the readable metadata (duration, dimensions) is thrown away, because the code waits for frame data before reading it.
  - The friend's session opened two posterless videos (IMG_9358 and 9359) onto a black stage.
- **Fix:**
  1. **Client:**
     - Await `loadedmetadata` first and keep duration and dimensions even if no frame decodes.
     - Then try a frame with `play()`/`pause()` or `requestVideoFrameCallback`.
     - Prepare videos one at a time (a separate concurrency of 1 for `prepareVideo`).
  2. **Server backfill:**
     - In the hourly cron, pick `kind = 'video' and status = 'ready' and poster_path is null`.
     - Run `ffprobe` and `ffmpeg -ss 1 -frames:v 1` on the R2 copy in a Node function (ffmpeg-static, 60 s budget) to write `poster.jpg`, `thumb.webp`, `duration_seconds`, `width` and `height`.
  3. **Viewer, today:** append `#t=0.1` to `videoUrl` so iOS paints the first frame instead of black.
  4. **Debugging:** add a `prepare_error` column, so the next case is diagnosable without guessing.

### VL-6 Video allowance: checked at insert with an unknown duration, then the client's number is trusted and never rechecked
- **Where:**
  - Migration 27, `:78-88` (`media_units`: a null duration counts as 1 minute);
  - `:270-290` (`guard_photo_allowance`, BEFORE INSERT only);
  - `finalize/route.ts:14,55` (client-supplied `durationSeconds`, max 86400).
- **Who and when:** organisers on capped plans; billing integrity.
- **Heuristic / severity / effort:** bug, security (integrity). **2**. S.
- **Problem:**
  - At insert, duration is always null, so every video passes as 10 units.
  - At finalize the real duration is written and nothing is rechecked. A 9-minute video crosses the cap by 80 units unnoticed.
  - If preparation fails (VL-5), it counts 10 forever.
  - A modified client can report `durationSeconds: 1` for anything.
  - Today's 10 unknown durations happen to be short, but that's luck.
- **Fix:**
  - Re-run the allowance check on the finalize update: a BEFORE UPDATE trigger when `duration_seconds` changes, or an explicit check in the route.
  - Set duration from the server-side `ffprobe` (VL-5) and treat the client's value as provisional.
  - Over the cap at finalize: keep the file, flag it, and say so ("This video is 9 minutes and used 90 photos of allowance"), rather than silently going over.

### VL-7 In the app, "Save to Photos" can never save a video: it saves a still, or silently drops the video
- **Where:** `components/AlbumActions.tsx:84-95` (native branch, `variant: "display"`); `api/media/sign/route.ts:30` (display = `poster_path` for video); `PhotoSaver.swift:46-62`.
- **Who and when:** attendees in the app saving an album.
- **Heuristic / severity / effort:** #1, #9. **3**. S.
- **Problem:**
  - Of the 13 videos, 3 save as JPEG stills and 10 are filtered out (`filter(Boolean)`).
  - The result still reads "Saved N to Photos", with N lower than the count shown, and no word about videos.
  - The bridge handles `.video` already; the page never sends one.
- **Fix:**
  - Add a `variant: "original"` to `/api/media/sign`: the R2 presigned URL for both kinds, falling back to Supabase.
  - Use it for the native path; photo originals are the "full quality" the product promises.
  - Report "Saved 36 of 38. 2 videos are still processing" from the bridge's `{saved, failed}`.

### VL-8 Wrapper download UX: zips download with no progress, and a second tap deletes the first one mid-flight
- **Where:** `WebViewController.swift:324-337` (no progress, no HUD); `:328-329` (destination is `tmp/Downloads/<suggestedFilename>`, and `removeItem` runs on an existing path).
- **Who and when:** organisers and attendees using Download all, part N or a roster export in the app.
- **Heuristic / severity / effort:** #1, bug. **3**. S.
- **Problem:**
  - A 150-file zip on venue Wi-Fi runs for minutes with nothing on screen until a share sheet appears, so people tap again.
  - The second download gets the same filename ("Mt barney.zip"), and its `decideDestination` removes the file the first one is still writing.
  - Failures show `error.localizedDescription` (for example, "The operation couldn't be completed").
- **Fix:**
  - Keep a small native HUD bound to `download.progress`: "Downloading Mt barney.zip, 84 of 310 MB", with Cancel.
  - Ignore a second request for the same URL while one is running.
  - Write each download to a per-download UUID subfolder.
  - Map common `NSURLError` codes to plain text.

### VL-9 Pull-to-refresh is on every page, including the uploader: one overscroll reloads the page and kills the upload queue
- **Where:** `WebViewController.swift:54-56` (a `UIRefreshControl` on the web view's scroll view, everywhere); `:191-194`; `:273-276` (process terminated, so reload). See also V-4.
- **Who and when:** organisers uploading in the app (Upload menu, shots 48 to 50), and photographers if they use the app.
- **Heuristic / severity / effort:** #5, #3. **3**. S.
- **Problem:**
  - A tus queue lives in page memory. Scrolling back to the top of the uploader and pulling down, the most natural gesture to "check progress", reloads the page.
  - Every in-flight upload dies, and its row is left `processing` (VL-4).
  - The `beforeunload` guard V-4 asks for won't help here: WKWebView has no public hook to show a beforeunload prompt, so the reload is silent.
  - Video prepares (VL-5) raise memory, and a WebContent crash also reloads.
- **Fix:**
  - Expose `klubbiesBusy` from the upload queues (`postMessage({busy: true|false})` from `UploadQueue.emit`).
  - While busy, the wrapper sets `refreshControl = nil` and ignores the termination reload, showing "Upload interrupted. Reopen the album to resume" instead.
  - Also turn refresh off on the viewer and on any page with a fixed sheet.

### VL-10 The wrapper paints the safe areas in paper colour, so a white band frames the dark viewer
- **Where:** shot 32 (white strip above the viewer and below its bottom bar). `WebViewController.swift:30,70-71` (web view pinned to the safe area, controller background `#F7F7F5`). No `viewport-fit=cover` anywhere in `app/`, so the existing `env(safe-area-inset-*)` paddings (`MemberTabBar.tsx:73`, `globals.css:1139`) evaluate to 0.
- **Who and when:** every viewer screen in the app, and any page with a non-paper background.
- **Heuristic / severity / effort:** #8 (consistency), wrapper. **2**. S.
- **Problem:** the native view, not the page, owns the 44 pt above and 34 pt below, so the near-black viewer floats inside a light frame. The home indicator sits on white below a dark bar.
- **Fix:**
  - Pin the web view to `view.topAnchor` and `bottomAnchor`, and set `contentInsetAdjustmentBehavior = .never`.
  - Add `viewportFit: "cover"` to the root `viewport` export, and let the CSS insets that already exist do their job.
  - Check the header and tab bar on the 375 pt screen afterwards.

### VL-11 "Downloads" counts taps, not files: the overview's one download was the failed Instagram attempt
- **Where:** `api/media/[id]/download/route.ts:36` (logged before the redirect); shot 21 ("Downloads 1, single photos and zips"); `access_events` (the one pre-walk download is the Instagram one; the walk added two more, and nothing was saved).
- **Who and when:** organisers reading the overview and the activity feed.
- **Heuristic / severity / effort:** #1 (honest status). **2**. S.
- **Problem:** the stat and the activity line say a guest downloaded something when they didn't. Repeated taps on a stuck download inflate it.
- **Fix:**
  - Log on confirmed saves, which the native bridge reports.
  - For web downloads, label it honestly ("Download taps"), or dedupe per member, media and 10 minutes.

### VL-12 Small things, from the same traces (severity 1)
- `prepare.ts:106`: the timeout message interpolates `${event}` (the global `window.event`) instead of `ev`, so any future `prepare_error` would read "timeout waiting for undefined".
- Viewer copy is photo-only on videos: "Photo: Maximilian Umschaden" (`Viewer.tsx:199`, shot 32) and "About this photo" (`:362`, shot 38).
- The presigned R2 URL is visible and shareable from the Safari sheet's address bar (shot 35). It goes away with VL-1.

---

## My top 10 for the fix list (all IDs)

1. **VL-3:** at a real event most phone video fails with no reason shown, and the retry loops. The fastest fix is a plan setting.
2. **VL-1 + VL-2 (+ M-2):** the owner's actual complaint, with two different causes. Ship both: native save in the app, and an honest "open in Safari" in social web views.
3. **V-1 / M-1:** venue lockout. `697d093` targets it; keep it on the list until it's verified deployed and tested with many joins from one IP.
4. **VL-4 (+ V-7, V-8):** dead uploads shown as "2 to 5 minutes" to guests for two weeks, false organiser copy, and 10% of the Free cap spent on files that don't exist. Small change.
5. **V-2 / M-4:** zip parts and the deletion email. Permanent data loss through a misleading status. Unchanged by the walk.
6. **V-3:** the uploader already had "larger than your storage plan allows" on 6 Oct and hid it. Rendering `job.error` would have made VL-3 obvious.
7. **VL-5:** posterless, duration-less videos make every video album look broken and feed VL-6. The client fix is S; the backfill is M.
8. **V-4 / M-8 / M-9 + VL-9:** upload safety net. In the app, pull-to-refresh is the likeliest way to lose a batch, and the web guard can't cover it.
9. **V-9 / M-3 + VL-7:** "Save to Photos" saves stills or nothing for video, and previews instead of originals.
10. **VL-8:** silent zip downloads in the app, with a real file-clobbering race on the second tap.

Runners-up:
- **V-6 / S-2** (scheduling) and **I-1** (Dialog): both appear to be in progress in the working tree, so verify, don't re-rank.
- **VL-6**: allowance integrity.
- **V-13**: organiser loading states. Confirmed at 2.5 to 3 s per tap.
- **VL-10**: safe-area bands.
