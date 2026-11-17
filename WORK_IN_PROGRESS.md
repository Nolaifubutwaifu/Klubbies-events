Last updated: 17 Nov 2026

Handover for the next agent. Read this before changing production or opening another pull request.

## How we work

A cloud agent builds the change and opens a pull request. Klubbies UX and Klubbies Security review that pull request read-only and report to the CTO agent. Max approves the merge.

Migrations are never applied by an agent on their own. Max runs them in the Supabase SQL editor for project `yfdglvhhakbuahyfrihs` in `ap-southeast-2`. An agent may apply a migration only after Max has said yes to that exact file. The history row in `supabase_migrations.schema_migrations` uses the time it was applied, not the timestamp in the filename. That is why 038's recorded version is earlier on 17 Nov than 037's, even though 037's filename sorts first.

The stack is Next.js on Vercel (project `prj_GO1DACvcRfKb0NPc3z37X6BUtCH5`, region syd1), Supabase for the database and Storage, a Cloudflare R2 backup, AWS Rekognition for face matching, and Resend for email.

## Deadline

Two university club events are on Saturday 28 Nov 2026.

- WISTEMS Cocktail Night, up to 140 guests.
- Adelaide Uni French Club L'apero.

Do not start unrelated work that could slip past that weekend.

## Migration status

Migrations 001 through 038 are applied on production.

- 037 (`20261021000037_raster_media.sql`) was applied on 17 Nov. The history version is `20261117061620`.
- 038 (`20261114000038_album_credits_face_stats.sql`) was applied on 17 Nov. The history version is `20261117060641`.

Do not re-run 037 or 038.

[PR 38](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/38) adds four migrations. Run them in this order:

1. `supabase/migrations/20261117000039_worker_leases.sql`
2. `supabase/migrations/20261117000040_face_stats_insert_guard.sql`
3. `supabase/migrations/20261117000042_event_media_video_size.sql`
4. `supabase/migrations/20261117000041_media_path_ownership.sql` last

Run 041 only after the read-only pre-check in the PR 38 body returns no rows. On 17 Nov that pre-check was 0 media rows and 0 avatars. 041 is one transaction. If its own pre-check finds a bad path, it raises and commits nothing, including the trigger drop.

039 adds worker leases and a Rekognition cap of 8. 040 lets only `service_role`, `postgres`, and `supabase_admin` set or change `face_stats`. 042 raises the `event_media` bucket file size limit to 200 MiB when it is missing or lower, and never lowers a higher limit. Production is already 500 MiB (`524288000`), so 042 changes nothing there. 041 requires each media path to stay in that row's own folder, and each avatar under `avatars/{that user}/`.

## In progress

[PR 38](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/38), "Harden uploads and background work for a 150-guest burst", is a draft. Head at this note: `cbe662e`. It is waiting on the final Security and UX re-check. After that, Max merges and runs the migrations in the order above. Nothing in PR 38 has been applied to production. The pull request body has the pre-check SQL and the verification queries. Follow that body, not a summary.

Max's settings, as of 17 Nov:

- Supabase Storage global file size limit raised to 500 MB.
- Database compute goes up to Small on Wednesday 18 Nov, in the off-peak window, and stays there through 28 Nov. Step it back down after the events. That step is also listed under Clean-up.
- Resend is on Pro.

Load test. The harness is on the CTO agent's machine. It is not in this repo. It stages 10, then 50, then 150 accounts. Planned for Thursday 19 Nov 2026, 10am to 1pm AEST, after PR 38 is live on production. No emails are sent. The harness has stop rules and a full cleanup. Those rules live with the harness, not in the repo.

After PR 38 is live, Max runs a 5-step iPhone check. The steps are Max's. They are not written in this repo.

When the club links arrive, lift `guest_limit` and `photo_limit` on both events. Check the triggers before writing NULL. On current main this is already safe:

- `private.guest_join_state` returns `open` when `guest_limit` is null (`supabase/migrations/20260928000027_plans_and_limits.sql`).
- `private.rebalance_event_guests` clears pauses when `guest_limit` is null.
- `private.guard_photo_allowance` returns the new row when `photo_limit` is null, so there is no photo cap.
- `private.guard_video_length` does the same (`supabase/migrations/20261009000034_video_units_per_six_seconds.sql`).

