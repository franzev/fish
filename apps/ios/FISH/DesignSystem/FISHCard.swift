import SwiftUI

struct FISHCard<Content: View>: View {
    private let content: Content
    @Environment(\.colorScheme) private var colorScheme

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(FISHSpacing.lg)
            .background(FISHColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: FISHRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: FISHRadius.card, style: .continuous)
                    .stroke(FISHColors.border, lineWidth: FISHStroke.hairline)
            )
            .shadow(
                color: FISHShadow.cardColor(for: colorScheme),
                radius: FISHShadow.cardRadius,
                x: 0,
                y: FISHShadow.cardY
            )
    }
}

#Preview("Card") {
    FISHTheme {
        FISHCard {
            VStack(alignment: .leading, spacing: FISHSpacing.sm) {
                Text("Today")
                    .font(FISHType.heading)
                    .foregroundStyle(FISHColors.foreground)
                Text("One small check-in is ready when you are.")
                    .font(FISHType.body)
            }
        }
        .padding(FISHSpacing.lg)
    }
}
