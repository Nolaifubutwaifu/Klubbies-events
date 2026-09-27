# Klubbies Events

Private photo galleries for one-off events: conferences, launches, meetups. The organiser creates an event, gives each photographer an upload link, and shares one link or QR code with attendees. Attendees confirm their email with a code, take a selfie if they want, and get every photo they're in at full quality. Nothing is public.

Live at https://events.klubbies.app (`APP_URL`) on Vercel (project `klubbies-events`, team `couple-app-s-projects`, region `syd1`). Database, auth and file storage are the Supabase project `klubbies-events` (ref `yfdglvhhakbuahyfrihs`, Sydney). Face search uses AWS Rekognition. Email goes out through Resend as `Klubbies Events <events@klubbies.app>`.

This started as a fork of Klubbies (club photo archives). Klubbies is a separate product with real users: its folder, Supabase project (`gyeqrmsidwmfpeunjntl`), Vercel project and iPhone app are not this one.

## Where things are

| Path | What's there |
| --- | --- |
| `app/(marketing)` | The public site: home, privacy, terms, refunds, support |
| `app/(auth)` | Sign in, the event join screen (`/signin?event=`), email code, create an event (`/start`) |
| `app/(app)/e/[handle]` | The attendee side: event home, albums, the photo viewer, Your photos (`me`), Saved |
| `app/(app)/admin/[handle]` | The organiser side: overview, setup checklist, albums, upload, photographers, attendees, share kit and poster, removals, activity, settings, billing |
| `app/(app)/admin/new` | Create an event |
| `app/(app)/account`, `events` | Your profile (with account deletion), and the list of your events |
| `app/g/[token]` | Photographer upload page (the only signed-out page with content) |
| `app/api` | Route handlers: uploads, downloads, zips, face crops, guest list import, push registration, Stripe, the hourly cron |
| `components` | Shared UI |
| `lib` | Everything that isn't UI: `auth`, `billing`, `faces`, `media`, `storage`, `roster` (guest lists), `email`, `push`, `account`, `events`, `supabase` clients |
| `emails` | React Email templates |
| `supabase/migrations` | The whole database schema, in order. `supabase/tests` holds the face RLS checks |
| `ios` | The iPhone app (see `ios/README.md`) |
| `tests` | `unit` (Vitest) and `e2e` (Playwright access-control and account tests) |
| `docs` | The spec (`masterfile.md`), decisions made since (`decisions.md`), QA reports (`reports/`), and Klubbies' own history |

Start with `docs/masterfile.md` for what the product is meant to be, and `docs/decisions.md` for why it is the way it is.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the values
npx supabase start           # local database in Docker
pnpm dev
```

Locally, `.env.local` points at the Supabase stack on `127.0.0.1:54321`, and `EMAIL_DRY_RUN=1` prints every email, sign-in codes included, to the server log instead of sending it. Sample data:

```bash
pnpm demo   # Brisbane Product Summit 2026 (@demo_summit); the organiser is organiser.demo@klubbies.test
```

## Checks

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm typecheck` | Route types + `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Access-control and account tests against the Supabase project in `.env.local` (needs the service role key) |

## Maintenance scripts

All read `.env.local` and use the service role. Nothing destructive happens without `--confirm`.

| Command | What it does |
| --- | --- |
| `pnpm backfill-faces --event <handle>` | Face-index a big library locally, with no function timeout |
| `pnpm dedupe-media --event <handle>` | Report photos uploaded twice into an album; `--confirm` deletes the extra copies |
| `pnpm logo-marks` | Make the small badge version of logos uploaded before those existed |

## Deploying

Vercel deploys `main` to production. Every variable from `.env.example` is set in the Vercel project, pointed at the cloud Supabase project. Apply new migrations to Supabase, in order, before the code that needs them goes live.

`CRON_SECRET` enables the hourly job at `/api/cron/hourly`: it publishes scheduled albums, sweeps unanswered removal requests, sends the "gallery closes in a week" email, clears uploads that never finished, and works through the face search queue.

## Payments

One payment per event, through Stripe Checkout in `payment` mode. Setting up an event is free; paying unlocks uploading, photographer links and attendees.

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` (a one-time price). Use test mode keys locally.
2. In Stripe, Developers, Webhooks, add `https://events.klubbies.app/api/stripe/webhook` with `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. The price shown on the site lives in `lib/copy/site.ts` (`PRICE`). Change it together with the Stripe price.

Without Stripe keys, local development shows "Activate without payment (development)" on the billing page. Production never does.

## Stack

Next.js 16 (App Router), Tailwind 4, Supabase (Postgres with RLS, Storage, Auth OTP), AWS Rekognition, Stripe, Resend with React Email, Zod, Vitest, Playwright, pnpm.
