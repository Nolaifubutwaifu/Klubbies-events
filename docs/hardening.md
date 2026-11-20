# Hardening backlog: what's left to make Klubbies Events bulletproof

Last updated 20 Nov 2026. Start here when a session is asked to keep testing or hardening the product. It lists what has been proven, what's open in priority order, how to test, and the test data currently in production. Update it when an item is done or a new one is found.

Background: `docs/reports/2026-11-17-load-test.md` and `docs/reports/2026-11-18-full-test.md` (includes the 19 and 20 Nov re-tests).

## Rules

- **Production writes need Max's explicit yes**: migrations, SQL that changes data, merges, deleting test data. Read-only SQL, test runs against the `load_test_*` events and opening PRs are fine.
- **Never touch the WISTEMS event** (`wistems_2026_cocktail_night`, id `58c91ddc-e0fc-4b0d-a791-86bb5c0cef47`). It's real client data. Check it's quiet (no recent media or memberships) before any load test.
- Load tests only run against events whose handle starts with `load_test` (the script refuses anything else) and need `KBLT_ALLOW_PRODUCTION=yes-max-approved`.
- Test passwords and photographer link tokens stay in a session scratchpad, never in the repo.
- Billing decisions (Resend plan, Supabase compute size) are Max's. Bring him numbers.
- When what's live changes, update `docs/klubbies-events-brief.md` and its Google Doc (see `CLAUDE.md`).

## Proven so far (production, Nov 2026)

| Area | Result |
|---|---|
| Uploads | 2,000 photos through 2 photographer links, 0 failed. Real iPhone: 160 picks incl. 13 videos, all ready, kept going through a screen lock |
| Face search | Kept pace with 2,000 uploads. Selfie matches in about 10 s |
| Album page, 150 guests, 50 at once, 2,158 photos | 2.4 to 2.6 s typical, 2.8 to 3.1 s slow end (was 4.3 / 4.8 s before PR 48 and PR 50) |
| Event page / viewer under the same load | 2.3 s / 3.3 to 3.5 s typical |
| Album zip | Every part valid. 150 small files in 14 to 15 s (was 78 s). Whole 2,158 photo album about 5 min |
| Public pages, slow 4G | Main content about 1.3 s |
| Phone walk (iOS Simulator, Safari) | Attendee and organiser flows pass |

## Open, in priority order

### 1. Before an event with more than about 100 guests

