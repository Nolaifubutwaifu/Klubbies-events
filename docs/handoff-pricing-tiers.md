# Klubbies Events pricing tiers

The build spec for tiers, the free tier, club codes, the founding offer, upgrades, the guest overflow window, the video rule, the credit line and attribution. Written on 28 Sep 2026 from Max's strategy doc, "Klubbies Events launch: marketing and pricing strategy" (https://claude.ai/code/artifact/7c64b043-a01b-4c48-8085-c3ff7f731efa), plus the six answers Max approved in the build session the same day (sections 5.4 to 5.9). Decisions made while building are in `docs/decisions.md`. Retention and backups are in `docs/handoff-retention-backups.md`.

## 1. In one paragraph

One payment per event, in four tiers by guest headcount, each with a photo allowance. Free is permanent and needs no card. Student clubs get a lower rate through a campus club code. The first 25 founding clubs get one Medium event free. Upgrades cost the difference, or the difference plus 25% once the event has run out of room. Every tier keeps its gallery open for 12 months and gets face search, branding and the share kit; tiers differ only by guests and photos. Prices depend on guests downloading from the Cloudflare R2 copy, so paid tiers must not go on sale before that works.

## 2. Tiers

| Tier | Guests joined | Photos and videos | Club price (A$) | Standard price (A$) |
| --- | --- | --- | --- | --- |
| Free | up to 50 | 200 | 0 | 0 |
| Small | up to 150 | 1,500 | 29 | 49 |
| Medium | up to 400 | 4,000 | 59 | 79 |
| Large | up to 1,000 | 10,000 | 119 | 149 |
| Over 1,000 | quote | quote | quote | quote (cost + 60%) |

- Every tier: gallery open for 12 months after the event, face search, branding, share kit.
- Prices are one payment per event, never a subscription. GST: not registered while turnover is under A$75,000; prices say "incl. GST" once registered.
- Existing events already paid or comped keep unlimited use. Existing unpaid events become Free.
- Nothing about prices or payment inside the iPhone app.

## 3. Club rate, founding offer, partner codes

- **Club codes**, one per campus: `UQCLUBS`, `QUTCLUBS`, `GRIFFITHCLUBS`. Entered on the billing page, they switch Checkout to the club prices. They are app codes, not Stripe promotion codes, because one Stripe code can't give a different discount per tier. Each code records which campus converts. Max checks the club is real (union listing) before handing one out.
- **Founding offer:** the first 25 clubs get one Medium event free (worth A$59 at the club rate) for events before 31 Mar 2027, then 50% off their second. Stripe promotion code `FOUNDING25`, 100% off, 25 uses, expiring 31 Mar 2027. If the free event outgrows Medium, Medium to Large costs only the gap between the club prices (A$60), as if they had paid for Medium. The billing page always shows the real price with the discount, never "free". In return: a 15 minute call, a two line testimonial, permission to name the club, and a short guest survey.
- **Photographer partner codes** (from Nov): clients get 20% off; the photographer gets a free event per 3 referrals.

## 4. Videos

Each started minute of video counts as 10 photos toward the allowance. Each video can be up to 500 MB. This is explained in the FAQ on the home page, not on the price cards.

## 5. Rules

### 5.1 Headcount

Headcount is guests who join, not tickets sold. Only attendees count; organisers, co-organisers and photographers never do. On a guest list, people count when they first sign in, not when they are imported. The organiser picks a tier from their expected numbers (asked as "About how many guests?") when they choose a tier.

### 5.2 Upgrades

Upgrades cost only the difference between the two tiers, at the rate the event started on (club or standard). Small to Medium for a club is A$30.

### 5.3 Photo allowance

At the photo limit uploads stop. Photographers see a plain "This event is full. Ask the organiser to make room." The organiser gets an upgrade prompt. Photos and videos in Recently deleted don't count. Upgrades for photo room always cost the plain difference.

### 5.4 Guest limit and the overflow window

Example: a Small event includes 150 guests.

- 10% over is included: guests 151 to 165 join normally.
- **The window opens** when guest 166 joins and lasts 48 hours. Guests 166 to 225 (50% over) join normally during it.
- **Guest 226 and later** are stopped on the join screen before they're sent a code: "This event is full right now. We've let the organiser know." Nobody verifies their email only to be turned away.
- **If nobody upgrades by the end of the window,** the guests who joined last are paused (166 onwards). They keep their account, selfie and saved photos. When they open the event they see "This gallery is full for now. We've asked the organiser to make room, and we'll email you when it opens." They can't view or download until then.
- Face matching keeps running for paused guests in the background, so their photos are ready the moment they're let in.
- **Making room:** if the organiser removes someone, the earliest paused guest is let in automatically. If the organiser upgrades, everyone paused is let in at once.
- After an upgrade the new tier gets its own 10% and its own 2 day window.
- Shown with an asterisk under the pricing table.

