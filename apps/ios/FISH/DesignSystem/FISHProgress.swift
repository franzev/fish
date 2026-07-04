import SwiftUI

struct FISHProgress: View {
    let value: Double

    var body: some View {
        GeometryReader { proxy in
            let clamped = min(max(value, 0), 1)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(FISHColors.surface2)
                Capsule()
                    .fill(FISHColors.primary)
                    .frame(width: proxy.size.width * clamped)
            }
        }
        .frame(height: FISHSizes.progress)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Progress")
    }
}

#Preview("Progress") {
    FISHTheme {
        VStack(spacing: FISHSpacing.md) {
            FISHProgress(value: 0.35)
            FISHProgress(value: 0.7)
        }
        .padding(FISHSpacing.lg)
    }
}
