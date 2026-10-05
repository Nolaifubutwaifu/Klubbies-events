import UIKit

enum AppConfig {
    /// The live site. Events is its own site, separate from Klubbies.
    static let siteHost = "events.klubbies.app"

    /// Where the app opens. Signed-out people are sent on to sign in from here.
    ///
    /// Debug builds can point at a local server for testing: in Xcode, Product
    /// → Scheme → Edit Scheme → Run → Arguments, add the environment variable
    /// KLUBBIES_EVENTS_START_URL = http://localhost:3300/events. Release builds
    /// (TestFlight, App Store) always use the live site.
    static let startURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["KLUBBIES_EVENTS_START_URL"], let url = URL(string: override) {
            return url
        }
        #endif
        return URL(string: "https://\(siteHost)/events")!
    }()

    /// Hosts that open inside the app. Anything else opens in Safari.
    static let appHosts: Set<String> = {
        var hosts: Set<String> = [siteHost]
        if let host = startURL.host?.lowercased() { hosts.insert(host) }
        return hosts
    }()

    /// Added to the user agent so the site knows it is inside the app
    /// (lib/native-app.ts on the web side). Keep the two in step. Klubbies'
    /// own app sends "KlubbiesApp/"; the two must never overlap.
    static var userAgentSuffix: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "Mobile/15E148 KlubbiesEventsApp/\(version)"
    }

    /// The site's colours, so safe areas and loading states match it.
    static let background = UIColor(red: 0.969, green: 0.969, blue: 0.961, alpha: 1) // #F7F7F5 paper
    static let ink = UIColor(red: 0.086, green: 0.094, blue: 0.114, alpha: 1)        // #16181D
    static let accent = UIColor(red: 0.169, green: 0.290, blue: 0.796, alpha: 1)     // #2B4ACB
    static let inkSoft = UIColor(red: 0.420, green: 0.431, blue: 0.463, alpha: 1)    // #6B6E76, "Events" in the name
    static let dot = UIColor(red: 0.357, green: 0.471, blue: 0.941, alpha: 1)        // #5B78F0, the mark's dot

    /// Our own pages that belong outside the app, like "How it works" on the
    /// sign-in screen, carry `view=browser`. They open in a Safari sheet,
    /// without the marker, instead of in the app. Nil for every other URL.
    static func browserURL(for url: URL) -> URL? {
        guard isAppURL(url), var parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.queryItems?.contains(where: { $0.name == "view" && $0.value == "browser" }) == true else { return nil }
        parts.queryItems = parts.queryItems?.filter { $0.name != "view" }
        if parts.queryItems?.isEmpty == true { parts.queryItems = nil }
        return parts.url
    }

    static func isAppURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              let host = url.host?.lowercased() else { return false }
        return appHosts.contains(host)
    }
}
