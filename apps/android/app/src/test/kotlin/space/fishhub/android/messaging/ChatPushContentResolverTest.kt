package space.fishhub.android.messaging

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.UserRole

class ChatPushContentResolverTest {
    private val push = ChatPushMessage(
        conversationId = "conv-1",
        messageId = "msg-1",
        senderId = "sender-1",
        senderName = "Maria",
        unreadCount = 1,
    )

    private fun message(
        id: String,
        body: String,
        createdAt: String = "1970-01-01T00:00:02Z",
    ) = ChatMessage(
        id = id,
        conversationId = "conv-1",
        senderId = "sender-1",
        senderRole = UserRole.Coach,
        body = body,
        clientRequestId = "req-$id",
        createdAt = createdAt,
    )

    @Test
    fun `returns the fetched body and sent time for the pushed message`() = runBlocking {
        val resolved = ChatPushContentResolver.resolve(
            push,
            isSignedIn = { true },
            refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "Hi there"))) },
        )
        assertEquals(ChatNotificationMessage("Hi there", 2_000L), resolved)
    }

    @Test
    fun `keeps the text but drops the timestamp when createdAt is unparseable`() = runBlocking {
        val resolved = ChatPushContentResolver.resolve(
            push,
            isSignedIn = { true },
            refreshMessages = { _, _ ->
                ChatResult.Success(listOf(message("msg-1", "Hi", createdAt = "not-a-time")))
            },
        )
        assertEquals(ChatNotificationMessage("Hi", null), resolved)
    }

    @Test
    fun `falls back when signed out, failed, missing, or blank`() = runBlocking {
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { false },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "Hi"))) },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ ->
                    ChatResult.Failure("no", recoverable = true, category = FailureCategory.Network)
                },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-2", "Other"))) },
            ),
        )
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ -> ChatResult.Success(listOf(message("msg-1", "   "))) },
            ),
        )
    }

    @Test
    fun `ignores a fetched message from another conversation`() = runBlocking {
        assertNull(
            ChatPushContentResolver.resolve(
                push,
                isSignedIn = { true },
                refreshMessages = { _, _ ->
                    ChatResult.Success(listOf(message("msg-1", "Hi").copy(conversationId = "other")))
                },
            ),
        )
    }

    @Test
    fun `settled waits out the loading state`() = runBlocking {
        val states = MutableStateFlow<ChatAuthState>(ChatAuthState.Loading)
        launch {
            states.value = ChatAuthState.SignedOut
        }
        assertEquals(ChatAuthState.SignedOut, states.settled())
    }
}
