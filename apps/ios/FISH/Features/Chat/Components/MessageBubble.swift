import SwiftUI

struct MessageBubble: View {
    let text: String
    let mine: Bool

    var body: some View {
        Text(text)
            .font(Typography.caption)
            .foregroundStyle(mine ? Palette.onPrimary : Palette.body)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 10)
            .background(mine ? Palette.primary : Palette.surface)
            .clipShape(bubbleShape)
            .overlay(
                bubbleShape.stroke(mine ? Color.clear : Palette.border, lineWidth: Stroke.hairline)
            )
            .fixedSize(horizontal: false, vertical: true)
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Radius.card,
            bottomLeadingRadius: mine ? Radius.card : Radius.control,
            bottomTrailingRadius: mine ? Radius.control : Radius.card,
            topTrailingRadius: Radius.card,
            style: .continuous
        )
    }
}

#Preview("Message bubbles") {
    Theme {
        VStack(alignment: .leading, spacing: Spacing.md) {
            MessageBubble(text: "Could I have a little more time to think that through?", mine: false)
            MessageBubble(text: "That sentence feels usable.", mine: true)
        }
        .padding(Spacing.lg)
    }
}
