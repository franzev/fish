import Foundation

public enum MessageMarkdownInline: Sendable, Equatable {
    case text(String)
    case bold(String)
    case italic(String)
    case code(String)
    case link(label: String, href: String)
}

public struct MessageMarkdownListItem: Sendable, Equatable {
    public let content: [MessageMarkdownInline]
    public let children: MessageMarkdownList?

    public init(content: [MessageMarkdownInline], children: MessageMarkdownList? = nil) {
        self.content = content
        self.children = children
    }
}

public struct MessageMarkdownList: Sendable, Equatable {
    public let ordered: Bool
    public let items: [MessageMarkdownListItem]

    public init(ordered: Bool, items: [MessageMarkdownListItem]) {
        self.ordered = ordered
        self.items = items
    }
}

public enum MessageMarkdownBlock: Sendable, Equatable {
    case code(language: String?, content: String)
    case heading(level: Int, content: [MessageMarkdownInline])
    case blockquote(lines: [[MessageMarkdownInline]])
    case list(MessageMarkdownList)
    case paragraph(lines: [[MessageMarkdownInline]])
}

/// Deliberately small chat-markdown grammar ported from web. It never accepts
/// HTML and only marks http, https, and mailto destinations as links.
public enum MessageMarkdownParser {
    public static func parse(_ body: String) -> [MessageMarkdownBlock] {
        let lines = body.replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n")
        var blocks: [MessageMarkdownBlock] = []
        var index = 0

        while index < lines.count {
            let line = lines[index]
            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                index += 1
                continue
            }

            if let language = fenceLanguage(line) {
                var code: [String] = []
                index += 1
                while index < lines.count, !isFenceClose(lines[index]) {
                    code.append(lines[index])
                    index += 1
                }
                if index < lines.count { index += 1 }
                blocks.append(.code(language: language.isEmpty ? nil : language, content: code.joined(separator: "\n")))
                continue
            }

            if let heading = heading(line) {
                blocks.append(.heading(level: heading.level, content: parseInline(heading.text)))
                index += 1
                continue
            }

            if quoteText(line) != nil {
                var quote: [[MessageMarkdownInline]] = []
                while index < lines.count, let text = quoteText(lines[index]) {
                    quote.append(parseInline(text))
                    index += 1
                }
                blocks.append(.blockquote(lines: quote))
                continue
            }

            if listItem(line) != nil {
                let parsed = parseList(lines, start: index, indent: 0)
                blocks.append(.list(parsed.list))
                index = parsed.nextIndex
                continue
            }

            var paragraph: [[MessageMarkdownInline]] = []
            while index < lines.count {
                let candidate = lines[index]
                if candidate.trimmingCharacters(in: .whitespaces).isEmpty || isBlockStart(candidate) {
                    break
                }
                paragraph.append(parseInline(candidate))
                index += 1
            }
            blocks.append(.paragraph(lines: paragraph))
        }
        return blocks
    }

    public static func sanitizedHref(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let separator = trimmed.firstIndex(of: ":") else { return nil }
        switch trimmed[..<separator].lowercased() {
        case "http", "https", "mailto": return trimmed
        default: return nil
        }
    }

    private static func parseList(
        _ lines: [String],
        start: Int,
        indent: Int
    ) -> (list: MessageMarkdownList, nextIndex: Int) {
        let ordered = listItem(lines[start]).map { $0.marker.last == "." } ?? false
        var items: [MessageMarkdownListItem] = []
        var index = start
        while index < lines.count {
            if lines[index].trimmingCharacters(in: .whitespaces).isEmpty {
                index += 1
                continue
            }
            guard let item = listItem(lines[index]) else { break }
            if item.indent < indent { break }
            if item.indent > indent {
                guard !items.isEmpty else { break }
                let nested = parseList(lines, start: index, indent: item.indent)
                let previous = items.removeLast()
                items.append(MessageMarkdownListItem(
                    content: previous.content,
                    children: nested.list
                ))
                index = nested.nextIndex
                continue
            }
            guard (item.marker.last == ".") == ordered else { break }
            items.append(MessageMarkdownListItem(content: parseInline(item.text)))
            index += 1
        }
        return (MessageMarkdownList(ordered: ordered, items: items), index)
    }

    private static func parseInline(_ text: String) -> [MessageMarkdownInline] {
        let pattern = #"`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return [.text(text)]
        }
        let fullRange = NSRange(text.startIndex..<text.endIndex, in: text)
        var result: [MessageMarkdownInline] = []
        var cursor = text.startIndex
        for match in regex.matches(in: text, range: fullRange) {
            guard let range = Range(match.range, in: text) else { continue }
            if cursor < range.lowerBound { result.append(.text(String(text[cursor..<range.lowerBound]))) }
            if let value = capture(1, from: match, in: text) {
                result.append(.code(value))
            } else if let value = capture(2, from: match, in: text) {
                result.append(.bold(value))
            } else if let value = capture(3, from: match, in: text) ?? capture(4, from: match, in: text) {
                result.append(.italic(value))
            } else if let label = capture(5, from: match, in: text),
                      let href = capture(6, from: match, in: text) {
                if let safe = sanitizedHref(href) {
                    result.append(.link(label: label, href: safe))
                } else {
                    result.append(.text(label))
                }
            }
            cursor = range.upperBound
        }
        if cursor < text.endIndex { result.append(.text(String(text[cursor...]))) }
        return result
    }

    private static func capture(
        _ group: Int,
        from match: NSTextCheckingResult,
        in text: String
    ) -> String? {
        guard match.range(at: group).location != NSNotFound,
              let range = Range(match.range(at: group), in: text) else { return nil }
        return String(text[range])
    }

    private static func fenceLanguage(_ line: String) -> String? {
        guard let match = firstMatch(#"^```\s*(\S*)\s*$"#, in: line) else { return nil }
        return capture(1, from: match, in: line) ?? ""
    }

    private static func isFenceClose(_ line: String) -> Bool {
        firstMatch(#"^```\s*$"#, in: line) != nil
    }

    private static func heading(_ line: String) -> (level: Int, text: String)? {
        guard let match = firstMatch(#"^(#{1,3})\s+(.*)$"#, in: line),
              let hashes = capture(1, from: match, in: line),
              let content = capture(2, from: match, in: line) else { return nil }
        return (hashes.count, content.trimmingCharacters(in: .whitespaces))
    }

    private static func quoteText(_ line: String) -> String? {
        guard let match = firstMatch(#"^>\s?(.*)$"#, in: line) else { return nil }
        return capture(1, from: match, in: line) ?? ""
    }

    private static func listItem(_ line: String) -> (indent: Int, marker: String, text: String)? {
        guard let match = firstMatch(#"^(\s*)([-*]|\d+\.)\s+(.*)$"#, in: line),
              let spacing = capture(1, from: match, in: line),
              let marker = capture(2, from: match, in: line),
              let content = capture(3, from: match, in: line) else { return nil }
        return (spacing.count, marker, content)
    }

    private static func isBlockStart(_ line: String) -> Bool {
        fenceLanguage(line) != nil || heading(line) != nil || quoteText(line) != nil || listItem(line) != nil
    }

    private static func firstMatch(_ pattern: String, in text: String) -> NSTextCheckingResult? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        return regex.firstMatch(
            in: text,
            range: NSRange(text.startIndex..<text.endIndex, in: text)
        )
    }
}
