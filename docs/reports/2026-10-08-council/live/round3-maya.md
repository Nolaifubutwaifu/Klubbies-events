# Round 3: Maya, Attendee Advocate (live app, iPhone 11 Pro)

**Verdict.** The friend is right, and it's worse than "doesn't work": in the iPhone app, tapping Download on a video opens a blank Safari sheet on a raw `r2.cloudflarestorage.com` address for 20 seconds, then shows a QuickTime icon and "Open in...". Nothing reaches Photos, and nothing says what's happening.
The app already has a native "save into Photos" bridge (`PhotoSaver.swift`), but the viewer never uses it, and the album's Save to Photos would save videos as still frames, or skip them, because 10 of the 13 real iPhone videos have no preview image.
The guest-facing copy mostly holds up on a 375pt screen, but status and labels fail exactly where real data is messy: videos called "photos", "Processing" tiles that died two days ago, a blank Favourites tab, and a credit line that says Klubbies took the photos.

Evidence: WALK.md, the shots I opened (03, 04, 05, 21, 24, 28-46, 64, 65, 66) and the code at the lines cited. I read the working copy of `ios/KlubbiesEvents/*.swift`, which has uncommitted changes. I'm assuming the phone build matches it.

---

## The owner's question: "a friend says downloading videos doesn't work"

**What the guest sees** [32]-[37]: they tap Download under a video. The dark viewer slides away to a white in-app Safari sheet showing `...b11ee2.r2.cloudflarestorage.com` and a thin blue bar [34][35]. It stays blank white for about 20 seconds with no text [36]. Then there's a grey MOV icon with "IMG_9362.mov, QuickTime movie - 31 MB" and a blue "Open in..." link [37]. To get the video into Photos they'd have to know to tap Share, then "Save Video". Most people tap X at second 8 and decide it's broken. A second tap starts the whole thing again.

**Root cause** (traced in code):
1. The viewer's Download is a plain link with no `download` attribute: `app/(app)/e/[handle]/a/[albumId]/[mediaId]/Viewer.tsx:296-297` → `<a href="/api/media/<id>/download">` (rendered by `Action`, `:61-64`).
2. The route answers with a **303 redirect to a signed storage URL**: R2 when the file is backed up, Supabase Storage otherwise (`app/api/media/[id]/download/route.ts:31-37`).
3. The wrapper checks every navigation, redirects included. Here `action.shouldPerformDownload` is false (no `download` attribute), and the storage host isn't an app host, so it cancels the load and calls `openOutside`, which presents an `SFSafariViewController` (`ios/KlubbiesEvents/WebViewController.swift:224-240, 201-207`).
4. The wrapper's real download path never runs. That's `decidePolicyFor navigationResponse` (Content-Disposition attachment → `.download`, `:242-249`), then `WKDownloadDelegate` to the share sheet (`:324-337`). The Safari sheet fetches all 31 MB before it can draw anything, so you get a blank screen and then a file preview.
5. The same path affects **photos** too: every viewer Download in the app ends in a Safari sheet. Only videos were tested live, but the code is identical.
6. Side effect: `logAccess(... "download")` runs before the redirect (`route.ts:36`). The organiser's overview counts "Downloads 1" [21] for a download that never arrived.

**Fix:** see ML-1 below. Short version: in the app, Download becomes **Save to Photos**, which hands the original file's signed URL to the existing `klubbiesSaveToPhotos` bridge, and the wrapper stops opening storage URLs in Safari.

---

## Confirmed from the phone

