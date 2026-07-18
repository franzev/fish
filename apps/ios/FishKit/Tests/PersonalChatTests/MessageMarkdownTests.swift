import Testing
@testable import PersonalChat

struct MessageMarkdownTests {
    @Test func parsesTheMirroredBlockGrammar() {
        let blocks = MessageMarkdownParser.parse(
            "# Heading\n\n> Keep going\n\n- First\n  - Detail\n\n1. One\n2. Two\n\n```ts\nlet value = 1\n```"
        )
        #expect(blocks.count == 5)
        #expect(blocks[0] == .heading(level: 1, content: [.text("Heading")]))
        #expect(blocks[1] == .blockquote(lines: [[.text("Keep going")]]))
        guard case .list(let bullets) = blocks[2] else {
            Issue.record("Expected bullet list")
            return
        }
        #expect(!bullets.ordered)
        #expect(bullets.items.first?.children?.items.first?.content == [.text("Detail")])
        guard case .list(let numbers) = blocks[3] else {
            Issue.record("Expected numbered list")
            return
        }
        #expect(numbers.ordered)
        #expect(blocks[4] == .code(language: "ts", content: "let value = 1"))

        let numberedBlocks = MessageMarkdownParser.parse("1. One\n2. Two")
        guard case .list(let standaloneNumbers) = numberedBlocks[0] else {
            Issue.record("Expected numbered list")
            return
        }
        #expect(standaloneNumbers.ordered)
    }

    @Test func parsesInlineEmphasisCodeAndSafeLinks() {
        let blocks = MessageMarkdownParser.parse(
            "A **bold** *star* _line_ `code` [guide](https://example.com) [mail](mailto:help@example.com)."
        )
        guard case .paragraph(let lines) = blocks.first else {
            Issue.record("Expected paragraph")
            return
        }
        #expect(lines[0].contains(.bold("bold")))
        #expect(lines[0].contains(.italic("star")))
        #expect(lines[0].contains(.italic("line")))
        #expect(lines[0].contains(.code("code")))
        #expect(lines[0].contains(.link(label: "guide", href: "https://example.com")))
        #expect(lines[0].contains(.link(label: "mail", href: "mailto:help@example.com")))
    }

    @Test func neutralizesExecutableOrMalformedDestinations() {
        for href in ["javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "example.com"] {
            #expect(MessageMarkdownParser.sanitizedHref(href) == nil)
        }
        #expect(MessageMarkdownParser.sanitizedHref(" HTTPS://example.com ") == "HTTPS://example.com")

        let blocks = MessageMarkdownParser.parse("Click [here](javascript:alert(1)) now.")
        guard case .paragraph(let lines) = blocks.first else { return }
        #expect(lines[0].contains(.text("here")))
        #expect(!lines[0].contains { inline in
            if case .link = inline { return true }
            return false
        })
    }

    @Test func emptyWhitespaceAndLineBreaksStayCalm() {
        #expect(MessageMarkdownParser.parse("").isEmpty)
        #expect(MessageMarkdownParser.parse("  \n ").isEmpty)
        let blocks = MessageMarkdownParser.parse("First\nSecond\n\nThird")
        #expect(blocks.count == 2)
        guard case .paragraph(let first) = blocks[0] else { return }
        #expect(first.count == 2)
    }

    @Test func adjacentListKindsRemainDistinctBlocks() {
        let blocks = MessageMarkdownParser.parse("- One\n- Two\n\n1. Breathe\n2. Begin")
        #expect(blocks.count == 2)
        guard case .list(let bullets) = blocks[0],
              case .list(let numbers) = blocks[1] else {
            Issue.record("Expected two list blocks")
            return
        }
        #expect(!bullets.ordered)
        #expect(numbers.ordered)
    }
}
