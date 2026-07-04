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
            FISHType.caption
        case .medium:
            FISHType.label
        case .large:
            FISHType.bodyMedium
        }
    }
}

struct AvatarView: View {
    let name: String
    var size: AvatarSize = .medium

    var body: some View {
        ZStack {
            Circle()
                .fill(FISHColors.surface2)

            if initials.isEmpty {
                Image(systemName: "person")
                    .font(FISHType.label)
                    .foregroundStyle(FISHColors.muted)
            } else {
                Text(initials)
                    .font(size.font)
                    .foregroundStyle(FISHColors.body)
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
    FISHTheme {
        HStack(spacing: FISHSpacing.md) {
            AvatarView(name: "Maya Chen", size: .small)
            AvatarView(name: "Alex Rivera")
            AvatarView(name: "", size: .large)
        }
        .padding(FISHSpacing.lg)
    }
}
