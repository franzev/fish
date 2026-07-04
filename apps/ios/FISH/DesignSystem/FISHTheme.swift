import SwiftUI

struct FISHTheme<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .font(FISHType.body)
            .foregroundStyle(FISHColors.body)
            .tint(FISHColors.primary)
            .background(FISHColors.bg)
    }
}

#Preview("Theme") {
    FISHTheme {
        VStack(alignment: .leading, spacing: FISHSpacing.md) {
            Text("FISH")
                .font(FISHType.display)
                .foregroundStyle(FISHColors.foreground)
            Text("Calm coaching for one useful next step.")
                .font(FISHType.body)
        }
        .padding(FISHSpacing.lg)
    }
}
