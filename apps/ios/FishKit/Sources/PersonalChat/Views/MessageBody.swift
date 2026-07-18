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

private struct MarkdownBlockView: View {
    let block: MessageMarkdownBlock
    let isOutgoing: Bool

    @ViewBuilder var body: some View {
        switch block {
        case .code(let language, let content):
            ScrollView(.horizontal) {
                VStack(alignment: .leading, spacing: Spacing.twoXs) {
                    if let language {
                        Text(language.uppercased())
                            .textStyle(.caption)
                            .foregroundStyle(isOutgoing ? Palette.onMessageOutgoing.opacity(0.7) : Palette.muted)
                    }
                    Text(verbatim: content)
                        .textStyle(.ui)
                }
                .padding(Spacing.sm)
            }
            .background(
                isOutgoing ? Palette.onMessageOutgoing.opacity(0.1) : Palette.surface2,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
        case .heading(let level, let content):
            Text(attributed(content))
                .textStyle(level == 1 ? .heading : .label)
        case .blockquote(let lines):
            Text(attributed(lines))
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .overlay {
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .strokeBorder(
                            (isOutgoing ? Palette.onMessageOutgoing : Palette.onMessageIncoming).opacity(0.3),
                            lineWidth: 1
                        )
                }
        case .list(let list):
            MarkdownListView(list: list, isOutgoing: isOutgoing)
        case .paragraph(let lines):
            Text(attributed(lines))
        }
    }

    private func attributed(_ lines: [[MessageMarkdownInline]]) -> AttributedString {
        var result = AttributedString()
        for (index, line) in lines.enumerated() {
            if index > 0 { result.append(AttributedString("\n")) }
            result.append(attributed(line))
        }
        return result
    }

    private func attributed(_ content: [MessageMarkdownInline]) -> AttributedString {
        var result = AttributedString()
        for inline in content {
            let value: String
            switch inline {
            case .text(let text), .bold(let text), .italic(let text), .code(let text): value = text
            case .link(let label, _): value = label
            }
            var segment = AttributedString(value)
            switch inline {
            case .bold: segment.inlinePresentationIntent = .stronglyEmphasized
            case .italic: segment.inlinePresentationIntent = .emphasized
            case .code: segment.inlinePresentationIntent = .code
            case .link(_, let href):
                segment.link = URL(string: href)
                segment.underlineStyle = .single
            case .text: break
            }
            result.append(segment)
        }
        return result
    }
}

private struct MarkdownListView: View {
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
