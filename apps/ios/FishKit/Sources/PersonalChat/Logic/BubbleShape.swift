import DesignSystem
import SwiftUI

/// Tightens only the corners that face same-sender neighbors.
public enum BubbleShape {
    public static func radii(
        direction: MessageDirection,
        position: MessageGroupPosition
    ) -> RectangleCornerRadii {
        let full = Radius.chat
        let inner = Radius.chatInner
        let (top, bottom): (CGFloat, CGFloat) = switch position {
        case .solo: (full, full)
        case .first: (full, inner)
        case .middle: (inner, inner)
        case .last: (inner, full)
        }
        return direction == .outgoing
            ? RectangleCornerRadii(
                topLeading: full,
                bottomLeading: full,
                bottomTrailing: bottom,
                topTrailing: top
            )
            : RectangleCornerRadii(
                topLeading: top,
                bottomLeading: bottom,
                bottomTrailing: full,
                topTrailing: full
            )
    }
}
