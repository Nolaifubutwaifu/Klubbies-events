# Round 4: Maya, Attendee Advocate

I read Viktor, Ines and Sam in full and checked the claims I argue with against the code, `docs/decisions.md` and the working tree on `claude/council-live-fixes`. The working tree already has the in-progress download fix: `?as=json` on the download route, `variant: "original"` on `/api/media/sign`, a `saveToPhotos()` in `Viewer.tsx` and `socialInAppBrowser()` in `lib/native-app.ts`. Where that fix changes a finding, I say so below.

My bias, stated plainly: I rank by what the guest holding the phone sees. Organiser polish and billing integrity matter, but only after the guest gets their photos.

---

## Challenges

### C-1 VL-6 (video allowance not rechecked at finalize): REJECT as a bug, DOWNGRADE to 1 as a note
- `docs/decisions.md` #38 rules on this directly. A video counts as one minute until its length is known, "so a long video can take an event slightly past its allowance. That is accepted rather than failing a finished upload."
- Viktor's main fix, a BEFORE UPDATE trigger on finalize, would undo that decision. The person who pays for it is a photographer or guest whose upload already finished and then gets refused. That's the worst moment to say no.
- "A modified client can report `durationSeconds: 1`" is true, but the attacker is the organiser cheating their own event out of a A$49 upgrade. That's not a guest risk and not worth a trigger now.
- Keep one part: write the server-side duration once VL-5's ffprobe backfill exists. That happens for free, with no new check.

### C-2 IL-6 ("can't do" list read as "can do"): DOWNGRADE to 2
- Verified: `GuestLinkForm.tsx:7-11, 70-72`. The ✕ is `aria-hidden`, and the strikethrough is an inline style, so VoiceOver reads all three rows as things the link can do. Ines is right about the defect.
- But the error points the safe way. A blind organiser is told the link is *more* powerful than it is, so the worst case is they don't hand out a photographer link. No privacy leaks. Nobody's photos get exposed. Severity 3 sits it next to failures where guests lose their videos, and it doesn't belong there.
- Ship it anyway, because it's S. Two lists, "It can" and "It can't", in plain text. That reads better for sighted organisers too: strikethrough says "feature removed", not "not allowed".

### C-3 IL-13, the "marketing chrome inside the app" sub-fix: REJECT that fix; SL-6 is the right one
- Ines wants in-app legal links to carry `?view=browser`, so they open in the Safari sheet. The Safari sheet shows the full marketing site, with the Pricing nav item and "paid sizes from A$49", inside our app. That's the App Review problem Sam found in SL-6, made worse.
- Verified: `components/LegalPage.tsx:59` renders `<SiteNav current="privacy" />` and `:98` `<SiteFooter />` with no `inApp`. `SiteNav.tsx:22, 149` already drops Pricing and the price line when `inApp` is set. Decision #64 says "nothing about prices inside the iPhone app", and the legal pages are the gap.
- Do SL-6: pass `inApp` from `isNativeAppRequest()` into both components. Legal pages stay in the web view with app chrome, and a guest reading Privacy before joining never wanders into a sales page.

### C-4 SL-1 "Ask the owner which device the friend used" and the H.264 MP4 branch: REJECT, already answered
- Viktor's `access_events` trace answers Sam's question. The friend was on iPhone, in Instagram's in-app browser (`Instagram 448.0.0.39.66 … iOS 26_6_2`). They tapped download at 23:14:18 and were back on the same video 14 s later.
- There's no Android or Windows evidence, so the M-sized transcode isn't justified. Park it until someone reports a .mov that won't play.
- The in-progress `socialInAppBrowser()` covers the friend's actual path. Sam's SL-1 web fix covers our own app. Together that's the complaint closed.

### C-5 IL-9 sub-fix "use `<video preload="metadata" src="…#t=0.5">` as the tile image for posterless videos": REJECT for the grid; keep it for the viewer only
- On this album that's 10 live `<video>` elements in one grid, each needing an hour-long R2 signed URL and a range request into a 30 to 70 MB HEVC file. On a guest's 4G at a venue that costs data and memory, and WKWebView can drop the page under memory pressure, which reloads it (`WebViewController.swift`, process-terminated reload).
- Viktor's version is the one to ship: `#t=0.1` on the single `<video>` in the viewer (VL-5 fix 3), which paints a first frame instead of a black stage. Grid tiles get "Tap to play" plus the duration (ML-3), and real posters come from the server backfill.

### C-6 IL-12 (albums can only be reordered by dragging): DOWNGRADE to 1
- Real 2.5.7 failure, but only organisers hit it, and only those with two or more albums who reorder from a phone. The live event has one album. Arrow-key reordering exists (`AlbumManager.tsx:200-228`).
- Fix the copy now ("Drag to reorder" once, only with 2+ albums). Put "Move up / Move down" in the ⋯ menu *after* IL-4 is fixed. Today that menu opens off-screen, so the alternative would be just as unusable.

