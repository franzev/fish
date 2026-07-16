import SwiftUI
import UIKit

/// Semantic names over the bundled Tabler outline set. Feature code never
/// references asset filenames directly.
public enum Icon: String, CaseIterable, Sendable {
    case back = "arrow-left"
    case send
    case retry = "rotate"
    case close = "x"
    case person = "user"
    case lock
    case info = "info-circle"
    case warning = "alert-triangle"
    case alert = "alert-circle"
    case check
    case checkDouble = "checks"

    public var isDirectional: Bool {
        self == .back
    }

    @MainActor public var image: some View {
        Image(rawValue, bundle: .module)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .flipsForRightToLeftLayoutDirection(isDirectional)
            .accessibilityHidden(true)
    }

    @MainActor var uiImage: UIImage? {
        UIImage(named: rawValue, in: .module, with: nil)
    }
}

extension View {
    public func glyphFrame() -> some View {
        frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
    }
}
