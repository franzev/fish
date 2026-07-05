import SwiftUI

struct TypingIndicatorView: View {
    var label = "Coach is typing"

    var body: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(0..<3, id: \.self) { _ in
                Circle()
                    .fill(Palette.muted)
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Palette.surface2)
        .clipShape(Capsule())
        .accessibilityLabel(label)
    }
}

#Preview("Typing") {
    Theme {
        TypingIndicatorView()
            .padding(Spacing.lg)
    }
}
