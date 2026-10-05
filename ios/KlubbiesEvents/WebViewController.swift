import SafariServices
import UIKit
import WebKit

/// The whole app: one web view on events.klubbies.app, plus the native pieces a
/// plain web view lacks. Those are confirm dialogs, file downloads, Save to
/// Photos, notifications, a QR scanner to join an event, pull to refresh, an
/// offline screen, and sending outside links to Safari.
final class WebViewController: UIViewController {
    private var webView: WKWebView!
    private let progressBar = UIProgressView(progressViewStyle: .bar)
    private let offlineView = OfflineView()
    /// The animated loading screen, until the first page has loaded.
    private var splash: SplashView? = SplashView()
    private var progressObservation: NSKeyValueObservation?
    private let photoSaver = PhotoSaver()
    private let scanBridge = ScanBridge()
    /// Where each download in flight is being written.
    fileprivate var downloads: [ObjectIdentifier: URL] = [:]

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AppConfig.background

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // keeps people signed in between launches
        config.applicationNameForUserAgent = AppConfig.userAgentSuffix
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.addScriptMessageHandler(photoSaver, contentWorld: .page, name: "klubbiesSaveToPhotos")
        config.userContentController.addScriptMessageHandler(PushManager.shared, contentWorld: .page, name: "klubbiesPush")
        config.userContentController.add(scanBridge, contentWorld: .page, name: "klubbiesEventsScan")
        scanBridge.onScanRequested = { [weak self] in self?.presentScanner() }

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = AppConfig.background
        webView.underPageBackgroundColor = AppConfig.background
        webView.scrollView.backgroundColor = AppConfig.background
        #if DEBUG
        webView.isInspectable = true // Safari → Develop menu, for debugging only
        #endif

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        progressBar.progressTintColor = AppConfig.accent
        progressBar.trackTintColor = .clear
        offlineView.isHidden = true
        offlineView.onRetry = { [weak self] in self?.retry() }

