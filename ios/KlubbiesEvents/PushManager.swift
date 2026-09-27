import UIKit
import UserNotifications
import WebKit

extension Notification.Name {
    /// Posted with a URL when a tapped notification should open a page.
    static let klubbiesOpenURL = Notification.Name("KlubbiesOpenURL")
}

/// Notifications for new albums and feed posts.
///
/// The site asks for permission through `window.webkit.messageHandlers
/// .klubbiesPush` (see lib/native-app.ts), never by surprise: iOS only lets
/// an app ask once. The device token Apple hands back is passed to the site,
/// which stores it against whoever is signed in and sends through Apple's
/// push service (lib/push/apns.ts).
///
///     await klubbiesPush.postMessage({ action: "status" | "enable" | "openSettings" })
///     // → { permission: "granted", token: "ab12…", environment: "production" }
final class PushManager: NSObject, WKScriptMessageHandlerWithReply, UNUserNotificationCenterDelegate {
    static let shared = PushManager()

    /// Debug builds get tokens for Apple's sandbox; TestFlight and the App Store for production.
    static var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    private(set) var token: String?
    /// A notification tapped before the web view was ready to open it.
    var pendingURL: URL?
    private var tokenWaiters: [CheckedContinuation<String?, Never>] = []

    // MARK: Token

    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        token = hex
        resumeWaiters(with: hex)
    }

    func didFailToRegister(_ error: Error) {
        print("push registration failed: \(error.localizedDescription)")
        resumeWaiters(with: nil)
    }

    private func resumeWaiters(with value: String?) {
        let waiters = tokenWaiters
        tokenWaiters.removeAll()
        waiters.forEach { $0.resume(returning: value) }
    }

    @MainActor
    private func registerAndWaitForToken() async -> String? {
        if let token { return token }
        UIApplication.shared.registerForRemoteNotifications()
        return await withCheckedContinuation { continuation in
            tokenWaiters.append(continuation)
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                self?.resumeWaiters(with: self?.token)
            }
        }
    }

    /// On launch: if the person already said yes, refresh the token (Apple can change it).
    @MainActor
    func refreshIfAuthorised() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    // MARK: Bridge

    @MainActor
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        let action = (message.body as? [String: Any])?["action"] as? String ?? "status"
        let center = UNUserNotificationCenter.current()

        switch action {
        case "enable":
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            if granted { _ = await registerAndWaitForToken() }
        case "openSettings":
            if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                await UIApplication.shared.open(url)
            }
        default:
            break
        }

        let settings = await center.notificationSettings()
        let permission: String
        switch settings.authorizationStatus {
        case .authorized, .ephemeral: permission = "granted"
        case .provisional: permission = "provisional"
        case .denied: permission = "denied"
        default: permission = "notDetermined"
        }
        if permission == "granted" || permission == "provisional" {
            _ = await registerAndWaitForToken()
        }
        return (["permission": permission, "token": token as Any, "environment": Self.environment], nil)
    }

    // MARK: Showing and tapping notifications

    /// Show the banner even when the app is open.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    /// A tap opens the album or feed the notification was about.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let string = response.notification.request.content.userInfo["url"] as? String,
              let url = URL(string: string), AppConfig.isAppURL(url) else { return }
        await MainActor.run {
            pendingURL = url
            NotificationCenter.default.post(name: .klubbiesOpenURL, object: url)
        }
    }
}

/// Receives the device token from iOS and hands it on.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = PushManager.shared
        Task { await PushManager.shared.refreshIfAuthorised() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushManager.shared.didRegister(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushManager.shared.didFailToRegister(error)
    }
}
