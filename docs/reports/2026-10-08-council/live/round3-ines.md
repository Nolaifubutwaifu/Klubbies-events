# Round 3: Ines (Accessibility and Visual Craft), live on an iPhone 11 Pro

**Verdict.** The token work holds up on glass: type, contrast and the 44pt buttons read well at 375pt. What fails is the frame around them: the iOS wrapper, the iOS form controls and positioned popovers.
The friend is right about video downloads. In the app, a single-item Download never reaches the native download code. It opens a blank Safari sheet on the raw storage host, and 20 seconds later that sheet offers "Open in…". Nothing reaches Photos.
Fix three things first, all cheap: the `download` attribute plus a native Save to Photos in the viewer (IL-1), the off-screen ⋯ menu (IL-4), and the "can't do" list that VoiceOver reads as "can do" (IL-6). Then do the wrapper's safe areas (IL-2) and the date fields (IL-3), because they show on every screen.

Method: I opened every screenshot in `shots/`, zoomed the ones with layout defects, and traced each defect to file:line. Contrast was computed with the WCAG 2.x formula against the hex values in `app/globals.css`. Screen positions are in points (pt): 384 screenshot px are roughly 375pt. Anything the walk could not show (keyboard, VoiceOver, scrubbing) is marked **verify**.

---

## Confirmed from the phone

- **I-10** Links told apart by colour alone: Terms and Privacy Policy on the landing have no underline [03]. The same goes for "contact form" in Terms [09], "Change who can get in" [53] and the app footer links [41][42].
- **I-13** Targets under the 44px house rule: the event switcher is about 36pt, next to the 44pt avatar [20]. The brand swatches are 32px [61].
- **I-15** Design drift, seen live:
  - The unfinished-uploads banner uses a 4px left border in the event accent [28] (`components/UnfinishedUploads.tsx:25`).
  - The photographer "can do" list hardcodes `#1f6b3a`/`#b42318` and sets text with opacity [52] (`GuestLinkForm.tsx:70,72`).
