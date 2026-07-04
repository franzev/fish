import SwiftUI

enum FISHButtonVariant {
    case primary
    case secondary
    case ghost
}

struct FISHButton<Label: View>: View {
    private let variant: FISHButtonVariant
    private let fullWidth: Bool
    private let loading: Bool
    private let action: () -> Void
    private let label: Label
    @Environment(\.isEnabled) private var isEnabled

    init(
        variant: FISHButtonVariant = .primary,
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
        Button {
            guard !loading else { return }
            action()
        } label: {
            ZStack {
                label
                    .opacity(loading ? FISHOpacity.hidden : FISHOpacity.full)

                if loading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foregroundColor)
                        .controlSize(.small)
                }
            }
            .font(FISHType.bodyMedium)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: FISHSizes.control)
            .padding(.horizontal, FISHSpacing.lg)
        }
        .buttonStyle(
            FISHButtonStyle(
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
            FISHColors.onPrimary
        case .secondary:
            FISHColors.foreground
        case .ghost:
            FISHColors.muted
        }
    }

    private var backgroundColor: Color {
        switch variant {
        case .primary:
            FISHColors.primary
        case .secondary:
            FISHColors.surface
        case .ghost:
            Color.clear
        }
    }

    private var borderColor: Color {
        switch variant {
        case .secondary:
            FISHColors.border
        case .primary, .ghost:
            Color.clear
        }
    }
}

private struct FISHButtonStyle: ButtonStyle {
    let variant: FISHButtonVariant
    let foregroundColor: Color
    let backgroundColor: Color
    let borderColor: Color
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(foregroundColor)
            .background(
                RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous)
                    .fill(configuration.isPressed && variant == .primary ? FISHColors.primaryPress : backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous)
                    .stroke(borderColor, lineWidth: FISHStroke.hairline)
            )
            .opacity(isEnabled ? FISHOpacity.full : FISHOpacity.disabledContent)
            .contentShape(RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous))
    }
}

#Preview("Buttons") {
    FISHTheme {
        VStack(spacing: FISHSpacing.sm) {
            FISHButton(fullWidth: true, action: {}) {
                Text("Continue")
            }
            FISHButton(variant: .secondary, fullWidth: true, action: {}) {
                Text("Use email instead")
            }
            FISHButton(variant: .ghost, action: {}) {
                Text("Back")
            }
            FISHButton(loading: true, action: {}) {
                Text("Sending")
            }
        }
        .padding(FISHSpacing.lg)
    }
}
