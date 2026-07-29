import DesignSystem
import SwiftUI
import UIComponents

/// One person, said the same way everywhere friends shows them: their
/// initials, their name, their handle. Friends never fetches a picture — a
/// name is enough to recognise someone by.
struct FriendIdentity: View {
    let displayName: String
    let username: String

    /// A handle stays Latin whatever the interface language is, so it is
    /// isolated left-to-right and keeps its leading "@" in a right-to-left
    /// layout.
    static func handle(_ username: String) -> String {
        "\u{2066}@\(username)\u{2069}"
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Avatar(name: displayName, size: .md)
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(displayName)
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(Self.handle(username))
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}
