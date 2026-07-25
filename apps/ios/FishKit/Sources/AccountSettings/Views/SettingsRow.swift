import DesignSystem
import SwiftUI
import UIComponents

struct SettingsRow: View {
    let label: String
    let explanation: String?
    let trailing: String?
    let selected: Bool
    let enabled: Bool
    let showsChevron: Bool
    let action: () -> Void

    init(
        label: String,
        explanation: String? = nil,
        trailing: String? = nil,
        selected: Bool = false,
        enabled: Bool = true,
        showsChevron: Bool = true,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.explanation = explanation
        self.trailing = trailing
        self.selected = selected
        self.enabled = enabled
        self.showsChevron = showsChevron
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(label)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                    if let explanation {
                        Text(explanation)
                            .textStyle(.caption)
                            .foregroundStyle(Palette.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: Spacing.xs)
                if let trailing {
                    Text(trailing)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .multilineTextAlignment(.trailing)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if selected { selectionMark }
                if showsChevron {
                    Icon.chevronRight.image
                        .glyphFrame()
                        .foregroundStyle(Palette.muted)
                }
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.twoXs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: Metrics.targetTouch)
            .background(
                selected ? Palette.surface2 : .clear,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : Opacity.focus)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var selectionMark: some View {
        ZStack {
            Circle()
                .stroke(Palette.body, lineWidth: 1)
                .frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
            if selected {
                Circle()
                    .fill(Palette.foreground)
                    .frame(width: Spacing.sm, height: Spacing.sm)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Account settings") {
    AccountSettingsSheet(
        displayName: "Alex Rivera",
        presence: AccountSettingsPresence(visibility: .automatic),
        notificationStatus: .authorized,
        appearance: .system,
        motion: .system,
        canManageBlockedPeople: true,
        onSignOut: {}
    )
}
