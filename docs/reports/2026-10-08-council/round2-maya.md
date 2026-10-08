# Round 2: Maya, Attendee Advocate

I read Viktor, Ines and Sam in full and opened every file:line I challenge or endorse below. In short, Viktor and I hit the same guest-facing breakages independently, and that should settle their priority. Ines is right on several focus bugs, but some of her severities rank marketing-page polish above things a guest actually feels. Sam's organiser findings are solid, but two of his feature ideas would put friction in front of guests.

**A note on evidence first.** Several line numbers in other reports point past the end of the file. They look like offsets into a concatenated `cat` dump. Corrections, so round 3 can act on them:
- Viktor: `lib/auth/request.ts:48` is really `:12` (the file has 14 lines); `verify_code/route.ts:55-57` is really `:21-23`; `proxy.ts:70, 95-98` is really `proxy.ts:6, 29-34` (the file has 58 lines); `GuestUploader.tsx:332, 353-359` is really `:202, 223-229`.
- Ines: `CodeForm.tsx:293, 218-224` is really `:103, 28-35` (127 lines); `GuestUploader.tsx:78-92, 113, 120` is really `:183-199, 218, 225`.

The substance checks out in each case. I'm only flagging the numbers.

---

## Challenges

### V-2: DOWNGRADE to 3 (keep it in the fix list, but out of the "4" bucket)
I confirmed it: `lib/events/retention.ts:37` builds `/api/albums/<id>/zip` with no `part`, and `emails/DeletionWarning.tsx:22-29` says "After that nothing can be recovered" above those links. It's a real bug and the fix is S. But a 4 means "catastrophe, must fix before anything else". Here it's an organiser, once a year, after two warnings (30 and 7 days, decision 80). The album page they'd open from the overview already offers every part (`components/AlbumActions.tsx:483-491`). And the photographer who shot the event almost always still has the originals. Compare M-1/V-1: hundreds of guests, on the night, being told their correct code "didn't match". Those two shouldn't share a severity. Fix V-2 the cheap way: list every part in the email with counts ("Keynote: part 1 of 4, photos 1 to 150"). That's the same fix as my M-4, so do them together.

### V-13: REFINE (partly wrong) and keep at 2
`app/(app)/e/[handle]/loading.tsx` wraps every child segment of the event layout, so `/e/[handle]/me` and `/saved` already get *a* skeleton. It's the event-home skeleton, the wrong shape, but it isn't nothing. The real gaps are the organiser area (`admin/[handle]`, no `loading.tsx`), `/events`, `/account`, and the lack of any segment-level `error.tsx` (`find app -name error.tsx` finds only `app/error.tsx`). For guests, the part that matters is a `me/loading.tsx` shaped like the selfie or results screen, because face queries are the slowest attendee read, and on one bar the old screen just sits there after the tap.

### V-15: keep at 2, REJECT half the fix
Random suffixes on new handles: fine, guests scan the QR and never type the handle. But "in guest-list mode, show only the name until a code is verified" removes the event's letterhead from the join screen. That letterhead is exactly what tells a nervous guest this email-and-code request is legit (`components/AuthShell.tsx:86-96`, and the `EventIntro` comment: "where the event has to vouch for itself"). Strip it and we look like a phishing page asking for an email. Keep the logo and name. If an organiser really wants it, drop only the venue and dates in guest-list mode.

### I-9: DOWNGRADE to 1
4.43:1 against 4.5:1, on eyebrow captions on *marketing* sand sections. The only attendee-facing instance is the "Selfie" placeholder in an empty avatar circle (`me/Enrol.tsx:64`), which disappears once a photo is chosen. Darkening the token is a one-line change, so do it, but it isn't a 2 next to guests who can't get their photos into Photos.

### I-15: DOWNGRADE to 1 overall, UPGRADE one piece to 2 and move it out
Most of this is token hygiene that no guest or photographer will ever notice: undefined `--kb-mist`, plum rgba values, the `border-l-4`. One item changes meaning for my photographer, so it should be its own finding. On `/g/[token]`, "Failed" and the error text are drawn in the *event accent* (`GuestUploader.tsx:218` `--color-accent-700`, `:225` `text-accent-800`). On a green-branded event, a failed upload is green. The photographer on one bar scanning 400 rows can't tell failure from success. Use `--kb-danger`. Severity 2, effort S. The primary-styled Delete (`AlbumGrid.tsx:333-336`) is the other meaningful piece, but it only affects organisers, so 1 to 2.

