import SwiftUI

enum AvatarSize {
    case small
    case medium
    case large

    var value: CGFloat {
        switch self {
        case .small:
            32
        case .medium:
            40
        case .large:
            56
        }
    }

    var font: Font {
        switch self {
        case .small:
            Typography.caption
        case .medium:
            Typography.label
        case .large:
            Typography.bodyMedium
        }
    }
}

struct AvatarView: View {
    let name: String
    var size: AvatarSize = .medium

    var body: some View {
        ZStack {
            Circle()
                .fill(Palette.surface2)

            if initials.isEmpty {
                Image(systemName: "person")
                    .font(Typography.label)
                    .foregroundStyle(Palette.muted)
            } else {
                Text(initials)
                    .font(size.font)
                    .foregroundStyle(Palette.body)
            }
        }
        .frame(width: size.value, height: size.value)
        .accessibilityLabel(name.isEmpty ? "User avatar" : "\(name) avatar")
    }

    private var initials: String {
        let parts = name
            .split(separator: " ")
            .map(String.init)

        guard let first = parts.first?.first else { return "" }
        let second = parts.dropFirst().last?.first
        return String([first, second].compactMap { $0 }).uppercased()
    }
}

#Preview("Avatar") {
    Theme {
        HStack(spacing: Spacing.md) {
            AvatarView(name: "Maya Chen", size: .small)
            AvatarView(name: "Alex Rivera")
            AvatarView(name: "", size: .large)
        }
        .padding(Spacing.lg)
    }
}
