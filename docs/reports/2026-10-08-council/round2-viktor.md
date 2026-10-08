# Round 2: Viktor

I opened the cited lines for every severity 3 and 4 finding from Maya, Ines and Sam. Most of them hold up. Four are overstated, and one part of a finding I share with Maya is still speculative (the share sheet). Many citations point at the wrong lines: the problem is real, but the line numbers look like offsets from a concatenated `cat -n`. They need fixing before anyone hands this to an engineer (see C-7).

## Challenges

### C-1 S-3 (Free plan's 200-photo cap): DOWNGRADE to 2
- **What the finding says:** the size step hides the photo cap, so a Free event surprises its photographer.
- **What the code shows:**
  - The Free card already says it: `detail={\`Up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos\`}` (`setup/SizeStep.tsx:58`). Paid cards say the same (`:73`).
  - Photo emails already exist: "nearly out of photos" at 90% and "used all its photos" (`lib/billing/notices.ts:112-130`). That answers Sam's "check that photos are covered too": they are.
  - The photographer page already says "This event is full" before anyone picks files (`app/g/[token]/page.tsx`).
- **What is left:** `suggestedTier` and `freeFits` (`SizeStep.tsx:32-33`) look only at guests. That is a recommendation problem, worth fixing with a photographer count, but not a severity 3 trap.
- **Caveat:** the 90% email does nothing for one 400-file batch, which crosses 180 and 200 within minutes. Sam's warning line on the Free card ("One photographer usually shoots 300+") is the cheap, correct fix.
- **Citations:** `SizeStep.tsx` is 132 lines, so ":191-193, 215-224" don't exist.

### C-2 S-1 (organisers land in the gallery): DOWNGRADE to 2
- **What holds:** `events/page.tsx:69` links every card, admin ones included, to `/e/${handle}`.
- **Why it is not a 3:**
  - An organiser with one event already lands on admin (`lib/auth/flow.ts:242-244`).
  - Organisers with several events are one header click away ("Organiser view" or "Gallery") or one switcher pick (decision 100).
- This is an efficiency cost, not a trap. I still endorse the fix: link admin cards to `/admin/<handle>` and show a "Setup not finished" chip. Both are S effort.

### C-3 M-7 (face notice blocks the photo search): DOWNGRADE to 2, and keep the order
- **The order is deliberate:** "Told first, invited second: the notice has to be acknowledged before the selfie invitation appears" (`app/(app)/e/[handle]/page.tsx:80-81`). That is consent design, not an unhandled state. Maya herself says not to weaken it.
- **Endorse:** the copy changes, showing the facts instead of folding them away, and a hint under the disabled "Find my photos" button (`Enrol.tsx:99`, disabled until a selfie is added and the box ticked, with no reason shown).
- **Reject:** merging notice and enrolment into one card with "Not now" also recording the acknowledgement. That needs a privacy sign-off, not a UX ticket.

### C-4 M-2 (downloads land in Files, not Photos): DOWNGRADE to 2 as a standalone finding; merge its viewer part into V-9 / M-3
- **What is true:** on iOS, a navigation to a URL that sends `content-disposition: attachment` (`/api/media/[id]/download` → 303 → signed URL) ends up in Files.
- **Why that is not a defect on its own:** it is what every web download does.
- **The one piece worth building:** single-photo "Save to phone" in the viewer, as a share of one file straight from the tap, with nothing awaited before `navigator.share`. That is the only gesture-safe use of the share sheet, and it covers the most common case.
- **Don't spread `AlbumActions`' loop to more screens.** That copies the bugs in V-9.

### C-5 M-3 and V-9 (Save to Photos), including my own: split proven from speculative
- **Proven from the code, so severity 3 stands on these alone:**
  - It walks `readyIds`, which is capped at `.limit(240)` (`a/[albumId]/page.tsx:66-72`).
  - It asks for the `display` variant: the 2000px WebP for a photo, and the **poster** for a video (`api/media/sign/route.ts:30`).
- **Speculative:** that `navigator.share` fails after the first batch on iOS Safari. The transient-activation rule is documented, but neither Maya nor I ran a device. Label it "needs one iPhone test" in the merged ticket. Don't let it be the headline.

### C-6 I-10 (email link colours): the react-email default colour is unverified
- **The claim:** unstyled `<Link>` inherits `#067df7` with no underline.
- **Why I can't confirm it:** that colour lives in `@react-email/components`, and node_modules isn't installed. It matches what I remember, but nobody in this council read it from the package.
- **What stands either way:** the colour-only footer links in `emails/Layout.tsx`.
- **Keep it at 2.** Verify after `pnpm install` before quoting "3.97:1".

### C-7 Citation hygiene across Maya, Ines and Sam
The substance checks out, but these line numbers point past the end of the file. An engineer following them will doubt the finding.

