# Klubbies Events photo retention, undo and backups

A copy of Max's handoff doc as of 28 Sep 2026 (https://claude.ai/code/artifact/462c24d3-75bd-45f3-9e6e-f7f542b67ed4). The doc is the original; decisions made while building are in `docs/decisions.md`.

Every event's photos are kept for 12 months after the event, anything an organiser deletes sits in a bin for 30 days, and every original has a backup copy in Cloudflare R2.

## The photo lifecycle

The clock starts on the event's last day, not the payment date, so a club that pays early still gets a full year after its event.

- **Guest gallery:** open to guests for the full 12 months on every tier, including Free, at no extra cost. The organiser can close it earlier, but it can never stay open past the deletion date.
- **Warnings:** the organiser gets emails 30 days and 7 days before deletion, each with the album download links. Guests keep the existing email a week before the gallery closes.
- **Deletion at 12 months:** original files, previews, selfies, faceprints and the guest list go. The event row, payment records and usage totals stay, so invoices and your cost figures survive. The organiser sees "Photos from this event were deleted on (date)".
- **Face data:** kept only while the gallery is open, so it goes at 12 months with everything else, or earlier if a guest turns face search off or the organiser closes the gallery early. This matches the privacy page.
- **Existing events:** get 12 months from their end date, or from today if that date is already past.

## Recently deleted bin

Today a deleted photo, album or event is gone for good the moment it is deleted: the files are removed at once and Supabase's backups hold only the database, not the files. The bin fixes the common case, an organiser deleting the wrong thing.

| What is deleted | Where it goes | Can be restored |
| --- | --- | --- |
| Photos and videos (organiser) | Bin, hidden from everyone | 30 days, by the organiser |
| An album | Bin with all its photos | 30 days |
| A whole event (Settings, danger zone) | Bin; the event goes offline for guests at once | 30 days, by any organiser of the event |
| A guest removed from the attendee list | Already restorable today | Unchanged |

- **Undo:** for 10 seconds after any delete, a bar says "Deleted 12 photos. Undo".
- **Bin page:** Settings, Recently deleted, listing each item with its delete date, Restore and Delete now.
- **Purge:** the hourly job permanently deletes anything in the bin for more than 30 days, using the existing delete code.
- **Allowance:** items in the bin do not count toward the tier's photo allowance.

**Deleted straight away, never through the bin,** because someone asked for their data to go: account deletion, a removal request the organiser confirms (or that times out after 7 days), a guest turning off face search, and the 12 month expiry above (the organiser was warned twice).

## Backup copy in Cloudflare R2

Every original photo and video gets a second copy in a Cloudflare R2 bucket, so a bug, a leaked key or a problem at Supabase cannot lose an event's photos.

- **What is copied:** original files, their previews and event logos. Previews are made in the uploader's browser, so the server cannot easily rebuild them; backing them up adds only about 5%. Never selfies or faceprints, so face data exists in one place only.
- **Where:** a bucket named `klubbies-events-backup` in a separate Cloudflare account from anything else, with the Oceania location hint. A hint is best effort, not a guarantee, so the privacy page must say backups may be held outside Australia (see copy changes).
- **Protection:** R2 encrypts every object at rest (AES-256). The app gets one API token limited to this bucket, kept only in Vercel's server settings.
- **When:** each upload is queued for backup when it finishes; the hourly job and an after upload kick copy the queue, like the face search queue does today. The same folder path is used in both places, so a restore needs no lookup table.
- **Deleting backups:** when a photo leaves Supabase for good (bin purge or the 12 month expiry), its backup is queued for deletion 30 days later. As a safety net, a monthly check deletes any R2 object whose event is past its deletion date. A fixed age rule in R2 would wrongly delete events that paid to keep another year.
- **Restoring:** a script (`pnpm restore-media --event <handle>`, optionally one album or one photo) copies files back from R2 and rebuilds previews. Test a restore of one demo event every month; a backup nobody has restored is only a hope.
- **The database:** Supabase Pro keeps 7 days of daily database backups, which is enough for now. Supabase's point in time recovery (about US$100 a month) can wait until there is real revenue.

