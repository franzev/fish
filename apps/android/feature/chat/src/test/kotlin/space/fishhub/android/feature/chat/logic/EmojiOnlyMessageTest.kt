package space.fishhub.android.feature.chat.logic

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors the required cases from `message-body-parser.test.ts:26-29`, then
 * layers on the edge cases already proven out by iOS's
 * `EmojiOnlyMessageTests` (`ChatMediaLogicTests.swift`): a bare pictograph, a
 * skin-tone modifier without a ZWJ continuation, a four-person ZWJ chain, a
 * second flag pair, a keycap sequence, and the standalone punctuation a
 * keycap base can be mistaken for.
 */
class EmojiOnlyMessageTest {

    // Ported from message-body-parser.test.ts:26-29.

    @Test
    fun `recognizes emoji-only messages without treating ordinary digits as emoji`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly(" 👩🏽‍💻 "))
        assertTrue(EmojiOnlyMessage.isEmojiOnly("🇵🇭"))
        assertFalse(EmojiOnlyMessage.isEmojiOnly("1"))
        assertFalse(EmojiOnlyMessage.isEmojiOnly("😀 😀"))
    }

    @Test
    fun `blank and mixed-content bodies are not emoji-only`() {
        assertFalse(EmojiOnlyMessage.isEmojiOnly(""))
        assertFalse(EmojiOnlyMessage.isEmojiOnly("   "))
        assertFalse(EmojiOnlyMessage.isEmojiOnly("😀 hi"))
    }

    // Explicit coverage beyond the mirrored suite (also proven out by iOS's
    // EmojiOnlyMessageTests, which this Kotlin port aligns with in intent).

    @Test
    fun `a single pictograph with no modifier or ZWJ is emoji-only`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly("😀"))
        assertTrue(EmojiOnlyMessage.isEmojiOnly(" ❤️ "))
    }

    @Test
    fun `a skin-tone modifier without a ZWJ continuation is emoji-only`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly("👍🏽"))
    }

    @Test
    fun `a lone skin-tone modifier with no base glyph is not emoji-only`() {
        assertFalse(EmojiOnlyMessage.isEmojiOnly("🏽"))
    }

    @Test
    fun `a four-person ZWJ family chain is one emoji-only cluster`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly("👨‍👩‍👧‍👦"))
    }

    @Test
    fun `a keycap sequence is emoji-only but its base character alone is not`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly("3️⃣"))
        assertFalse(EmojiOnlyMessage.isEmojiOnly("*"))
    }

    @Test
    fun `a second flag pair confirms regional indicators are not special-cased to one country`() {
        assertTrue(EmojiOnlyMessage.isEmojiOnly("🇯🇵"))
    }

    @Test
    fun `two concatenated flag pairs are not a single flag`() {
        assertFalse(EmojiOnlyMessage.isEmojiOnly("🇵🇭🇵🇭"))
    }
}
