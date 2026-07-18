import DesignSystem
import SwiftUI

/// Identity marker: image, initials, or a neutral person glyph. Decorative by
/// default because adjacent text usually carries the person's identity.
public struct Avatar: View {
    public enum Size: Sendable {
        case badge
        case sm
        case md
        case profile

        var points: CGFloat {
            switch self {
            case .badge: Metrics.avatarBadge
            case .sm: Metrics.avatarSm
            case .md: Metrics.avatarMd
            case .profile: Metrics.avatarProfile
            }
        }

        var initialsRole: TextRole? {
            switch self {
            case .badge: nil
            case .sm: .caption
            case .md: .ui
            case .profile: .heading
            }
        }
    }

    private let name: String
    private let image: Image?
    private let size: Size
    private let isDecorative: Bool

    public init(
        name: String,
        image: Image? = nil,
        size: Size,
        isDecorative: Bool = true
    ) {
        self.name = name
        self.image = image
        self.size = size
        self.isDecorative = isDecorative
    }

    nonisolated static func initials(from name: String) -> String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }

    public var body: some View {
        ZStack {
            Circle().fill(Palette.avatar)
            if let image {
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: size.points, height: size.points)
                    .clipShape(Circle())
            } else if let role = size.initialsRole,
                      !Self.initials(from: name).isEmpty {
                Text(Self.initials(from: name))
                    .textStyle(role)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .allowsTightening(true)
            } else {
                Icon.person.image
                    .glyphFrame()
                    .foregroundStyle(Palette.body)
            }
        }
        .frame(width: size.points, height: size.points)
        .accessibilityHidden(isDecorative)
        .accessibilityLabel(isDecorative ? "" : name)
    }
}
