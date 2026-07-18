import DesignSystem
import SwiftUI

public struct StagedAttachmentStrip: View {
    private let items: [StagedAttachment]
    private let onRetry: (String) -> Void
    private let onRemove: (String) -> Void

    public init(
        items: [StagedAttachment],
        onRetry: @escaping (String) -> Void,
        onRemove: @escaping (String) -> Void
    ) {
        self.items = items
        self.onRetry = onRetry
        self.onRemove = onRemove
    }

    public var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: Spacing.xs) {
                ForEach(items) { item in
                    StagedAttachmentTile(
                        item: item,
                        onRetry: { onRetry(item.id) },
                        onRemove: { onRemove(item.id) }
                    )
                }
            }
            .padding(.vertical, Spacing.twoXs)
        }
        .scrollIndicators(.hidden)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Files to send")
    }
}