- **M-2** (Download goes to Files, not Photos): confirmed, and worse inside the app. It doesn't even reach Files; it opens a Safari sheet. [34]-[37]. Re-filed as ML-1 for the app.
- **M-7** (face notice blocks the headline feature, consent wall): [64] shows "This event's photos are analysed for faces", the facts folded under "What this means", one button, "I understand that faces in this event's photos are analysed.", and no "Find the photos you're in" card while it's up. [39]-[41]: on a 375pt phone the consent runs about 2.5 screens before you reach the selfie buttons. "Find my photos" is a disabled grey button with no reason given, and there's no "Not now".
- **M-10** ("Save" means three things): [32] shows the heart labelled **Save** right next to **Download** under a video. A guest reasonably reads Save as "save to my phone". [42]: the Saved page says "Photos you saved from this event, ready to download" above an empty Favourites tab.
- **M-12** (sign-in friction): [04][05] show "Full name: As you gave it when you joined" and "Use a password instead" on the plain sign-in. iOS autofill offers the name, which helps here, but its chip covers the hint text [05].
- **V-8** (false "still uploading" states): [30] shows IMG_9390.mov and IMG_9382.mov as **"Processing"** tiles in the grid two days after they started, while the banner above says the same two files "didn't finish uploading" [28]. The same file has two contradictory statuses on one screen.
- **V-3 / V-7 / M-8 family** (upload failures): [28] shows two iPhone .mov uploads stuck since "6 Oct, 7:04 pm", with no reason shown. "Remove it" and "Upload again" are the only options. Real failures happen with real data, on the first event.
- **S-13** ("Upload" opens "New album" when an album exists): [48][49] show the keyboard up on a new album name, with "Or add to an existing album" below the fold. That's Sam's, but it's the photographer-adjacent path, so I'm noting it.
- **S-14** (branding promise vs reality): [21] promises the organiser "Attendees see your brand on every screen, not ours", while every attendee screen ends "Photos by Klubbies Events" [31][41][42][65]. See ML-5.

## Not reproduced / wrong

- **M-3** ("Save to Photos very likely stops after 8" because each share needs a fresh tap): **wrong inside the iPhone app.** There the album button skips the share sheet. It posts each batch to the native `klubbiesSaveToPhotos` handler, which needs no gesture (`components/AlbumActions.tsx:78-95`, `ios/KlubbiesEvents/PhotoSaver.swift:14-34`). The gesture problem stands only for mobile Safari, which this walk didn't test. The rest of M-3 stands and gets worse with real data: see ML-2. (Not tapped live; this is from code.)
- **M-2**, partly: I said Download "puts photos in the Files app". In the app it never gets that far (see above). My fix (a shared Save to Phone control) still applies, now with a native path.
- **M-1, M-4, M-5, M-6, M-9, M-11, M-13, M-14**: not exercised on this walk (one signed-in organiser, no face matches, no code entry, no closed gallery). Neither confirmed nor refuted.

---

## New findings

### ML-1 In the app, Download opens a blank Safari sheet on a storage URL; videos and photos never reach Photos
- **Where:** [32] [34] [35] [36] [37]; `Viewer.tsx:296-297`; `app/api/media/[id]/download/route.ts:31-37`; `ios/KlubbiesEvents/WebViewController.swift:224-240` (storage host → `openOutside`), `:201-207` (SFSafariViewController), `:242-249` and `:324-337` (download path never reached). Affects every attendee (and organiser) in the app, in the viewer, on any photo or video.
- **Heuristic / severity / effort:** #1 visibility of system status, #2 match with the real world, #9. **4**. S (wrapper) + S (viewer).
- **Problem:** Saving the photo or video is the guest's main job, and the button for it shows a white page with an address made of hex for 20 seconds, then a file icon. There's no progress text, no "Saved", nothing in Photos. The raw signed storage link is also on screen and shareable from that sheet. The organiser's "Downloads 1" says it worked.
- **Fix:**
  1. *Viewer (web), main fix.* When `nativeSaveToPhotos()` is present, render the middle action as a button labelled **"Save to Photos"**, not a link. On tap, POST `/api/media/sign` with a new `variant: "original"`. That variant returns `r2Url(m, ttl, filename)`, falling back to the signed `storage_path` for photos and videos alike. Then call `native.postMessage({ urls: [url] })`. Inline status under the bar: "Saving video (31 MB)…", then "Saved to Photos", or the bridge's own error ("needs Photos access…"). Log the access only after a `saved: 1` reply. Keep the Files-style download under More as "Download file".
  2. *Wrapper (Swift), safety net for every other download link (zips, rosters).* In `decidePolicyFor navigationAction`, add `AppConfig.isStorageURL(url)` (hosts ending `.r2.cloudflarestorage.com`, and the Supabase project host with a `/storage/v1/object/sign/` path). Return `.download` for those instead of `openOutside`. While the `WKDownload` runs, show a small native HUD from `download.progress`: "Downloading IMG_9362.mov · 12 of 31 MB" with Cancel. In `downloadDidFinish`, if the file is an image or movie (`UTType(filenameExtension:)` conforms to `.image` or `.movie`), add it straight to Photos via a `PhotoSaver.save(fileAt:)` refactor and show "Saved to Photos". Otherwise keep the share sheet.
  3. Test on device: one 31 MB .mov, one HEIC, one JPEG, on Wi-Fi and on 4G.

