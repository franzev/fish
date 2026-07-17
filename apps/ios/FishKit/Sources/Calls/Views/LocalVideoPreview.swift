import DesignSystem
import SwiftUI

/// The movable self-view: a mirrored 16:9 inset at the `callPreview` width,
/// draggable anywhere inside the stage and clamped to its bounds. Defaults to
/// the bottom-trailing corner (web `DraggableVideoPreview`; edge-resize is a
/// pointer affordance and intentionally not ported to touch).
struct LocalVideoPreview: View {
    let video: AnyView?
    let stageSize: CGSize

    @State private var position: CGPoint?
    @GestureState private var dragOffset: CGSize = .zero

    private var previewSize: CGSize {
        CGSize(
            width: Metrics.callPreview,
            height: Metrics.callPreview * 9 / 16
        )
    }

    private var restingPosition: CGPoint {
        position ?? CGPoint(
            x: stageSize.width - previewSize.width / 2 - Spacing.xs,
            y: stageSize.height - previewSize.height / 2 - Spacing.xs
        )
    }

    var body: some View {
        ZStack {
            Palette.bg
            if let video {
                video
            } else {
                Icon.videoOff.image
                    .glyphFrame()
                    .foregroundStyle(Palette.muted)
                    .accessibilityLabel(CallCopy.localCameraOff)
            }
        }
        .frame(width: previewSize.width, height: previewSize.height)
        .clipped()
        .position(clamped(CGPoint(
            x: restingPosition.x + dragOffset.width,
            y: restingPosition.y + dragOffset.height
        )))
        .gesture(
            DragGesture()
                .updating($dragOffset) { value, offset, _ in
                    offset = value.translation
                }
                .onEnded { value in
                    position = clamped(CGPoint(
                        x: restingPosition.x + value.translation.width,
                        y: restingPosition.y + value.translation.height
                    ))
                }
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(CallCopy.localPreviewLabel)
    }

    private func clamped(_ point: CGPoint) -> CGPoint {
        let halfWidth = previewSize.width / 2
        let halfHeight = previewSize.height / 2
        guard stageSize.width > previewSize.width,
              stageSize.height > previewSize.height
        else { return point }
        return CGPoint(
            x: min(max(point.x, halfWidth), stageSize.width - halfWidth),
            y: min(max(point.y, halfHeight), stageSize.height - halfHeight)
        )
    }
}