| Finding | Cited line | File length | Where it actually is |
| --- | --- | --- | --- |
| M-2, M-3 | `AlbumActions.tsx:337-345, 395-438, 464-469` | 197 lines | `:75-118` (save), `:144-156` (button) |
| M-5 | `MemberTabBar.tsx:263, 314` | 95 lines | n/a |
| M-8 | `GuestUploader.tsx:156, 202, 226` | 141 lines | `:21, :97, :121`, roughly |
| I-8 | `CodeForm.tsx:293, 218-224` | 127 lines | `:103` (disabled), `:28-35` (refocus) |
| S-2 | `AlbumManager.tsx:398-402, 348` | 344 lines | `:309` (input) |
| S-3 | `SizeStep.tsx:191-224` | 132 lines | see C-1 |

Fix the numbers in round 3. I'm not lowering any severity for this.

### C-8 I-2 (viewer leaves the header focusable): holds, but rank it below the phone-first findings
- **Confirmed:** `AppHeader` and `CreditLine` render around `{props.children}` (`e/[handle]/layout.tsx:91-95`). Only `MemberTabBar` hides itself in the lightbox (`MemberTabBar.tsx:15`). That is a real 2.4.11 failure.
- **But:** the attendee audience is mostly on phones with no keyboard. Severity 3 is right under WCAG; on priority it sits behind the flows that lose people.

## Endorsements (independently confirmed)

- **I-1 (Dialog steals focus), 3, confirmed and arguably the most reproducible bug in the council.**
  - The effect depends on `[open, onClose]` (`components/Dialog.tsx:16-26`).
  - The paste dialog passes an inline `onClose={() => setPasteOpen(false)}` (`RosterImport.tsx:179`), and the textarea's `onChange` calls `setPasted`.
  - So every keystroke runs cleanup (`previous?.focus()`), then the effect again, which focuses the first `input, button…` in the panel: the ✕.
  - Typing one character moves focus to ✕. From there Space or Enter closes the dialog and the text is lost. Paste survives once.
  - Refinement: store `onClose` in a ref and depend on `[open]` only, as Ines says. Also make the initial focus target opt-in (`data-autofocus`), so the delete confirm in `AlbumGrid` focuses Cancel, not ✕ or Delete.
- **I-4 (focus ring on dark backgrounds), 3, confirmed.**
  - My own calculation: `--kb-ember #2b4acb` on `#14100f` = 2.65:1.
  - `lib/theme.ts:98` overwrites `--kb-ember` with the event colour, so the per-event figures are plausible.
