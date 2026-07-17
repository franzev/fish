import DesignSystem
import SwiftUI

/// Icon-only control with a 44-point target, 20-point glyph, and required
/// accessible name.
public struct IconButton: View {
    public enum Style: Sendable, Equatable {
        case solid
        case quiet
    }

    /// `critical` renders the calm error fill (ending a call). Neutral keeps
    /// the monochrome system.
    public enum Tone: Sendable, Equatable {
        case neutral
        case critical
    }

    private let icon: Icon
    private let style: Style
    private let tone: Tone
    private let isActive: Bool
    private let accessibilityLabel: String
    private let isBusy: Bool
    private let action: () -> Void

    public init(
        _ icon: Icon,
        style: Style = .quiet,
        tone: Tone = .neutral,
        isActive: Bool = false,
        accessibilityLabel: String,
        isBusy: Bool = false,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.style = style
        self.tone = tone
        self.isActive = isActive
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
        .buttonStyle(IconButtonStyle(
            style: style,
            tone: tone,
            isActive: isActive,
            isBusy: isBusy
        ))
        .tint(usesInvertedContent ? Palette.onPrimary : Palette.foreground)
        .disabled(isBusy)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isBusy ? "In progress" : "")
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }

    private var usesInvertedContent: Bool {
        style == .solid || tone == .critical
    }
}

private struct IconButtonStyle: ButtonStyle {
    let style: IconButton.Style
    let tone: IconButton.Tone
    let isActive: Bool
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
        if tone == .critical { return Palette.onPrimary }
        return style == .solid ? Palette.onPrimary : Palette.body
    }

    private func background(pressed: Bool, showsDisabled: Bool) -> Color {
        if showsDisabled {
            return style == .solid || tone == .critical ? Palette.surface2 : .clear
        }
        if tone == .critical { return Palette.error }
        switch style {
        case .solid: return pressed ? Palette.primaryPress : Palette.primary
        case .quiet:
            if pressed { return isActive ? Palette.surface3 : Palette.surface2 }
            return isActive ? Palette.surface3 : .clear
        }
    }
}
