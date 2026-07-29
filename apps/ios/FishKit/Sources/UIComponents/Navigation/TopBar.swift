import DesignSystem
import SwiftUI

public struct TopBarAction {
    public let icon: Icon
    public let accessibilityLabel: String
    public let action: () -> Void

    public init(
        icon: Icon,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }
}

/// FISH-drawn chrome with optional quiet back and trailing actions. It keeps
/// the standard 64-point height and grows when Dynamic Type needs more room.
public struct TopBar<Content: View>: View {
    private let onBack: (() -> Void)?
    private let trailing: [TopBarAction]
    private let content: Content

    /// More than one trailing action is for a bar that genuinely carries two
    /// errands — the inbox's add-a-friend beside the account. They read left
    /// to right in the order given, so the account stays where it has always
    /// been: last.
    public init(
        onBack: (() -> Void)? = nil,
        trailing: [TopBarAction],
        @ViewBuilder content: () -> Content
    ) {
        self.onBack = onBack
        self.trailing = trailing
        self.content = content()
    }

    public init(
        onBack: (() -> Void)? = nil,
        trailing: TopBarAction? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            onBack: onBack,
            trailing: trailing.map { [$0] } ?? [],
            content: content
        )
    }

    public var body: some View {
        HStack(spacing: Spacing.xs) {
            if let onBack {
                IconButton(
                    .back,
                    style: .quiet,
                    accessibilityLabel: "Back",
                    action: onBack
                )
            }
            content
                .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(trailing.indices, id: \.self) { index in
                IconButton(
                    trailing[index].icon,
                    style: .quiet,
                    accessibilityLabel: trailing[index].accessibilityLabel,
                    action: trailing[index].action
                )
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, Spacing.twoXs)
        .frame(minHeight: Metrics.chatHeader)
        .background(Palette.bg)
        .overlay(alignment: .bottom) {
            Palette.divider.frame(height: 1)
        }
    }
}

extension TopBar where Content == AnyView {
    public init(
        title: String,
        onBack: (() -> Void)? = nil,
        trailing: [TopBarAction]
    ) {
        self.init(onBack: onBack, trailing: trailing) {
            AnyView(
                Text(title)
                    .textStyle(.heading)
                    .foregroundStyle(Palette.foreground)
                    .fixedSize(horizontal: false, vertical: true)
            )
        }
    }

    public init(
        title: String,
        onBack: (() -> Void)? = nil,
        trailing: TopBarAction? = nil
    ) {
        self.init(
            title: title,
            onBack: onBack,
            trailing: trailing.map { [$0] } ?? []
        )
    }
}