- **I-3 (viewer sheets aren't dialogs), 3, confirmed.** The only `role` in `Viewer.tsx` is `role="status"` at `:311`. Neither sheet has `role="dialog"` and nothing moves focus.
- **I-5 (swatches lose their focus ring), 3, confirmed.** `outline: … : "none"` is set inline (`SettingsForm.tsx:83-86`) and beats `:focus-visible` (`globals.css:179-182`). The hex `aria-label` is at `:78`.
- **I-8 (code boxes lose focus after a wrong code), 2, confirmed.**
  - `setPending(false)` and `boxes.current[0]?.focus()` run in the same tick, while React still has the inputs `disabled`.
  - The real refocus belongs in an effect keyed on `error`.
- **I-11b (Enter on the disabled Download), 2, confirmed.**
  - An empty `only=` falls through to `range(part…)` (`api/albums/[id]/zip/route.ts:114-137`), so Enter on the aria-disabled Download zips the first 150 files.
  - Add the 400 for an empty `only=` to the V-11 ticket.
- **S-4 (blurry poster logo), 3, confirmed. The code contradicts its own comment.**
  - `poster/page.tsx:24` calls `signLogoMarks`, which prefers the 96px mark (`lib/storage/index.ts:132-138`).
  - The next line says "The poster wants the full logo, not the 96px badge."
  - One-line fix: `signPaths(client, [event.logo_path], …)`.
- **S-5 (paid upgrades after the 12-month deletion), 3, confirmed.**
  - `tierOffers()` never looks at `photos_deleted_at` (`lib/billing/plans.ts:102-121`).
  - The billing page renders `offers` whenever `offers.length && !inApp`, whatever the deletion state (`billing/page.tsx:126`).
  - `startCheckoutAction` doesn't refuse (`billing-actions.ts:24-38`), while `startKeepYearAction` does (`:45`).
  - `BillingGate` still says "unlock after the one-off payment" (`components/BillingGate.tsx:13`), which the Free tier made wrong anyway.
  - It's rare (12+ months in), but it takes money for nothing.
- **S-9 (open removal requests can fall off the page), 2, confirmed.**
  - `status` is `text` with a check constraint (migration 11 `:73`), so `.order("status")` sorts 'confirmed' before 'open'.
  - With `.limit(30)` (`removals/page.tsx:27-31`), open requests drop off once there are 30 confirmed ones.
  - Severity stays 2: the default outcome (auto-delete) is the privacy-safe one.
- **M-4 (Your photos download stops at 150), 3, confirmed.**
  - `/me` links the zip with no `part` (`me/page.tsx:142`).
  - The home card labels it "Download (part 1)" when `zipParts > 1` (`YourPhotosCard.tsx:37-38`), and no part 2 link exists anywhere.
  - This is the same root cause as my V-2.
- **M-5 (viewer from Your photos drops you into the album), 3, confirmed.**
  - `albumHref` and `itemHrefBase` are always the album (`[mediaId]/page.tsx:66-68`).
  - A real context bug: Close takes you somewhere you never were.
- **M-6 ("Send a new code" doesn't send one), 3, confirmed.**
  - "Send a new code" and "Use a different email" both go to `restartHref` (`signin/code/page.tsx:17,26`, `CodeForm.tsx:122`).
  - Combined with V-1, each retry also costs the venue's shared limit.
- **S-6 (inflated organiser numbers) and S-8 (activity log zips): plausible, severity 2.** I didn't re-trace every count. S-8's "Deleted item" for zip rows matches what I saw: zips log `media_id: null` (`api/albums/[id]/zip/route.ts:141`, `logAccess(event, null, "zip")`).

## Duplicates / merges

| Merge | Proposed title |
| --- | --- |
| V-1 + M-1 | **Shared-IP rate limits lock a venue out of sign-in, and correct codes are rejected.** The two fixes agree: per-email first, IP as a flood guard, don't record refused hits, a distinct verify message. Add M-6, since every resend burns the same bucket. |
| V-4 + M-8 + M-9 | **Photographer upload has no safety net**: no unload guard, no auto-retry or "Retry all", failures scroll out of view, stale signed tokens blamed on the link. |
| V-2 + M-4 + V-11 (+ I-11b) | **Zip parts are invisible outside the album header.** Deletion email, Your photos and the home card serve part 1 only. Zips skip files silently. Empty selection zips the album. |
| V-9 + M-3 (+ M-2 viewer part) | **"Save to Photos" saves a truncated, downscaled set, with video posters instead of videos; add a gesture-safe single save in the viewer.** Share-sheet failure is pending a device test. |
| V-6 + S-2 | **Scheduled publish times are parsed as UTC.** Sam's point about guest-link expiry (`guest-actions.ts:34`) errs late and is harmless; note it, don't fix it first. |
| V-3 + I-7 | **Upload status isn't communicated**: error text never rendered, the tray disappears with failures outstanding, no progressbar or live region. |
| M-13 + my LookingNow note | **Attendee actions fail silently offline**, including endless polling. |
| V-7 + V-8 | **One "stuck upload" rule (`STUCK_AFTER_MS`) for the organiser list, "Remove it" and the attendee banner.** |
| I-15 + V-13 (error page) | `global-error.tsx` and `error.tsx` still use Klubbies branding and colours. Handle it in Ines's token clean-up. |

## Revisions to my own findings

- **V-9:** reworded per C-5. The cap, the display variant and the video poster carry severity 3. The share-sheet failure is "needs device test".
- **V-13:** I drop the "wrong brand" remark; I-15 covers it better. Severity stays 2 on the missing `loading.tsx` and segment `error.tsx`.
- **V-2:** stays at 4. M-4 shows the zip-part gap is systemic, not a one-off in the email. Fix it once with a shared "parts list" component used by the album header, `/me`, the home card and a signed-in export page linked from the email.
- **V-15:** stays at 2. I accept that `getPublicEvent` is the documented design ("what anyone holding the event link may know"). My point is narrower: the "link" is guessable because the handle is the event's name as a slug. If the owner accepts that, close it as intended.
- **New note (no new ID):** M-6 makes V-1 worse. Put both in the same sprint.

## My top 10 (all members, UX impact first)

1. **V-1 / M-1:** at the event itself, the core join flow silently stops and blames the guest for our limit.
2. **V-2 / M-4:** organisers and speakers think they have all their photos, then a permanent deletion follows. Data loss through a bad status.
3. **V-4 / M-8 / M-9:** the person with no account, no gallery and no one to ask loses uploads, and is sent to the organiser over a token we expired.
4. **V-3 (+ I-7):** organisers get a wall of "FAILED" with the reason already in memory and never shown. Cheapest high-impact fix in the council.
5. **I-1:** the paste-a-guest-list dialog throws focus to ✕ on every keystroke. 100% reproducible, one-line fix.
6. **V-9 / M-3:** the headline "Save to Photos" on phones saves at most 240, at preview size, with video stills. The trust promise is "full quality".
7. **M-5:** after "Your photos" → a photo, Close and swipe drop guests into strangers' photos. A broken mental model on the most-used attendee path.
8. **V-6 / S-2:** "9am" goes live at 7pm, and the email goes out with it. Wrong in the default case.
9. **V-5:** Undo, the safety net decision 25 promises, vanishes in most albums. A one-line `key` fix.
10. **S-4:** every printed poster carries a blurry client logo on the registration desk. One line to fix, and highly visible.

Runners-up: M-6 (resend sends nothing), V-7 ("Remove it" kills live uploads), S-5 (charging for nothing after deletion), I-4 (focus ring invisible on the viewer), M-7 copy (at 2).