### ML-2 The app's Save to Photos saves videos as still frames, silently skips videos with no preview, and saves 2000px WebP copies
- **Where:** `components/AlbumActions.tsx:84-95` (requests `variant: "display"`); `app/api/media/sign/route.ts:30` (display for a video = `poster_path`, which is null for 10 of 13 videos here, see ML-3); `AlbumActions.tsx:91` (missing URLs are filtered out before the bridge); `:94, :109` (reports "Saved N to Photos", ignores `failed`). Album header (members) or the album's "..." menu (organisers, [66]). Not tapped live; traced in code against the live data [30][31].
- **Heuristic / severity / effort:** #1, #2, bug. **3**. S.
- **Problem:** On this album a guest taps Save to Photos and gets "Saved 28 to Photos" from 38 items. The 25 photos are downscaled WebP copies. The 3 videos with posters arrive as single JPEG stills. The 10 videos without posters are skipped, and nothing says so. The guest believes they have the trip. They don't have one video.
- **Fix:** Use the new `variant: "original"` from ML-1 for the bridge path, so videos save as videos and photos at full quality. (`PhotoSaver.save` already handles `video/*` MIME types, `PhotoSaver.swift:49-60`.) Count from the full list, not the signed subset: "Saved 36 of 38. 2 couldn't be saved: IMG_9382.mov, IMG_9390.mov (still uploading)." On phones, say the size first: "38 items, about 420 MB. Best on Wi-Fi." Same shared control as M-2's `SaveToPhone`.

