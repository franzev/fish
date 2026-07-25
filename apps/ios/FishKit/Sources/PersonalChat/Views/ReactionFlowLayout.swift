import DesignSystem
import SwiftUI

struct ReactionFlowLayout: Layout {
    enum Alignment {
        case leading
        case trailing
    }

    let spacing: CGFloat
    let alignment: Alignment
    let layoutDirection: LayoutDirection

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let layout = makeLayout(proposal: proposal, subviews: subviews)
        return CGSize(width: layout.width, height: layout.height)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let layout = makeLayout(
            proposal: ProposedViewSize(width: bounds.width, height: proposal.height),
            subviews: subviews
        )
        var y = bounds.minY
        for row in layout.rows {
            let leading = physicalLeading(for: row.width, containerWidth: bounds.width)
            var consumed: CGFloat = 0
            for item in row.items {
                let x: CGFloat
                if layoutDirection == .leftToRight {
                    x = bounds.minX + leading + consumed
                } else {
                    x = bounds.minX + leading + row.width - consumed - item.size.width
                }
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(item.size)
                )
                consumed += item.size.width + spacing
            }
            y += row.height + spacing
        }
    }

    func makeLayout(proposal: ProposedViewSize, subviews: Subviews) -> FlowLayout {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let intrinsicWidth = sizes.reduce(0) { $0 + $1.width }
            + spacing * CGFloat(max(0, sizes.count - 1))
        let availableWidth = max(0, proposal.width ?? intrinsicWidth)
        var rows: [FlowRow] = []
        var items: [FlowItem] = []
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0

        for (index, size) in sizes.enumerated() {
            let nextWidth = items.isEmpty ? size.width : rowWidth + spacing + size.width
            if !items.isEmpty, nextWidth > availableWidth {
                rows.append(FlowRow(items: items, width: rowWidth, height: rowHeight))
                items = []
                rowWidth = 0
                rowHeight = 0
            }
            items.append(FlowItem(index: index, size: size))
            rowWidth = items.count == 1 ? size.width : rowWidth + spacing + size.width
            rowHeight = max(rowHeight, size.height)
        }
        if !items.isEmpty {
            rows.append(FlowRow(items: items, width: rowWidth, height: rowHeight))
        }
        let height = rows.reduce(0) { $0 + $1.height }
            + spacing * CGFloat(max(0, rows.count - 1))
        return FlowLayout(width: availableWidth, height: height, rows: rows)
    }

    private func physicalLeading(for rowWidth: CGFloat, containerWidth: CGFloat) -> CGFloat {
        let logicalLeading = alignment == .leading
        let startsAtLeft = layoutDirection == .leftToRight ? logicalLeading : !logicalLeading
        return startsAtLeft ? 0 : max(0, containerWidth - rowWidth)
    }
}

struct FlowLayout {
    let width: CGFloat
    let height: CGFloat
    let rows: [FlowRow]
}

struct FlowRow {
    let items: [FlowItem]
    let width: CGFloat
    let height: CGFloat
}

struct FlowItem {
    let index: Int
    let size: CGSize
}
