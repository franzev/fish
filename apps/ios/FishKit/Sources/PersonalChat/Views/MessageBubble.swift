import DesignSystem
import SwiftUI
import UIComponents

/// One message bubble. Direction is conveyed by alignment, corners, and fill;
/// delivery meaning always includes text.
public struct MessageBubble: View {
    private let row: MessageRowUiModel
    private let onRetry: ((String) -> Void)?
    @Environment(\.locale) private var locale
    @Environment(\.timeZone) private var timeZone

    public init(
        row: MessageRowUiModel,
        onRetry: ((String) -> Void)? = nil
    ) {
        self.row = row
        self.onRetry = onRetry
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
            VStack(alignment: horizontalAlignment, spacing: Spacing.threeXs) {
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
        }
        .frame(maxWidth: .infinity, alignment: frameAlignment)
        .padding(isOutgoing ? .leading : .trailing, Spacing.twoXl)
    }

    private var bodyText: some View {
        Text(row.message.body)
            .textStyle(
                EmojiOnlyMessage.isEmojiOnly(row.message.body) ? .display : .body
            )
            .foregroundStyle(
                isOutgoing
                    ? Palette.onMessageOutgoing
                    : Palette.onMessageIncoming
            )
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
