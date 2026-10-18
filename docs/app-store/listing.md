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

FOR ORGANISERS
Create an event, add your logo and colour, give each photographer their own upload link, and share the QR code. See who joined, what was downloaded, and handle removal requests from your phone. Events are set up and paid for on the website.

Photos and face data are stored in Sydney, Australia.

## Keywords (100)

event photos,conference,QR,selfie,photo sharing,gallery,photographer,corporate,face,download,meetup

## What's new (version 1.0)

The first release of Klubbies Events.

## Screenshots (6.3 inch, 1206 × 2622)

App Store Connect's required slot is "iPhone with Dynamic Island (medium display)": 1206 × 2622 or 1179 × 2556. It refused 1320 × 2868.

In `docs/app-store/screenshots/`, in this order:

1. `01-event.png`: an event's page, branded, with "12 photos of you" at the top
2. `02-your-photos.png`: Your photos, found with a selfie
3. `03-album.png`: an album, as an attendee sees it
4. `04-viewer.png`: the photo viewer with Download, Details and Remove
5. `05-join.png`: the join screen the QR scanner opens
6. `06-organiser.png`: the organiser's Overview with the QR code

Retaken in the new design on 17 Oct 2026. Regenerate them with `scripts/app-store-screenshots.ts` (instructions at the top of the file); on a local server it gives the demo attendee a selfie and demo matches first, since face matching needs AWS. Check you are happy for the people in the demo photos to appear in the App Store before uploading.

## App Privacy

App Store Connect → the app → **App Privacy**. Answers checked against Apple's definitions (https://developer.apple.com/app-store/app-privacy-details/) and the database on 17 Oct 2026. The app is our website in a web view, and Apple counts data collected through web views of our own site, so this covers everything events.klubbies.app collects. `ios/KlubbiesEvents/PrivacyInfo.xcprivacy` lists the same twelve types.

**Privacy policy URL:** https://events.klubbies.app/privacy

**Do you or your third-party partners collect data from this app?** Yes.

For **every** data type below, give the same three answers:

- Used for tracking? **No.** No advertising, no analytics SDK, nothing shared with data brokers.
- Linked to the user's identity? **Yes.** Everything sits with the account.
- Purpose: **App Functionality** only. Not Analytics, not Product Personalisation, not advertising or marketing.

### Select these data types

| Apple category → data type | What it is in Klubbies Events |
| --- | --- |
| Contact Info → **Name** | The name people give when they join; names on an organiser's guest list; photographer names |
| Contact Info → **Email Address** | Sign-in codes; new-album, gallery-closing and announcement emails; guest-list emails |
| User Content → **Photos or Videos** | Uploaded photos and videos, the optional selfie, profile pictures, event logos |
| User Content → **Audio Data** | The sound in uploaded videos (the app can record video with the microphone) |
| User Content → **Emails or Text Messages** | An organiser's announcement email (subject and message are stored and sent to guests) |
| User Content → **Customer Support** | Messages sent through the contact form on the support page |
| User Content → **Other User Content** | Event names and descriptions, album titles, profile bio, removal requests |
| Sensitive Info → **Sensitive Info** | Biometric data: faceprints made from event photos and the optional selfie, for "Your photos" (AWS Rekognition, Sydney) |
| Identifiers → **User ID** | The account ID |
| Identifiers → **Device ID** | The push notification token, only if notifications are turned on |
| Usage Data → **Product Interaction** | Which photos were viewed and downloaded (the organiser's activity log), last visit, Saved photos |
| Diagnostics → **Other Diagnostic Data** | A hashed IP address and the browser name stored with each view and download |

### Leave these unticked

| Data type | Why not |
| --- | --- |
| Payment Info, Purchase History | Organisers pay on the website through Stripe. Nothing can be bought in the app, and card details never reach us |
| Precise Location, Coarse Location | We never read location. Note: original files keep the camera's own metadata, which can include where a photo was taken |
| Contacts | We never read the phone's contacts. Guest lists are files organisers upload, covered by Name and Email Address |
| Phone Number, Physical Address, Other Contact Info | Not asked for |
| Health, Fitness, Financial, Credit | Not collected |
| Browsing History, Search History | Album search runs on the device; nothing about other websites |
| Advertising Data, Other Usage Data | No ads; Product Interaction covers usage |
| Crash Data, Performance Data | No crash or performance reporting in the app; server errors are logged without user details |
| Gameplay Content, Environment Scanning, Hands, Head, Other Data | Not applicable |

### Worth knowing

- **Emails carry a small credit line** ("Photos by Klubbies Events · Run your own event"). If a reviewer counts that as marketing, add **Developer's Advertising or Marketing** to Email Address. We send no newsletters.
- **The hashed IP and browser name are stored but never read.** If you'd rather not declare Other Diagnostic Data, we can stop storing them; then that row goes.

## Age rating

Answer the questionnaire with: no violence, no mature themes, no gambling, no unrestricted web access (the app only opens events.klubbies.app; other links open in a Safari sheet), **user-generated content: yes**. Expect 13+ or 16+ depending on Apple's current tiers.

## App Review

### Sign-in for the reviewer

Klubbies Events signs in with an emailed code, which a reviewer can't receive. They use **Use a password instead** on the sign-in screen with a demo account that already belongs to an event with photos.

Set up on 18 Oct 2026: `appreview@klubbies.app` (forwards to Max's inbox) is on the guest list of the event "TESTING" as "Reviewer", has signed in once under that name and has a password. Its published albums have about 300 photos.

- Keep the list name "Reviewer": since migration 36, someone who signs in under a name that doesn't match the list waits for organiser approval and sees no photos. The password sign-in doesn't re-check the name, and this account already matched, so it won't be held.
- Before submitting, consider renaming the event and the album "test 2" to something presentable, and check you're happy for Apple's reviewer to see those photos.

| Field | Value |
| --- | --- |
| Username | appreview@klubbies.app |
| Password | (set in step 2) |

### Notes for the reviewer

Klubbies Events shares photos from private events: conferences, launches and club events. An organiser creates an event on our website, photographers upload to it, and attendees join by scanning the event's QR code or opening its link, then confirming their email with a one-time code.

To review: tap "Use a password instead" on the sign-in screen and use the demo account above. It is an attendee of a demo event with photos.

Built for iPhone, beyond the website:
- A native QR scanner (on the sign-in screen and on Your events). It opens only Klubbies Events links and refuses any other code.
- Save to Photos straight into the photo library (add-only access), and downloads of whole albums.
- A native offline screen and launch screen.

Also worth checking:
- Your photos: finds the photos you're in from an optional selfie. Consent is asked on that screen, only the account holder sees their matches, and turning it off deletes the faceprint.
- Account deletion: Profile (the "You" tab), Delete my account.
- User content: every photo has Remove (request removal), which hides it immediately while the organiser decides. Organisers can remove any attendee from their event. We act on reports to support@klubbies.app within 24 hours.
- Payments: organisers pay per event on our website. The app contains no purchases and no links, buttons or wording about paying.

## Before you submit

- `SUPABASE_SERVICE_ROLE_KEY` set in Vercel, so the live site can sign people in.
- `support@klubbies.app` receives email (the support page's contact form sends to it, and every email's Reply-To is it).
- Notifications: the app only offers them once the APNs variables are set in Vercel (`ios/README.md`, step 5). Until then they are left out of the description and the reviewer notes; add both back when they work.
- The reviewer account above works on a phone, not just on the Mac.
