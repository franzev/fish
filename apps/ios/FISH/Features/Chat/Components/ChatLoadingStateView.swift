import SwiftUI

struct ChatLoadingStateView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            loadingRow(width: 180)
            loadingRow(width: 240, mine: true)
            loadingRow(width: 150)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
    }

    private func loadingRow(width: CGFloat, mine: Bool = false) -> some View {
        HStack(spacing: Spacing.sm) {
            if mine {
                Spacer(minLength: Spacing.xl)
            } else {
                Circle()
                    .fill(Palette.surface2)
                    .frame(width: AvatarSize.small.value, height: AvatarSize.small.value)
            }

            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .fill(Palette.surface2)
                .frame(width: width, height: 40)

            if mine {
                Circle()
                    .fill(Palette.surface2)
                    .frame(width: AvatarSize.small.value, height: AvatarSize.small.value)
            } else {
                Spacer(minLength: Spacing.xl)
            }
        }
    }
}

#Preview("Loading") {
    Theme {
        ChatLoadingStateView()
            .padding(Spacing.lg)
    }
}
