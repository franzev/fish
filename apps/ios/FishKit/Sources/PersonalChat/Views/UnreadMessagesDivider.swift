import DesignSystem
import SwiftUI

public struct UnreadMessagesDivider: View {
    public init() {}

    public var body: some View {
        HStack(spacing: Spacing.xs) {
            Palette.divider.frame(height: 1)
            Text("New messages")
                .textStyle(.caption)
                .foregroundStyle(Palette.notice)
                .fixedSize()
            Palette.divider.frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("New messages")
        .accessibilityAddTraits(.isHeader)
    }
}
