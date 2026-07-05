import SwiftUI

enum ButtonVariant {
    case primary
    case secondary
    case ghost
}

struct Button<Label: View>: View {
    private let variant: ButtonVariant
    private let fullWidth: Bool
    private let loading: Bool
    private let action: () -> Void
    private let label: Label
    @Environment(\.isEnabled) private var isEnabled

    init(
        variant: ButtonVariant = .primary,
        fullWidth: Bool = false,
        loading: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder label: () -> Label
    ) {
        self.variant = variant
        self.fullWidth = fullWidth
        self.loading = loading
        self.action = action
        self.label = label()
    }

    var body: some View {
        SwiftUI.Button {
            guard !loading else { return }
            action()
        } label: {
            ZStack {
                label
                    .opacity(loading ? Opacity.hidden : Opacity.full)

                if loading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foregroundColor)
                        .controlSize(.small)
                }
            }
            .font(Typography.bodyMedium)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: Sizes.control)
            .padding(.horizontal, Spacing.lg)
        }
        .buttonStyle(
            ActionButtonStyle(
                variant: variant,
                foregroundColor: foregroundColor,
                backgroundColor: backgroundColor,
                borderColor: borderColor
            )
        )
        .disabled(loading || !isEnabled)
        .accessibilityValue(Text(loading ? "Loading" : ""))
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary:
            Palette.onPrimary
        case .secondary:
            Palette.foreground
        case .ghost:
            Palette.muted
        }
    }

    private var backgroundColor: Color {
        switch variant {
        case .primary:
            Palette.primary
        case .secondary:
            Palette.surface
        case .ghost:
            Color.clear
        }
    }

    private var borderColor: Color {
        switch variant {
        case .secondary:
            Palette.border
        case .primary, .ghost:
            Color.clear
        }
    }
}

private struct ActionButtonStyle: ButtonStyle {
    let variant: ButtonVariant
    let foregroundColor: Color
    let backgroundColor: Color
    let borderColor: Color
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(foregroundColor)
            .background(
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .fill(configuration.isPressed && variant == .primary ? Palette.primaryPress : backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .stroke(borderColor, lineWidth: Stroke.hairline)
            )
            .opacity(isEnabled ? Opacity.full : Opacity.disabledContent)
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }
}

#Preview("Buttons") {
    Theme {
        VStack(spacing: Spacing.sm) {
            Button(fullWidth: true, action: {}) {
                Text("Continue")
            }
            Button(variant: .secondary, fullWidth: true, action: {}) {
                Text("Use email instead")
            }
            Button(variant: .ghost, action: {}) {
                Text("Back")
            }
            Button(loading: true, action: {}) {
                Text("Sending")
            }
        }
        .padding(Spacing.lg)
    }
}
