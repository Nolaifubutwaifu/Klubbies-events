import UIKit

/// The loading screen: the Klubbies Events mark animates in while the first
/// page loads, then fades away to show it. The system launch screen before it
/// is the same paper colour, so the hand-over can't be seen.
///
/// The mark is the site's own (components/ui.tsx, BrandTile, app/icon.svg):
/// stacked album prints on a night tile, drawn here from the same 512 viewBox.
final class SplashView: UIView {
    /// Shown at least this long, so a fast load doesn't flash the mark.
    static let minimumDuration: TimeInterval = 1.3

    private let tile = UIView()
    private let wordmark = UILabel()
    private let shownAt = Date()
    private var dismissing = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AppConfig.background
        isAccessibilityElement = true
        accessibilityLabel = "Klubbies Events, loading"

        let size: CGFloat = 96
        tile.translatesAutoresizingMaskIntoConstraints = false
        drawMark(in: tile.layer, size: size)
        // A soft drop shadow, as on the design canvas.
        tile.layer.shadowColor = AppConfig.ink.cgColor
        tile.layer.shadowOpacity = 0.22
        tile.layer.shadowRadius = 15
        tile.layer.shadowOffset = CGSize(width: 0, height: 18)

        let name = NSMutableAttributedString(string: "Klubbies", attributes: [
            .font: UIFont.systemFont(ofSize: 26, weight: .semibold),
            .foregroundColor: AppConfig.ink,
            .kern: -0.5,
        ])
        name.append(NSAttributedString(string: " Events", attributes: [
            .font: UIFont.systemFont(ofSize: 26, weight: .regular),
            .foregroundColor: AppConfig.inkSoft,
            .kern: -0.5,
        ]))
        wordmark.attributedText = name
        wordmark.translatesAutoresizingMaskIntoConstraints = false

        addSubview(tile)
        addSubview(wordmark)
        NSLayoutConstraint.activate([
            tile.widthAnchor.constraint(equalToConstant: size),
            tile.heightAnchor.constraint(equalToConstant: size),
            tile.centerXAnchor.constraint(equalTo: centerXAnchor),
            tile.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -24),
            wordmark.topAnchor.constraint(equalTo: tile.bottomAnchor, constant: 22),
            wordmark.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])

        // Start hidden; play() brings everything in.
        tile.alpha = 0
        tile.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
        wordmark.alpha = 0
        wordmark.transform = CGAffineTransform(translationX: 0, y: 12)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    /// Stacked album prints. Coordinates are the 512 viewBox in app/icon.svg.
    private func drawMark(in layer: CALayer, size: CGFloat) {
        let scale = size / 512
        func shape(_ path: UIBezierPath, _ color: UIColor) -> CAShapeLayer {
            let layer = CAShapeLayer()
            layer.path = path.cgPath
            layer.fillColor = color.cgColor
            return layer
        }
        func scaled(_ path: UIBezierPath) -> UIBezierPath {
            path.apply(CGAffineTransform(scaleX: scale, y: scale))
            return path
        }

        let night = UIColor(red: 14 / 255, green: 20 / 255, blue: 36 / 255, alpha: 1) // #0E1424
        let back = UIColor(red: 179 / 255, green: 193 / 255, blue: 246 / 255, alpha: 1) // #B3C1F6
        let paper = UIColor(red: 247 / 255, green: 247 / 255, blue: 245 / 255, alpha: 1) // #F7F7F5
        let photo = UIColor(red: 43 / 255, green: 74 / 255, blue: 203 / 255, alpha: 1) // #2B4ACB

        let tilePath = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: size, height: size), cornerRadius: 112 * scale)
        let backPath = UIBezierPath(roundedRect: CGRect(x: 160, y: 138, width: 180, height: 214), cornerRadius: 22)
        // Same as SVG rotate(-14 250 245): translate to the origin, rotate, translate back.
        backPath.apply(CGAffineTransform(translationX: -250, y: -245).rotated(by: -14 * .pi / 180).translatedBy(x: 250, y: 245))
        let card = UIBezierPath(roundedRect: CGRect(x: 184, y: 168, width: 184, height: 214), cornerRadius: 22)
        let window = UIBezierPath(roundedRect: CGRect(x: 212, y: 196, width: 128, height: 128), cornerRadius: 10)
        let found = UIBezierPath(ovalIn: CGRect(x: 246, y: 230, width: 60, height: 60))

        layer.addSublayer(shape(tilePath, night))
        layer.addSublayer(shape(scaled(backPath), back))
        layer.addSublayer(shape(scaled(card), paper))
        layer.addSublayer(shape(scaled(window), photo))
        layer.addSublayer(shape(scaled(found), paper))
    }

    /// The tile springs in, then the name rises.
    func play() {
        if UIAccessibility.isReduceMotionEnabled {
            tile.alpha = 1
            tile.transform = .identity
            wordmark.alpha = 1
            wordmark.transform = .identity
            return
        }

        UIView.animate(withDuration: 0.7, delay: 0.05, usingSpringWithDamping: 0.62, initialSpringVelocity: 0.4) {
            self.tile.alpha = 1
            self.tile.transform = .identity
        }

        UIView.animate(withDuration: 0.5, delay: 0.35, options: [.curveEaseOut]) {
            self.wordmark.alpha = 1
            self.wordmark.transform = .identity
        } completion: { _ in
            self.breatheIfStillLoading()
        }
    }

    /// On a slow connection the tile pulses gently, so it never looks frozen.
    private func breatheIfStillLoading() {
        guard !dismissing, !UIAccessibility.isReduceMotionEnabled else { return }
        let pulse = CABasicAnimation(keyPath: "opacity")
        pulse.fromValue = 1
        pulse.toValue = 0.55
        pulse.duration = 0.9
        pulse.autoreverses = true
        pulse.repeatCount = .infinity
        pulse.beginTime = CACurrentMediaTime() + 0.4
        pulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        tile.layer.add(pulse, forKey: "breathe")
    }

    /// Fades away once it has been up for `minimumDuration`. `willReveal`
    /// runs as the fade starts, so the page can begin its own entrance.
    func dismiss(willReveal: @escaping () -> Void) {
        guard !dismissing else { return }
        dismissing = true
        let wait = max(0, Self.minimumDuration - Date().timeIntervalSince(shownAt))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
            self.tile.layer.removeAnimation(forKey: "breathe")
            willReveal()
            // The mark zooms away first, so it never ghosts over the page's own.
            UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseIn]) {
                self.tile.alpha = 0
                self.tile.transform = CGAffineTransform(scaleX: 1.12, y: 1.12)
                self.wordmark.alpha = 0
            }
            UIView.animate(withDuration: 0.35, delay: 0.14, options: [.curveEaseInOut]) {
                self.alpha = 0
            } completion: { _ in
                self.removeFromSuperview()
            }
        }
    }
}
