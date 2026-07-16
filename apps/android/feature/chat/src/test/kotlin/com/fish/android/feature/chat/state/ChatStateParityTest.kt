package com.fish.android.feature.chat.state

import com.fish.android.data.chat.model.ChatMessage
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class ChatStateParityTest {
    private val json = Json {
        ignoreUnknownKeys = true
        classDiscriminator = "type"
    }

    @Test
    fun `replays every shared chat-state vector`() {
        val resource = checkNotNull(javaClass.classLoader?.getResource("chat-state-vectors.json"))
        val vectors = json.decodeFromString<List<ChatStateVector>>(resource.readText())

        assertEquals("The shared contract case count changed", 24, vectors.size)
        vectors.forEach { vector ->
            val actual = applyChatEvents(vector.initialState, vector.events)
            vector.expectedState?.let { expected ->
                assertEquals(vector.name, expected, actual)
            }
            vector.expectedSelectors?.let { selectors ->
                assertSelectors(vector.name, actual, selectors)
            }
        }
    }

    private fun assertSelectors(name: String, state: ChatState, selectors: JsonObject) {
        selectors["unreadCount"]?.jsonObject?.let { input ->
            val conversation = state.conversation(input.string("conversationId"))
            val readState = conversation.readStates.firstOrNull {
                it.userId == input.string("readStateUserId")
            }
            assertEquals(
                name,
                input.getValue("expected").jsonPrimitive.int,
                countUnreadMessages(
                    conversation.messages,
                    input.string("currentUserId"),
                    readState,
                ),
            )
        }
        selectors["snippet"]?.jsonObject?.let { input ->
            val message = state.message(input.string("conversationId"), input.string("messageId"))
            assertEquals(name, input.string("expected"), messageSnippet(message))
        }
        selectors["replyPreview"]?.jsonObject?.let { input ->
            val message = state.message(input.string("conversationId"), input.string("messageId"))
            val expected = json.decodeFromJsonElement(
                ReplyPreview.serializer(),
                input.getValue("expected"),
            )
            assertEquals(
                name,
                expected,
                replyPreview(
                    message,
                    input.string("currentUserId"),
                    input.string("participantName"),
                    input.string("currentUserName"),
                ),
            )
        }
        selectors["outgoingStatus"]?.jsonObject?.let { input ->
            val conversation = state.conversation(input.string("conversationId"))
            val message = conversation.messages.first { it.id == input.string("messageId") }
            val readState = conversation.readStates.firstOrNull {
                it.userId == input.string("readStateUserId")
            }
            val expected = when (input.string("expected")) {
                "read" -> OutgoingMessageStatus.Read
                "delivered" -> OutgoingMessageStatus.Delivered
                else -> OutgoingMessageStatus.Sent
            }
            assertEquals(name, expected, outgoingMessageStatus(message, conversation.messages, readState))
        }
    }

    private fun ChatState.conversation(id: String): ChatConversationState =
        assertNotNull(conversations[id]).let { conversations.getValue(id) }

    private fun ChatState.message(conversationId: String, messageId: String): ChatMessage =
        conversation(conversationId).messages.first { it.id == messageId }

    private fun JsonObject.string(name: String): String = getValue(name).jsonPrimitive.content
}

@Serializable
private data class ChatStateVector(
    val name: String,
    val initialState: ChatState,
    val events: List<ChatEvent>,
    val expectedState: ChatState? = null,
    val expectedSelectors: JsonObject? = null,
)
