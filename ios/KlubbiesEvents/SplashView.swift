import UIKit

/// The loading screen: the Klubbies Events mark animates in while the first
/// page loads, then fades away to show it. The system launch screen before it
/// is the same paper colour, so the hand-over can't be seen.
///
/// The mark is the site's own (components/ui.tsx, BrandTile): an ink tile with
/// a paper K and a blue dot, drawn here from the same 64 by 64 drawing.
final class SplashView: UIView {
    /// Shown at least this long, so a fast load doesn't flash the mark.
    static let minimumDuration: TimeInterval = 1.3

    private let tile = UIView()
    private let dot = CAShapeLayer()
    private let wordmark = UILabel()
    private let shownAt = Date()
    private var dismissing = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AppConfig.background
        isAccessibilityElement = true
        accessibilityLabel = "Klubbies Events, loading"

        let size: CGFloat = 88
        tile.translatesAutoresizingMaskIntoConstraints = false
        drawMark(in: tile.layer, size: size)

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
            wordmark.topAnchor.constraint(equalTo: tile.bottomAnchor, constant: 18),
            wordmark.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])

        // Start hidden; play() brings everything in.
        tile.alpha = 0
        tile.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
        wordmark.alpha = 0
        wordmark.transform = CGAffineTransform(translationX: 0, y: 12)
        dot.transform = CATransform3DMakeScale(0.01, 0.01, 1)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    /// The ink tile with its K, and the blue dot as its own layer so it can pop.
    private func drawMark(in layer: CALayer, size: CGFloat) {
        let scale = size / 64
        let tileLayer = CAShapeLayer()
        tileLayer.path = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: size, height: size), cornerRadius: 14 * scale).cgPath
        tileLayer.fillColor = AppConfig.ink.cgColor

        let k = UIBezierPath()
        let points: [(CGFloat, CGFloat)] = [
            (19, 15), (27, 15), (27, 30), (38.5, 15), (48, 15), (35, 30.5),
            (48.5, 49), (39, 49), (27, 32.5), (27, 49), (19, 49),
        ]
        for (index, point) in points.enumerated() {
            let p = CGPoint(x: point.0 * scale, y: point.1 * scale)
            if index == 0 { k.move(to: p) } else { k.addLine(to: p) }
        }
        k.close()
        let kLayer = CAShapeLayer()
        kLayer.path = k.cgPath
        kLayer.fillColor = AppConfig.background.cgColor

        let radius = 5 * scale
        dot.bounds = CGRect(x: 0, y: 0, width: radius * 2, height: radius * 2)
        dot.position = CGPoint(x: 48 * scale, y: 16 * scale)
        dot.path = UIBezierPath(ovalIn: dot.bounds).cgPath
        dot.fillColor = AppConfig.dot.cgColor

        layer.addSublayer(tileLayer)
        layer.addSublayer(kLayer)
        layer.addSublayer(dot)
    }

    /// The tile springs in, the dot pops onto it, then the name rises.
    func play() {
        if UIAccessibility.isReduceMotionEnabled {
            tile.alpha = 1
            tile.transform = .identity
            wordmark.alpha = 1
            wordmark.transform = .identity
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            dot.transform = CATransform3DIdentity
            CATransaction.commit()
            return
        }

        UIView.animate(withDuration: 0.7, delay: 0.05, usingSpringWithDamping: 0.62, initialSpringVelocity: 0.4) {
            self.tile.alpha = 1
            self.tile.transform = .identity
        }

        let pop = CAKeyframeAnimation(keyPath: "transform.scale")
        pop.values = [0.01, 1.35, 0.9, 1]
        pop.keyTimes = [0, 0.5, 0.78, 1]
        pop.duration = 0.45
        pop.beginTime = CACurrentMediaTime() + 0.38
        pop.fillMode = .backwards
        pop.timingFunction = CAMediaTimingFunction(name: .easeOut)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        dot.transform = CATransform3DIdentity
        CATransaction.commit()
        dot.add(pop, forKey: "pop")

        UIView.animate(withDuration: 0.5, delay: 0.45, options: [.curveEaseOut]) {
            self.wordmark.alpha = 1
            self.wordmark.transform = .identity
        } completion: { _ in
            self.breatheIfStillLoading()
        }
    }

    /// On a slow connection the dot pulses gently, so it never looks frozen.
    private func breatheIfStillLoading() {
        guard !dismissing, !UIAccessibility.isReduceMotionEnabled else { return }
        let pulse = CABasicAnimation(keyPath: "opacity")
        pulse.fromValue = 1
        pulse.toValue = 0.35
        pulse.duration = 0.8
        pulse.autoreverses = true
        pulse.repeatCount = .infinity
        pulse.beginTime = CACurrentMediaTime() + 0.4
        pulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        dot.add(pulse, forKey: "breathe")
    }

    /// Fades away once it has been up for `minimumDuration`. `willReveal`
    /// runs as the fade starts, so the page can begin its own entrance.
    func dismiss(willReveal: @escaping () -> Void) {
        guard !dismissing else { return }
        dismissing = true
        let wait = max(0, Self.minimumDuration - Date().timeIntervalSince(shownAt))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
            self.dot.removeAnimation(forKey: "breathe")
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
