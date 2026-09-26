import Photos
import WebKit

/// The site's "Save to Photos" inside the app. The page posts a batch of
/// signed photo URLs; this downloads each one and adds it to the Photos
/// library, then answers with how many made it.
///
///     await window.webkit.messageHandlers.klubbiesSaveToPhotos.postMessage({ urls })
///     // → { saved: 8, failed: 0 }
///
/// Asks only for add-only access, so the app can never read the library.
final class PhotoSaver: NSObject, WKScriptMessageHandlerWithReply {
    @MainActor
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        guard let body = message.body as? [String: Any], let strings = body["urls"] as? [String] else {
            return (nil, "Nothing to save")
        }
        guard await Self.canAddToPhotos() else {
            return (nil, "Klubbies needs Photos access to save. Turn it on in Settings, Klubbies, Photos.")
        }

        var saved = 0
        var failed = 0
        for string in strings {
            guard let url = URL(string: string), url.scheme == "https" else { failed += 1; continue }
            do {
                try await Self.save(from: url)
                saved += 1
            } catch {
                failed += 1
            }
        }
        return (["saved": saved, "failed": failed], nil)
    }

    private static func canAddToPhotos() async -> Bool {
        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited: return true
        case .notDetermined:
            let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
            return status == .authorized || status == .limited
        default: return false
        }
    }

    private static func save(from url: URL) async throws {
        let (downloaded, response) = try await URLSession.shared.download(from: url)
        let mime = response.mimeType ?? "image/jpeg"
        let isVideo = mime.hasPrefix("video/")
        let ext = isVideo ? (mime.contains("quicktime") ? "mov" : "mp4") : (mime.contains("png") ? "png" : mime.contains("webp") ? "webp" : "jpg")

        // Photos works out the file type from the extension.
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
        try FileManager.default.moveItem(at: downloaded, to: file)
        defer { try? FileManager.default.removeItem(at: file) }

        try await PHPhotoLibrary.shared().performChanges {
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = false
            PHAssetCreationRequest.forAsset().addResource(with: isVideo ? .video : .photo, fileURL: file, options: options)
        }
    }
}
