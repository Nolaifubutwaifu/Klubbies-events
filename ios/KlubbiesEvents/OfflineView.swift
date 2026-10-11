import UIKit

/// Shown when a page can't load: no signal at a venue is the usual reason.
/// Paper, a quiet icon, a serif title, and one ink button at the bottom.
final class OfflineView: UIView {
    var onRetry: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AppConfig.background

        let iconWell = UIView()
        iconWell.backgroundColor = UIColor(red: 0.937, green: 0.937, blue: 0.925, alpha: 1) // #EFEFEC mist
        iconWell.layer.cornerRadius = 16
        let icon = UIImageView(image: UIImage(systemName: "wifi.slash", withConfiguration: UIImage.SymbolConfiguration(pointSize: 26, weight: .regular)))
        icon.tintColor = UIColor(red: 0.290, green: 0.302, blue: 0.333, alpha: 1) // #4A4D55
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconWell.addSubview(icon)
        iconWell.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel()
        title.text = "You're offline"
        // New York, the system serif, standing in for the site's Instrument Serif.
        let base = UIFont.systemFont(ofSize: 42, weight: .regular)
        title.font = base.fontDescriptor.withDesign(.serif).map { UIFont(descriptor: $0, size: 42) } ?? base
        title.textColor = AppConfig.ink
        title.adjustsFontForContentSizeCategory = true
        title.numberOfLines = 0

        let body = UILabel()
        body.text = "Photos you saved are still in your photo library. Connect to Wi-Fi or mobile data to open the gallery."
        body.font = .systemFont(ofSize: 16)
        body.textColor = UIColor(red: 0.290, green: 0.302, blue: 0.333, alpha: 1)
        body.numberOfLines = 0

        var buttonConfig = UIButton.Configuration.filled()
        buttonConfig.attributedTitle = AttributedString("Try again", attributes: AttributeContainer([.font: UIFont.systemFont(ofSize: 16, weight: .semibold)]))
        buttonConfig.baseBackgroundColor = AppConfig.ink
        buttonConfig.background.cornerRadius = 10
        let button = UIButton(configuration: buttonConfig, primaryAction: UIAction { [weak self] _ in self?.onRetry?() })
        button.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [iconWell, title, body])
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        addSubview(button)

        let safe = safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            iconWell.widthAnchor.constraint(equalToConstant: 64),
            iconWell.heightAnchor.constraint(equalToConstant: 64),
            icon.centerXAnchor.constraint(equalTo: iconWell.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconWell.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -40),
            button.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            button.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            button.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -24),
            button.heightAnchor.constraint(equalToConstant: 54),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }
}
