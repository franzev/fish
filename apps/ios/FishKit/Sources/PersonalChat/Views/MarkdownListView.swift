import DesignSystem
import SwiftUI

struct MarkdownListView: View {
    let list: MessageMarkdownList
    let isOutgoing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ForEach(Array(list.items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                    Text(list.ordered ? "\(index + 1)." : "•")
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        MarkdownBlockView(
                            block: .paragraph(lines: [item.content]),
                            isOutgoing: isOutgoing
                        )
                        if let children = item.children {
                            MarkdownListView(list: children, isOutgoing: isOutgoing)
                                .padding(.leading, Spacing.md)
                        }
                    }
                }
            }
        }
        .padding(.leading, Spacing.md)
    }
}
