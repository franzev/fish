package space.fishhub.android.feature.call.state

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class CallStateParityTest {
    private val json = Json {
        ignoreUnknownKeys = true
        classDiscriminator = "type"
    }

    @Test
    fun `replays every shared call-state vector`() {
        val resource = checkNotNull(javaClass.classLoader?.getResource("call-state-vectors.json"))
        val vectors = json.decodeFromString<List<CallStateVector>>(resource.readText())

        assertEquals(6, vectors.size)
        vectors.forEach { vector ->
            val actual = vector.events.fold(vector.initialState, ::reduceCallState)
            assertEquals(vector.name, vector.expectedState, actual)
        }
    }
}

@Serializable
private data class CallStateVector(
    val name: String,
    val initialState: CallState,
    val events: List<CallEvent>,
    val expectedState: CallState,
)
