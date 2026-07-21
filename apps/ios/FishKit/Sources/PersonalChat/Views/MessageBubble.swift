import ChatData
import DesignSystem
import SwiftUI
import UIKit
import UIComponents

/// One message bubble. Direction is conveyed by alignment, corners, and fill;
/// delivery meaning always includes text.
public struct MessageBubble: View {
    private let row: MessageRowUiModel
    private let onRetry: ((String) -> Void)?
    private let onAction: (MessageAction) -> Void
    private let onReplyTap: (String) -> Void
    private let reactionsEnabled: Bool
    private let attachmentCommands: (any AttachmentCommandProviding)?
    private let imageLoader: MessageImageLoader
    private let fileDownloader: AttachmentFileDownloader
    @Environment(\.locale) private var locale
    @Environment(\.timeZone) private var timeZone
    @Environment(\.layoutDirection) private var layoutDirection
    @State private var confirmsDeletion = false
    @State private var isReactionPickerPresented = false

    public init(
        row: MessageRowUiModel,
        onRetry: ((String) -> Void)? = nil,
        onAction: @escaping (MessageAction) -> Void = { _ in },
        onReplyTap: @escaping (String) -> Void = { _ in },
        reactionsEnabled: Bool = true,
        attachmentCommands: (any AttachmentCommandProviding)? = nil,
        imageLoader: MessageImageLoader = .shared,
        fileDownloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.row = row
        self.onRetry = onRetry
        self.onAction = onAction
        self.onReplyTap = onReplyTap
        self.reactionsEnabled = reactionsEnabled
        self.attachmentCommands = attachmentCommands
        self.imageLoader = imageLoader
        self.fileDownloader = fileDownloader
    }

    private var isOutgoing: Bool {
        row.message.direction == .outgoing
    }

    private var horizontalAlignment: HorizontalAlignment {
        isOutgoing ? .trailing : .leading
    }

    private var frameAlignment: Alignment {
        isOutgoing ? .trailing : .leading
    }

