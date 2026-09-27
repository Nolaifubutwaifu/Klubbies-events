# Klubbies Events for iPhone

A native iPhone app that runs Klubbies Events from https://events.klubbies.app. Anything you change on the website shows up in the app straight away. You only need a new build when something in this `ios/` folder changes.

This is its own app, separate from the Klubbies club app: different name, bundle ID, icon and website. Both can sit on the same phone.

What the app adds on top of the website:

- **Scan the event's QR code** on the sign-in screen and on Your events. The camera reads the poster or slide and opens that event's join screen. Codes that aren't a Klubbies Events link are refused with a clear message.
- **Save to Photos** saves photos straight into the Photos app, with no share sheet step.
- **Downloads** (album zips) open the share sheet, where Save to Files lives.
- **Notifications** when a new album is published. Tapping one opens the album.
- **Delete my account** on the profile, as Apple requires.
- Pull down to refresh, swipe from the left edge to go back, real iOS pop-ups for confirmations.
- An offline screen with Try again, for venues with no signal.
- Links to other websites open in an in-app Safari sheet. Sign-in is remembered between launches.
- No payment buttons inside the app. Organisers pay for an event on the website.

| Setting | Value |
|---|---|
| Display name | Klubbies Events |
| Bundle ID | `app.klubbies.events` |
| Version | 1.0 (build 1) |
| Minimum iOS | 17.0 |
| Devices | iPhone only, portrait |

## 1. Open the project

Double-click `ios/KlubbiesEvents.xcodeproj`. Xcode opens it.

## 2. Sign in to your developer account (once)

1. Xcode menu → **Settings** → **Accounts**.
2. Click **+** → **Apple Account**, and sign in with your paid Apple Developer account.

## 3. Choose your team (once)

1. In the left sidebar click the blue **KlubbiesEvents** project icon, then the **KlubbiesEvents** target.
2. Open the **Signing & Capabilities** tab.
3. Leave **Automatically manage signing** ticked.
4. Set **Team** to your paid team. Xcode registers the bundle ID `app.klubbies.events` for you, with push notifications turned on.

## 4. Put it on your phone

1. Plug your iPhone into the Mac and tap **Trust** on the phone.
2. On the phone: **Settings** → **Privacy & Security** → **Developer Mode** → on (skip if you already did this for Klubbies).
3. In Xcode's top bar, pick your iPhone as the run destination.
4. Press **⌘R** (or the play button). The app installs and opens.

To try the QR scanner, open an event's Share page on your computer and scan the QR code with the app.

## 5. Turn on notifications (once)

One APNs key works for every app on your team, so you can reuse the Klubbies key.

1. If you don't have the Klubbies `.p8` file and Key ID any more: https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Keys** → **+**, name it `Klubbies Events push`, tick **Apple Push Notifications service (APNs)**, **Continue** → **Register**, then **Download** the `.p8` (only once) and note the **Key ID**.
2. Your **Team ID** is at the top right of the developer site, or under Membership details.
3. In Vercel → **klubbies-events** → Settings → Environment Variables, add for Production:
   - `APNS_KEY_ID`: the Key ID
   - `APNS_TEAM_ID`: the Team ID
   - `APNS_PRIVATE_KEY`: open the `.p8` file in TextEdit and paste the whole contents, including the BEGIN and END lines
   - `APNS_BUNDLE_ID`: `app.klubbies.events`
4. Redeploy (Deployments → the latest one → Redeploy).

Until those are set, everything works except that nothing is sent.

## 6. TestFlight

### Create the app in App Store Connect (once)

1. Go to https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Fill in:
   - Platform: **iOS**
   - Name: **Klubbies Events** (if it's taken, try **Klubbies Events: Photos**)
   - Primary language: **English (Australia)**
   - Bundle ID: **app.klubbies.events**. It appears here after step 3 above. If it doesn't, register it at https://developer.apple.com/account → Identifiers.
   - SKU: **klubbies-events-ios**
   - User access: **Full Access**

### Upload a build

1. In Xcode's top bar, set the destination to **Any iOS Device (arm64)**.
2. Menu → **Product** → **Archive**. It takes a minute or two, then the Organizer window opens.
3. Click **Distribute App** → **App Store Connect** → **Distribute**. Keep the defaults, including automatic build number handling.
4. Apple processes the build, usually in 10 to 30 minutes. You get an email when it's ready.

### Test it

- **Just you and your team (no review):** App Store Connect → the app → **TestFlight** → **Internal Testing** → **+** → add yourself. Install the **TestFlight** app and accept the invite.
- **Other people:** add an **External Testing** group. The first build goes through Beta App Review, usually within a day. Give reviewers the demo account from `docs/app-store/listing.md`.

### Every later upload

Each upload needs a higher build number; the automatic option in step 3 handles that. For a new public version, change **Version** under the target's **General** tab (1.0 → 1.1).

The App Store listing, privacy answers, review notes and screenshots are in `docs/app-store/listing.md`.

## Testing against your Mac

Debug builds can open a local server instead of the live site. In Xcode: **Product** → **Scheme** → **Edit Scheme** → **Run** → **Arguments** → Environment Variables, add `KLUBBIES_EVENTS_START_URL` = `http://localhost:3300/events`. Use the dev server (`pnpm dev`), not a local production build: WebKit drops the secure sign-in cookie on plain `http://localhost`.

The Simulator has no camera. To test scanning there, also set `KLUBBIES_EVENTS_QR_IMAGE` to the path of a QR code image on the Mac (the PNG from an event's Share page): the scanner reads it exactly as it would read the camera. This only exists in Debug Simulator builds.

## What's in here

| File | What it does |
|---|---|
| `KlubbiesEvents/AppConfig.swift` | Start URL, which domain stays in the app, the colours, the user agent marker |
| `KlubbiesEvents/WebViewController.swift` | The web view, links, downloads, pop-ups, pull to refresh, opening the scanner |
| `KlubbiesEvents/QRScanner.swift` | The QR scanner, and the rule for which codes it opens (`EventLink`) |
| `KlubbiesEvents/PhotoSaver.swift` | Save to Photos (the site calls it through `lib/native-app.ts`) |
| `KlubbiesEvents/PushManager.swift` | Notifications: permission, device token, opening the right page on a tap |
| `KlubbiesEvents.entitlements` | Lets the app receive notifications |
| `KlubbiesEvents/OfflineView.swift` | The "Can't reach Klubbies Events" screen |
| `KlubbiesEvents/Assets.xcassets` | App icon and colours |
| `KlubbiesEvents/PrivacyInfo.xcprivacy` | Apple's privacy manifest |
| `Info.plist` | App name and the text iOS shows when it asks for camera and Photos access |

The app adds `KlubbiesEventsApp/<version>` to its user agent, and the website uses that to know it is inside the app (`lib/native-app.ts`). Klubbies' own app sends `KlubbiesApp/`. Keep the two markers different, or each site would treat the other app as its own.
