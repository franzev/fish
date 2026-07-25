import DesignSystem
import SwiftUI

public struct StagedAttachmentStrip: View {
    private let attachments: [StagedAttachment]
    private let onRemove: (String) -> Void
    private let onRetry: (String) -> Void

    public init(
        attachments: [StagedAttachment],
        onRemove: @escaping (String) -> Void,
        onRetry: @escaping (String) -> Void
    ) {
        self.attachments = attachments
        self.onRemove = onRemove
        self.onRetry = onRetry
    }

    public var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: Spacing.xs) {
                ForEach(attachments) { item in
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
