import DesignSystem
import SwiftUI

/// Avatar with a bottom-trailing status badge on a `surface` ring, merged
/// into one accessibility element: "{name}, {status}".
public struct PresenceAvatar: View {
    private let name: String
    private let image: Image?
    private let size: Avatar.Size
    private let status: PresenceDisplayStatus
    private let statusLabel: String

    public init(
        name: String,
        image: Image? = nil,
        size: Avatar.Size = .sm,
        status: PresenceDisplayStatus,
        statusLabel: String
    ) {
        self.name = name
        self.image = image
        self.size = size
        self.status = status
        self.statusLabel = statusLabel
    }

    public var body: some View {
        Avatar(name: name, image: image, size: size)
            .overlay(alignment: .bottomTrailing) {
                PresenceIndicator(status: status, label: statusLabel)
                    .padding(Spacing.threeXs)
                    .background(Palette.surface, in: Circle())
                    // Centered on the avatar's corner so initials stay
                    // legible behind the badge.
                    .offset(x: Spacing.xs, y: Spacing.xs)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(name), \(statusLabel)")
    }
}