    public var body: some View {
        VStack(alignment: horizontalAlignment, spacing: Spacing.threeXs) {
            if row.showsMeta {
                // Visual only — the combined element below already speaks the
                // time as part of the message label.
                Text(
                    row.message.sentAt,
                    format: Date.FormatStyle(time: .shortened)
                )
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
                .accessibilityHidden(true)
            }
            // A GIF carries focusable children (playback, attribution), so it
            // sits outside the combined element; its description still lives
            // in the combined label, which reads first.
            if case .gif(let gif) = row.message.media {
                MessageGif(gif: gif)
            }
            if !row.message.attachments.isEmpty {
                MessageAttachments(
                    attachments: row.message.attachments,
                    author: row.message.senderName,
                    loader: imageLoader,
                    commands: attachmentCommands,
                    downloader: fileDownloader
                )
            }
            VStack(alignment: horizontalAlignment, spacing: Spacing.threeXs) {
                if let reply = row.message.replyPreview {
                    replyPreview(reply)
                }
                switch row.message.media {
                case .sticker(let id):
                    StickerMedia(stickerId: id)
                case .gifUnavailable:
                    unavailableMedia(MediaAccessibility.gifUnavailableLabel)
                case .gif, .none:
                    EmptyView()
                }
                if !row.message.body.isEmpty {
                    bodyText
                }
                if row.showsDeliveryStatus,
                   let delivery = row.message.delivery,
                   delivery != .failed {
                    statusLine(delivery)
                }
                if row.message.isEdited && !row.message.isDeleted {
                    Text("Edited")
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(MessageAccessibility.label(
                for: row,
                locale: locale,
                timeZone: timeZone
            ))
            .accessibilitySortPriority(1)

            if row.showsDeliveryStatus, row.message.delivery == .failed {
                failedLine
            }
            if !row.message.reactions.isEmpty {
                reactionPills
            }
        }
        .frame(maxWidth: .infinity, alignment: frameAlignment)
        .padding(isOutgoing ? .leading : .trailing, Spacing.twoXl)
        .contextMenu { actionMenu }
        .popover(
            isPresented: $isReactionPickerPresented,
            attachmentAnchor: .rect(.bounds),
            arrowEdge: isOutgoing ? .trailing : .leading
        ) {
            ReactionPicker { emoji in
                onAction(.toggleReaction(messageId: row.message.id, emoji: emoji))
            }
        }
        .onChange(of: canReact) { _, available in
            if !available { isReactionPickerPresented = false }
        }
        .confirmationDialog(
            "Delete this message?",
            isPresented: $confirmsDeletion,
            titleVisibility: .visible
        ) {
            Button("Delete message", role: .destructive) {
                onAction(.delete(row.message.id))
            }
            Button("Keep message", role: .cancel) {}
        } message: {
            Text("It will be replaced with “Message deleted.”")
        }
    }

    @ViewBuilder private var actionMenu: some View {
        if actionsAvailable {
            Button("Reply", systemImage: "arrowshape.turn.up.left") {
                onAction(.reply(row.message.id))
            }
            if canCopyMessage {
                Button("Copy", systemImage: "doc.on.doc") {
                    UIPasteboard.general.string = row.message.body
                }
            }
            if isOutgoing && !row.message.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button("Edit", systemImage: "pencil") {
                    onAction(.edit(row.message.id))
                }
            }
            if isOutgoing {
                Button("Delete", systemImage: "trash", role: .destructive) {
                    confirmsDeletion = true
                }
            }
            Button("Add a reaction", systemImage: "face.smiling") {
                isReactionPickerPresented = true
            }
            .disabled(!canReact)
            if isGifMessage {
                Button("Report GIF", systemImage: "flag") {
                    onAction(.reportGif(row.message.id))
                }
            }
        }
    }

    private var actionsAvailable: Bool {
        !row.message.isDeleted
            && row.message.delivery != .sending
            && row.message.delivery != .failed
    }

    internal var canCopyMessage: Bool {
        actionsAvailable && !row.message.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canReact: Bool {
        actionsAvailable && reactionsEnabled && !row.message.isReactionPending
    }

    private var isGifMessage: Bool {
        switch row.message.media {
        case .gif, .gifUnavailable: true
        case .sticker, .none: false
        }
    }

    private func replyPreview(_ preview: MessageReplyPreviewUiModel) -> some View {
        Button {
            onReplyTap(preview.messageId)
        } label: {
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(preview.authorName)
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                Text(preview.snippet)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.xs)
            .background(
                Palette.surface2,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Reply to \(preview.authorName): \(preview.snippet)")
    }

    private var reactionPills: some View {
        ReactionFlowLayout(
            spacing: Spacing.nudge,
            alignment: isOutgoing ? .trailing : .leading,
            layoutDirection: layoutDirection
        ) {
            ForEach(row.message.reactions) { reaction in
                ReactionPill(
                    reaction: reaction,
                    disabled: !canReact
                ) {
                    onAction(.toggleReaction(
                        messageId: row.message.id,
                        emoji: reaction.emoji
                    ))
                }
            }
            AddReactionPill(disabled: !canReact) {
                isReactionPickerPresented = true
            }
        }
    }

    private var bodyText: some View {
        MessageBody(body: row.message.body, isOutgoing: isOutgoing)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.compact)
            .background(
                isOutgoing
                    ? Palette.messageOutgoingContainer
                    : Palette.messageIncomingContainer,
                in: UnevenRoundedRectangle(
                    cornerRadii: BubbleShape.radii(
                        direction: row.message.direction,
                        position: row.groupPosition
                    ),
                    style: .continuous
                )
            )
            .fixedSize(horizontal: false, vertical: true)
    }

    private func unavailableMedia(_ label: String) -> some View {
        Text(label)
            .textStyle(.caption)
            .foregroundStyle(Palette.muted)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.compact)
            .background(
                Palette.surface2,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
    }

    private func statusLine(_ delivery: MessageDeliveryStatus) -> some View {
        HStack(spacing: Spacing.nudge) {
            if let icon = MessageDeliveryPresentation.icon(delivery) {
                icon.image
                    .frame(
                        width: TypeScale.caption.size,
                        height: TypeScale.caption.size
                    )
                    .foregroundStyle(Palette.muted)
            }
            Text(MessageDeliveryPresentation.statusText(delivery))
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
    }

    private var failedLine: some View {
        HStack(spacing: Spacing.nudge) {
            Icon.alert.image
                .frame(
                    width: TypeScale.caption.size,
                    height: TypeScale.caption.size
                )
                .foregroundStyle(Palette.messageFailed)
            Text("Not sent.")
                .textStyle(.caption)
                .foregroundStyle(Palette.messageFailed)
            if let onRetry {
                ActionButton("Try sending again", variant: .link) {
                    onRetry(row.message.id)
                }
            }
        }
    }
}
import ChatData
