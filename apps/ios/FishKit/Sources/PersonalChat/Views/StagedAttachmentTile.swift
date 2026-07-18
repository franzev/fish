import ChatData
import DesignSystem
import ImageIO
import SwiftUI
import UIComponents
import UIKit

public struct StagedAttachmentTile: View {
    private let item: StagedAttachment
    private let onRetry: () -> Void
    private let onRemove: () -> Void
    @State private var showsFailureActions = false
    @State private var previewImage: UIImage?
    @Environment(\.displayScale) private var displayScale

    public init(
        item: StagedAttachment,
        onRetry: @escaping () -> Void,
        onRemove: @escaping () -> Void
    ) {
        self.item = item
        self.onRetry = onRetry
        self.onRemove = onRemove
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            ZStack(alignment: .topTrailing) {
                Button {
                    if item.isFailed { showsFailureActions = true }
                } label: {
                    preview
                        .frame(
                            width: Metrics.attachmentComposerTile,
                            height: Metrics.attachmentComposerTile
                        )
                        .background(Palette.surface2)
                        .clipShape(RoundedRectangle(
                            cornerRadius: Radius.control,
                            style: .continuous
                        ))
                        .overlay(alignment: .bottom) {
                            statusOverlay
                        }
                        .opacity(item.isFailed ? Opacity.focus : 1)
                }
                .buttonStyle(.plain)
                .disabled(!item.isFailed)

                IconButton(
                    .close,
                    accessibilityLabel: "Remove \(item.originalName)",
                    action: onRemove
                )
            }
            Text(item.originalName)
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(width: Metrics.attachmentComposerTile, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(AttachmentAccessibility.tileLabel(item))
        .accessibilityAction(named: "Remove") { onRemove() }
        .accessibilityAction(named: "Retry") {
            if item.isFailed { onRetry() }
        }
        .confirmationDialog(
            "Didn't finish",
            isPresented: $showsFailureActions,
            titleVisibility: .visible
        ) {
            Button("Retry", action: onRetry)
            Button("Remove", action: onRemove)
            Button("Cancel", role: .cancel) {}
        }
        .task(id: item.localUrl) {
            previewImage = nil
            guard item.kind == .image, let url = item.localUrl else { return }
            let maximumPixel = Metrics.attachmentComposerTile * displayScale
            let loaded = await Task.detached(priority: .userInitiated) {
                Self.downsampledImage(url: url, maximumPixel: maximumPixel)
            }.value
            guard !Task.isCancelled else { return }
            previewImage = loaded
        }
    }

    @ViewBuilder private var preview: some View {
        if item.kind == .image, let image = previewImage {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else if item.kind == .file {
            VStack(spacing: Spacing.xs) {
                Icon.fileText.image
                    .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                    .foregroundStyle(Palette.body)
            }
        } else {
            Rectangle()
                .fill(Palette.surface2)
                .accessibilityHidden(true)
        }
    }

    private nonisolated static func downsampledImage(
        url: URL,
        maximumPixel: CGFloat
    ) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: max(1, Int(ceil(maximumPixel))),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(
            source,
            0,
            options as CFDictionary
        ) else { return nil }
        return UIImage(cgImage: image)
    }

    @ViewBuilder private var statusOverlay: some View {
        switch item.status {
        case .loading:
            EmptyView()
        case .preparing, .uploading, .finishing:
            ProgressView(value: item.progress)
                .progressViewStyle(.linear)
                .tint(Palette.notice)
                .padding(Spacing.twoXs)
                .accessibilityValue("\(Int(item.progress * 100)) percent")
        case .ready:
            EmptyView()
        case .failed:
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Spacing.twoXs) {
                    failureDot
                    Text("Didn't finish")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1)
                }
                failureDot
            }
            .padding(Spacing.twoXs)
            .frame(maxWidth: .infinity)
            .background(Palette.surface)
        }
    }

    private var failureDot: some View {
        Circle()
            .fill(Palette.notice)
            .frame(width: Spacing.nudge, height: Spacing.nudge)
    }
}
