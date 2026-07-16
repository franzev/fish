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
            VStack(alignment: horizontalAlignment, spacing: Spacing.threeXs) {
                if row.showsMeta {
                    Text(
                        row.message.sentAt,
                        format: Date.FormatStyle(time: .shortened)
                    )
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                }
                Text(row.message.body)
                    .textStyle(.body)
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

            if row.showsDeliveryStatus, row.message.delivery == .failed {
                failedLine
            }
        }
        .frame(maxWidth: .infinity, alignment: frameAlignment)
        .padding(isOutgoing ? .leading : .trailing, Spacing.twoXl)
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
                ActionButton("Try sending again", variant: .ghost) {
                    onRetry(row.message.id)
                }
            }
        }
    }
}
