import SwiftUI

struct ProgressBar: View {
    let value: Double

    var body: some View {
        GeometryReader { proxy in
            let clamped = min(max(value, 0), 1)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Palette.surface2)
                Capsule()
                    .fill(Palette.primary)
                    .frame(width: proxy.size.width * clamped)
            }
        }
        .frame(height: Sizes.progress)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Progress")
    }
}

#Preview("Progress") {
    Theme {
        VStack(spacing: Spacing.md) {
            ProgressBar(value: 0.35)
            ProgressBar(value: 0.7)
        }
        .padding(Spacing.lg)
    }
}
