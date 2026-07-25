import ChatCore
import DesignSystem
import SwiftUI
import UIKit
import UIComponents

enum SharedContentViewportCoordinateSpace {
    static let name = "shared-content-gallery-viewport"
}

struct SharedContentItemFramesKey: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

extension View {
    func sharedContentViewportItem(_ itemID: String) -> some View {
        background {
            GeometryReader { geometry in
                Color.clear.preference(
                    key: SharedContentItemFramesKey.self,
                    value: [
                        itemID: geometry.frame(
                            in: .named(SharedContentViewportCoordinateSpace.name)
                        ),
                    ]
                )
            }
        }
        .id(itemID)
    }
}
