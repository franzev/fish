import SwiftUI

struct Card<Content: View>: View {
    private let content: Content
    @Environment(\.colorScheme) private var colorScheme

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(Spacing.lg)
            .background(Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .stroke(Palette.border, lineWidth: Stroke.hairline)
            )
            .shadow(
                color: Shadow.cardColor(for: colorScheme),
                radius: Shadow.cardRadius,
                x: 0,
                y: Shadow.cardY
            )
    }
}

#Preview("Card") {
    Theme {
        Card {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Today")
                    .font(Typography.heading)
                    .foregroundStyle(Palette.foreground)
                Text("One small check-in is ready when you are.")
                    .font(Typography.body)
            }
        }
        .padding(Spacing.lg)
    }
}
