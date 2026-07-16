import DesignSystem
import SwiftUI

public struct MessageDaySeparator: View {
    private let label: String

    public init(label: String) {
        self.label = label
    }

    public var body: some View {
        Text(label)
            .textStyle(.caption)
            .foregroundStyle(Palette.body)
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.threeXs)
            .background(Palette.surface2, in: Capsule())
            .frame(maxWidth: .infinity)
            .accessibilityAddTraits(.isHeader)
    }
}
