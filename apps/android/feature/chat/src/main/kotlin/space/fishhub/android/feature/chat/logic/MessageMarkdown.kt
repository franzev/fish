package space.fishhub.android.feature.chat.logic

sealed interface MessageMarkdownInline {
    data class Text(val text: String) : MessageMarkdownInline
    data class Bold(val text: String) : MessageMarkdownInline
    data class Italic(val text: String) : MessageMarkdownInline
    data class Code(val text: String) : MessageMarkdownInline
    data class Link(val label: String, val href: String) : MessageMarkdownInline
}

data class MessageMarkdownListItem(
    val content: List<MessageMarkdownInline>,
    val children: MessageMarkdownList? = null,
)

data class MessageMarkdownList(val ordered: Boolean, val items: List<MessageMarkdownListItem>)

sealed interface MessageMarkdownBlock {
    data class Code(val language: String?, val content: String) : MessageMarkdownBlock
    data class Heading(val level: Int, val content: List<MessageMarkdownInline>) : MessageMarkdownBlock
    data class Blockquote(val lines: List<List<MessageMarkdownInline>>) : MessageMarkdownBlock
    data class Bullets(val list: MessageMarkdownList) : MessageMarkdownBlock
    data class Paragraph(val lines: List<List<MessageMarkdownInline>>) : MessageMarkdownBlock
}

/**
 * Deliberately small chat-markdown grammar ported from web
 * (`message-body-parser.ts`) and iOS (`MessageMarkdown.swift`) so all three
 * clients render the same subset. It never accepts HTML and only marks http,
 * https, and mailto destinations as links.
 */
object MessageMarkdownParser {

    private val FenceOpenRe = Regex("""^```\s*(\S*)\s*$""")
    private val FenceCloseRe = Regex("""^```\s*$""")
    private val HeadingRe = Regex("""^(#{1,3})\s+(.*)$""")
    private val BlockquoteRe = Regex("""^>\s?(.*)$""")
    private val ListItemRe = Regex("""^(\s*)([-*]|\d+\.)\s+(.*)$""")
    private val InlineRe = Regex(
        """`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)""",
    )

    fun parse(body: String): List<MessageMarkdownBlock> {
        val lines = body.replace("\r\n", "\n").split("\n")
        val blocks = mutableListOf<MessageMarkdownBlock>()
        var index = 0

        while (index < lines.size) {
            val line = lines[index]
            if (line.trim().isEmpty()) {
                index += 1
                continue
            }

            val language = fenceLanguage(line)
            if (language != null) {
                val code = mutableListOf<String>()
                index += 1
                while (index < lines.size && !isFenceClose(lines[index])) {
                    code.add(lines[index])
                    index += 1
                }
                if (index < lines.size) index += 1
                blocks.add(
                    MessageMarkdownBlock.Code(
                        language = if (language.isEmpty()) null else language,
                        content = code.joinToString("\n"),
                    ),
                )
                continue
            }

            val headingMatch = heading(line)
            if (headingMatch != null) {
                blocks.add(MessageMarkdownBlock.Heading(headingMatch.level, parseInline(headingMatch.text)))
                index += 1
                continue
            }

            if (quoteText(line) != null) {
                val quote = mutableListOf<List<MessageMarkdownInline>>()
                while (index < lines.size) {
                    val text = quoteText(lines[index]) ?: break
                    quote.add(parseInline(text))
                    index += 1
                }
                blocks.add(MessageMarkdownBlock.Blockquote(quote))
                continue
            }

            if (listItem(line) != null) {
                val parsed = parseList(lines, index, 0)
                blocks.add(MessageMarkdownBlock.Bullets(parsed.list))
                index = parsed.nextIndex
                continue
            }

            val paragraph = mutableListOf<List<MessageMarkdownInline>>()
            while (index < lines.size) {
                val candidate = lines[index]
                if (candidate.trim().isEmpty() || isBlockStart(candidate)) break
                paragraph.add(parseInline(candidate))
                index += 1
            }
            blocks.add(MessageMarkdownBlock.Paragraph(paragraph))
        }
        return blocks
    }

    fun sanitizedHref(value: String): String? {
        val trimmed = value.trim()
        val scheme = trimmed.substringBefore(':', missingDelimiterValue = "")
        return when (scheme.lowercase()) {
            "http", "https", "mailto" -> trimmed
            else -> null
        }
    }

    /** Flattens the parsed tree to plain text, for an accessibility string. */
    fun plainText(body: String): String = parse(body).joinToString("\n\n") { blockPlainText(it) }