### I-1: UPGRADE scope (keep severity 3), because it isn't only a keyboard bug
I confirmed it in `components/Dialog.tsx:20-30` and `RosterImport.tsx:179-185`. Every keystroke in the paste textarea re-renders, creating a new inline `onClose`. The cleanup then focuses `previous`, and the effect re-run focuses the first `button`, the ✕. That happens for **touch and mouse users too**, not just keyboard users. On an iPad, the on-screen keyboard closes after the first letter. Ines's fix is right (a ref for `onClose`, effect on `[open]`). I'd frame it as "the paste box is unusable", not as a WCAG nicety.

### Sam F-3 (sponsor branding on the join screen and gallery header): REJECT for the join screen
The join screen is the most fragile 30 seconds in the product: a guest deciding whether to hand over their email. Adding 1 to 4 sponsor logos there makes it read like marketing, and that hurts trust and conversion. Put the "Presented by" strip on the poster, in the gallery footer next to the credit line, and in emails. Keep it off the join screen and away from the top of Your photos.

### Sam S-3: endorse the problem, push back on part of the fix
The photographer dead end is real (`app/g/[token]/page.tsx:33-36, 44`). It's my photographer standing in the hallway with 200 frames still on the card, and guests then get an event with half its photos missing. But "add an optional 'Roughly how many photos?' field" is another question in a setup Sam himself wants short. Cheaper, and kinder to everyone: on Free, state the 200 cap on the card, and email and banner the organiser at 90% of *photos* (decision 62 only covers guests). On the photographer page, tell the photographer exactly what to say: "This event has hit its 200-photo limit. Ask the organiser to change the event's size. Your 200 are safe." Don't make the size step longer.

---

## Endorsements (independently confirmed)

- **V-1** = my M-1. Same code, same conclusion. Viktor adds a 200-joins-from-one-IP test, which I support.
- **V-9**: confirmed, and it strengthens my M-3. `app/(app)/e/[handle]/a/[albumId]/page.tsx:66-72` caps `readyIds` at 240, so even if every share sheet worked, a 600-photo album saves 240 and says "Done".
- **V-4**: confirmed. It's my M-8 plus M-9 almost word for word.
- **V-6 / S-2**: confirmed. `app/(app)/admin/actions.ts:405-409` does `new Date(publishAt)` on a zone-less `datetime-local` value. Guests feel this one: the organiser announces "photos at 9am", and at 9am the gallery says "No photos yet". Severity 3 is right.
- **V-8**: confirmed (`a/[albumId]/page.tsx:95-106`, with no age limit). A spinner promising "usually 2 to 5 minutes" for two weeks teaches guests the app lies. I agree with "N more photos are still uploading", with no time estimate.
- **V-12 + V-14**: confirmed (`proxy.ts:29-34` clears `search`; `lib/auth/flow.ts:196-200, 246`). Refinement: for `flow === "join"`, *always* redirect to `/e/<handle>` (the layout then shows the full, removed or join screen), and carry a safe `next` for album links from email.
- **V-5**: confirmed (`a/[albumId]/page.tsx:301`, `key={`${items.length}-…`}`). Organiser-side, but it breaks the undo promised in decision 25.
- **I-8**: confirmed (`CodeForm.tsx:28-35` focuses box 0 while the boxes are still `disabled`, `:103`). It's on my code screen, so do it in the same pass as M-6: `readOnly` instead of `disabled`, refocus in an effect.
- **I-2 and I-3**: confirmed (`[mediaId]/layout.tsx:8` is only a fixed cover; the sheets at `Viewer.tsx:318-414` are plain divs). Request removal is the privacy action, so losing focus to `<body>` there matters most.
- **I-12**: confirmed (`app/globals.css:1157-1161` sets `animation: none`, so the hint never fades). "Swipe for the next one" sitting permanently over every photo for Reduce Motion users who tap arrows is guest-felt. I'd rank it above I-9.
- **I-10**: the email links half. Unsubscribe has to look like a link.
- **I-7**: the photographer half. A screen-reader photographer is never told "All done" or "3 failed".
- **S-11**: from the photographer's side. A QR code of the upload link means the photographer scans it from the organiser's laptop instead of being texted a 60-character URL. Cheap, and it helps on the day.
- **S-14**: merges with the email half of my M-12. Guests know the *event*, not "Klubbies Events". Put the event in the code email's subject and header.

