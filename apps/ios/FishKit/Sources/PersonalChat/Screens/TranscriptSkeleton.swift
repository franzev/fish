import ChatData
import DesignSystem
import SwiftUI
import UIComponents

struct TranscriptSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(alignment: .top, spacing: Spacing.xs) {
                    SkeletonAvatar(size: .sm)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        SkeletonBar()
                        SkeletonBar()
                    }
                }
            }
        }
        .padding(Spacing.page)
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .top
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
    }
}
