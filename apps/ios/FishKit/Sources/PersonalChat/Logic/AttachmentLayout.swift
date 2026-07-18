import DesignSystem
import SwiftUI

public enum AttachmentLayout {
    public static let minimumAspectRatio: CGFloat = 2 / 3
    public static let maximumAspectRatio: CGFloat = 2

    public static func clampedAspectRatio(_ value: Double) -> CGFloat {
        min(maximumAspectRatio, max(minimumAspectRatio, CGFloat(value)))
    }

    public static func frames(
        aspectRatios: [Double],
        containerWidth: CGFloat
    ) -> [CGRect] {
        guard !aspectRatios.isEmpty, containerWidth > 0 else { return [] }
        if aspectRatios.count == 1 {
            let aspect = max(0.1, CGFloat(aspectRatios[0]))
            var width = min(containerWidth, Metrics.attachmentSingleMaxWidth)
            var height = width / aspect
            if height > Metrics.attachmentSingleMaxWidth {
                height = Metrics.attachmentSingleMaxWidth
                width = min(containerWidth, height * aspect)
            }
            return [CGRect(x: 0, y: 0, width: width, height: height)]
        }

        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for rawAspect in aspectRatios {
            let aspect = clampedAspectRatio(rawAspect)
            let height = min(Metrics.attachmentBubbleTile, containerWidth / aspect)
            let width = min(containerWidth, height * aspect)
            if x > 0, x + width > containerWidth {
                x = 0
                y += rowHeight + Spacing.threeXs
                rowHeight = 0
            }
            frames.append(CGRect(x: x, y: y, width: width, height: height))
            x += width + Spacing.threeXs
            rowHeight = max(rowHeight, height)
        }
        return frames
    }
}

struct AttachmentAspectLayoutKey: LayoutValueKey {
    static let defaultValue: Double = 1
}

struct AttachmentFlowLayout: Layout {
    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let width = proposal.width ?? Metrics.attachmentSingleMaxWidth
        let frames = AttachmentLayout.frames(
            aspectRatios: subviews.map { $0[AttachmentAspectLayoutKey.self] },
            containerWidth: width
        )
        return CGSize(
            width: width,
            height: frames.map(\.maxY).max() ?? 0
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let frames = AttachmentLayout.frames(
            aspectRatios: subviews.map { $0[AttachmentAspectLayoutKey.self] },
            containerWidth: bounds.width
        )
        for (subview, frame) in zip(subviews, frames) {
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(frame.size)
            )
        }
    }
}
