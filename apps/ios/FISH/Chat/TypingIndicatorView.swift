import SwiftUI

struct TypingIndicatorView: View {
    var label = "Coach is typing"

    var body: some View {
        HStack(spacing: FISHSpacing.xs) {
            ForEach(0..<3, id: \.self) { _ in
                Circle()
                    .fill(FISHColors.muted)
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.horizontal, FISHSpacing.md)
        .padding(.vertical, FISHSpacing.sm)
        .background(FISHColors.surface2)
        .clipShape(Capsule())
        .accessibilityLabel(label)
    }
}

#Preview("Typing") {
    FISHTheme {
        TypingIndicatorView()
            .padding(FISHSpacing.lg)
    }
}
