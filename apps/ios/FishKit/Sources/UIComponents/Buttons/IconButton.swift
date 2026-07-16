import DesignSystem
import SwiftUI

/// Icon-only control with a 44-point target, 20-point glyph, and required
/// accessible name.
public struct IconButton: View {
    public enum Style: Sendable, Equatable {
        case solid
        case quiet
    }

    private let icon: Icon
    private let style: Style
    private let accessibilityLabel: String
    private let isBusy: Bool
    private let action: () -> Void

    public init(
        _ icon: Icon,
        style: Style = .quiet,
        accessibilityLabel: String,
        isBusy: Bool = false,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.style = style
        self.accessibilityLabel = accessibilityLabel
        self.isBusy = isBusy
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                icon.image
                    .glyphFrame()
                    .opacity(isBusy ? 0 : 1)
                if isBusy {
                    ProgressView()
                }
            }
            .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
        }
        .buttonStyle(IconButtonStyle(style: style, isBusy: isBusy))
        .tint(style == .solid ? Palette.onPrimary : Palette.foreground)
        .disabled(isBusy)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isBusy ? "In progress" : "")
    }
}

private struct IconButtonStyle: ButtonStyle {
    let style: IconButton.Style
    let isBusy: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let showsDisabled = !isEnabled && !isBusy
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
        return style == .solid ? Palette.onPrimary : Palette.body
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return style == .solid ? Palette.surface2 : .clear
        }
        return switch style {
        case .solid: pressed ? Palette.primaryPress : Palette.primary
        case .quiet: pressed ? Palette.surface2 : .clear
        }
    }
}
