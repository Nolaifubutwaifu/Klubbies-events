# Live walk log, 8 Oct 2026, iPhone 11 Pro via Device Hub

Observations only; interpretation is the council's job. Screenshot names in brackets.

## Signed out
- Cold start: ~1s plain white screen [01], then the K splash [02], then the landing ~3s later [03].
- Landing: "Sign in with email", "Scan the event's QR code", "Create an event", "How it works" [03].
- Sign in: name + email, "Email me a code", "Use a password instead" [04]. Tapping Full name: iOS autofill chip
  "Maximilian Umschaden" overlaps the help text under the field [05]. While Device Hub is attached iOS shows the
  hardware-keyboard bar instead of the on-screen keyboard (known Device Hub artefact, not an app bug).
- Password mode: info box at the bottom is cut off until you scroll; content scrolls under the status bar with no
  header [06][07].
- Create an event step 1 [08]: header link says "Sign in", no back.
- Terms [09]: marketing chrome (hamburger) inside the app. Menu uses the serif display face; focus ring drawn on
  the logo when the menu opens [10]. Menu footer: "Free for up to 50 guests, paid sizes from A$49 per event".
- "How it works" lands mid page with the heading clipped under the top edge [11]. Rest of the marketing page
  [12]-[17]: footer has no Pricing link although the menu does.

## Signed in as organiser (Rasmus trip)
- Opening the app lands on the organiser overview [20]. Stats: "Photos and videos 38, 2 unfinished",
  "Attendees joined 2", "Found their photos 0", "Downloads 1" [21]. Usage card: "Guests 1 of 50" while the
  stat above says 2 attendees joined; "Photos 175 of 200, each started minute of video counts as 10" for 25
  photos + 13 short videos [22]. "Needs you: 2 uploads didn't finish ... Fix" [22][23]. Activity:
  "Rasmus Klaerke viewed IMG_9376.mov" etc [24].
- Mid-scroll the phone view flipped to landscape once [67]; the web content did not re-layout (stayed portrait,
  rotated) until the device was rotated back. Probably the physical phone moving; worth checking whether the
  wrapper is portrait-locked.
- Organiser Menu dropdown [26]: Overview, Albums, Upload, Photographers, Attendees, Invite and share, Settings,
  Plan, Activity. No Removals entry visible.
- Each menu navigation took 2.5-3s with the old page still shown and no progress indicator [27].
- Albums page [27]: "Drag to reorder" said twice (lead + card).
- Tapping the album opens the attendee album view with an "Organise" button [28]. Banner "2 files didn't finish
  uploading": IMG_9382.mov and IMG_9390.mov, "started 6 Oct, 7:04 pm", each with "Remove it", plus "Upload
  again". Those 2 stuck files also appear in the grid as "Processing" tiles [30].
- Album grid: the album header sticks while the grid scrolls, leaving a strip of grid visible above the sticky
  header under the status bar [29]. Duplicate-looking photos (data).
- Videos: of 13 videos only 3 show a poster frame with a duration (0:04, 0:09, 0:08); the rest are grey "No
  preview" tiles with a "Video" chip [30][31]. Grid footer says "Photos by Klubbies Events" although the album
  header says "photos by Maximilian Umschaden" [31].
- Video viewer [32]: header "36 of 38 · Photo: Maximilian Umschaden" (it's a video), black stage with only a
  play button (no poster), filmstrip, Save / Download / More. A white band shows below the dark viewer at the
  bottom of the screen; the status bar area is white above the dark viewer.
- Play works after a short load [33].
- DOWNLOAD A VIDEO (the owner's friend's complaint): tapping Download slides in an in-app Safari sheet
  (SFSafariViewController style, X button top left, share/refresh/compass toolbar) pointed at the raw storage
  URL "...r2.cloudflarestorage.com" [34][35]. It stays blank white with a slow blue progress bar for ~20s [36],
  then shows a QuickTime icon, "IMG_9362.mov, QuickTime movie - 31 MB" and an "Open in..." link [37]. Nothing
  says what is happening while it loads, nothing is saved to Photos, and the user has to find Share > Save
  Video themselves. A second tap repeats the same.
- More sheet on a video [38]: "Copy link", "Request removal", "About this photo" (for a video), Taken: Unknown,
  File 31 MB.
- Your photos [39]-[41]: long consent text, selfie circle, "Take a selfie", "Choose from your photos", consent
  checkbox, disabled grey "Find my photos". No "not now".
- Saved [42]: "Favourites 0" selected and the area below is completely empty (no empty-state message);
  "Downloads 1" tab.
- You tab [43]-[46]: header changes from the event header to the plain Klubbies header. Notifications card:
  "Turn on" button while both notification checkboxes already show ticked. Copy split oddly across two lines:
  "For a copy of everything shared with you, use / Download in each album, or contact us." No sign-out on the
  page; it's in the avatar menu [47] (Your profile, Your events, Create an event, Sign out, Sign out of all
  devices).
- Upload (menu) [48]-[50]: opens a "New album" form with the album-name field auto-focused (keyboard comes up)
  even though one album exists; "Or add to an existing album" is below the fold [49]. The Date input
  ("05.10.2026") is wider than the other fields and overflows the card's right edge [50]. Schedule field shows
  "09.10.2026 at 09:00".
- Photographers [51][52]: "Link expires" date input overflows the card the same way. "What the link can do"
  lists the two things it can't do in red strikethrough text.
- Attendees [53]-[55]: "Drop the guest list" box with only "Paste a list instead" (no file picker button on a
  phone). "Add one person" has placeholder-only fields. Table: email column truncated
  ("maximilianumschaden@gm"), other columns off screen to the right.
- Invite and share [56]-[58]: event link, QR (card a few px wider than the others), Download PNG/SVG,
  Print A4 poster, announcement email whose sign-off reads "The Max team" (Hosted by is "Max"). No native
  Share button.
- Settings [59]-[61]: chips row; First day / Last day date inputs overflow the card; the empty Last day input
  is taller than text inputs. Logo: "Drop your logo" box (no visible choose button) on a phone.
- Plan [62][63]: Free, Guests 1 of 50, Photos 175 of 200, "The event's size can't be changed in the iPhone
  app." with no further guidance.
- Gallery home [64][65]: "Hosted by Max", face-analysis notice with "I understand..." button, one album card
  "Mt barney 25 photos · 13 videos" with a "New" chip. "Photos by Klubbies Events" footer again.
- Album "..." menu [66]: the popover opens to the left and is cut off by the screen edge ("tails and cover",
  "o Photos", "oad all", "lish, back to draft").