## Duplicates / merges

| Merge | Proposed title |
| --- | --- |
| M-1 + V-1 | Shared-IP rate limits lock a whole venue out of sign-in, and blame the guest |
| M-3 + V-9 | "Save to Photos" stops after one batch, caps at 240, and saves previews and video stills |
| M-8 + M-9 + V-4 (+ I-15's green "Failed", + I-7's photographer half) | Photographer upload page has no safety net on bad signal |
| V-3 + the hidden-failure part of V-4 and M-8 | One shared upload list: pin failed rows, show the reason, "Retry all failed" (organiser and photographer) |
| M-4 + V-2 + V-11 | Zips are capped at 150 with no way to the rest (Your photos, deletion email) and silently drop files |
| V-6 + S-2 | Scheduled albums go live 10 hours late (local time parsed as UTC) |
| M-10 + S-8 | Zips are logged with no photo, so Saved › Downloads and Activity both misreport |
| M-12 (email part) + S-14 | Emails speak as Klubbies Events, not as the event the guest knows |
| V-12 + V-14 | After the code, sign-in forgets where the guest was going |
| M-6 + I-8 | The code screen: "Send a new code" doesn't send, and a typo drops focus and the keyboard |

## Revisions to my own findings

- **M-11:** I **withdraw** the claim that the viewer toast follows you to the next photo. Viktor checked that the `[mediaId]` segment remounts on a param change, so `message` resets. The no-undo part stands (`me/Suggestions.tsx:69-92`, `Viewer.tsx:340-353`, permanent `face_rejections`). Still severity 2.
- **M-3:** add V-9's 240 cap to the evidence. I'm more confident in severity 3 now that two of us traced the share-gesture problem independently. It still needs one test on a real iPhone.
- **M-4:** fold in V-11. The zip silently skips files it can't fetch (`lib/media/zip.ts`, `continue` on a failed fetch), so "Download all" can be short even within part 1. Keep severity 3.
- **M-13:** narrowed. Viktor flagged `LookingNow`'s endless poll too, so that piece merges with his low-severity note. The FaceNotice and Suggestions silent failures stay mine.
- No change to M-1, M-2, M-5, M-6 or M-7 after reading the others. No one contested them, and M-7 is still the only finding about the guest's first minute *after* joining.

## My top 10 (across all members)

1. **M-1 / V-1**: the venue's own Wi-Fi stops new guests getting in, on the night, and tells people with the right code they're wrong.
2. **M-3 / V-9**: the one "Save to Photos" button the product has very likely saves 8 photos (or none), as previews, which breaks the core promise.
3. **M-2**: everywhere else "Download" puts photos in the Files app, not the camera roll, which is where every guest looks.
4. **M-8 / M-9 / V-4**: the photographer in a hallway loses uploads silently, can't retry in bulk, and is told their good link is dead.
5. **V-6 / S-2**: "Photos at 9am" becomes 7pm, so the whole guest list opens an empty gallery after the organiser's announcement.
6. **M-7**: the face notice hides the headline feature and offers an uneasy guest no option except "I understand".
7. **M-6 + I-8**: the code screen, the most-used screen in the product, punishes slow email and typos.
8. **M-4 / V-2 / V-11**: zips stop at 150 with no way to the rest, for the most-photographed guest and for the organiser's archive.
9. **M-5**: opening "your" photo drops you into a stranger-filled album with no way back.
10. **S-3**: Free's 200-photo cap shuts the photographer out mid-event, so guests get half the photos.

Just outside the ten: V-8 (a fake "2 to 5 minutes" spinner), V-12/V-14 (sign-in forgets the destination), I-2/I-3 (viewer focus and the removal sheet), I-1 (the paste box is unusable for everyone), S-1 (organisers land in the gallery).
