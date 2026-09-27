import AVFoundation
import CoreImage
import UIKit
import WebKit

/// Which scanned codes the app will open: only an event's own link on the
/// Events site (`/e/<handle>` or `/signin?event=<handle>`). Anything else,
/// including other pages on the same site, is refused, so a poster can't be
/// used to send someone somewhere unexpected.
enum EventLink {
    static func joinURL(from text: String) -> URL? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), AppConfig.isAppURL(url),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        let parts = components.path.split(separator: "/").map(String.init)
        let handle: String?
        if parts.count >= 2, parts[0] == "e" {
            handle = parts[1]
        } else if parts == ["signin"] {
            handle = components.queryItems?.first(where: { $0.name == "event" })?.value
        } else {
            handle = nil
        }
        guard let handle, handle.range(of: "^[A-Za-z0-9_]{1,48}$", options: .regularExpression) != nil,
              let scheme = url.scheme, let host = url.host else { return nil }
        let port = url.port.map { ":\($0)" } ?? ""
        return URL(string: "\(scheme)://\(host)\(port)/e/\(handle.lowercased())")
    }
}

/// The page asks for the scanner with
///     window.webkit.messageHandlers.klubbiesEventsScan.postMessage({})
/// (see lib/native-app.ts). The web view controller opens whatever comes back.
final class ScanBridge: NSObject, WKScriptMessageHandler {
    var onScanRequested: (() -> Void)?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        onScanRequested?()
    }
}

/// Full-screen camera that reads one QR code and hands back the event link.
final class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onEventLink: ((URL) -> Void)?

    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private let hint = UILabel()
    private let frameView = UIView()
    private var handled = false
    private var lastRejected: String?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let title = UILabel()
        title.text = "Scan the event's QR code"
        title.font = .systemFont(ofSize: 20, weight: .semibold)
        title.textColor = .white
        title.textAlignment = .center

        hint.text = "It's on the poster, the slides or the table cards."
        hint.font = .systemFont(ofSize: 15)
        hint.textColor = UIColor(white: 1, alpha: 0.85)
        hint.textAlignment = .center
        hint.numberOfLines = 0

        frameView.layer.borderColor = UIColor.white.cgColor
        frameView.layer.borderWidth = 3
        frameView.layer.cornerRadius = 16
        frameView.isUserInteractionEnabled = false

        var closeConfig = UIButton.Configuration.filled()
        closeConfig.title = "Cancel"
        closeConfig.baseBackgroundColor = UIColor(white: 1, alpha: 0.18)
        closeConfig.baseForegroundColor = .white
        closeConfig.cornerStyle = .medium
        closeConfig.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 28, bottom: 12, trailing: 28)
        let close = UIButton(configuration: closeConfig, primaryAction: UIAction { [weak self] _ in self?.dismiss(animated: true) })
        close.accessibilityLabel = "Cancel scanning"

        let text = UIStackView(arrangedSubviews: [title, hint])
        text.axis = .vertical
        text.spacing = 6
        for subview in [frameView, text, close] as [UIView] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            text.topAnchor.constraint(equalTo: safe.topAnchor, constant: 28),
            text.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 24),
            text.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -24),
            frameView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            frameView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            frameView.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.7),
            frameView.heightAnchor.constraint(equalTo: frameView.widthAnchor),
            close.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            close.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -28),
            close.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])

        startCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async { if session.isRunning { session.stopRunning() } }
    }

    private func startCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async { granted ? self?.configureSession() : self?.showNoCamera() }
            }
        default:
            showNoCamera()
        }
    }

    private func configureSession() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            showNoCamera(simulator: true)
            return
        }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return showNoCamera(simulator: true) }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.insertSublayer(layer, at: 0)
        preview = layer

        let session = self.session
        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
    }

    private func showNoCamera(simulator: Bool = false) {
        #if DEBUG && targetEnvironment(simulator)
        // The Simulator has no camera. For testing, point
        // KLUBBIES_EVENTS_QR_IMAGE at a QR image on the Mac (the share page's
        // PNG) and it is read exactly as a scanned code would be.
        if simulator, let path = ProcessInfo.processInfo.environment["KLUBBIES_EVENTS_QR_IMAGE"],
           let image = CIImage(contentsOf: URL(fileURLWithPath: path)),
           let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: nil),
           let code = (detector.features(in: image).first as? CIQRCodeFeature)?.messageString {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in self?.handle(code: code) }
            return
        }
        #endif
        frameView.isHidden = true
        hint.text = simulator
            ? "This device has no camera. Open the event's link instead."
            : "Klubbies Events needs the camera to scan. Turn it on in Settings, Klubbies Events, Camera."
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let code = objects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        handle(code: code)
    }

    private func handle(code: String) {
        guard !handled else { return }
        if let url = EventLink.joinURL(from: code) {
            handled = true
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss(animated: true) { [onEventLink] in onEventLink?(url) }
        } else if code != lastRejected {
            // Say it once per code, not thirty times a second.
            lastRejected = code
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
            hint.text = "That code isn't a Klubbies Events link. Scan the QR code the organiser shared for the event."
        }
    }
}
