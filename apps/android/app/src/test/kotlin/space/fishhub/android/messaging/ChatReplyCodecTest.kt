package space.fishhub.android.messaging

import org.junit.Assert.assertEquals
import org.junit.Test

class ChatReplyCodecTest {
    @Test
    fun `round trips replies with and without message id`() {
        val replies = listOf(
            PendingChatReply("id-1", "conv-1", "hello", "msg-1", attempts = 3),
            PendingChatReply("id-2", "conv-2", "there", null),
        )
        assertEquals(replies, ChatReplyCodec.decode(ChatReplyCodec.encode(replies)))
    }

    @Test
    fun `decodes legacy entries without a message id`() {
        val legacy = """[{"id":"id-1","conversationId":"conv-1","body":"hello"}]"""
        assertEquals(
            listOf(PendingChatReply("id-1", "conv-1", "hello", null)),
            ChatReplyCodec.decode(legacy),
        )
    }

    @Test
    fun `legacy entries decode with zero attempts`() {
        val legacy = """[{"id":"id-1","conversationId":"conv-1","body":"hello"}]"""
        assertEquals(0, ChatReplyCodec.decode(legacy).single().attempts)
    }

    @Test
    fun `skips entries missing required fields and tolerates garbage`() {
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode("not json"))
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode(null))
        val partial = """[{"id":"","conversationId":"conv","body":"x"},{"id":"a","conversationId":"conv","body":"  "}]"""
        assertEquals(emptyList<PendingChatReply>(), ChatReplyCodec.decode(partial))
    }

    @Test
    fun `treats explicit json nulls as absent`() {
        val nulls = """[{"id":null,"conversationId":"c","body":"x"},{"id":"a","conversationId":"c","body":"hi","messageId":null}]"""
        assertEquals(
            listOf(PendingChatReply("a", "c", "hi", null)),
            ChatReplyCodec.decode(nulls),
        )
    }

    @Test
    fun `keeps valid entries when others are invalid`() {
        val mixed = """[{"id":"","conversationId":"c","body":"x"},{"id":"ok","conversationId":"c","body":"hi"}]"""
        assertEquals(
            listOf(PendingChatReply("ok", "c", "hi", null)),
            ChatReplyCodec.decode(mixed),
        )
    }

    @Test
    fun `negative attempts decode as zero`() {
        val negative = """[{"id":"a","conversationId":"c","body":"hi","attempts":-3}]"""
        assertEquals(0, ChatReplyCodec.decode(negative).single().attempts)
    }
}
