import DesignSystem
import SwiftUI

public enum ActionButtonVariant: Sendable, Equatable {
    case primary
    case secondary
    case ghost
    /// Inline text action inside content flow (retry lines). Underlined body
    /// text so the action stays distinguishable from static copy without a
    /// fill — mirrors the web chat row's underlined retry button.
    case link
}

/// Semantic accent over the monochrome variants. `success` is the calm
/// acceptance fill (answering a call); `critical` tints a quiet action's
/// label with the error token (declining or cancelling a call). Neutral keeps
/// the plain monochrome system.
public enum ActionButtonTone: Sendable, Equatable {
    case neutral
    case success
    case critical
}

/// `focused` raises the control to the 56-point primary-action height even
/// for non-primary variants — the call prompt's answer/decline pair.
public enum ActionButtonProminence: Sendable, Equatable {
    case standard
    case focused
}

/// Token-pure action control. Loading preserves geometry and blocks duplicate
/// activation; primary is reserved for a screen's single main action.
public struct ActionButton: View {
    private let title: String
    private let variant: ActionButtonVariant
    private let tone: ActionButtonTone
    private let prominence: ActionButtonProminence
    private let icon: Icon?
    private let isLoading: Bool
    private let fullWidth: Bool
    private let action: () -> Void
    @Environment(\.fishReduceMotion) private var reduceMotion

    public init(
        _ title: String,
        variant: ActionButtonVariant = .secondary,
        tone: ActionButtonTone = .neutral,
        prominence: ActionButtonProminence = .standard,
        icon: Icon? = nil,
        isLoading: Bool = false,
        fullWidth: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.tone = tone
        self.prominence = prominence
        self.icon = icon
        self.isLoading = isLoading
        self.fullWidth = fullWidth
        self.action = action
    }

    nonisolated static func height(
        for variant: ActionButtonVariant,
        prominence: ActionButtonProminence = .standard
    ) -> CGFloat {
        variant == .primary || prominence == .focused
            ? Metrics.controlPrimary
            : Metrics.targetTouch
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                if isLoading {
                    buttonLabel.hidden()
                    if reduceMotion {
                        StaticProgressIndicator()
                    } else {
                        ProgressView()
                    }
                } else {
                    buttonLabel
                }
            }
            .padding(.horizontal, variant == .link ? Spacing.xs : Spacing.lg)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(minHeight: Self.height(for: variant, prominence: prominence))
        }
        .buttonStyle(ActionButtonStyle(
            variant: variant,
            tone: tone,
            isLoading: isLoading
        ))
        .tint(usesInvertedContent ? Palette.onPrimary : Palette.foreground)
        .disabled(isLoading)
        .accessibilityLabel(title)
        .accessibilityValue(isLoading ? "In progress" : "")
    }

    private var usesInvertedContent: Bool {
        variant == .primary || tone == .success
    }

    private var buttonLabel: some View {
        HStack(spacing: Spacing.xs) {
            if let icon {
                icon.image.glyphFrame()
            }
            Text(title)
                .textStyle(.ui)
                .underline(variant == .link)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityHidden(true)
    }
}

private struct StaticProgressIndicator: View {
    var body: some View {
        Circle()
            .trim(from: 0.12, to: 0.82)
            .stroke(
                style: StrokeStyle(
                    lineWidth: 2,
                    lineCap: .round
                )
            )
            .rotationEffect(.degrees(-90))
            .frame(width: 20, height: 20)
            .accessibilityHidden(true)
    }
}

private struct ActionButtonStyle: ButtonStyle {
    let variant: ActionButtonVariant
    let tone: ActionButtonTone
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
        switch tone {
        case .success: return Palette.onPrimary
        case .critical: return Palette.error
        case .neutral:
            return switch variant {
            case .primary: Palette.onPrimary
            case .secondary: Palette.foreground
            case .ghost, .link: Palette.body
            }
        }
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return variant == .ghost || variant == .link ? .clear : Palette.surface2
        }
        if tone == .success {
            return pressed ? Palette.successPressed : Palette.success
        }
        return switch variant {
        case .primary: pressed ? Palette.primaryPress : Palette.primary
        case .secondary: pressed ? Palette.surface3 : Palette.surface2
        case .ghost, .link: pressed ? Palette.surface2 : .clear
        }
    }
}
