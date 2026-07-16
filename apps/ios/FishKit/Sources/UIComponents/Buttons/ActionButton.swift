import DesignSystem
import SwiftUI

public enum ActionButtonVariant: Sendable, Equatable {
    case primary
    case secondary
    case ghost
}

/// Token-pure action control. Loading preserves geometry and blocks duplicate
/// activation; primary is reserved for a screen's single main action.
public struct ActionButton: View {
    private let title: String
    private let variant: ActionButtonVariant
    private let isLoading: Bool
    private let fullWidth: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        variant: ActionButtonVariant = .secondary,
        isLoading: Bool = false,
        fullWidth: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.isLoading = isLoading
        self.fullWidth = fullWidth
        self.action = action
    }

    nonisolated static func height(for variant: ActionButtonVariant) -> CGFloat {
        variant == .primary ? Metrics.controlPrimary : Metrics.targetTouch
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    buttonTitle.hidden()
                    ProgressView()
                } else {
                    buttonTitle
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(minHeight: Self.height(for: variant))
        }
        .buttonStyle(ActionButtonStyle(variant: variant, isLoading: isLoading))
        .tint(variant == .primary ? Palette.onPrimary : Palette.foreground)
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityValue(isLoading ? "In progress" : "")
    }

    private var buttonTitle: some View {
        Text(title)
            .textStyle(.ui)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityHidden(true)
    }
}

private struct ActionButtonStyle: ButtonStyle {
    let variant: ActionButtonVariant
    let isLoading: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let showsDisabled = !isEnabled && !isLoading
        configuration.label
            .foregroundStyle(foreground(showsDisabled: showsDisabled))
            .background(background(
                pressed: configuration.isPressed,
                showsDisabled: showsDisabled
            ))
            .clipShape(RoundedRectangle(
                cornerRadius: Radius.control,
                style: .continuous
            ))
            .contentShape(RoundedRectangle(
                cornerRadius: Radius.control,
                style: .continuous
            ))
    }

    private func foreground(showsDisabled: Bool) -> Color {
        if showsDisabled { return Palette.muted }
        return switch variant {
        case .primary: Palette.onPrimary
        case .secondary: Palette.foreground
        case .ghost: Palette.body
        }
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return variant == .ghost ? .clear : Palette.surface2
        }
        return switch variant {
        case .primary: pressed ? Palette.primaryPress : Palette.primary
        case .secondary: pressed ? Palette.surface3 : Palette.surface2
        case .ghost: pressed ? Palette.surface2 : .clear
        }
    }
}