1. **Resend is on the free plan: 100 emails a day, shared by everything.** Sign-in codes, the "new album" email, organiser announcements and the "gallery closes in a week" email all count. One album published during a 150-guest event uses the whole day, and after that nobody gets a sign-in code. Fix: paid plan (Max's call). Check the dashboard first; it may already be done.
2. **Sign-in bursts.** Supabase Auth sees every sign-in as coming from the server's IP, so a burst trips its rate limit and guests get the friendly "Lots of people are signing in" message (2 of 150 on 19 Nov, 8 of 300 in back-to-back runs on 20 Nov, all retries from one Mac). Retries already cover small bursts (4 attempts). Real fix: forward the guest's IP to Supabase Auth so limits apply per guest. Planned for after the Christmas season; research the supported header first.
3. **Consent checkbox on a real phone.** In the simulator a tap on the box itself didn't tick it; a tap on the text did. Check on a real iPhone (face notice gate on the join page). Fix if it reproduces.
4. **Clean up the test data** when Max says go (see the last section).

### From the 20 Nov audit (PR 53, branch `claude/audit-fixes`): both done

- ~~Apply migration 46~~ Done 20 Nov 2026 on Max's yes (`atomic_purchase_and_tally`): `apply_keep_year` and `record_guest_upload` are live, and the two load-test link tallies now read 1,000 and 999.
- ~~Production sign-in code expiry~~ Done 20 Nov 2026 on Max's yes: Supabase Auth email OTP expiry 3600 to 600 seconds, matching the 10 minutes the email promises. Codes are 8 digits.

### 2. Speed under load

5. **Event page and viewer under load.** Profile them the way the album page was: reset `pg_stat_statements`, load the page once as a test guest (`scripts/one-page.mjs`), list the `public.*` queries by time. Look for reads that scan a whole album or event with RLS on every row; the album page fix (migration 45, `album_page_summary`) is the pattern.
6. **Other callers of the `album_media_counts` view**: `lib/media/event-cards.ts`, `lib/media/album-list.ts`, `lib/notify.ts`. Each scans every ready file of the albums it counts. Fine at today's sizes; check with the method above if an event page with several big albums gets slow.
7. **Heavy images on slow links.** On slow 4G the event page took 5.3 s and the viewer 10.1 s, because the event cover is the 2,000 px display copy (about 480 KB) and the viewer loads both neighbours at display size. `fetchPriority` already helps. Next step if needed: a smaller cover variant or `srcset`.
8. **Database compute.** Postgres CPU was the limit under load. If a much bigger crowd (several hundred guests at once) is expected, the next lever is a bigger Supabase compute size (billing, Max).

### 3. Not tested yet

9. **More than about 2,200 photos in one album, or 3,000+ in an event.** Album page and face search are proven to 2,158.
10. **150 real phones on venue wifi.** All load so far came from one Mac.
11. **The iOS app** (only the website has been load tested). Apple review status is in the brief.
12. **Emailed code sign-in at volume**, blocked by item 1.

### Known limits, not fixable from the page

- iOS 26 Safari lets every site scroll under the status bar, so the clock overlaps dark event pages. A backing strip was tried and removed (PR 46, PR 47).
- Big photos need a second tap on "Save to Photos" in iPhone Safari (the share sheet needs a fresh tap after a long download). The button reads "Tap to save" while it waits.
- A big pick on an iPhone looks frozen at first while iOS converts the files. A hint under "Add photos" says so.

## How to test

All from the repo root. Test guests are `loadtest-001` to `loadtest-150@klubbies.app`, all with the same password, kept in a scratchpad JSON `{ "password": "...", "links": [{ "token": "..." }] }` (`KBLT_SECRETS`). If that file is gone, create new users or reset their password with SQL (Max's yes): the setup follows the pattern in the 17 Nov report.

- `scripts/loadtest.ts`, modes in its header:
  - `KBLT_PROBE=1`: one of each operation, run first.
  - `KBLT_BROWSE=1`: 150 guests sign in, open event, album and viewer pages twice, 50 at once. The standard speed check.
  - `KBLT_BULK=1`: the 2,000 photo upload test with guests browsing and zips.
  - `KBLT_ZIP_PARTS=8,12`: time chosen zip parts.
- `scripts/speedtest.ts`: pages on throttled slow 4G with a 4x slower CPU, iPhone-sized (`KBLT_PUBLIC=1` for public pages).
- `scripts/one-page.mjs`: signs in one test guest and loads one page, for counting the database calls behind it.
- Phone checks: the iOS Simulator (iPhone 17 Pro, Safari) via the simulator tool. Max is signed in there as organiser of `load_test_organiser_delete_me`. Device Hub can't be driven (clicks are refused).
- Vercel: `vercel logs --environment production --since 15m --level error`, `vercel metrics`. Supabase: advisors, `query_logs`, `pg_stat_statements` (read-only).

Pass bar used so far: 0 failed pages, under 1% failures per operation, album p95 under 5 s at 50 concurrent guests (now about 3 s).

## Test data in production now

Kept on Max's instruction (20 Nov). About 5 GB of the 100 GB included in the Supabase Pro plan, so no space pressure. Remove when Max says go.

- `load_test_nov18`: event `46536d67-5c29-4d77-a7f8-3d8612c1bfcc`, album `5bf5b78b-5c49-4960-aefa-eb69079f5898`, 2,158 files (Max's NZ photos, generated images, his phone uploads), 2 photographer links.
- `load_test_organiser_delete_me`: Max's throwaway organiser event, incl. photographer links "Test Photographer" and "Scroll Check".
- 150 users `loadtest-%@klubbies.app`.
- Max's faceprint (selfie enrolment) on `load_test_nov18`.

Clean-up steps (same as 17 Nov): set both events' `deleted_at` to 31 days ago so the hourly bin purge deletes them with their media, faces and storage; check event, albums, media, memberships, links and storage objects are all 0; then delete the 150 test users (auth users, identities, profile rows, sessions). R2 backup copies are queued and purged automatically 30 days later. Then mark this section done here and in the 18 Nov report.
