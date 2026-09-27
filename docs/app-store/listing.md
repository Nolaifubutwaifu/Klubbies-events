# App Store pack: Klubbies Events

Everything App Store Connect asks for, ready to paste. Field limits are Apple's; every text below fits.

## App information

| Field | Value |
| --- | --- |
| Name (30) | Klubbies Events |
| Subtitle (30) | Private event photo galleries |
| Bundle ID | `app.klubbies.events` |
| SKU | `klubbies-events-ios` |
| Primary language | English (Australia) |
| Category | Photo & Video (secondary: Business) |
| Price | Free. The app sells nothing; organisers pay per event on the website |
| Support URL | https://events.klubbies.app/support |
| Marketing URL | https://events.klubbies.app |
| Privacy policy URL | https://events.klubbies.app/privacy |
| Copyright | 2026 Klubbies Events |

## Promotional text (170)

Scan the event QR code, confirm your email, take a selfie, and get every photo you are in at full quality. Private to the people the organiser let in.

## Description (4000)

Every photo from your event, in your hands.

Klubbies Events is where the photos from a conference, launch or meetup go after the day. The organiser shares one link or QR code. You open it, confirm your email with a code, and the event's galleries are yours to browse and download at full quality.

FIND YOURSELF IN SECONDS
Add a selfie if you like, and Klubbies Events shows you every photo you appear in, across every album. It's your choice, only you see your matches, and you can turn it off and delete your face data at any time.

JOIN BY SCANNING
Point the app at the QR code on the event poster, slide or table card and you land on that event's page. No searching, no typing a link.

SAVE THE GOOD ONES
Save photos straight into your Photos library, download a whole album or all your photos at once, and keep favourites in Saved to come back to.

PRIVATE BY DEFAULT
Nothing is public. Only people the organiser let in can see an event, every photo is served through a link that expires within minutes, and the gallery closes on the date the organiser sets. If you're in a photo you want gone, ask for it to come down: it's hidden straight away while the organiser decides.

NEW PHOTOS, TOLD STRAIGHT AWAY
Turn on notifications and hear when a new album is published.

FOR ORGANISERS
Create an event, add your logo and colour, give each photographer their own upload link, and share the QR code. See who joined, what was downloaded, and handle removal requests from your phone. Events are set up and paid for on the website.

Photos and face data are stored in Sydney, Australia.

## Keywords (100)

event photos,conference,QR,selfie,photo sharing,gallery,photographer,corporate,face,download,meetup

## What's new (version 1.0)

The first release of Klubbies Events.

## Screenshots (6.9 inch, 1320 × 2868)

In `docs/app-store/screenshots/`, in this order:

1. `01-event.png`: an event's page, branded, with the attendee's own photos at the top
2. `02-your-photos.png`: Your photos, found with a selfie
3. `03-album.png`: an album
4. `04-viewer.png`: the photo viewer with Save and Download
5. `05-join.png`: the join screen the QR scanner opens
6. `06-organiser.png`: the organiser's overview

Regenerate them with `scripts/app-store-screenshots.ts` (instructions at the top of the file). Check you are happy for the people in the demo photos to appear in the App Store before uploading.

## App Privacy

Tracking: **No.** No data is used to track people, and there is no advertising or analytics SDK.

Data collected, all **linked to the user**, all for **App Functionality** only:

| Apple category | Data type | Why |
| --- | --- | --- |
| Contact Info | Email Address | Sign-in codes, new-album and gallery-closing emails |
| Contact Info | Name | Shown to the organiser on the attendee list |
| User Content | Photos or Videos | Photos organisers, photographers and attendees upload; the optional selfie |
| Sensitive Info | Biometric data | Faceprints made from event photos and the optional selfie, for "Your photos" |
| Identifiers | User ID | The account |
| Identifiers | Device ID | The notification token, only if notifications are turned on |
| Usage Data | Product Interaction | The event's activity log of views and downloads, shown to its organisers |

Not collected: location, financial info (payments happen on the website through Stripe), contacts, browsing history, diagnostics.

## Age rating

Answer the questionnaire with: no violence, no mature themes, no gambling, no unrestricted web access (the app only opens events.klubbies.app; other links open in a Safari sheet), **user-generated content: yes**. Expect 13+ or 16+ depending on Apple's current tiers.

## App Review

### Sign-in for the reviewer

Klubbies Events signs in with an emailed code, which a reviewer can't receive. They use **Use a password instead** on the sign-in screen with a demo account that already belongs to an event with photos.

To set it up once the live site works (Claude can do this with your OK, since it writes to the live database):

1. Create a demo event on the live site under your own account, with two or three albums of photos you are happy to show.
2. Add `appreview@klubbies.app` to it as an attendee, sign in once as that address, and set a password on its profile page.
3. Put the address and password in the fields below. Keep the event comped (no payment needed).

| Field | Value |
| --- | --- |
| Username | appreview@klubbies.app |
| Password | (set in step 2) |

### Notes for the reviewer

Klubbies Events shares photos from private events: conferences, launches and meetups. An organiser creates an event on our website, photographers upload to it, and attendees join by scanning the event's QR code or opening its link, then confirming their email with a one-time code.

To review: tap "Use a password instead" on the sign-in screen and use the demo account above. It is an attendee of a demo event with photos.

- Scan the event's QR code: on the sign-in screen and on Your events. It opens only Klubbies Events links and refuses any other code.
- Your photos: finds the photos you're in from an optional selfie. Consent is asked on that screen, only the account holder sees their matches, and it can be turned off, which deletes the faceprint.
- Save to Photos (add-only access), downloads, notifications for new albums, an offline screen.
- Account deletion: Profile (the "You" tab), Delete my account.
- Reporting content: open a photo, More, Request removal. It is hidden immediately and the organiser decides; we act on reports to support@klubbies.app within 24 hours.
- Payments: organisers pay per event on our website. The app contains no purchases and no links or buttons to pay.

## Before you submit

- `SUPABASE_SERVICE_ROLE_KEY` set in Vercel, so the live site can sign people in.
- `support@klubbies.app` receives email (it's on the support page and every legal page).
- APNs variables set in Vercel if you want notifications at launch (see `ios/README.md`, step 5).
- The reviewer account above works on a phone, not just on the Mac.