**The copy also serves guests.** Full quality downloads, zips and video playback come from the R2 copy, because R2 charges nothing for downloads and download traffic is the biggest cost of an event. Thumbnails and previews stay on Supabase. This is what makes the agreed prices work, and it means the privacy wording must cover photos served by Cloudflare, not only backups.

## What it costs per event

The backup adds about 70% to storage costs, and a full Medium event costs about A$28 to keep and back up for its whole life. Margins below use the agreed prices (club A$29, A$59, A$119; standard A$49, A$79, A$149) with guest downloads served from R2.

| Tier (full allowance used) | Supabase, 12 months (A$) | R2 backup, 13 months (A$) | Storage total (A$) | Worst case margin after all costs, club / standard |
| --- | --- | --- | --- | --- |
| Free, 200 photos | 0.79 | 0.60 | 1.39 | not applicable |
| Small, 1,500 photos | 5.90 | 4.48 | 10.38 | 45% / 67% |
| Medium, 4,000 photos | 15.72 | 11.98 | 27.70 | 29% / 46% |
| Large, 10,000 photos | 39.30 | 30.00 | 69.30 | 12% / 29% |

Assumptions: 10 MB per original, previews 0.5 MB more, in both places, Supabase US$0.0213 and R2 US$0.015 per GB a month, US$1 = A$1.50. Margins add face search, Stripe fees and the small Supabase traffic left for thumbnails and previews. Most events will not fill their allowance, so real margins will be higher.

## Copy and legal pages that must change

Your terms already promise 12 months and a 30 day warning, and the privacy page already deletes selfies when access ends, so the plan fits. The gaps below ship with the build, not after it.

| Where | Says today | Change to |
| --- | --- | --- |
| Privacy promises on the home page (`lib/copy/site.ts`) | Photos, attendee details and faceprints are stored in Sydney | Add: a copy of each photo is kept and delivered by Cloudflare, which may be outside Australia; faceprints never leave Sydney |
| Pricing includes and FAQ | Gallery open for 90 days, adjustable | Gallery open to guests for 12 months after the event on every tier, then deleted |
| Privacy page | Covers galleries closing and face data, but not when photos and guest lists are deleted, or backups | Add: photos and guest lists deleted 12 months after the event, backups 30 days later |
| Terms, "How long we keep an event" | At least 12 months, with a warning at least 30 days before deletion | Keep, and add: deleted items can be restored for 30 days; after the 12 month deletion nothing can be recovered |
| Organiser emails | Only "gallery closes in a week" for guests | New: 30 day and 7 day deletion warnings for organisers |

## Build plan for Claude Code

Three phases, in this order: the bin first (it protects organisers from the most likely mistake), then the backup copy, then the 12 month expiry, which is not due for anyone until late 2027. Read `AGENTS.md`, `docs/decisions.md` and `docs/handoff-pricing-tiers.md` first; migrations continue after the pricing work (26), applied through the Supabase connector one at a time.

**Phase 1: Recently deleted bin**

1. Migration: `deleted_at timestamptz` and `deleted_by uuid` on `media`, `albums` and `events`. RLS: guests never see rows with `deleted_at` set; organisers see them only in the bin. Put the check in `private.can_view_event_item` so every read path inherits it, then grep `lib/media` and `app` for queries that must also filter.
2. Change `deleteMediaAction`, `deleteAlbumAction` and `deleteEventAction` in `app/(app)/admin/actions.ts` to set `deleted_at` instead of removing files. Add `restoreMediaAction`, `restoreAlbumAction`, `restoreEventAction`.
3. Undo bar for 10 seconds after a delete; bin page under Settings with Restore and Delete now; a deleted event shows on Your events as "Deleted, restore until (date)" for its organisers.
4. Hourly job `runBinPurge` in `app/api/cron/hourly/route.ts`: anything deleted more than 30 days ago goes through the existing permanent delete code (`lib/events/delete.ts` and the media delete path).
5. Leave account deletion, removal requests (`lib/media/removals.ts`, `app/(app)/removal-actions.ts`) and face data deletion as immediate permanent deletes.
6. Photo allowance counting (pricing handoff 5.3) ignores rows with `deleted_at` set.

**Phase 2: Backup copy in R2**

