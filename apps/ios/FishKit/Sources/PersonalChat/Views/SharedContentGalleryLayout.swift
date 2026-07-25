import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

enum SharedContentGalleryLayout {
    static let normalMediaMinimum: CGFloat = 88
    static let accessibilityMediaMinimum: CGFloat = 120
    static let maximumMediaColumns = 6
    static let metadataRowMinimumHeight: CGFloat = 64

    static func mediaMaximumWidth(accessibilitySize: Bool) -> CGFloat {
        let minimum = accessibilitySize
            ? accessibilityMediaMinimum
            : normalMediaMinimum
        return (minimum * CGFloat(maximumMediaColumns)) +
            (Spacing.twoXs * CGFloat(maximumMediaColumns - 1))
    }

    static func mediaColumns(
        availableWidth: CGFloat,
        accessibilitySize: Bool
    ) -> Int {
        let minimum = accessibilitySize
            ? accessibilityMediaMinimum
            : normalMediaMinimum
        let usableWidth = max(availableWidth, minimum)
        let count = Int((usableWidth + Spacing.twoXs) / (minimum + Spacing.twoXs))
        return min(max(count, 1), maximumMediaColumns)
    }
}

extension View {
    @ViewBuilder
    func sharedContentDirectionIsolated(_ isolated: Bool) -> some View {
        if isolated {
            environment(\.layoutDirection, .leftToRight)
        } else {
            self
        }
    }
}
