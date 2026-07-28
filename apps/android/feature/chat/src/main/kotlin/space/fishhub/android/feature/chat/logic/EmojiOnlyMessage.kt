package space.fishhub.android.feature.chat.logic

/**
 * A standalone emoji gets the same visual emphasis it carries in
 * conversation: web and iOS render it at display size, and this decides
 * which bodies qualify. Port of web's rule (`EMOJI_ONLY_RE` in
 * `message-body-parser.ts`) and iOS's (`EmojiOnlyMessage.swift`): the body,
 * once trimmed, is exactly one emoji cluster — a flag pair, a keycap, or a
 * pictograph with optional presentation/skin-tone/ZWJ additions. Deliberately
 * stricter than "is emoji": a bare digit, `#`, or `*` carries the Unicode
 * Emoji property but stays ordinary text unless it is followed by the
 * combining keycap mark.
 *
 * This is a hand-rolled code-point classifier, not a regex port. A probe
 * against this project's JDK 21 toolchain (the JBR bundled with Android
 * Studio) found `Pattern.compile` accepts `\p{IsExtended_Pictographic}`,
 * `\p{IsEmoji_Modifier}`, and `\p{IsEmoji}`, but rejects `\p{Regional_Indicator}`
 * in every spelling tried, including `\p{IsRegional_Indicator}`, with "Unknown
 * character property name". Web's regex needs `Regional_Indicator` for flag
 * pairs, so it cannot be ported verbatim. Rather than build a hybrid that
 * leans on the properties that happen to compile on the desktop unit-test
 * JVM — with no way in this environment to confirm they also compile in
 * Android's own regex engine at runtime, and a `PatternSyntaxException` there
 * would crash the app rather than just mis-measure text size — this avoids
 * `\p{Is...}` Unicode properties entirely. "Pictographic" is approximated
 * with the Unicode block ranges that hold the overwhelming majority of
 * real-world emoji, rather than the complete Extended_Pictographic property
 * (several thousand code points, including many that are not pictographs).
 * The approximation is lossy in both directions: a rare pictograph outside
 * these ranges renders at body size instead of display size, and a few
 * non-pictographic symbols inside them (dingbats, arrows, chess and zodiac
 * glyphs) get treated as pictographic when they are not. Either way is a
 * minor cosmetic miss, not a bug.
 */
object EmojiOnlyMessage {

    private const val ZeroWidthJoiner = 0x200D
    private const val VariationSelector15 = 0xFE0E
    private const val VariationSelector16 = 0xFE0F
    private const val CombiningEnclosingKeycap = 0x20E3

    fun isEmojiOnly(body: String): Boolean {
        val trimmed = body.trim()
        if (trimmed.isEmpty()) return false
        val codePoints = trimmed.codePoints().toArray()

        return isRegionalIndicatorPair(codePoints) ||
            isKeycapSequence(codePoints) ||
            isPictographicCluster(codePoints)
    }

    /** A flag emoji: exactly two regional-indicator letters, nothing else. */
    private fun isRegionalIndicatorPair(codePoints: IntArray): Boolean =
        codePoints.size == 2 && codePoints.all(::isRegionalIndicator)

    /** `#`, `*`, or a digit, with an optional presentation selector, then the combining keycap mark. */
    private fun isKeycapSequence(codePoints: IntArray): Boolean {
        val last = codePoints.size - 1
        if (last < 1 || codePoints[last] != CombiningEnclosingKeycap) return false
        if (!isKeycapBase(codePoints[0])) return false
        return when (last) {
            1 -> true // base, keycap
            2 -> codePoints[1] == VariationSelector16 // base, VS16, keycap
            else -> false
        }
    }

    /** One pictograph, or several joined by ZWJ, each with optional presentation/skin-tone additions. */
    private fun isPictographicCluster(codePoints: IntArray): Boolean {
        var index = consumeGlyph(codePoints, 0)
        if (index < 0) return false
        while (index < codePoints.size) {
            if (codePoints[index] != ZeroWidthJoiner) return false
            index = consumeGlyph(codePoints, index + 1)
            if (index < 0) return false
        }
        return true
    }

    /**
     * Consumes one pictograph plus its optional presentation selector and
     * skin-tone modifier, starting at [start]. Returns the index just past
     * it, or -1 if [start] is not a pictograph.
     */
    private fun consumeGlyph(codePoints: IntArray, start: Int): Int {
        if (start >= codePoints.size || !isExtendedPictographic(codePoints[start])) return -1
        var index = start + 1
        if (index < codePoints.size && isVariationSelector(codePoints[index])) index += 1
        if (index < codePoints.size && isEmojiModifier(codePoints[index])) index += 1
        return index
    }

    private fun isVariationSelector(codePoint: Int): Boolean =
        codePoint == VariationSelector15 || codePoint == VariationSelector16

    private fun isRegionalIndicator(codePoint: Int): Boolean =
        codePoint in 0x1F1E6..0x1F1FF

    /** Fitzpatrick skin-tone modifiers. */
    private fun isEmojiModifier(codePoint: Int): Boolean =
        codePoint in 0x1F3FB..0x1F3FF

    private fun isKeycapBase(codePoint: Int): Boolean =
        codePoint == '#'.code || codePoint == '*'.code || codePoint in '0'.code..'9'.code

    /**
     * Approximates Extended_Pictographic with the Unicode blocks that hold
     * almost every emoji actually sent in chat: Miscellaneous Symbols and
     * Dingbats, Miscellaneous Symbols and Arrows, and the contiguous run of
     * blocks from Miscellaneous Symbols and Pictographs through Symbols and
     * Pictographs Extended-A — minus the Emoji_Modifier sub-range
     * [isEmojiModifier] already owns, since a lone skin-tone swatch is not
     * itself a pictograph in the real property.
     */
    private fun isExtendedPictographic(codePoint: Int): Boolean =
        codePoint in 0x2600..0x27BF ||
            codePoint in 0x2B00..0x2BFF ||
            (codePoint in 0x1F300..0x1FAFF && !isEmojiModifier(codePoint))
}
