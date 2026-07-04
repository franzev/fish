import SwiftUI

struct MessageBubble: View {
    let text: String
    let mine: Bool

    var body: some View {
        Text(text)
            .font(FISHType.caption)
            .foregroundStyle(mine ? FISHColors.onPrimary : FISHColors.body)
            .padding(.horizontal, FISHSpacing.md)
            .padding(.vertical, 10)
            .background(mine ? FISHColors.primary : FISHColors.surface)
            .clipShape(bubbleShape)
            .overlay(
                bubbleShape.stroke(mine ? Color.clear : FISHColors.border, lineWidth: FISHStroke.hairline)
            )
            .fixedSize(horizontal: false, vertical: true)
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: FISHRadius.card,
            bottomLeadingRadius: mine ? FISHRadius.card : FISHRadius.control,
            bottomTrailingRadius: mine ? FISHRadius.control : FISHRadius.card,
            topTrailingRadius: FISHRadius.card,
            style: .continuous
        )
    }
}

#Preview("Message bubbles") {
    FISHTheme {
        VStack(alignment: .leading, spacing: FISHSpacing.md) {
            MessageBubble(text: "Could I have a little more time to think that through?", mine: false)
            MessageBubble(text: "That sentence feels usable.", mine: true)
        }
        .padding(FISHSpacing.lg)
    }
}
