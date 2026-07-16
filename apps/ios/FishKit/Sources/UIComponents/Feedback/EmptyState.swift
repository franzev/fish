import DesignSystem
import SwiftUI

/// Explains an absence with at most one useful next action.
public struct EmptyState: View {
    private let title: String
    private let message: String?
    private let actionLabel: String?
    private let isPrimaryAction: Bool
    private let onAction: (() -> Void)?

    public init(
        title: String,
        message: String? = nil,
        actionLabel: String? = nil,
        isPrimaryAction: Bool = false,
        onAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.actionLabel = actionLabel
        self.isPrimaryAction = isPrimaryAction
        self.onAction = onAction
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            Text(title)
                .textStyle(.heading)
                .foregroundStyle(Palette.foreground)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let message {
                Text(message)
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let actionLabel, let onAction {
                ActionButton(
                    actionLabel,
                    variant: isPrimaryAction ? .primary : .secondary,
                    action: onAction
                )
                .padding(.top, Spacing.xs)
            }
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}