1. Max creates the Cloudflare account, the bucket with the Oceania hint, and a token limited to that bucket. No lifecycle rule (see the safety net above). Env vars `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`; with none set, backup quietly does nothing, like face search without AWS keys.
2. Add `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` (R2 speaks the S3 API, endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`). New `lib/backup/r2.ts`: copy a Supabase path to the same key in R2 as a streamed multipart upload; delete keys.
3. Migration: `media.backed_up_at timestamptz`; table `backup_purge_queue` (key, due_at). Service role only.
4. After `app/api/media/[id]/finalize` succeeds, kick a backup of that item after the response (like `kickFaceJobs`). The hourly job drains anything not yet backed up within a time budget that leaves room for the face jobs.
5. Files too big for one function run (long videos): flag them and let `pnpm backup-drain` (a new local script) finish them.
6. When a file is permanently deleted, queue its backup keys for deletion 30 days later; the hourly job works the queue. Once a month, a check lists R2 keys whose event is past `photos_delete_at` plus 30 days, or no longer exists, and deletes them.
7. `scripts/restore-media.ts` (`pnpm restore-media --event <handle> [--album <id>] [--media <id>]`): dry run by default, `--confirm` copies files back and clears `deleted_at` where needed. Test it on the demo event.
8. Serve full quality downloads, zips (`lib/media/zip.ts`) and video playback from R2 with short lived presigned URLs, changing `app/api/media/sign` (its video variant streams the Supabase original today) and `app/api/media/[id]/download`. Fall back to Supabase for anything not copied yet. Then update the privacy promise and privacy page (section above).

**Phase 3: 12 month expiry**

1. Migration: `events.photos_delete_at` (set from the event's last day plus 12 months, by trigger when dates change), `deletion_warned_30_at`, `deletion_warned_7_at`, `photos_deleted_at`. Existing events: 12 months from their end date, or from today if that has already passed. `access_ends_at` defaults to the same date as, and can never be later than, `photos_delete_at`.
2. Hourly job `runRetentionJob`: send the 30 and 7 day warning emails to organisers (new template beside `emails/AccessEnding.tsx`), then expire events that are due.
3. `lib/events/expire.ts`: split the file deletion out of `deleteEventEverywhere` so expiry deletes media, albums' covers, selfies, faceprints and attendee memberships, but keeps the event row, payments and usage totals, and sets `photos_deleted_at`.
4. When an organiser closes a gallery early, selfies and faceprints must be deleted then, as the privacy page promises; check the hourly job does this and add it if not.
5. Organiser screens: a banner from 60 days before deletion, and a plain "Photos from this event were deleted on (date)" state after.
6. "Keep another year": A$29, bought on the billing page (website only, never in the iPhone app), moves `photos_delete_at` and `access_ends_at` 12 months later and pushes back the warning emails; can be bought again each year. The monthly R2 check (phase 2) reads `photos_delete_at`, so extended events are safe. Update pricing copy, privacy page and terms (section above). Record every choice in `docs/decisions.md`.

## Decisions

Decided: photos are kept 12 months after the event, guests can open the gallery for that whole time on every tier, and every original is backed up to Cloudflare R2.

- **Recently deleted bin:** 30 days. It is the first thing to build.
- **Free tier:** also keeps its gallery for 12 months, with 200 photos costing about A$1.40 of storage per free event.
- **Keeping longer:** "Keep another year" for A$29 per event, paid on the website like any upgrade. Because of it, the R2 safety net is a monthly check rather than a fixed age rule.
- **Large club price:** A$119, chosen to be the cheapest option. Worst case margin is 12%, acceptable because a 1,000 guest event rarely fills 10,000 photos. Revisit after the first real Large events.
- **Backups outside Australia:** accepted. The privacy page says Cloudflare's copy may be held outside Australia; faceprints never leave Sydney.

## Sources

Prices as published on 28 Sep 2026, in US$.

- [Supabase backups](https://supabase.com/docs/guides/platform/backups): database only, 7 days on Pro, point in time recovery from about US$100 a month
- [Supabase storage pricing](https://supabase.com/docs/guides/storage/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 data location](https://developers.cloudflare.com/r2/reference/data-location/): location hints are best effort
- [Cloudflare R2 data security](https://developers.cloudflare.com/r2/reference/data-security/): AES-256 at rest
