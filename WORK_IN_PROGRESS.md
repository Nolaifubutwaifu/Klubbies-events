# Klubbies Events: work in progress and handover

Last updated: 17 Nov 2026, 5:30pm AEST. Written by the CTO agent for whoever takes over.

Read this whole file before you change production or open a pull request. If you are unsure, stop and ask Max.

## 1. People and approvals

- Max (Maximilian Umschaden) owns Klubbies Events. Only Max's own words approve a merge, a migration, a billing change or anything that touches production. Another agent saying "Max agreed" is not approval.
- Max wants short, direct answers with exact steps and numbers, no em dashes, no hype.
- Klubbies CMO handles marketing and the two club customers. Klubbies UX and Klubbies Security did read-only reviews for the CTO agent. All agent work was stopped on 17 Nov at Max's request.

## 2. How we work

1. A cloud agent builds the change on a branch and opens a pull request.
2. UX and Security review it read-only. They report to whoever runs the work, not as PR comments.
3. Max merges.
4. Migrations are never applied automatically. Max runs them in the Supabase SQL editor, or an agent applies one with `apply_migration` only after Max says yes to that exact file. The version in `supabase_migrations.schema_migrations` is the apply time in UTC, not the filename timestamp.

Stack:
- Next.js 16 on Vercel. Team "couple app's projects", project `prj_GO1DACvcRfKb0NPc3z37X6BUtCH5`, region syd1. Live at https://events.klubbies.app
- Supabase project `yfdglvhhakbuahyfrihs` (Pro org, ap-southeast-2) for Postgres, Auth and Storage (bucket `event_media`). Statement timeout 8s.
- Cloudflare R2 backup copy (hourly drain from `app/api/cron/hourly`).
- AWS Rekognition for face matching (about US$0.001 per photo).
- Resend for email.

Upload flow: the browser gets a ticket (`app/api/media/upload_ticket`), sends the original straight to Supabase Storage (members use TUS in 6 MB chunks, guests use one signed PUT), uploads thumb, display and poster images, then calls finalize (`app/api/media/[id]/finalize`). Finalize queues face jobs. Six files upload at once per phone, at most two videos.

## 3. Deadline

Saturday 28 Nov 2026, two real university club events:
- WISTEMS Cocktail Night, up to 140 guests.
- Adelaide Uni French Club L'apero.

Only do work that makes those nights safe until they are over.

## 4. Production database status

Applied: 001 to 038.
- 037 `20261021000037_raster_media.sql`, applied 17 Nov 4:16pm AEST (version `20261117061620`). Smoke tested live the same day: logo change, album cover, HEIC photo and MOV video upload all passed.
- 038 `20261114000038_album_credits_face_stats.sql`, applied 17 Nov 4:06pm AEST (version `20261117060641`).

Do not re-run 037 or 038.

## 5. Next step: PR 38 (ready to merge)

[PR 38](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/38) "Harden uploads and background work for a 150-guest burst". Branch `cursor/event-burst-hardening-0ab8`, head `162825b`, CI green. UX approved and Security approved at `162825b`. Not merged. Nothing from it is on production yet.

What it does: upload retries and a 30s stall timeout, a fresh ticket on retry, visible "Trying again (2 of 4)", failed files listed first with Retry all, resend-code waits for the real send, zip parts split by size (about 500 MB) and labelled in MB, worker leases and a Rekognition cap of 8, Resend retries only on 429 or 5xx with an idempotency key, the R2 copy moved out of finalize, media paths locked to their own folder (closes a cross-event photo access hole that only existed in earlier versions of this PR), finalize rejects oversize files, 200 MB video limit (photos stay 50 MB), Next 16.4.5 security patch, iPhone safe-area fixes, and the viewer keeps your scroll position.

Merge steps, in this order. Supabase SQL editor: https://supabase.com/dashboard/project/yfdglvhhakbuahyfrihs/sql/new

