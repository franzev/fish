import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

public enum SharedContentNativeAction: Sendable, Equatable {
    case share
    case save
    case download
    case open
}

public enum SharedContentPreviewCapabilities {
    private static func hasVerifiedAttachmentMetadata(_ item: SharedContentAcceptedItem) -> Bool {
        item.attachmentId?.isEmpty == false &&
            item.mimeType?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false &&
            item.byteSize.map { $0 > 0 } == true
    }

    public static func canTransfer(_ item: SharedContentAcceptedItem) -> Bool {
        item.canExport && item.kind != "gif" && item.kind != "sticker" &&
            (hasVerifiedAttachmentMetadata(item) || isSafeLink(item.linkUrl))
    }

    public static func canOpen(_ item: SharedContentAcceptedItem) -> Bool {
        if item.kind == "link" { return isSafeLink(item.linkUrl) }
        return ["video", "document", "voice"].contains(item.kind) &&
            hasVerifiedAttachmentMetadata(item)
    }

    public static func canDelete(_ item: SharedContentAcceptedItem) -> Bool {
        item.canDelete && item.sourceMessageId?.isEmpty == false
    }

    private static func isSafeLink(_ value: String?) -> Bool {
        guard let value,
              let components = URLComponents(string: value),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host?.isEmpty == false
        else { return false }
        return true
    }
}

public struct SharedContentPreviewScreen: View {
    private let item: SharedContentAcceptedItem
    private let senderName: String
    private let sourceDateLabel: String
    private let onBack: () -> Void
    private let onOpenSource: (String) -> Void
    private let onNativeAction: (SharedContentNativeAction) -> Void
    private let onDelete: (String) -> Void
    private let loadThumbnail: ((SharedContentMediaThumbnailHandle) async -> Data?)?

    @State private var thumbnail: UIImage?
    @State private var isLoadingThumbnail = false
    @State private var thumbnailFailed = false
    @State private var retryCount = 0
    @State private var showsDeleteConfirmation = false

    public init(
        item: SharedContentAcceptedItem,
        senderName: String,
        sourceDateLabel: String? = nil,
        onBack: @escaping () -> Void,
        onOpenSource: @escaping (String) -> Void,
        onNativeAction: @escaping (SharedContentNativeAction) -> Void,
        onDelete: @escaping (String) -> Void,
        loadThumbnail: ((SharedContentMediaThumbnailHandle) async -> Data?)? = nil
    ) {
        self.item = item
        self.senderName = senderName.isEmpty ? "Sender unavailable" : senderName
        self.sourceDateLabel = sourceDateLabel ?? Self.localizedDate(item.sourceCreatedAt)
        self.onBack = onBack
        self.onOpenSource = onOpenSource
        self.onNativeAction = onNativeAction
        self.onDelete = onDelete
        self.loadThumbnail = loadThumbnail
    }