### ML-3 Most iPhone videos have no preview: grey "No preview" tiles in the grid and a black stage in the viewer
- **Where:** [30] [31] (10 of 13 videos "No preview" with only a "Video" chip, no duration); [32] (black viewer, play button only); `lib/media/prepare.ts:114-138`. Posters are made in the **uploader's browser**, and the catch at `:133-135` says it outright: "Some codecs (e.g. HEVC .mov in Chrome) can't be decoded; upload anyway." Affects every attendee browsing any album with iPhone videos uploaded from a laptop.
- **Heuristic / severity / effort:** #6 recognition rather than recall, #1. **2**. M.
- **Problem:** iPhone videos are HEVC by default, so this is the normal case, not an edge case. A guest looking for "the bit where Rasmus jumps in" has to open ten identical grey squares one by one. The tiles also lose their durations, so they can't even tell a 4 second clip from a 2 minute one. In the viewer [32] the video sits as a black box until Play.
- **Fix:** Generate posters and durations server side after upload, for any video that arrives without them (a background job with ffmpeg, or the storage provider's video frame transform). Write `poster_path`, `thumb_path` and `duration_seconds`, and backfill the existing rows. Until then, show the filename and "Tap to play" on the tile instead of "No preview", and keep the duration when the browser could read it (`prepare.ts:122` gets duration before the decode fails, so return it).

### ML-4 The Saved page goes blank once you've downloaded anything
- **Where:** [42]; `app/(app)/e/[handle]/saved/page.tsx:74-86` (the "Nothing saved yet" empty state only shows when favourites **and** downloads are both 0); `saved/SavedTabs.tsx:44, 74-110` (opens on the Favourites tab and renders an empty list). Affects attendees in Saved.
- **Heuristic / severity / effort:** #1, #10. **2**. S.
- **Problem:** "Favourites 0" is selected and the rest of the screen is empty space down to the footer. No line says what Favourites is or how to add one. The header promises "Photos you saved from this event, ready to download." The one thing this guest did (a download) is behind the other tab.
- **Fix:** Open on whichever tab has items. Give the Favourites tab its own empty line: "Tap the heart on any photo to keep it here." Change the header to "Your favourites and downloads from this event."

### ML-5 "Photos by Klubbies Events" under an album credited to the real photographer
- **Where:** [31] (album header "photos by Maximilian Umschaden", footer "Photos by Klubbies Events"); also [41] [42] [65]; `components/event/CreditLine.tsx:10-12` (plain text in the app); `app/(app)/e/[handle]/a/[albumId]/page.tsx:225-226`; the organiser's promise in [21] ("Attendees see your brand on every screen, not ours"). Affects attendees on every event page, and the photographer's credit.
- **Heuristic / severity / effort:** #2 match with the real world, #4 consistency. **2**. S.
- **Problem:** "Photos by" means "who took the photos". On the same screen we tell guests Max took them and that Klubbies Events did. A freelance photographer who sees our name in their byline slot will be annoyed, and rightly. On Your photos [41] it sits right under the face consent, which makes the vendor feel more present than it should.
- **Fix:** Change the line to "Gallery by Klubbies Events" (or "Shared with Klubbies Events") in `CreditLine.tsx` and on the poster (`app/(print)/admin/[handle]/share/poster/page.tsx:94`). Keep "photos by …" only for the people who took them. Reword the organiser setup card to what's true: "Your logo and colour on the event's pages."

### ML-6 Videos are called photos, and their details say "Unknown"
- **Where:** [32] [33] (header "36 of 38 · Photo: Maximilian Umschaden" on a video); [38] (More sheet "About this photo", "Taken: Unknown" on an iPhone .mov); `Viewer.tsx:199` ("Photo:"), `:362` ("About this photo"), the prev/next `aria-label`s ("Previous photo", "Next photo"); `lib/media/prepare.ts:132, 135` (videos never get `capturedAt`). Affects attendees in the viewer.
- **Heuristic / severity / effort:** #2, #4. **1**. S.
- **Problem:** Small, but it's on every video, and it reads as unfinished. "Taken: Unknown" on a phone video, which always carries its creation date, makes the guest wonder whether the file is right.
- **Fix:** Use `current.kind` in the copy: "By Maximilian Umschaden" (works for both), "About this video", "Previous" and "Next". Read the creation date for videos (the uploader can take `lastModified` as a fallback, or have the server-side job in ML-3 read the QuickTime `creationdate` atom). Hide the "Taken" row when it's unknown rather than printing "Unknown".

### ML-7 Guests aren't told plainly that the organiser sees, by name, every photo they open
- **Where:** [24] (organiser overview: "Rasmus Klaerke viewed IMG_9376.mov", "viewed IMG_9381.mov", "viewed IMG_9417.jpeg"…, one line per photo); `app/(app)/admin/[handle]/page.tsx:409`; the only attendee-side mention is the last line of the More sheet, "Views and downloads are logged." [38] (`Viewer.tsx:372`), plus the privacy policy (`lib/copy/site.ts:141-142` sells it to organisers as "You can see who opened what"). Affects every attendee, consent.
- **Heuristic / severity / effort:** #2, #10, trust and consent. **2**. S.
- **Problem:** "Logged" is passive and buried. A guest wouldn't guess that the club committee sees "Rasmus viewed IMG_9376" with their name on each photo, for example who keeps opening photos of one person. That's the kind of surprise that ends trust when someone finds out. I'm not asking to stop logging (it protects people when photos leak). I'm asking that it's said where people will read it, and that the organiser sees no more than they need.
- **Fix:** One plain line where guests decide to join and on the face notice: "The organiser can see who opened and downloaded each photo." Change the More sheet line to the same wording. On the organiser side, group views ("Rasmus viewed 14 photos in Mt barney") and keep per-photo names for downloads only. Per-photo view lists stay in the Full log for removal and leak cases.

### ML-8 The full-screen viewer sits between two light bands
- **Where:** [32] [33] (white status-bar strip above, white band below the dark viewer); `ios/KlubbiesEvents/WebViewController.swift:70-71` (web view pinned to the safe area), `:30, 47-49` (the paper colour fills the rest). Affects attendees in the viewer, the moment they look at a photo.
- **Heuristic / severity / effort:** #8 aesthetic, #4. **1**. S.
- **Problem:** The photo moment looks like a web page in a frame, not a photo app. On a dark photo the bright band at the bottom draws the eye away from it.
- **Fix:** Pin the web view to `view.topAnchor`/`bottomAnchor` and let the site handle `env(safe-area-inset-*)` (it needs `viewport-fit=cover`). Or have the viewer page tell the wrapper its background colour (a tiny message handler, or read `theme-color`), and set `view.backgroundColor` and the status bar style to match while the viewer is open.

### ML-9 The You page: notification ticks that look on but aren't, and a "Download" instruction for a button that doesn't exist
- **Where:** [44] ("iPhone notifications · Get a notification for everything ticked below · **Turn on**" above two already-ticked boxes); `app/(app)/account/PhoneNotifications.tsx:27-32, 49`. [46] ("For a copy of everything shared with you, use Download in each album, or contact us."); `app/(app)/account/page.tsx:136`. Affects attendees in You.
- **Heuristic / severity / effort:** #2, #4. **1**. S.
- **Problem:** The ticks are email preferences, but nothing says "email", so a guest sees ticked boxes and thinks notifications are already on, then wonders why "Turn on" is there. And there is no button called "Download" on an album for a guest in the app. It's "Save to Photos", or "Download all" behind "...".
- **Fix:** Label the ticks "Email me when…" and the button "Also send these to this iPhone". Rewrite the copy line: "To keep everything, open each album and tap Save to Photos (or Download all on a computer). Need help? Contact us."

---

## My top 10 for the fix list

1. **ML-1** (+ M-2): the owner's complaint, live. The main thing a guest wants to do in the app opens a blank page on a storage address, for photos and videos alike. Severity 4, effort S, and the native bridge already exists.
2. **M-1 / V-1**: the venue Wi-Fi still locks a room out of sign-in and tells people with the right code they're wrong. Not testable from one phone, but nothing about the live app changes it.
3. **ML-2** (+ M-3 / V-9): once Save to Photos is wired up, it has to save the real files. Right now a guest "saves" a video trip and gets stills and gaps, with a success message.
4. **M-8 / M-9 / V-3 / V-4 / V-7**: two iPhone videos are already stuck on the very first real event [28]. Photographers will hit this every time, and they can't see why.
5. **V-6 / S-2**: the schedule field shows "09:00" [49]. Guests open an empty gallery after the organiser's announcement.
6. **ML-3**: iPhone video is HEVC, so "No preview" is the normal case [30]. Videos are half of what people want from a trip.
7. **M-7**: confirmed on the phone [39]-[41][64]. 2.5 screens of consent, a grey button with no reason, no "Not now".
8. **M-6 + I-8**: the code screen is still the most-used screen, and its recovery is still broken.
9. **V-8** (+ ML-4): "Processing" two days later next to "didn't finish" [28][30], and a blank Saved tab [42]. Status that lies teaches guests not to trust the app.
10. **ML-7**: the organiser sees, by name, every photo a guest opens, and the guest is told in one passive line. Cheap to say plainly, expensive if someone finds out the hard way.

Just outside: M-4 / V-2 (zips stop at 150), M-5 (Your photos viewer drops you in the album), ML-5 (the credit line), M-10 (rename the heart to Favourite; [32] makes the case).