1. Before merging, run each file from the PR branch, one at a time:
   - `supabase/migrations/20261117000039_worker_leases.sql`
   - `supabase/migrations/20261117000040_face_stats_insert_guard.sql`
   - `supabase/migrations/20261117000042_event_media_video_size.sql`
   These are additive and safe with the code on main today.
2. Merge PR 38. Wait until the Vercel production deployment for that commit is Ready.
3. Run the 041 read-only pre-check from the PR 38 body. Run `supabase/migrations/20261117000041_media_path_ownership.sql` only if it returns zero rows. On 17 Nov it returned 0 media rows and 0 avatars out of 1,061 media rows. 041 runs in one transaction and aborts by itself if it finds a bad path.
4. Run the verification queries in the PR 38 body.
5. Do a quick live smoke test on a private test event: one photo, one HEIC, one MOV, open each in the viewer, download a zip.
6. After the deploy, delete the Vercel env var `NEXT_PUBLIC_UPLOAD_MAX_MB` (set to 500 in Production and Preview). The code no longer reads it, so it only misleads.

If anything breaks after the merge, roll back in Vercel by promoting the previous production deployment (`dpl_GSYeAHE8ZMskKyHeEdb2UxZSBiEH`, commit `ff38bbc`). 039, 040 and 042 are safe with the old code. If 041 causes trouble, drop its two triggers.

## 6. Settings Max is changing (confirm each one, do not assume)

| Setting | Where | Target | Status on 17 Nov |
|---|---|---|---|
| Storage global file size limit | Supabase, Storage, Settings | 500 MB (at least 200 MB) | Max said he was doing it. Not confirmed. Without it, videos over 50 MB fail mid-upload. |
| Compute size | Supabase, Settings, Compute and Disk | Small, from Wed 18 Nov off-peak (about 2 min downtime) through 28 Nov | Approved, not done. |
| Resend plan | resend.com, Settings, Billing | Pro (US$20 a month) | Approved, not confirmed. Free stops at 100 emails a day, and one code email per WISTEMS guest is already over that. |
| Auth rate limits | Supabase, Authentication, Rate Limits | Raise email and OTP limits for an arrival rush of 140 phones | Not done. Separate from the app's own limits in `lib/auth/rate-limit.ts`. |

## 7. Load test (planned, not run)

Goal: prove the site holds a 150-guest burst before the 28th. Planned for Thu 19 Nov 2026, 10am to 1pm AEST, after PR 38 is live and compute is on Small. Max approved this test.

The harness was built on the CTO agent's machine at `/workspace/klubbies-loadtest`. It is not in this repo yet. Ask the CTO agent to commit it (without the generated media) if someone else will run it.