Do not set either column to 0. Both columns have a check that the value is greater than 0. NULL means unlimited. A positive number is a cap.

Raise the Supabase Auth rate limits in the dashboard before 28 Nov. Those are separate from the app's own limits in `lib/auth/rate-limit.ts` (5 code requests per email per hour, 400 per IP per hour, 1200 code checks per IP per hour). A room of 140 phones on one network can still hit Auth's own caps even when the app limits allow it.

[PR 36](https://github.com/Nolaifubutwaifu/Klubbies-events/pull/36), "Add optional Google Ads conversion tracking", is a draft and ON HOLD. Leave it unmerged.

## Clean-up

- Delete the test event named `Upload test - delete me` (handle `upload_test_delete_me`).
- On `klubbies_demo_event`, 7 photos failed on 13 Nov. Clear or retry them so the demo is not full of stuck rows.
- After 28 Nov, step the Supabase compute size back down from Small.

## Known risks

- Album zip downloads on slow venue wifi. The zip route allows 800 seconds, and PR 38 also splits a zip at about 500 MB as well as 150 files. A stack of long videos can still run out the clock or produce several parts.
- Sign-in during an arrival rush. The app limits are per email first and a high per-IP flood guard, but Supabase Auth has its own dashboard limits. Raise those before the 28th.
- Resend on the Free plan stops at 100 emails a day. Max has moved the account to Resend Pro. Confirm that upgrade is actually live before the events. One code email per guest at WISTEMS is already over 100.
- The minimatch advisory is still open. The patched release is 11.0.1, a new major for the copies eslint and archiver use. It was left on the current major on purpose.

## Future improvements

Do these after the events, not before.

- Backfill `face_stats` for photos that already exist. `scripts/backfill-faces.ts` does that pass. Budget about US$1 in Rekognition for the current library. It uses the service role key and will not spend anything without `--confirm`.
- Build zips off the request, or as a background job. The 800 second function limit is the wrong place for a whole album.
- Keep Next.js and the other dependencies current. PR 38 moved Next to 16.4.5 and Vitest to 5.0.3 or newer. minimatch still needs a major bump.
- Run the load test from CI, or from a runner in Sydney, so it is not tied to one machine.
- Give organisers a real upload progress dashboard. Today they have the small tray in `app/(app)/UploadTray.tsx` and the panel on the album.

Suggestions from the PR 38 work, also for after the events:

- Guest originals are one signed PUT, not TUS. A 200 MB iPhone video on venue wifi starts again from the beginning if the connection drops. Member uploads already use 6 MB TUS chunks.
- Member TUS still sends the user JWT on every chunk. That path can still return 544 in a burst. Signing those chunks on the server would take the JWT out of the hot path.
- The browser hashes the whole file up to 96 MB (`lib/media/content-hash.ts`). A video between 50 MB and 96 MB is read entirely into memory on the phone. Past 96 MB it samples the ends.
- Video preview seeks with ffmpeg range requests and gives up after 60 seconds (`lib/media/video-previews.ts`). A large phone video whose index sits at the end of the file can use most of that. Watch the first real 200 MB clips before changing it.
- The avatar path trigger is still `SECURITY INVOKER`. It does not call another private function, so it should be fine, but it did not get the same definer treatment as the media path guard in 041. Worth a second look if avatar updates start failing for `service_role`.
- The SQL tests under `supabase/tests/` are not in CI. The 041 path rule would have broken `backup.sql`, `face_rls.sql`, `limits.sql`, and one insert in `bin_rls.sql`, and only the review caught it.
- Face matching indexes photos only (`lib/faces/index-media.ts`). A person who appears only in a video never shows up in Photos of you. Indexing the poster frame would cover that without sending the video to Rekognition.
- `NEXT_PUBLIC_UPLOAD_MAX_MB` is set to 500 in Vercel Production and Preview. PR 38 stops reading it, so photos stay at 50 MB and videos at 200 MB. After that deploy, delete the variable so the next person does not think it still sets the limit.
- The hourly R2 drain assumes about 10 MB/s and a short budget. A run of 200 MB videos can be deferred to `pnpm backup-drain`. That is safe, but the backup will lag the gallery on a heavy night.