### C-7 SL-8 (Activity card logs every view): the fix is incomplete; merge with ML-7 and keep it at 2
- The logging is intended: decision #10 lets admins read `access_events`, and `lib/copy/site.ts:141` sells "You can see who opened what". I'm not asking to stop it.
- Sam's fix only tidies the organiser's view. The guest is still told in one passive line at the bottom of the More sheet ("Views and downloads are logged.", `Viewer.tsx`). Grouping hides the problem from the organiser. It doesn't tell the guest. Merged fix below (D-6).

---

## Endorsements

- **VL-1 / IL-1 / SL-1 (download opens a blank Safari sheet).** All four of us traced the same lines. The in-progress fix matches the consensus: `saveToPhotos()` in the viewer calls `download?as=json`, then the `klubbiesSaveToPhotos` bridge. Refinements to check before it ships:
  1. **Downloads are still logged on the tap.** `route.ts` calls `logAccess(... "download")` before the `?as=json` branch. So a failed save still counts on the organiser's stat (VL-11/SL-11) **and** shows in the guest's own Saved › Downloads tab, which is built from `access_events` (`saved/page.tsx:22-40`). Ines spotted that the guest sees "Downloads 1" for a video they never got. Log only after the bridge replies `saved: 1` (a small POST), or log as "requested" and filter Saved on confirmed saves.
  2. **The status line is static for 20 s.** "Saving video to Photos (31 MB)…" is honest, but it needs a spinner, and the button must stay disabled (it is: `if (saving) return`). The 4 s auto-clear must not fire mid-save (it doesn't: `[message, saving]`). Good.
  3. **Wrapper safety net.** Viktor's trigger, "when the previous main-frame request was `/api/media/*/download`", isn't something `decidePolicyFor` can see cleanly. Use the host rule (`*.r2.cloudflarestorage.com`, Supabase `/storage/v1/object/sign/`) → `.download`, as Ines, Sam and I proposed. That needs the next app build.
  4. Ines's `download` attribute stopgap is now redundant in the app. It's harmless in Safari, so add it to the anchor anyway for the non-app path.
- **VL-2 (Instagram in-app browser).** `socialInAppBrowser()` is in the working tree. Copy refinement: tell them *before* the tap, on the event home, not after a dead tap. "You're in Instagram's browser, which can't save photos. Tap ⋯ › Open in external browser." Offer "get the app" only once it's live on the App Store. `docs/app-store/` has a listing, so check the status before promising it.
- **VL-3 (50 MB Storage limit vs 500 MB promise).** Confirmed by decision #16 in `docs/klubbies-decisions.md` ("Uploads over 50 MB per file are rejected by Storage on the free plan"), which contradicts decision #44 ("Videos over 500 MB are refused"). From my side: guests never see the longest clips, which are usually the ones that matter (the jump, the speech). Severity 4 is right. The plan setting is the fix today.
- **VL-4 + SL-3 (failed uploads never reported).** Decision #38 says "Photos count while processing, so parallel uploads can't overshoot". Sam's age cutoff (`STUCK_AFTER_MS`) keeps that and drops dead rows, so they don't conflict. Viktor's `finalize { failed: true }` from the catch is the root fix. Guests stop seeing "still cooking, usually 2 to 5 minutes" for two weeks.
- **ML-2 / VL-7 (album Save to Photos saves stills).** The working tree switches the native path to `variant: "original"`, and AlbumActions now reports "Saved N of M". Two things to check:
  - HEIC and other non-JPEG/PNG photos fall back to `display_path`, the 2000 px WebP (`sign/route.ts`, `savesAsOriginal`). Every iPhone photo is HEIC, so most guest photos still save as downscaled WebP. `PhotoSaver.swift` maps any unknown image MIME to `.jpg`, which is why. Next app build: add `heic`/`heif` to the extension map, then drop the fallback.
  - Test on device that Photos accepts a `.webp` resource through `addResource(with: .photo)` at all.
  - The failure line "The rest couldn't be saved; try Download all on a computer" should name the files when it's 1 or 2.
- **IL-4 / SL-12 (⋯ menu off-screen).** It hides the guest's two save actions. Do the flip-and-clamp in `MoreMenu` (fixes every caller), not just `align="start"` at one site.
- **IL-2 / VL-10 / ML-8 (paper bands round the viewer).** Agreed. On orientation, unlock landscape **in the viewer only** (IL-2c via a script message). Turning the phone for a landscape video is the most natural thing a guest does. An app-wide unlock means re-checking every organiser form at 812×375 for little gain.
- **IL-5 (sticky header uses 25% of the screen).** Guest-facing on every album. Agree with one sticky row below 640px.
- **VL-9 (pull-to-refresh kills uploads).** Verified at `WebViewController.swift:54-56, 191-194`, on every page. Add the viewer and every sheet to the "refresh off" list. Pulling down to dismiss a photo is a reflex from the Photos app.
- **SL-2 (short clips cost a full minute).** From the guest side this matters more than it looks. An organiser near the cap will remove guests' short clips or close uploads to stay on Free. It's a pricing change, though (FAQ and pricing copy, decision #65), so it needs Max's yes, not just a migration.
- **SL-7 ("The Max team")**, **SL-10 (post-event overview)**, **IL-3 (date fields)**, **IL-10/IL-11**: confirmed in the shots I opened; no changes to the fixes.

---

## Duplicates / merges

| Merged title | IDs |
|---|---|
| **D-1 In the app, Download opens a blank Safari sheet on a storage URL; nothing reaches Photos** | ML-1 = VL-1 = IL-1 = SL-1 (+ M-2). Fix in progress. |
| **D-2 Social in-app browsers (Instagram) silently fail downloads: the friend's actual case** | VL-2 (sub-case of the owner's complaint). Fix in progress. |
| **D-3 Album Save to Photos saves stills, skips videos, downscales photos** | ML-2 = VL-7 = V-9 (+ M-3 for Safari). Fix in progress; HEIC caveat. |
| **D-4 Failed uploads: hidden reason, "Processing" forever, counted against the cap, three different words** | VL-4 = SL-3 = IL-10 = V-7 = V-8 (+ V-3 reason, M-8/M-9 guest side) |
| **D-5 Videos over 50 MB never upload** | VL-3 (root cause behind D-4's two live files) |
| **D-6 Who-opened-what: tell guests plainly, show organisers summaries** | ML-7 = SL-8 |
| **D-7 iPhone videos have no poster, no duration, black stage** | ML-3 = VL-5 = IL-9 (poster half) |
| **D-8 Videos called photos** | ML-6 = IL-9 (copy half) = VL-12 (copy item) |
| **D-9 The wrapper's paper bands, and landscape in the viewer** | ML-8 = VL-10 = IL-2 |
| **D-10 Downloads count taps, not files**, on the organiser stat and the guest's own Saved tab | VL-11 = SL-11 (+ my ML-1 point 6) |
| **D-11 Saved opens on an empty tab** | ML-4 = IL-11 (+ M-10 naming) |
| **D-12 Album ⋯ menu off-screen** | IL-4 = SL-12 |
| **D-13 Prices and marketing chrome inside the app via legal pages** | SL-6 = IL-13 (marketing chrome item), with the SL-6 fix (see C-3) |
| **D-14 Overview numbers disagree** | SL-4 = S-6 |
| **D-15 "Photos by Klubbies Events" vs the brand promise** | ML-5 = S-14 |
| **D-16 Desktop "Drop" copy on phone setup screens** | SL-9 = I-14 / S-7 |

---

## My top 10

UX impact on guests first, then bugs, then the rest. "In progress" means a commit or the working tree touches it. It still ranks because nobody has seen it work on the phone yet.

1. **D-1 + D-2, the owner's complaint** (ML-1/VL-1/IL-1/SL-1, VL-2). In progress. Verify on device with a 31 MB .mov, a HEIC and a JPEG, on Wi-Fi and 4G, and in Instagram, and move the download log to after the save.
2. **D-5 VL-3, videos over 50 MB never upload.** The longest, best clips are the ones guests never see. A plan setting today.
3. **D-3, album Save to Photos with real files.** In progress. Videos now save as videos. iPhone HEIC photos still save as 2000 px WebP until the next app build.
4. **D-4, failed uploads.** Guests are told "usually 2 to 5 minutes" for two weeks. The organiser can't see why. 20 units of the Free cap are spent on nothing.
5. **D-12 IL-4, ⋯ menu off-screen.** It hides Save to Photos and Download all on every phone. S.
6. **M-7, face consent wall.** 2.5 screens of text, a grey button with no reason, no "Not now" [39]-[41][64].
7. **D-13 SL-6, prices on the in-app legal pages.** If App Review rejects the build, no guest gets the app at all. Two props.
8. **D-7, posterless videos.** Ten grey tiles with no length. `#t=0.1` in the viewer today, server posters next.
9. **D-6, who-opened-what disclosure.** One plain sentence where guests join, and summaries for the organiser. Cheap now, expensive once someone finds out.
10. **D-9, paper bands and viewer landscape.** The photo moment looks like a web page in a frame, and a landscape video can't go full width.

Just outside: D-11 (blank Saved tab), IL-5 (sticky header), D-8 (video wording), SL-2 (short-clip pricing, needs Max), VL-9 (pull-to-refresh, extended to the viewer), D-10.
Already shipped on this branch, verify only: M-1/V-1 and M-6/I-8 (`697d093`), V-6/S-2 and I-1 (`4982d35`), V-2/M-4/V-11 and V-12 (`b52d044`). M-1/V-1 would be my #1 if those commits hadn't landed. Test many joins from one IP before the next event.