- **I-14 / C-4 / S-7** Drop zones on a phone: "Drop the guest list" [53] and "Drop your logo" [61]. Neither has visible "Choose file" wording on a touch device.
- **I-3** (visual half only): the More sheet [38] has no top title or close button; Close sits at the bottom. On a video it is headed "About this photo", and the native fullscreen, PiP and volume controls stay live above it. Focus behaviour is **verify** (needs VoiceOver).
- **I-12a** (partial): "Swipe for the next one" sits on the video stage [32]. Reduce Motion was not tested.
- **M-2 / M-3 / V-9**: confirmed, and worse in the app than we wrote. See "Not reproduced / wrong" and IL-1.
- **M-7** The face step is a hurdle: a long consent text, then a disabled grey "Find my photos" with no "Not now" [39][40][41].
- **M-10 / Saved page**: Saved opens on an empty "Favourites 0" panel [42] (see IL-11).
- **V-7 / V-8** False upload states: the same two .mov files show as "didn't finish" in the banner and as "Processing" in the grid [28][30] (see IL-10).
- **V-13** No `loading.tsx`: every organiser menu hop shows the old page for 2.5 to 3 seconds with no indicator [27]. The native progress bar can't help, because it watches `isLoading` (`WebViewController.swift:89-104`) and client-side navigations never set it.
- **S-6** Inflated or contradictory numbers: "Attendees joined 2" sits next to "Guests 1 of 50" [21][22].
- **S-13** "Upload" opens a New album form with the keyboard up, while "Or add to an existing album" is below the fold [48][49].
- **S-1** (Viktor's downgrade holds): a single-event organiser lands on the overview [20].

## Not reproduced / wrong

- **Consensus item 4 / M-2 wording, "Download saves to Files": wrong for the iPhone app.** A single photo or video download does not go to Files. It is redirected off-host and opens an in-app Safari sheet [34]-[37]. Only album zips (same host, `Content-Disposition: attachment`) reach the WKDownload code and the share sheet (`WebViewController.swift:242-249, 325-337`). "Files" is only true in mobile Safari.
- **M-3, the share-sheet loop: does not apply in the app.** `components/AlbumActions.tsx:78-93` uses the native `klubbiesSaveToPhotos` bridge, so the loop is a mobile-Safari-only problem. **V-9 still stands in the app, and more sharply.** For videos, the `display` variant signs `poster_path` (`app/api/media/sign/route.ts:30`):
  - The album's Save to Photos saves video stills, not videos.
  - The 10 of 13 videos with no poster are skipped silently.
- **I-12b, the `kb-splash` blank landing: not reproduced.** Splash and then landing came up normally [01]-[03]. The ~1s white frame [01] is the system launch screen, which is a colour only (`ios/Info.plist`, `UILaunchScreen`), not the race. Keep it at sev 1, as a hardening note.
- **Walk note [67], "content did not re-layout in landscape": not a rendering bug.** The app is portrait-locked (`project.pbxproj:195,229`, `INFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait`). Whether that lock is acceptable is a separate question (see IL-2c).
- **I-9** (caption grey on sand): neither confirmed nor refuted. The JPEG compression in [11]-[16] is too lossy to measure 4.43 against 4.5. The code finding stands.

---

## New findings

### IL-1 Downloading a video (or photo) in the app opens a blank Safari sheet, and nothing reaches Photos
- **Where:** [32] → [34] → [35] → [36] → [37]. Attendee or organiser in the viewer, tapping Download.
  - `app/(app)/e/[handle]/a/[albumId]/[mediaId]/Viewer.tsx:296-300`: `Action` renders a plain `<a href="/api/media/{id}/download">` (:81) with no `download` attribute.
  - `app/api/media/[id]/download/route.ts:31-37`: 303 redirect to a presigned R2 URL on `*.r2.cloudflarestorage.com`.
  - `ios/KlubbiesEvents/WebViewController.swift:224-239`: `shouldPerformDownload` is false, the redirect target is not an app host, so the request is cancelled and handed to `openOutside`, which presents an `SFSafariViewController` (:201-206). The WKDownload path (:325-337) is never reached.
- **Heuristic / severity / effort:** Nielsen 1 (visibility of status), 4 (platform conventions), 3 (user control). WCAG 4.1.3 Status Messages and 3.2.2 (unexpected context change on activation). **Sev 3** (the attendee's main job on a phone, with no visible path to success), effort **S** for the stopgap and **M** for the real fix.
- **Problem:** What the friend sees:
  - A white sheet slides over the dark viewer, titled with a random storage host. The blue bar crawls for about 20s on a 31 MB .mov [36].
  - Then a QuickTime icon and "Open in…" [37]. Nothing says a download is happening, nothing lands in Photos, and the only way out is Share › Save Video, which nothing on screen mentions.
  - A second tap repeats all of it.
  - For a screen reader, the first sheet is announced as an empty web page.
  - The tap is still logged as a download (`route.ts:36`), so Saved shows "Downloads 1" for a video the person never got [42].
- **Fix:**
  1. **Today (S):** add `download` to the viewer's Download anchor (`Viewer.tsx:81`, `<a href={href} download …>`).
     - WebKit then sets `shouldPerformDownload`, and `WebViewController.swift:225` returns `.download`, which follows the redirect into WKDownload and opens the share sheet with Save Video in it.
     - Belt and braces in Swift: in `decidePolicyFor action`, return `.download` for the storage hosts (the R2 account host and `*.supabase.co/storage`) instead of `openOutside`.
     - **Verify on device** that the WKDownload follows the cross-host 303.
  2. **Properly (M):** in the app, the viewer's button becomes **"Save to Photos"**.
     - Post the original to the existing bridge: `nativeSaveToPhotos()` with `/api/media/sign` `variant: "video"` for videos. "display" returns the poster, which is the same bug as V-9.
     - While saving, set `aria-busy` on the button, keep it focusable but ignore repeat taps, and show a `role="status"` line: "Saving video to Photos, 31 MB…", then "Saved to Photos" or the bridge's error.
     - In `PhotoSaver.swift:48-50`, fall back to the URL's extension when R2 answers `application/octet-stream`. Otherwise a .mov is renamed .jpg and Photos rejects it (**verify** R2's content type).
  3. In Swift, show WKDownload progress (`download.progress`) in the existing `progressBar` for zips. Today nothing is shown between the tap and the share sheet.
  4. Log the download only once it has been handed over: either a client beacon after the save succeeds, or keep the server log but call it "requested".

### IL-2 The wrapper frames every screen in paper bands; the dark viewer gets a white status bar and chin (plus the portrait lock)
- **Where:** [32][33][38] (viewer), [42][65] (tab bar), [28] (sticky header under the band).
  - `WebViewController.swift:68-71` pins the web view to `safeAreaLayoutGuide`, so the 44pt status bar band and the 34pt home-indicator band are the native `AppConfig.background` (#F7F7F5).
  - `app/layout.tsx:35-39` has no `viewportFit`, so inside the page `env(safe-area-inset-*)` is 0 and `MemberTabBar.tsx:73` falls back to 12px.
  - Orientation: `project.pbxproj:195,229`.
- **Heuristic / severity / effort:** Nielsen 8 (aesthetic) and 4. WCAG 1.3.4 Orientation (AA; applies to the app via WCAG2ICT). **Sev 2**, effort **M**.
- **Problem:**
  - The viewer is near-black (#14100f) and is framed by two paper bars at 17.6:1 against it: 78pt of an 812pt screen, about 10%. It reads like a web page inside a letterbox, not a photo app [32].
  - Under the white tab bar there is a second, off-white strip (1.07:1, visible as a seam) on every attendee screen [65].
  - The lock is portrait only, in a photo and video gallery. Landscape photos and videos can't be viewed larger by turning the phone, which is what everyone will try with a landscape video [67]. 1.3.4 allows a lock only when the orientation is essential, and it isn't here.
- **Fix:**
  - (a) Pin `webView` to `view.topAnchor`/`bottomAnchor`. Add `viewportFit: "cover"` to `viewport` in `app/layout.tsx`. Then pad:
    - app and auth headers: `pt-[env(safe-area-inset-top)]`
    - viewer top bar (`Viewer.tsx:185`): `pt-[max(14px,env(safe-area-inset-top))]`
    - viewer bottom bar (:282): `pb-[max(24px,env(safe-area-inset-bottom))]`
    - sticky album header (`page.tsx:198`): top inset as padding
    - left and right insets on the viewer, for landscape.
  - (b) Status bar text: observe `webView.themeColor` (iOS 15+), set `preferredStatusBarStyle` to light when the colour is dark, and give the viewer route `export const viewport = { themeColor: "#14100f" }`.
  - (c) Allow `.allButUpsideDown` at least while the viewer is open: a `supportedInterfaceOrientations` override toggled by a `klubbiesViewer` script message, or app-wide once (a) is in.
  - Cheap interim, if (a) has to wait: KVO `webView.themeColor` → `view.backgroundColor`. That kills the viewer's white bands for a few lines of Swift.

### IL-3 Date fields overflow their cards on iPhone, and an empty one is taller than its neighbours
- **Where:** [50] New album, [52] Photographers "Link expires", [59][60] Settings "First day" and "Last day". Organiser forms.
  - Date inputs: `upload/NewAlbumPanel.tsx:30`, `photographers/GuestLinkForm.tsx:62`, `settings/SettingsForm.tsx:44,48`, `settings/AccessForm.tsx:78`, `admin/new/CreateEventForm.tsx:94,98`, `components/AlbumEditPanel.tsx:118`.
  - Styles: `app/globals.css:485-506`.
- **Heuristic / severity / effort:** Nielsen 4 and 8; WCAG 1.4.10 Reflow (content wider than the 375pt viewport). **Sev 2**, effort **S**.
- **Problem:**
  - iOS WebKit draws `type="date"` as a native control with its own intrinsic minimum width and height, so `width: 100%` is ignored. The field runs about 6pt past the card's right edge while the text fields above it line up [50][60].
  - The empty "Last day" field is visibly taller than the filled one [60].
  - The one datetime field that looks right (`NewAlbumPanel.tsx:69`, [49]) only does so because of `!w-auto`.
- **Fix:** One rule in `globals.css`, inside the same components layer:
  ```css
  input[type="date"], input[type="datetime-local"], input[type="time"] {
    -webkit-appearance: none; appearance: none;
    display: block; min-width: 0; max-width: 100%; height: 44px;
  }
  input::-webkit-date-and-time-value { text-align: left; margin: 0; }
  ```
  Then re-check all eight fields at 375pt.

### IL-4 The album ⋯ menu opens off the left edge of the screen
- **Where:** [66], album page, organiser and attendee.
  - `components/MoreMenu.tsx:91` (`align="end"` → `right-0`).
  - `app/globals.css:1054` (`min-width: 232px`).
  - `app/(app)/e/[handle]/a/[albumId]/page.tsx:199,210`: a `flex-wrap` header with a `min-w-[220px]` title block pushes the actions to a second row at the left.
- **Heuristic / severity / effort:** Nielsen 4 and 8. WCAG 1.4.10 Reflow (content lost without two-dimensional scrolling) and 2.4.11 (a focused item is entirely off-screen). **Sev 3**, effort **S**.
- **Problem:**
  - On a phone the ⋯ button's right edge is about 170pt from the left, so a right-aligned 232pt menu starts about 60pt off-screen.
  - "Edit details and cover", "Save to Photos", "Download all" and "Unpublish, back to draft" are cut to "tails and cover", "o Photos", "oad all" and "lish, back to draft".
  - These are the attendee's two save actions and the organiser's destructive one. The danger item can't even be read before tapping it.
- **Fix:**
  - In `MoreMenu`, measure on open (`useLayoutEffect`, `getBoundingClientRect`). Flip to `left-0` when the left edge is under 8px, flip to `right-0` when the right edge passes `innerWidth - 8`, and clamp with `max-width: calc(100vw - 16px)`.
  - Better on `(pointer: coarse) and (max-width: 640px)`: render the menu as a bottom sheet built on the fixed `Dialog` (my round 2 condition S-G). That also fixes I-14's `role="menu"` misuse.
  - Audit every `MoreMenu` caller at 375pt.

### IL-5 The sticky album header takes a quarter of the phone and can hide focus
- **Where:** [29][30][31]; `app/(app)/e/[handle]/a/[albumId]/page.tsx:198-261`. Attendee and organiser, album grid.
- **Heuristic / severity / effort:** WCAG **2.4.11 Focus Not Obscured (Minimum)**, 1.4.10 and 1.4.4 at larger text; Nielsen 8. **Sev 2**, effort **M**.
- **Problem:**
  - Three wrapped rows stay pinned while the grid scrolls: title and chip, the meta line with "Private to attendees", and Add photos with ⋯. That is about 185pt of a 734pt web view, 25%, so only two and a half rows of photos are visible [29].
  - There is no `scroll-padding-top`. When keyboard focus or the VoiceOver cursor moves up the grid, tiles scroll under a 94%-opaque bar.
  - With iOS Larger Text the header alone would fill most of the screen.
- **Fix:**
  - Below 640px, make only one 56pt row sticky: back, truncated title, ⋯. Move the meta line, the chip and Add photos out of the sticky `div` so they scroll away.
  - Publish the sticky height as `--kb-sticky-top` and set `html { scroll-padding-top: var(--kb-sticky-top) }`.
  - Optional: collapse the row further on scroll down and restore it on scroll up.

### IL-6 "What the link can do" tells screen readers the link can see everything
- **Where:** [52]; `app/(app)/admin/[handle]/photographers/GuestLinkForm.tsx:7-11` (data), :15 (the ✕ icon is `aria-hidden`), :66-75 (strikethrough by inline style, `opacity: 0.85`). Organiser making a photographer link.
- **Heuristic / severity / effort:** WCAG **1.3.1 Info and Relationships**, 1.4.1 Use of Color; Nielsen 2 and 4. **Sev 3**, effort **S**.
- **Problem:**
  - The only things that mark the two "can't" rows are a hidden icon, red and a `line-through`, none of which reach assistive tech. VoiceOver reads "What the link can do: Upload full resolution photos…, See other albums, attendees or anything else in the event, Delete or download what's already there."
  - That is the exact opposite of the truth, on the screen where an organiser decides whether to trust a stranger with a link.
  - Sighted readers get a red ✕ plus strikethrough, a double negative that reads as "removed feature". Struck-through text is also harder to read.
- **Fix:** Two short lists with real headings, "It can" (one item) and "It can't" (two items). Plain, unstruck text. Icons stay decorative, with colours from `--kb-ok` and the new `--kb-danger` token. If space is tight, visually hidden "Can:" and "Can't:" prefixes inside each `<li>` also fix it.

### IL-7 Form controls set below 16px make iOS zoom into the page on focus
- **Where:**
  - Nine controls where `text-[14px]` (a utility, which beats `.input`'s 16px in `@layer components`, `globals.css:502`) shrinks the font: `attendees/AddMemberForm.tsx:18-20`, `attendees/MemberTable.tsx:131,148,235`, `attendees/RosterImport.tsx:182`, `settings/SettingsForm.tsx:103` (hex colour), `upload/NewAlbumPanel.tsx:69` (schedule).
  - Seen in [53][54][61][49]. The zoom itself was not exercised: Device Hub showed the hardware-keyboard bar. **Verify** by tapping "Full name" under "Add one person".
- **Heuristic / severity / effort:** WCAG 1.4.10 Reflow (a zoomed page scrolls sideways), 1.4.4; Nielsen 4. **Sev 2**, effort **S**.
- **Problem:**
  - WebKit zooms the viewport into any focused field under 16px and leaves it zoomed after blur. The organiser then pans sideways around a 760px table (IL-8) inside a zoomed page.
  - Same screen, layout drift:
    - The "Add" button is `justify-start` (`AddMemberForm.tsx:26`), so its label sits left, unlike every other button in the product [54].
    - The search field stops at `max-w-[280px]` while the chips above span the card [54].
- **Fix:**
  - Drop `text-[14px]` from every `input`, `select` and `textarea`. Add a lint rule (`className` containing `input` and `text-[1[0-5]px]`), or a guard: `@media (pointer: coarse) { .input, .soft-input { font-size: 16px !important } }`.
  - Make "Add" centred like `.btn`.
  - Search: `w-full sm:max-w-[280px]`.

### IL-8 The attendee table is cut off on a phone and its scroller can't be reached by keyboard
- **Where:** [54][55]; `app/(app)/admin/[handle]/attendees/MemberTable.tsx:187-205`: `overflow-x-auto` around `min-w-[760px]`, an empty `<th />` at :205, and no checkbox on the organiser row (:210-220). Organiser, Attendees.
- **Heuristic / severity / effort:** WCAG 2.1.1 Keyboard (the scroll region), 1.3.1 (unnamed column header), 1.4.10 (tables are exempt from reflow, but must still be operable); Nielsen 8. **Sev 2**, effort **M**.
- **Problem:**
  - At 375pt the email is cut mid-address ("maximilianumschaden@gm") and Role, Status, Selfie, Added and the actions are off-screen. Nothing signals that the table scrolls.
  - Safari does not make scroll containers focusable, so a keyboard user can't reach those columns.
  - The organiser row has no checkbox, which leaves the first column ragged [55].
- **Fix:**
  - Below `sm`, render each member as a row card: name, email with `overflow-wrap: anywhere`, role select, status chip and ⋯, with the checkbox aligned or the row's selection shown as "You".
  - Keep the table at `sm` and up, adding `tabIndex={0} role="region" aria-label="Attendees, scrolls sideways"` and a right-edge fade. Name the last column ("Actions", visually hidden).

### IL-9 The video viewer: photo wording, a low-contrast hint, and a swipe that probably fights the scrubber
- **Where:** [30][31][32][33][38]; `Viewer.tsx`:
  - :199 "Photo: {name}"
  - :235 and :242 "Previous photo" / "Next photo"
  - :362 "About this photo"
  - :207-209 and :163-175 (touch swipe on the whole stage, 50px threshold)
  - :248-254 (hint)
  - grid tiles: `components/AlbumGrid.tsx:28-30`
  - posters made client side: `lib/media/prepare.ts:114-132`
- **Heuristic / severity / effort:** Nielsen 4; WCAG 1.4.3 (hint), 2.5.1 and 2.5.2 (gesture conflict), 4.1.2 (names). **Sev 2**, effort **S** to **M**.
- **Problem:**
  - On a video, the header credits a "Photo", the sheet says "About this photo" and the arrows say "photo". VoiceOver's alt text says "Video", so the screen and the reader disagree.
  - 10 of 13 videos have no poster. The stage is black with a lone play button [32], and the grid is a wall of grey "No preview" tiles with no duration [30][31]. Upload-time poster extraction fails when the uploading browser can't decode iPhone HEVC .mov files.
  - The hint is `text-white/80` on 55% near-black over the photo. Over Mt Barney's sky that measures **3.31:1** at 14px, which fails 1.4.3. While a video plays, the hint also sits on the native scrubber [33].
  - The swipe handler wraps the `<video>`. Dragging the native scrubber more than 50px will likely send `router.replace` to the next item (**verify** by scrubbing).
  - The native video controls stay interactive above the More sheet [38].
- **Fix:**
  - Kind-aware strings: "Video by", "About this video", "Previous item" / "Next item".
  - In `onTouchStart`, ignore touches whose target is the `<video>` (`if (e.target instanceof HTMLVideoElement) return`) or that start while it is playing.
  - Hint: `bg-[rgba(20,16,15,0.82)] text-white` (at least 7:1 over white), placed above the video controls and hidden while a video plays.
  - When a sheet opens, pause the video and set `inert` on the stage.
  - For tiles with no poster: `<video muted playsinline preload="metadata" src="{url}#t=0.5">` as the tile image. Long term, generate the poster server side (Viktor's lane).

### IL-10 One file, two statuses: "didn't finish" in the banner, "Processing" in the grid
- **Where:** [28][30]; `components/UnfinishedUploads.tsx:25` (left border in the event accent), :35-49 (two identical "Remove it" buttons), `components/AlbumGrid.tsx:47-50` (anything not ready is labelled "Processing" unless it failed). Organiser, album view.
- **Heuristic / severity / effort:** Nielsen 1 and 4; WCAG 2.4.6 Headings and Labels (identical button names), 1.3.1. **Sev 2**, effort **S**.
- **Problem:**
  - IMG_9382.mov and IMG_9390.mov are "2 files didn't finish uploading" above the grid, and in the grid the same tiles say "Processing" with a "Video" chip.
  - The organiser can't tell whether to wait or act. The overview's "2 unfinished" and "Fix" [20][22] pick a third word.
  - VoiceOver hears "Remove it, button" twice with no file.
  - The failure banner is drawn in the event's brand colour with a left rule, so on a green event it reads as success.
- **Fix:**
  - One status vocabulary from one source: rows that `UnfinishedUploads` lists show a "Didn't finish" chip on the tile, in a new `--kb-danger` token, not "Processing".
  - Name the buttons: `aria-label={\`Remove ${filename}\`}` (or put the filename in the visible text).
  - Banner on the warn surface (`--kb-warn-tint`, 5.6:1 text) with no left border, matching the "No left border" rule.
  - The same word everywhere ("Didn't finish"), including the overview's Needs you card.

### IL-11 Saved opens on an empty tab
- **Where:** [42]; `app/(app)/e/[handle]/saved/SavedTabs.tsx:44` (always starts on Favourites), :74-90 (no empty state per tab), :62-67 (`aria-pressed` toggles acting as tabs). The page-level empty state (`saved/page.tsx:74`) only covers "both empty". Attendee, Saved tab.
- **Heuristic / severity / effort:** Nielsen 1 and 6; WCAG 1.3.1 and 4.1.2 (tab semantics). **Sev 2**, effort **S**.
- **Problem:** With 0 favourites and 1 download, the page shows "Favourites 0" selected and then nothing at all: no message, no prompt. It looks broken.
- **Fix:**
  - Start on the first non-empty tab.
  - Give each tab its own empty state, e.g. "No favourites yet. Tap the heart on any photo to keep it here."
  - Either a real `tablist`/`tab`/`tabpanel` with `aria-controls`, or keep the buttons and label the panel with the selected button's name.

### IL-12 Album order can only be changed by dragging (or arrow keys), so a phone has no way to reorder
- **Where:** [27]; `app/(app)/admin/[handle]/albums/AlbumManager.tsx:200-228` (HTML5 `draggable` grip plus ArrowUp/ArrowDown only), :163 and `albums/page.tsx:55` ("Drag to reorder" said twice). Organiser, Albums.
- **Heuristic / severity / effort:** WCAG **2.5.7 Dragging Movements** (AA, new in 2.2: needs a single-pointer alternative; keyboard doesn't count); Nielsen 4 and 8. **Sev 2**, effort **S**.
- **Problem:**
  - On a touchscreen the only control is a 32pt grip that needs a drag. HTML5 drag-and-drop in a WKWebView on iPhone is unreliable at best (**verify** with two albums).
  - The page says "Drag to reorder" twice, even with a single album, where there is nothing to reorder.
- **Fix:**
  - Add "Move up" and "Move down" to each album's ⋯ menu (reusing `nudge`), or ▲▼ icon buttons on `pointer: coarse`, named "Move {album} up".
  - Say "Drag to reorder" once, and only when there are 2 or more albums.

### IL-13 Small craft batch (sev 1 each, all S)
- **Inline link breaks its sentence** [46]: `.kb-link` is `inline-flex; min-height: 44px` (`globals.css:421-434`), used mid-sentence at `app/(app)/account/page.tsx:136-139`. "For a copy of everything shared with you, use / Download in each album, or contact us." splits with a 44px line gap. Add a `.kb-link-inline` (`display: inline; min-height: 0`). Inline links are exempt from 2.5.8.
- **Focus ring on the logo when the menu opens by touch** [10]: `components/site/SiteNav.tsx:32` focuses the first link, which is the brand link, and WebKit shows `:focus-visible` for scripted focus. Focus the Close button instead (the useful first stop), or the sheet itself with `tabIndex={-1}`.
- **"How it works" anchor lands with its eyebrow cut off** [11]: the `id` is on the `<h2>` (`components/site/parts.tsx:165`), not the wrapper. Move it to the wrapper `div` and add `scroll-margin-top: 24px`.
- **Marketing chrome inside the app** [09]: Terms from the app shows the site's "Sign in" and hamburger, so a tap can wander into the marketing site with no back control. Give in-app legal links `?view=browser`, as "How it works" already has (`app/(auth)/signin/AppLanding.tsx:50`), so they open in the Safari sheet.
- **Event link wraps mid-word** [24]: "events.klubbies.app/e/ras / mus_trip". Insert `<wbr>` after each `/` and use `overflow-wrap: anywhere` instead of breaking letters.

---

## My top 10 for the fix list

1. **M-1 / V-1**, venue Wi-Fi locks guests out of sign-in. Still the only sev 4: nobody gets in on the night.
2. **IL-1 (+ M-2, M-3, V-9)**, video and photo downloads leave the app for a blank Safari sheet. The owner's live complaint, and the attendee's main job. A one-attribute stopgap ships today.
3. **V-2**, the deletion email's zip stops at 150 files. Permanent loss. Nothing on the phone changes that.
4. **IL-4**, the ⋯ menu opens off-screen and hides Save to Photos, Download all and Unpublish on every phone. S effort, every album.
5. **M-8 / M-9 / V-3 / V-4 + IL-10**, upload failures hidden and named three different ways. The live event already has two stuck .movs reported as "Processing".
6. **I-1**, the shared Dialog steals focus. Pasting a guest list is impossible. A one-line root fix.
7. **V-6 / S-2**, scheduled albums go live 10 hours late. The schedule field in [49] is exactly where it starts.
8. **IL-6**, the "can't do" list is read aloud as "can do". It misinforms the organiser about privacy scope. S.
9. **I-2 + I-3 (+ IL-9)**, viewer focus behind the lightbox, sheets that aren't dialogs, and photo wording on videos. The privacy flow has to work without a mouse.
10. **IL-2 + IL-3**, the wrapper's paper bands and overflowing date fields are on every screen. They make a native app look like a web page in a frame. Cheap interim fixes exist for both.

Just outside: IL-5 (sticky header 25% of the screen), IL-7 (iOS focus zoom), IL-12 (no tap way to reorder albums, 2.5.7), I-4 / I-5 (focus ring on dark surfaces), S-1.
