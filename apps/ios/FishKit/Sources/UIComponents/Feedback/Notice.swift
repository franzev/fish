import DesignSystem
import SwiftUI

/// Calm inline feedback with semantic icon, copy, and at most one quiet action.
public struct Notice: View {
    public enum Tone: Sendable {
        case notice
        case error
        case warning
        case success

        var color: Color {
            switch self {
            case .notice: Palette.notice
            case .error: Palette.error
            case .warning: Palette.warning
            case .success: Palette.success
            }
        }

        nonisolated var icon: Icon {
            switch self {
            case .notice: .info
            case .error: .alert
            case .warning: .warning
            case .success: .check
            }
        }
    }

    private let tone: Tone
    private let title: String
    private let message: String?
    private let actionLabel: String?
    private let onAction: (() -> Void)?

    public init(
        tone: Tone,
        title: String,
        message: String? = nil,
        actionLabel: String? = nil,
        onAction: (() -> Void)? = nil
    ) {
        self.tone = tone
        self.title = title
        self.message = message
        self.actionLabel = actionLabel
        self.onAction = onAction
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            tone.icon.image
                .glyphFrame()
                .foregroundStyle(tone.color)
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(title)
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                    if let message {
                        Text(message)
                            .textStyle(.caption)
                            .foregroundStyle(Palette.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .accessibilityElement(children: .combine)
                if let actionLabel, let onAction {
                    ActionButton(actionLabel, variant: .ghost, action: onAction)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.md)
        .background(
            Palette.surface2,
            in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        )
    }
}
