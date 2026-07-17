package space.fishhub.android.feature.chat.state

import space.fishhub.android.data.chat.model.ChatMessage
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ChatMediaMergeParityTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `bare acknowledgements preserve shared media metadata`() {
        val resource = checkNotNull(
            javaClass.classLoader?.getResource("chat-media-merge-vectors.json"),
        )
        val vectors = json.decodeFromString<List<MediaMergeVector>>(resource.readText())

        vectors.forEach { vector ->
            val merged = mergeChatMessage(listOf(vector.existing), vector.incoming).single()
            assertEquals(vector.name, vector.expectedGifProviderId, merged.gif?.providerId)
            assertEquals(vector.name, vector.expectedStickerId, merged.stickerId)
        }
    }
}

@Serializable
private data class MediaMergeVector(
    val name: String,
    val existing: ChatMessage,
    val incoming: ChatMessage,
    val expectedGifProviderId: String?,
    val expectedStickerId: String?,
)
