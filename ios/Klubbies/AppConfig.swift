import UIKit

enum AppConfig {
    /// Where the app opens. Signed-out people are sent on to sign in from here.
    ///
    /// Debug builds can point at a local server for testing: in Xcode, Product
    /// → Scheme → Edit Scheme → Run → Arguments, add the environment variable
    /// KLUBBIES_START_URL = http://localhost:3100/clubs. Release builds (TestFlight,
    /// App Store) always use the live site.
    static let startURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["KLUBBIES_START_URL"], let url = URL(string: override) {
            return url
        }
        #endif
        return URL(string: "https://www.klubbies.app/clubs")!
    }()

    /// Hosts that open inside the app. Anything else opens in Safari.
    static let appHosts: Set<String> = {
        var hosts: Set<String> = ["www.klubbies.app", "klubbies.app"]
        if let host = startURL.host?.lowercased() { hosts.insert(host) }
        return hosts
    }()

    /// Added to the user agent so the site knows it is inside the app
    /// (lib/native-app.ts on the web side). Keep the two in step.
    static var userAgentSuffix: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "Mobile/15E148 KlubbiesApp/\(version)"
    }

    /// The site's background, so safe areas and loading states match it.
    static let background = UIColor(red: 1.0, green: 0.973, blue: 0.957, alpha: 1) // #FFF8F4
    static let accent = UIColor(red: 0.812, green: 0.180, blue: 0.071, alpha: 1)    // #CF2E12

    static func isAppURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              let host = url.host?.lowercased() else { return false }
        return appHosts.contains(host)
    }
}