    public var body: some View {
        VStack(spacing: 0) {
            TopBar(onBack: onBack) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(title)
                        .textStyle(.heading)
                        .foregroundStyle(Palette.foreground)
                    Text(senderName + " · " + sourceDateLabel)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    previewBody
                    if let description = item.mediaDescription, !description.isEmpty {
                        Text(description)
                            .textStyle(.body)
                            .foregroundStyle(Palette.body)
                    }
                    if thumbnailFailed {
                        Notice(
                            title: "This preview is unavailable right now. Try again.",
                            tone: .notice
                        )
                        ActionButton("Try again", variant: .link) {
                            retryCount += 1
                        }
                    }
                    transferActions
                    if SharedContentPreviewCapabilities.canOpen(item) {
                        ActionButton(
                            item.kind == "video" ? "Play video" : "Open",
                            variant: .secondary,
                            fullWidth: true
                        ) {
                            onNativeAction(.open)
                        }
                        .accessibilityHint(
                            item.kind == "video"
                                ? "Opens the video without autoplay"
                                : "Opens this item with a compatible app"
                        )
                    }
                    if let sourceMessageId = item.sourceMessageId {
                        ActionButton(
                            "Go to source message",
                            variant: .ghost,
                            fullWidth: true
                        ) {
                            onOpenSource(sourceMessageId)
                        }
                        .accessibilityHint("Opens the conversation at the original message")
                    }
                    if SharedContentPreviewCapabilities.canDelete(item),
                       let sourceMessageId = item.sourceMessageId {
                        ActionButton(
                            "Delete message",
                            variant: .ghost,
                            fullWidth: true
                        ) {
                            showsDeleteConfirmation = true
                        }
                        .accessibilityHint("Removes the whole source message and every item derived from it")
                        .confirmationDialog(
                            "Delete this message?",
                            isPresented: $showsDeleteConfirmation,
                            titleVisibility: .visible
                        ) {
                            Button("Delete", role: .destructive) {
                                onDelete(sourceMessageId)
                            }
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text("This removes the whole source message and every item derived from it in shared content.")
                        }
                    }
                }
                .frame(maxWidth: Metrics.chatContentMaxWidth)
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.horizontal, Spacing.page)
                .padding(.vertical, Spacing.md)
            }
        }
        .background(Palette.bg)
        .task(id: "(item.itemId)-(retryCount)") {
            await loadPreview()
        }
    }

    private var title: String {
        switch item.kind {
        case "document": item.originalName ?? "File"
        case "link": item.linkTitle ?? item.linkHostname ?? "Link"
        case "voice": "Voice message"
        default: item.mediaTitle ?? item.originalName ?? item.kind.capitalized
        }
    }

    private var canTransfer: Bool { SharedContentPreviewCapabilities.canTransfer(item) }

    @ViewBuilder private var transferActions: some View {
        if canTransfer {
            if item.kind == "link" {
                ActionButton("Share", variant: .primary, fullWidth: true) {
                    onNativeAction(.share)
                }
                .accessibilityHint("Shares a verified copy using the system share sheet")
            } else {
                VStack(spacing: Spacing.xs) {
                    HStack(spacing: Spacing.xs) {
                        ActionButton("Share", variant: .primary, fullWidth: true) {
                            onNativeAction(.share)
                        }
                        .accessibilityHint("Shares a verified copy using the system share sheet")
                        ActionButton("Save", variant: .secondary, fullWidth: true) {
                            onNativeAction(.save)
                        }
                        .accessibilityHint("Saves a verified copy using the system file picker")
                    }
                    ActionButton("Download", variant: .secondary, fullWidth: true) {
                        onNativeAction(.download)
                    }
                    .accessibilityHint("Downloads a verified copy using the system file picker")
                }
            }
        } else if item.kind == "gif" || item.kind == "sticker" {
            Text("Export is unavailable for this item yet.")
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
    }

    @ViewBuilder private var previewBody: some View {
        if item.kind == "sticker", let stickerId = item.stickerId {
            StickerMedia(stickerId: stickerId, displaySize: .fill)
                .frame(maxWidth: .infinity, minHeight: 180, maxHeight: 520)
        } else if let thumbnail {
            Image(uiImage: thumbnail)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .frame(minHeight: 180, maxHeight: 520)
                .accessibilityLabel(title)
        } else {
            VStack(spacing: Spacing.xs) {
                Text(title)
                    .textStyle(.heading)
                    .foregroundStyle(Palette.foreground)
                Text(previewDetail)
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .multilineTextAlignment(.center)
                if isLoadingThumbnail { ProgressView().accessibilityLabel("Loading preview") }
            }
            .frame(maxWidth: .infinity, minHeight: 180)
            .padding(Spacing.lg)
            .background(Palette.surface2, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityElement(children: .combine)
            .accessibilityLabel(title + ". " + previewDetail)
        }
    }

    private var previewDetail: String {
        switch item.kind {
        case "document":
            [item.mimeType, item.byteSize.map(Self.byteSizeLabel)].compactMap { $0 }.joined(separator: " · ")
        case "voice": item.durationMs.map(Self.durationLabel) ?? "Duration unavailable"
        case "link": item.linkHostname ?? item.linkUrl ?? title
        case "video": "Video is paused until you choose Play video."
        default: isLoadingThumbnail ? "Loading preview…" : "Preview unavailable"
        }
    }

    private func loadPreview() async {
        guard let loadThumbnail,
              item.kind == "photo" || item.kind == "video" || item.kind == "gif"
        else { return }
        isLoadingThumbnail = true
        thumbnailFailed = false
        let data = await loadThumbnail(.init(
            itemId: item.itemId,
            contentVersion: item.contentVersion
        ))
        guard !Task.isCancelled else { return }
        thumbnail = data.flatMap(UIImage.init(data:))
        thumbnailFailed = thumbnail == nil
        isLoadingThumbnail = false
    }

    private static func localizedDate(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return "Date unavailable" }
        return DateFormatter.localizedString(
            from: date,
            dateStyle: .medium,
            timeStyle: .short
        )
    }

    private static func byteSizeLabel(_ value: Int64) -> String {
        if value >= 1_000_000 { return String(format: "%.1f MB", Double(value) / 1_000_000) }
        if value >= 1_000 { return String(format: "%.1f KB", Double(value) / 1_000) }
        return "\(value) B"
    }

    private static func durationLabel(_ value: Int64) -> String {
        let seconds = value / 1_000
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