### 5.5 Overflow emails

All emails about the event go to every organiser and co-organiser, once per event per stage.

| When | Who | Says |
| --- | --- | --- |
| 90% of guest limit (guest 135) | Organisers | Nearly full. Upgrade now for the plain difference |
| Window opens (guest 166) | Organisers | Over the limit. 48 hours to upgrade; guests keep joining up to 225. Shows the late price |
| 12 hours left | Organisers | Reminder, same content |
| Window closes, no upgrade | Organisers | "(Number) guests are paused. Upgrade any time to let them in" |
| Let back in | Each paused guest | "Your photos from (event) are ready" |
| 90% of photo allowance | Organisers | Nearly full |
| Photo allowance full | Organisers | Uploads have stopped; upgrade to continue |

Paused guests get no email when they're paused; they see the message on screen. Photographers see "this event is full, ask the organiser" on the upload page, with no email.

### 5.6 Late upgrade price

- Upgrade before you run out of room and you pay the difference. Upgrade after the free 10% is used up (the window has opened) and you pay the difference plus 25%, rounded to the nearest dollar. The late price stays once the window has opened, whether it is still open or has closed.
- Photo limit upgrades always cost the plain difference.
- The event keeps its rate (club or standard).
- No upgrade prices in Stripe: the app works out the amount and sends one Checkout, like today's, labelled for example "Upgrade Small to Medium (late)", with an invoice.
- Promotion codes are off for upgrades, so FOUNDING25 can't make an upgrade free. Founding clubs still get their A$60 Medium to Large gap.

| Upgrade | On time, club / standard (A$) | Late, club / standard (A$) |
| --- | --- | --- |
| Free to Small | 29 / 49 | 36 / 61 |
| Free to Medium | 59 / 79 | 74 / 99 |
| Free to Large | 119 / 149 | 149 / 186 |
| Small to Medium | 30 / 30 | 38 / 38 |
| Small to Large | 90 / 100 | 113 / 125 |
| Medium to Large | 60 / 70 | 75 / 88 |

### 5.7 Credit line

- "Photos by Klubbies Events" on attendee pages, emails and the poster, on every tier including paid events. It links to the home page; "Run your own event" links to Create an event. Both links are tagged so sign ups from the credit can be counted (5.9).
- On the poster it is printed text only; a second QR code would confuse people scanning for the event.
- Inside the iPhone app it is plain text with no link, because the link leads to a paid product.

### 5.8 Usage view

- **Organisers**, on Overview and Billing: "Guests 132 of 150" and "Photos 1,210 of 1,500". Videos show as photo equivalents; the bin is left out.
- **Max**, on a private page only his email can open: one row per event with tier and price paid, guests joined, selfies, photos and video minutes, storage in Supabase and R2, face search calls, downloads and zips, an estimated cost in A$ using the retention handoff's rates, and the margin. Also the launch measures (join, selfie and download rates, time to first photo, source) and a spreadsheet download.
- Totals are saved so they survive the 12 month deletion.
- Expected headcount is asked on the tier step ("About how many guests?"); it also helps suggest the right tier.

### 5.9 Where an event came from

- **Tracked links first.** Any link with a tag, for example `klubbies.app/?src=flyer-uq-union`, is remembered for 30 days in that browser and saved on the event when that person creates one. The first tag seen wins.
- **Codes second.** A campus club code or a photographer partner code used at checkout is saved too.
- **A question as a fallback.** Create an event asks "How did you hear about us?" (optional): Flyer or poster, Instagram or TikTok, Email from Klubbies, At an event (saw the credit), A photographer, Another club, Other.
- The privacy page gets one line about the source tag. It covers organisers only; guests aren't tracked.

## 6. Build phases

1. **Plans, database, free tier and limits** (after the bin): plan columns and limits on events, the free tier, legacy events unlimited, the photo allowance with video minutes and the 500 MB cap, the guest limit with the 10% grace, the 2 day window and pausing, enforced in the database.
2. **Checkout and upgrades** (only after the R2 copy serves downloads): tier picker and expected headcount, club codes, Stripe Checkout per tier, upgrades and the late price, overflow emails and screens, pricing copy with the asterisk footnote, the video FAQ.
3. **Credit line, attribution and the usage view.**

Max's steps: the Stripe prices (six tier prices), the FOUNDING25 promotion code, Resend Pro before the first real event.