    private fun blockPlainText(block: MessageMarkdownBlock): String = when (block) {
        is MessageMarkdownBlock.Code -> block.content
        is MessageMarkdownBlock.Heading -> inlinePlainText(block.content)
        is MessageMarkdownBlock.Blockquote -> block.lines.joinToString("\n") { inlinePlainText(it) }
        is MessageMarkdownBlock.Bullets -> listPlainText(block.list)
        is MessageMarkdownBlock.Paragraph -> block.lines.joinToString("\n") { inlinePlainText(it) }
    }

    private fun listPlainText(list: MessageMarkdownList): String =
        list.items.joinToString("\n") { item ->
            val own = inlinePlainText(item.content)
            val children = item.children?.let(::listPlainText)
            if (children.isNullOrEmpty()) own else "$own\n$children"
        }

    private fun inlinePlainText(inlines: List<MessageMarkdownInline>): String =
        inlines.joinToString("") { inline ->
            when (inline) {
                is MessageMarkdownInline.Text -> inline.text
                is MessageMarkdownInline.Bold -> inline.text
                is MessageMarkdownInline.Italic -> inline.text
                is MessageMarkdownInline.Code -> inline.text
                is MessageMarkdownInline.Link -> inline.label
            }
        }

    private data class ListParseResult(val list: MessageMarkdownList, val nextIndex: Int)

    private fun parseList(lines: List<String>, start: Int, indent: Int): ListParseResult {
        val ordered = listItem(lines[start])?.marker?.endsWith(".") ?: false
        val items = mutableListOf<MessageMarkdownListItem>()
        var index = start
        while (index < lines.size) {
            if (lines[index].trim().isEmpty()) {
                index += 1
                continue
            }
            val item = listItem(lines[index]) ?: break
            if (item.indent < indent) break
            if (item.indent > indent) {
                if (items.isEmpty()) break
                val nested = parseList(lines, index, item.indent)
                val previous = items.removeAt(items.size - 1)
                items.add(previous.copy(children = nested.list))
                index = nested.nextIndex
                continue
            }
            if (item.marker.endsWith(".") != ordered) break
            items.add(MessageMarkdownListItem(content = parseInline(item.text)))
            index += 1
        }
        return ListParseResult(MessageMarkdownList(ordered, items), index)
    }

    private fun parseInline(text: String): List<MessageMarkdownInline> {
        val result = mutableListOf<MessageMarkdownInline>()
        var cursor = 0
        for (match in InlineRe.findAll(text)) {
            val range = match.range
            if (cursor < range.first) {
                result.add(MessageMarkdownInline.Text(text.substring(cursor, range.first)))
            }
            val code = capture(match, 1)
            val bold = capture(match, 2)
            val italic = capture(match, 3) ?: capture(match, 4)
            val label = capture(match, 5)
            val href = capture(match, 6)
            when {
                code != null -> result.add(MessageMarkdownInline.Code(code))
                bold != null -> result.add(MessageMarkdownInline.Bold(bold))
                italic != null -> result.add(MessageMarkdownInline.Italic(italic))
                label != null && href != null -> {
                    val safe = sanitizedHref(href)
                    result.add(
                        if (safe != null) {
                            MessageMarkdownInline.Link(label, safe)
                        } else {
                            MessageMarkdownInline.Text(label)
                        },
                    )
                }
            }
            cursor = range.last + 1
        }
        if (cursor < text.length) {
            result.add(MessageMarkdownInline.Text(text.substring(cursor)))
        }
        return result
    }

    private fun capture(match: MatchResult, group: Int): String? = match.groups[group]?.value

    private fun fenceLanguage(line: String): String? = FenceOpenRe.find(line)?.groupValues?.get(1)

    private fun isFenceClose(line: String): Boolean = FenceCloseRe.matches(line)

    private data class HeadingMatch(val level: Int, val text: String)

    private fun heading(line: String): HeadingMatch? {
        val match = HeadingRe.find(line) ?: return null
        return HeadingMatch(match.groupValues[1].length, match.groupValues[2].trim())
    }

    private fun quoteText(line: String): String? = BlockquoteRe.find(line)?.groupValues?.get(1)

    private data class ListItemMatch(val indent: Int, val marker: String, val text: String)

    private fun listItem(line: String): ListItemMatch? {
        val match = ListItemRe.find(line) ?: return null
        return ListItemMatch(match.groupValues[1].length, match.groupValues[2], match.groupValues[3])
    }

    private fun isBlockStart(line: String): Boolean =
        fenceLanguage(line) != null || heading(line) != null || quoteText(line) != null || listItem(line) != null
}
