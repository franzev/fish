import SwiftUI

public enum TextRole: String, CaseIterable, Sendable {
    case display
    case heading
    case body
    case ui
    case label
    case caption
}

public enum Typography {
    static func fontName(for role: TextRole) -> String {
        switch role {
        case .display, .heading:
            "Fraunces-SemiBold"
        case .label:
            "Lexend-Medium"
        case .body, .ui, .caption:
            "Lexend-Regular"
        }
    }

    static func spec(for role: TextRole) -> TypeSpec {
        switch role {
        case .display: TypeScale.display
        case .heading: TypeScale.heading
        case .body: TypeScale.body
        case .ui: TypeScale.ui
        case .label: TypeScale.label
        case .caption: TypeScale.caption
        }
    }

    static func anchor(for role: TextRole) -> Font.TextStyle {
        switch role {
        case .display: .largeTitle
        case .heading: .title3
        case .body: .body
        case .ui, .label: .subheadline
        case .caption: .footnote
        }
    }

    public static func font(_ role: TextRole) -> Font {
        Fonts.register()
        let spec = spec(for: role)
        return .custom(
            fontName(for: role),
            size: spec.size,
            relativeTo: anchor(for: role)
        )
    }

    /// Emoji glyphs render in the system emoji font at the shared 24 pt cell
    /// size (pictographs, like Apple's own keyboard, do not scale with
    /// Dynamic Type — surrounding text still does).
    public static var emojiGlyph: Font {
        .system(size: Metrics.emojiGlyph)
    }

    static func extraLineSpacing(for role: TextRole) -> CGFloat {
        let spec = spec(for: role)
        return max(0, spec.size * (spec.lineHeight - 1.2))
    }
}

public struct TextStyleModifier: ViewModifier {
    let role: TextRole

    public func body(content: Content) -> some View {
        content
            .font(Typography.font(role))
            .lineSpacing(Typography.extraLineSpacing(for: role))
    }
}

/// Single-line text controls use the same scalable font ladder without text
/// leading, which UIKit otherwise interprets as clipped editable content.
public struct TextInputStyleModifier: ViewModifier {
    let role: TextRole

    public func body(content: Content) -> some View {
        content.font(Typography.font(role))
    }
}

extension View {
    public func textStyle(_ role: TextRole) -> some View {
        modifier(TextStyleModifier(role: role))
    }

    public func textInputStyle(_ role: TextRole) -> some View {
        modifier(TextInputStyleModifier(role: role))
    }
}
