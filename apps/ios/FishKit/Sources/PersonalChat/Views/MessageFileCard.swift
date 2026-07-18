import DesignSystem
import QuickLook
import SwiftUI
import UIComponents

public struct MessageFileCard: View {
    private let attachment: MessageAttachmentUiModel
    private let downloader: AttachmentFileDownloader

    @State private var previewUrl: URL?
    @State private var isDownloading = false
    @State private var failed = false

    public init(
        attachment: MessageAttachmentUiModel,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.attachment = attachment
        self.downloader = downloader
    }

    public var body: some View {
        Button {
            Task { await open() }
        } label: {
            HStack(spacing: Spacing.sm) {
                Icon.fileText.image
                    .glyphFrame()
                    .foregroundStyle(Palette.body)
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(attachment.originalName)
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text("\(AttachmentAccessibility.fileTypeLabel(attachment.mimeType)) · \(AttachmentAccessibility.formattedByteSize(attachment.byteSize))")
                        .textStyle(.caption)
                        .foregroundStyle(failed ? Palette.notice : Palette.muted)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.xs)
                if isDownloading {
                    ProgressView()
                        .accessibilityLabel("Downloading file")
                } else {
                    (failed ? Icon.retry : Icon.download).image
                        .glyphFrame()
                        .foregroundStyle(Palette.body)
                }
            }
            .padding(Spacing.sm)
            .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch)
            .background(
                Palette.surface2,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .disabled(isDownloading)
        .accessibilityLabel(
            "\(attachment.originalName), \(AttachmentAccessibility.fileTypeLabel(attachment.mimeType)), \(AttachmentAccessibility.formattedByteSize(attachment.byteSize))"
        )
        .accessibilityHint(failed ? "Try again" : "Open file preview")
        .quickLookPreview($previewUrl)
    }

    private func open() async {
        isDownloading = true
        failed = false
        defer { isDownloading = false }
        do {
            previewUrl = try await downloader.download(attachment)
        } catch {
            failed = true
        }
    }
}
