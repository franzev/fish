import DesignSystem
import QuickLook
import SwiftUI
import UIComponents

public struct MessageFileCard: View {
    private let attachment: MessageAttachmentUiModel
    private let downloader: AttachmentFileDownloader

    @State private var previewUrl: URL?
    @State private var isDownloading = false
    @State private var isPreparingShare = false
    @State private var shareUrl: URL?
    @State private var shareFileIsTemporary = false
    @State private var showsShareSheet = false
    @State private var shareNotice: String?
    @State private var failed = false

    public init(
        attachment: MessageAttachmentUiModel,
        downloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.attachment = attachment
        self.downloader = downloader
    }

    public var body: some View {
        HStack(spacing: Spacing.xs) {
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
                .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch, alignment: .leading)
            }
            .buttonStyle(.plain)
            .disabled(isDownloading || isPreparingShare)
            .accessibilityLabel(
                "\(attachment.originalName), \(AttachmentAccessibility.fileTypeLabel(attachment.mimeType)), \(AttachmentAccessibility.formattedByteSize(attachment.byteSize))"
            )
            .accessibilityHint(failed ? "Try again" : "Open file preview")

            IconButton(
                .share,
                accessibilityLabel: isPreparingShare ? "Preparing file to share" : "Share or save file",
                isBusy: isPreparingShare
            ) {
                Task { await prepareShare() }
            }
            .disabled(isDownloading)
        }
        .padding(Spacing.sm)
        .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch)
        .background(
            Palette.surface2,
            in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
        )
        .quickLookPreview($previewUrl)
        .sheet(isPresented: $showsShareSheet, onDismiss: clearShareFile) {
            if let shareUrl {
                AttachmentActivitySheet(item: shareUrl)
            }
        }
        .alert(
            "File not ready to share",
            isPresented: Binding(
                get: { shareNotice != nil },
                set: { if !$0 { shareNotice = nil } }
            )
        ) {
            Button("OK") { shareNotice = nil }
        } message: {
            Text(shareNotice ?? "Try again in a moment.")
        }
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

    private func prepareShare() async {
        guard !isPreparingShare else { return }
        isPreparingShare = true
        failed = false
        defer { isPreparingShare = false }
        do {
            shareUrl = try await downloader.download(attachment)
            shareFileIsTemporary = attachment.localPreviewUrl != shareUrl
            showsShareSheet = true
        } catch {
            shareUrl = nil
            shareFileIsTemporary = false
            shareNotice = "Try again in a moment."
        }
    }

    private func clearShareFile() {
        guard let shareUrl else { return }
        if shareFileIsTemporary {
            try? FileManager.default.removeItem(at: shareUrl)
        }
        self.shareUrl = nil
        shareFileIsTemporary = false
    }
}
