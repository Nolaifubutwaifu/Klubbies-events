# Klubbies

Private photo and video albums for university clubs. Only people on a club's member list, verified with an emailed code, can see anything. Members can find the photos they're in with face recognition, which is on for every club (a club admin can switch it off).

Live at https://www.klubbies.app (`APP_URL`) on Vercel (project `klubbies`, region `syd1`). The database, auth and file storage are the Supabase project `klubbies` (Sydney). Face recognition uses AWS Rekognition.

## Where things are

| Path | What's there |
| --- | --- |
| `app/(marketing)` | The public site: home, how it works, privacy, terms, refunds |
| `app/(auth)` | Sign in, email code, start a club |
| `app/(app)/c/[handle]` | The member side of a club: events, albums, the photo viewer, Photos of you (`me`), Saved, Club feed |
| `app/(app)/admin/[handle]` | The committee side: dashboard, albums, upload, members, guest links, removals, handover, billing and settings |
| `app/(app)/account`, `clubs` | Your profile, and the list of your clubs |
| `app/g/[token]` | Guest photographer upload page (the only signed-out page with content) |
| `app/api` | Route handlers: uploads, downloads, zips, face crops, roster import, Stripe, the hourly cron |
| `components` | Shared UI. `components/soft` is the theme's building blocks and the landing page |
| `lib` | Everything that isn't UI: `auth`, `billing`, `faces`, `media`, `storage`, `roster`, `email`, `supabase` clients |
| `emails` | React Email templates |
| `supabase/migrations` | The whole database schema, in order. `supabase/tests` holds the face RLS checks |
| `scripts` | One-off and maintenance scripts (below) |
| `tests` | `unit` (Vitest) and `e2e` (Playwright access-control tests) |
| `docs` | The spec (`masterfile.md`), every decision made since (`decisions.md`), design history and the face tuning method |

Start with `docs/masterfile.md` for what the product is meant to be, and `docs/decisions.md` for why it is the way it is. The newest decisions are at the bottom.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev
```

Every migration in `supabase/migrations` is applied to the Supabase project. For a fresh project, apply them in order with `supabase db push` or the SQL editor. Sample data:

```bash
SEED_ADMIN_EMAIL=you@example.com pnpm seed   # two small clubs
pnpm demo                                    # the design's fictional club, UniMelb FC
```

## Checks

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm typecheck` | Route types + `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Access-control tests against the real Supabase project (needs the service role key) |

## Maintenance scripts

All read `.env.local` and use the service role. Nothing destructive happens without `--confirm`.

| Command | What it does |
| --- | --- |
| `pnpm backfill-faces --club <handle>` | Face-index a big library locally, with no function timeout |
| `pnpm dedupe-media --club <handle>` | Report photos uploaded twice into an album; `--confirm` deletes the extra copies |
| `pnpm logo-marks` | Make the small badge version of club logos uploaded before those existed |

## iPhone app

`ios/` holds the native iPhone app. Open `ios/Klubbies.xcodeproj` in Xcode; `ios/README.md` covers running it on a phone and shipping it through TestFlight.

## Deploying

Vercel deploys `main` to production. Set every variable from `.env.example`, and apply new migrations to Supabase before the code that needs them goes live.

`CRON_SECRET` enables the hourly job at `/api/cron/grace`: it publishes scheduled albums, sweeps unanswered removal requests, expires grace memberships, clears uploads that never finished, and works through the face recognition queue.

The project is on Vercel Pro, which the hourly cron (`0 * * * *` in `vercel.json`) needs: Hobby refuses more than one cron run a day and fails the deploy. Dropping back to Hobby means going back to `0 23 * * *` and the "first morning after" wording in `AlbumManager`, `NewAlbumPanel` and `scheduleAlbumAction` (see decision 68).

## Billing

Clubs pay through Stripe Checkout before they can add members or upload.

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` (use test mode keys locally).
2. In Stripe → Developers → Webhooks, add `https://<your-domain>/api/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`, `.updated` and `.deleted`
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. For local webhooks, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Stack

Next.js 16 (App Router), Tailwind 4, Supabase (Postgres with RLS, Storage, Auth OTP), AWS Rekognition, Stripe, Resend with React Email, Zod, Vitest, Playwright, pnpm.
