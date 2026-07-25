import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentGallerySkeleton: View {
    let category: SharedContentGalleryCategory?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if category == .media || category == nil {
                mediaSkeleton
            } else {
                listSkeleton
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading shared content")
    }

    private var mediaSkeleton: some View {
        let minimum = dynamicTypeSize.isAccessibilitySize
            ? SharedContentGalleryLayout.accessibilityMediaMinimum
            : SharedContentGalleryLayout.normalMediaMinimum
        let itemCount = dynamicTypeSize.isAccessibilitySize ? 6 : 9
        return LazyVGrid(
            columns: [
                GridItem(
                    .adaptive(minimum: minimum),
                    spacing: Spacing.twoXs
                ),
            ],
            spacing: Spacing.twoXs
        ) {
            ForEach(0..<itemCount, id: \.self) { _ in
                RoundedRectangle(
                    cornerRadius: Radius.chatInner,
                    style: .continuous
                )
                .fill(Palette.surface2)
                .aspectRatio(1, contentMode: .fit)
                .accessibilityHidden(true)
            }
        }
        .frame(
            maxWidth: SharedContentGalleryLayout.mediaMaximumWidth(
                accessibilitySize: dynamicTypeSize.isAccessibilitySize
            ),
            alignment: .leading
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var listSkeleton: some View {
        VStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { index in
                HStack(spacing: Spacing.sm) {
                    RoundedRectangle(
                        cornerRadius: Radius.control,
                        style: .continuous
                    )
                    .fill(Palette.surface2)
                    .frame(
                        width: Metrics.targetTouch,
                        height: Metrics.targetTouch
                    )
                    VStack(alignment: .leading, spacing: Spacing.twoXs) {
                        SkeletonBar()
                        SkeletonBar(width: SharedContentGalleryLayout.accessibilityMediaMinimum)
                    }
                }
                .padding(.vertical, Spacing.md)
                if index < 5 {
                    Palette.divider
                        .frame(height: 1)
                        .accessibilityHidden(true)
                }
            }
        }
    }
}
