package space.fishhub.android.messaging

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.calling.CallNotificationFactory

class ChatNotificationIdsTest {
    private val samples = (0 until 500).map { "conversation-$it" }

    @Test
    fun `message ids are stable and stay inside their own range`() {
        samples.forEach { conversationId ->
            val id = ChatNotificationFactory.notificationId(conversationId)
            assertEquals(id, ChatNotificationFactory.notificationId(conversationId))
            assertTrue(id in 100_000 until 1_100_000)
        }
    }

    @Test
    fun `failure ids stay inside their own range`() {
        samples.forEach { conversationId ->
            val id = ChatNotificationFactory.replyFailureNotificationId(conversationId)
            assertTrue(id in 2_000_000 until 3_000_000)
        }
    }

    @Test
    fun `ranges avoid the call notification buckets`() {
        // Calls occupy 6_100 until 6_900 (CallNotificationFactory); the legacy
        // chat scheme occupied 7_100 until 7_900. Both new ranges start above.
        assertTrue(ChatNotificationFactory.notificationId("any") >= 100_000)
        assertTrue(ChatNotificationFactory.replyFailureNotificationId("any") >= 2_000_000)
    }

    @Test
    fun `distinct conversations rarely share a message id`() {
        // 500 fixed samples over 1M buckets: tolerate the deterministic
        // birthday collisions, still fail loudly on any 800-bucket regression.
        val distinct = samples.map(ChatNotificationFactory::notificationId).distinct().size
        assertTrue(distinct >= samples.size - 2)
    }

    @Test
    fun `message, failure, and call ids never collide for the same conversation`() {
        samples.forEach { conversationId ->
            val message = ChatNotificationFactory.notificationId(conversationId)
            val failure = ChatNotificationFactory.replyFailureNotificationId(conversationId)
            val call = CallNotificationFactory.notificationId(conversationId)
            assertTrue(message != failure)
            assertTrue(message != call)
            assertTrue(failure != call)
        }
    }
}