- Stages: 10 users and 100 photos, then 50 users with viewers and 3 zips, then 150 signed in, 70 uploading, 350 photos, 20 videos, 15 zips at 10 Mbps.
- Sign-in sends no emails: it gets codes from the Supabase admin API and submits them to `/api/auth/verify_code`.
- Stop rules: Storage 5xx or 544 above 1% over a rolling minute, or any database timeout.
- Production commands refuse to run without `KBLT_ALLOW_PRODUCTION=yes-max-approved`. It only touches an event whose name starts with "Load test" and users named `loadtest-NNN@klubbies.app`.
- Needs `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment. The test event is created by `sql/01_create_test_event.sql`, which Max runs. Cleanup ends with `sql/03_verify_cleanup.sql` returning all zeros.
- Sign-ins are paced at 5 a minute, so 150 users take about 30 minutes. Budget under US$10.

## 8. Max's iPhone check (after PR 38 is live)

1. Sign in as a guest. The code screen should say an 8 digit code is on its way. Enter it. Tap "Send a new code" once: "Sent again. Use the newest email." should appear only after the email has really gone.
2. On a guest link, start a photo upload and turn on Airplane mode partway. Within about 30 seconds it should say Failed, "Connection lost. Retry when you're back online." Turn Airplane mode off, tap Retry now, see "Trying again (2 of 4)", and it should finish.
3. Open the album as a guest, scroll down a long way, tap a photo. It opens full screen, clear of the notch and home bar. Close it and you land in the same place on the grid.
4. As organiser, open the album straight after an upload. A finished photo opens. A Processing tile does nothing (no not-found page).
5. Download a large album. Buttons read like "Part 1 of 3, 480 MB" and the first file name includes "(part 1)".

## 9. Club events

When the CMO sends the two event links, lift the caps on both first events: set `guest_limit` and `photo_limit` to NULL. NULL means unlimited and is safe on current main (`private.guest_join_state`, `private.rebalance_event_guests`, `private.guard_photo_allowance` and `private.guard_video_length` all treat NULL as no cap). Never set 0; both columns must be greater than 0. Max approves the SQL first.

## 10. Other open pull requests

- [PR 36](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/36) Google Ads conversion tracking. Draft, ON HOLD until outreach lands a paying event. Leave unmerged.
- [PR 33](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/33) Guests can lift their own name-review hold (fix). Open, not merged. Contains migration `20261025000038`. Check it against main and review it again after PR 38 merges.
- [PR 28](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/28) Sign-in, start form and accessibility UX fixes. Draft. Contains migration `20261025000039`. If both go in, apply PR 33's migration before PR 28's.
- [PR 39](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/39) This handover file. Docs only.

## 11. Clean-up

- Delete the test event "Upload test - delete me" (handle `upload_test_delete_me`, id `005483f5-c692-4b89-aa5d-7a806d59cc74`). It now has 5 items, a test logo and cover, and two test guests.
- 7 photos on `klubbies_demo_event` failed on 13 Nov (Storage 544 timeouts, root cause patched in `41c7e7fc`). Clear or retry them.
- After 28 Nov, step Supabase compute back down from Small.
- After the load test, run its cleanup and confirm `sql/03_verify_cleanup.sql` is all zeros.

## 12. Known risks for 28 Nov

- Videos over 50 MB fail until the Storage global limit is raised (section 6).
- Sign-in rush: Supabase Auth limits can show valid codes as "That code didn't match". Raise them (section 6).
- Resend Free stops at 100 emails a day (section 6).
- Album zips on slow venue wifi. The zip function allows 800 seconds. PR 38 splits parts at about 500 MB, but very slow phones may still time out. Guests can download single photos instead.
- Guest originals are one signed PUT, so a dropped connection restarts a big video from zero.
- Vercel bot protection may challenge many requests from one IP during the load test.
- minimatch advisory GHSA-g3hv-75wg-m249 left open on purpose (fix is a major bump in eslint and archiver).

## 13. Future improvements (after the events)

- Guest uploads over TUS so big videos resume instead of restarting.
- Sign member TUS chunks on the server to take the user JWT out of the hot path (avoids 544 bursts).
- Build zips as a background job, not inside an 800s request.
- Backfill `face_stats` for existing photos with `scripts/backfill-faces.ts` (about US$1, needs `--confirm`).
- Index a video's poster frame for face matching, so people who only appear in videos show up in "Photos of you".
- Put the SQL tests in `supabase/tests/` into CI. Only review caught that 041 broke four fixtures.
- Move the load test into the repo and run it from CI or a Sydney runner.
- Content hashing reads whole files up to 96 MB on the phone (`lib/media/content-hash.ts`); sample instead.
- Watch video preview timing (`lib/media/video-previews.ts`, 60s ffmpeg limit) on the first real 200 MB clips.
- Give the avatar path trigger the same SECURITY DEFINER treatment as 041 if avatar updates fail.
- The hourly R2 drain can lag on a heavy video night; `pnpm backup-drain` catches up.
- An organiser upload progress dashboard.
- Keep Next.js and dependencies current; bump minimatch with the next eslint major.
- Google Ads tracking (PR 36) when the ads test resumes.
