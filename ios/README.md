# Klubbies for iPhone

A native iPhone app that runs Klubbies from https://www.klubbies.app. Anything you change on the website shows up in the app straight away. You only need a new build when something in this `ios/` folder changes.

What the app adds on top of the website:

- **Save to Photos** saves album photos straight into the Photos app, with no share sheet step.
- **Downloads** (album zips, member exports) open the share sheet, where Save to Files lives.
- Pull down to refresh, and swipe from the left edge to go back.
- Real iOS pop-ups for confirmations such as "Delete this album?".
- An offline screen with Try again, for venues with no signal.
- Links to other websites open in an in-app Safari sheet.
- Sign-in is remembered between launches.
- Inside the app, the billing page shows the club's status but no payment buttons. Apple rejects apps that sell subscriptions outside in-app purchase, so clubs pay on the website.

| Setting | Value |
|---|---|
| Bundle ID | `app.klubbies.ios` |
| Version | 1.0 (build 1) |
| Minimum iOS | 17.0 |
| Devices | iPhone only, portrait |

## 1. Open the project

Double-click `ios/Klubbies.xcodeproj`. Xcode opens it.

## 2. Sign in to your developer account (once)

1. Xcode menu → **Settings** → **Accounts**.
2. Click **+** → **Apple Account**, and sign in with your paid Apple Developer account.

## 3. Choose your team (once)

1. In the left sidebar click the blue **Klubbies** project icon, then the **Klubbies** target.
2. Open the **Signing & Capabilities** tab.
3. Leave **Automatically manage signing** ticked.
4. Set **Team** to your paid team. Xcode registers the bundle ID `app.klubbies.ios` for you.

If Xcode says the bundle ID is taken, change it to something like `app.klubbies.iphone` and use the new one in step 5.

## 4. Put it on your phone

1. Plug your iPhone into the Mac and tap **Trust** on the phone.
2. On the phone: **Settings** → **Privacy & Security** → **Developer Mode** → on. The phone restarts.
3. In Xcode's top bar, pick your iPhone as the run destination.
4. Press **⌘R** (or the play button). The app installs and opens.

## 5. TestFlight

### Create the app in App Store Connect (once)

1. Go to https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Fill in:
   - Platform: **iOS**
   - Name: **Klubbies** (if it's taken, try **Klubbies: Club Photos**)
   - Primary language: **English (Australia)**
   - Bundle ID: **app.klubbies.ios**. It appears here after step 3 above. If it doesn't, register it at https://developer.apple.com/account → Identifiers.
   - SKU: **klubbies-ios**
   - User access: **Full Access**

### Upload a build

1. In Xcode's top bar, set the destination to **Any iOS Device (arm64)**.
2. Menu → **Product** → **Archive**. It takes a minute or two, then the Organizer window opens.
3. Click **Distribute App** → **App Store Connect** → **Distribute**. Keep the defaults, including automatic build number handling.
4. Apple processes the build, which usually takes 10 to 30 minutes. You get an email when it's ready.

### Test it

- **Just you and your team (no review):** App Store Connect → your app → **TestFlight** → **Internal Testing** → **+** → add yourself. Install the **TestFlight** app on your phone from the App Store and accept the invite.
- **Other people by email or public link:** add an **External Testing** group. The first build goes through Beta App Review, usually within a day. Under **Test Information**, give reviewers a sign-in: an email and password for a demo account (they use **Use a password instead**), plus one line on what Klubbies is.

### Every later upload

Each upload needs a higher build number. The automatic option in step 3 handles that. For a new public version, change **Version** under the target's **General** tab (1.0 → 1.1).

## Before the App Store (not needed for TestFlight)

These block a public App Store release. TestFlight works without them.

1. **Account deletion inside the app.** Apple requires any app with sign-in to let people delete their account from within the app. The account page currently says to ask a club admin, which won't pass review.
2. **"Just a website" rejections (guideline 4.2).** Apple sometimes rejects apps that mostly show a website. Save to Photos, downloads and the offline screen help, but push notifications for new albums would make the strongest case.
3. **App Privacy answers** in App Store Connect. Declare: email address, name, photos and videos, and **biometric data** under Sensitive Info (the face recognition faceprints). All of these are linked to the user, used for app functionality, and not used for tracking.
4. **Store listing:** screenshots for the 6.9 inch iPhone (1320 × 2868), a description, support URL, and privacy policy URL `https://www.klubbies.app/privacy`.

## What's in here

| File | What it does |
|---|---|
| `Klubbies/AppConfig.swift` | Start URL, which domains stay in the app, the colours |
| `Klubbies/WebViewController.swift` | The web view, links, downloads, pop-ups, pull to refresh |
| `Klubbies/PhotoSaver.swift` | Save to Photos (the site calls it through `lib/native-app.ts`) |
| `Klubbies/OfflineView.swift` | The "Can't reach Klubbies" screen |
| `Klubbies/Assets.xcassets` | App icon and colours |
| `Klubbies/PrivacyInfo.xcprivacy` | Apple's privacy manifest |
| `Info.plist` | App name and the text iOS shows when it asks for camera and Photos access |

The app adds `KlubbiesApp/<version>` to its user agent. The website uses that to know it is inside the app (`lib/native-app.ts`). Keep the two in step if either changes.
