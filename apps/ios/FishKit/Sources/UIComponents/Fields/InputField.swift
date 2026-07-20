import DesignSystem
import SwiftUI

/// Single-line labeled field with a reserved support row so validation never
/// shifts surrounding content.
public struct InputField: View {
    public enum Support: Equatable, Sendable {
        case none
        case hint(String)
        case notice(String)
        case error(String)
    }

    private let label: String
    private let isSecure: Bool
    @Binding private var text: String
    private let support: Support
    @FocusState private var isFocused: Bool
    @Environment(\.isEnabled) private var isEnabled

    public init(
        label: String,
        text: Binding<String>,
        support: Support = .none,
        isSecure: Bool = false
    ) {
        self.label = label
        self._text = text
        self.support = support
        self.isSecure = isSecure
    }

    nonisolated static func supportText(for support: Support) -> String? {
        switch support {
        case .none: nil
        case .hint(let value), .notice(let value), .error(let value): value
        }
    }

    private var supportColor: Color {
        switch support {
        case .error: Palette.error
        case .notice: Palette.notice
        case .hint, .none: Palette.muted
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            Text(label)
                .textStyle(.label)
                .foregroundStyle(isEnabled ? Palette.foreground : Palette.muted)
            field
            Text(Self.supportText(for: support) ?? " ")
                .textStyle(.caption)
                .foregroundStyle(supportColor)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityHidden(Self.supportText(for: support) == nil)
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var field: some View {
        Group {
            if isSecure {
                SecureField("", text: $text)
            } else {
                TextField("", text: $text)
            }
        }
        .textInputStyle(.body)
        .foregroundStyle(isEnabled ? Palette.foreground : Palette.muted)
        .focused($isFocused)
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.fieldY)
        .background(isFocused ? Palette.surface3 : Palette.surface)
        .clipShape(RoundedRectangle(
            cornerRadius: Radius.control,
            style: .continuous
        ))
        .overlay {
            RoundedRectangle(
                cornerRadius: Radius.control,
                style: .continuous
            )
            .strokeBorder(Palette.border, lineWidth: 1)
        }
        .accessibilityLabel(label)
    }
}
