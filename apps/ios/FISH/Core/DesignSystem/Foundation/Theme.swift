import SwiftUI

struct Theme<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .font(Typography.body)
            .foregroundStyle(Palette.body)
            .tint(Palette.primary)
            .background(Palette.bg)
    }
}

#Preview("Theme") {
    Theme {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("FISH")
                .font(Typography.display)
                .foregroundStyle(Palette.foreground)
            Text("Calm coaching for one useful next step.")
                .font(Typography.body)
        }
        .padding(Spacing.lg)
    }
}