        for subview in [webView!, progressBar, offlineView] as [UIView] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safe.topAnchor),
            webView.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressBar.topAnchor.constraint(equalTo: safe.topAnchor),
            progressBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressBar.heightAnchor.constraint(equalToConstant: 2),
            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self else { return }
            let progress = Float(webView.estimatedProgress)
            self.progressBar.setProgress(progress, animated: progress > self.progressBar.progress)
            self.progressBar.isHidden = progress >= 1
        }

        // Over everything until the first page is ready. While it's up, pages
        // hold their entrance animation (html.kb-splash, app/globals.css).
        if let splash {
            splash.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(splash)
            NSLayoutConstraint.activate([
                splash.topAnchor.constraint(equalTo: view.topAnchor),
                splash.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                splash.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                splash.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            ])
            webView.configuration.userContentController.addUserScript(WKUserScript(
                source: "document.documentElement.classList.add('kb-splash')",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
            // Never longer than this, whatever the network is doing.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.hideSplash() }
        }

        NotificationCenter.default.addObserver(self, selector: #selector(openFromNotification(_:)), name: .klubbiesOpenURL, object: nil)
        // Opened by tapping a notification: go straight to what it was about.
        let first = PushManager.shared.pendingURL ?? AppConfig.startURL
        PushManager.shared.pendingURL = nil
        webView.load(URLRequest(url: first))
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        splash?.play()
    }

    /// Fades the loading screen and lets the page play its entrance.
    private func hideSplash() {
        guard let splash else { return }
        self.splash = nil
        webView.configuration.userContentController.removeAllUserScripts()
        splash.dismiss { [weak self] in
            self?.webView.evaluateJavaScript("document.documentElement.classList.remove('kb-splash')")
        }
    }

    @objc private func openFromNotification(_ note: Notification) {
        guard let url = note.object as? URL, isViewLoaded else { return }
        PushManager.shared.pendingURL = nil
        offlineView.isHidden = true
        webView.load(URLRequest(url: url))
    }

    /// The site keeps each phone's notification token against the person
    /// signed in on it. Hand it over after pages load until the site has it
    /// for this launch; a signed-out page just answers 401 and we try again.
    private var tokenSentForLaunch = false

    private func sendPushTokenIfNeeded() {
        guard !tokenSentForLaunch, let token = PushManager.shared.token,
              let url = webView.url, AppConfig.isAppURL(url) else { return }
        let script = """
        const response = await fetch('/api/push/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, environment })
        });
        return response.status;
        """
        webView.callAsyncJavaScript(script, arguments: ["token": token, "environment": PushManager.environment], in: nil, in: .defaultClient) { [weak self] result in
            if case .success(let status) = result, (status as? Int) == 200 || (status as? NSNumber)?.intValue == 200 {
                self?.tokenSentForLaunch = true
            }
        }
    }

    /// The native QR scanner, opened from "Scan the event's QR code" on the
    /// sign-in and "Your events" pages. It only ever opens an event link.
    private func presentScanner() {
        guard presentedViewController == nil else { return }
        let scanner = QRScannerViewController()
        scanner.modalPresentationStyle = .fullScreen
        scanner.onEventLink = { [weak self] url in
            self?.offlineView.isHidden = true
            self?.webView.load(URLRequest(url: url))
        }
        present(scanner, animated: true)
    }

    @objc private func pullToRefresh(_ control: UIRefreshControl) {
        if webView.url == nil { webView.load(URLRequest(url: AppConfig.startURL)) } else { webView.reload() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { control.endRefreshing() }
    }

    private func retry() {
        offlineView.isHidden = true
        if let url = webView.url, AppConfig.isAppURL(url) { webView.reload() } else { webView.load(URLRequest(url: AppConfig.startURL)) }
    }

    private func openOutside(_ url: URL) {
        let scheme = url.scheme?.lowercased()
        if scheme == "https" || scheme == "http" {
            let safari = SFSafariViewController(url: url)
            safari.preferredControlTintColor = AppConfig.accent
            present(safari, animated: true)
        } else {
            UIApplication.shared.open(url) // mailto:, tel:, maps and the like
        }
    }

    /// Hands a finished download to the share sheet, where "Save to Files" lives.
    private func share(fileAt url: URL) {
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
        present(sheet, animated: true)
    }
}

// MARK: - Navigation

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { return decisionHandler(.download) }
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let scheme = url.scheme?.lowercased() ?? ""

        // Frames inside a page (Stripe's card field, embedded video) load as they are.
        if let frame = action.targetFrame, !frame.isMainFrame { return decisionHandler(.allow) }
        if scheme == "about" || scheme == "blob" || scheme == "data" { return decisionHandler(.allow) }
        if let website = AppConfig.browserURL(for: url) {
            decisionHandler(.cancel)
            return openOutside(website)
        }
        if AppConfig.isAppURL(url) { return decisionHandler(.allow) }

        decisionHandler(.cancel)
        openOutside(url)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        if !response.canShowMIMEType || disposition.lowercased().hasPrefix("attachment") {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        offlineView.isHidden = true
        hideSplash()
        sendPushTokenIfNeeded()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showOfflineIfNeeded(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOfflineIfNeeded(error)
    }

    /// iOS can kill a web page in the background to save memory; bring it back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    private func showOfflineIfNeeded(_ error: Error) {
        let nsError = error as NSError
        // Cancelled loads and loads that turned into downloads are not failures.
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return }
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 102 { return }
        offlineView.isHidden = false
        hideSplash()
    }
}

// MARK: - Dialogs and new windows

extension WebViewController: WKUIDelegate {
    /// Links with target="_blank" and window.open(): our pages open here, the rest in Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if AppConfig.isAppURL(url) { webView.load(action.request) } else { openOutside(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    /// Without this, every confirm() on the site ("Delete this album?") silently answers no.
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }
}

// MARK: - Downloads (album zips, roster exports)

extension WebViewController: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("Downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let destination = folder.appendingPathComponent(suggestedFilename)
        try? FileManager.default.removeItem(at: destination)
        downloads[ObjectIdentifier(download)] = destination
        completionHandler(destination)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        share(fileAt: file)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
        let alert = UIAlertController(title: "Download failed", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}
