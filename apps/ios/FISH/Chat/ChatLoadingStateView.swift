import SwiftUI

struct ChatLoadingStateView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: FISHSpacing.md) {
            loadingRow(width: 180)
            loadingRow(width: 240, mine: true)
            loadingRow(width: 150)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
    }

    private func loadingRow(width: CGFloat, mine: Bool = false) -> some View {
        HStack(spacing: FISHSpacing.sm) {
            if mine {
                Spacer(minLength: FISHSpacing.xl)
            } else {
                Circle()
                    .fill(FISHColors.surface2)
                    .frame(width: AvatarSize.small.value, height: AvatarSize.small.value)
            }

            RoundedRectangle(cornerRadius: FISHRadius.card, style: .continuous)
                .fill(FISHColors.surface2)
                .frame(width: width, height: 40)

            if mine {
                Circle()
                    .fill(FISHColors.surface2)
                    .frame(width: AvatarSize.small.value, height: AvatarSize.small.value)
            } else {
                Spacer(minLength: FISHSpacing.xl)
            }
        }
    }
}

#Preview("Loading") {
    FISHTheme {
        ChatLoadingStateView()
            .padding(FISHSpacing.lg)
    }
}
