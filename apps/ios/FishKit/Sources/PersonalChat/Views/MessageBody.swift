import DesignSystem
import SwiftUI

public struct MessageBody: View {
    private let content: String
    private let isOutgoing: Bool

    public init(body: String, isOutgoing: Bool) {
        self.content = body
        self.isOutgoing = isOutgoing
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ForEach(Array(MessageMarkdownParser.parse(content).enumerated()), id: \.offset) { _, block in
                MarkdownBlockView(block: block, isOutgoing: isOutgoing)
            }
        }
        .textStyle(EmojiOnlyMessage.isEmojiOnly(content) ? .display : .body)
        .foregroundStyle(isOutgoing ? Palette.onMessageOutgoing : Palette.onMessageIncoming)
        .fixedSize(horizontal: false, vertical: true)
    }
}
