package space.fishhub.android.data.friends.remote

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.http.HttpHeaders
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.data.friends.FriendEventReason
import space.fishhub.android.data.friends.FriendRequestResponse

class FriendsContractTest {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    @Test
    fun candidateWithNoRelationshipCarriesTheSafeProfileFields() {
        val candidate = decodeCandidate(
            """
            {
              "status":"none",
              "profile":{
                "id":"client-2",
                "display_name":"Sam Lee",
                "username":"sam_lee"
              }
            }
            """.trimIndent(),
        )

        assertEquals(FriendCandidateStatus.None, candidate.status)
        assertEquals("Sam Lee", candidate.profile?.displayName)
        assertEquals("sam_lee", candidate.profile?.username)
        assertNull(candidate.requestId)
    }

    @Test
    fun existingFriendDecodesWithoutARequestId() {
        val candidate = decodeCandidate(
            """
            {
              "status":"friends",
              "profile":{"id":"client-2","display_name":"Sam Lee","username":"sam_lee"}
            }
            """.trimIndent(),
        )

        assertEquals(FriendCandidateStatus.Friends, candidate.status)
        assertNull(candidate.requestId)
    }

    @Test
    fun pendingCandidatesCarryTheRequestIdInBothDirections() {
        val outgoing = decodeCandidate(
            """
            {
              "status":"outgoing_pending",
              "request_id":"request-1",
              "profile":{"id":"client-2","display_name":"Sam Lee","username":"sam_lee"}
            }
            """.trimIndent(),
        )
        val incoming = decodeCandidate(
            """
            {
              "status":"incoming_pending",
              "request_id":"request-2",
              "profile":{"id":"client-2","display_name":"Sam Lee","username":"sam_lee"}
            }
            """.trimIndent(),
        )

        assertEquals(FriendCandidateStatus.OutgoingPending, outgoing.status)
        assertEquals("request-1", outgoing.requestId)
        assertEquals(FriendCandidateStatus.IncomingPending, incoming.status)
        assertEquals("request-2", incoming.requestId)
    }

    @Test
    fun unavailableCarriesNothingButTheStatus() {
        val candidate = decodeCandidate("""{"status":"unavailable"}""")

        assertEquals(FriendCandidateStatus.Unavailable, candidate.status)
        assertNull(candidate.profile)
    }

    @Test
    fun unknownStatusDecodesAsUnavailable() {
        val candidate = decodeCandidate(
            """
            {
              "status":"a_future_status",
              "profile":{"id":"client-2","display_name":"Sam Lee","username":"sam_lee"}
            }
            """.trimIndent(),
        )

        assertEquals(FriendCandidateStatus.Unavailable, candidate.status)
    }

    @Test
    fun aStatusWithoutAUsableProfileCollapsesToUnavailable() {
        val missing = decodeCandidate("""{"status":"none"}""")
        val partial = decodeCandidate("""{"status":"none","profile":{"id":"client-2"}}""")

        assertEquals(FriendCandidateStatus.Unavailable, missing.status)
        assertNull(missing.profile)
        assertEquals(FriendCandidateStatus.Unavailable, partial.status)
        assertNull(partial.profile)
    }

    @Test
    fun incomingRequestRowUsesCurrentDatabaseFieldNames() {
        val request = json.decodeFromString<IncomingFriendRequestDto>(
            """
            {
              "request_id":"request-1",
              "sender_id":"client-2",
              "display_name":"Sam Lee",
              "username":"sam_lee",
              "created_at":"2026-07-29T00:00:00Z"
            }
            """.trimIndent(),
        ).toDomain()

        assertEquals("request-1", request.requestId)
        assertEquals("client-2", request.sender.id)
        assertEquals("sam_lee", request.sender.username)
        assertEquals("2026-07-29T00:00:00Z", request.createdAt)
    }

    @Test
    fun commandBodiesUseCamelCaseAndTheExactActionLiterals() {
        assertEquals(
            "{\"action\":\"send-request\",\"targetId\":\"client-2\"," +
                "\"clientRequestId\":\"request-key-1\"}",
            json.encodeToString(
                SendFriendRequestBody(targetId = "client-2", clientRequestId = "request-key-1"),
            ),
        )
        assertEquals(
            "{\"action\":\"respond-request\",\"requestId\":\"request-1\",\"response\":\"accept\"}",
            json.encodeToString(
                RespondFriendRequestBody(
                    requestId = "request-1",
                    response = FriendRequestResponse.Accept.toWire(),
                ),
            ),
        )
        assertEquals("decline", FriendRequestResponse.Decline.toWire())
    }

    @Test
    fun successfulCommandReadsTheServerRequestRow() = runTest {
        val outcome = respondWith(
            HttpStatusCode.OK,
            """
            {
              "request":{
                "id":"request-1",
                "senderId":"client-1",
                "recipientId":"client-2",
                "status":"pending",
                "createdAt":"2026-07-29T00:00:00Z",
                "updatedAt":"2026-07-29T00:00:00Z",
                "respondedAt":null
              }
            }
            """.trimIndent(),
        ).decodeFriendRequest(json)

        assertEquals("request-1", outcome.requestId)
        assertEquals("pending", outcome.status)
    }

    // The next two cover the decoder's backstop only. In production the
    // functions client throws before a failed response reaches the decoder, so
    // the real failure path lives in SupabaseFriendsRemoteDataSourceTest.
    @Test
    fun failureBodyKeepsTheServersCodeAndCalmCopy() = runTest {
        val failure = runCatching {
            respondWith(
                HttpStatusCode.Conflict,
                """{"code":"already_friends","error":"You’re already friends."}""",
            ).decodeFriendRequest(json)
        }.exceptionOrNull() as RemoteFriendCommandException

        assertEquals("already_friends", failure.code)
        assertEquals("You’re already friends.", failure.message)
    }

    @Test
    fun unreadableFailureBodyFallsBackToTheOneCalmLine() = runTest {
        val failure = runCatching {
            respondWith(HttpStatusCode.ServiceUnavailable, "<html>gateway</html>")
                .decodeFriendRequest(json)
        }.exceptionOrNull() as RemoteFriendCommandException

        assertEquals("friends_unavailable", failure.code)
        assertEquals("Friends is taking a break. Chat still works.", failure.message)
    }

    @Test
    fun successWithoutARequestRowIsTreatedAsUnavailable() = runTest {
        val failure = runCatching {
            respondWith(HttpStatusCode.OK, """{"done":true}""").decodeFriendRequest(json)
        }.exceptionOrNull() as RemoteFriendCommandException

        assertEquals("friends_unavailable", failure.code)
        assertEquals("Friends is taking a break. Chat still works.", failure.message)
    }

    @Test
    fun everyBroadcastReasonMapsAndAnUnknownOneStillArrives() {
        val reasons = listOf(
            "request_created" to FriendEventReason.RequestCreated,
            "request_accepted" to FriendEventReason.RequestAccepted,
            "request_declined" to FriendEventReason.RequestDeclined,
            "request_cancelled" to FriendEventReason.RequestCancelled,
        )
        reasons.forEach { (wire, expected) ->
            val event = json.decodeFromString<FriendEventDto>(
                """{"requestId":"request-1","reason":"$wire","occurredAt":"2026-07-29T00:00:00Z"}""",
            ).toDomain()

            assertEquals(expected, event.reason)
            assertEquals("request-1", event.requestId)
            assertNull(event.friendshipId)
        }

        val friendship = json.decodeFromString<FriendEventDto>(
            """{"friendshipId":"friendship-1","reason":"friendship_created","occurredAt":"2026-07-29T00:00:00Z"}""",
        ).toDomain()
        val removed = json.decodeFromString<FriendEventDto>(
            """{"friendshipId":"friendship-1","reason":"friendship_removed","occurredAt":"2026-07-29T00:00:00Z"}""",
        ).toDomain()
        val unknown = json.decodeFromString<FriendEventDto>(
            """{"requestId":"request-1","reason":"something_new"}""",
        ).toDomain()

        assertEquals(FriendEventReason.FriendshipCreated, friendship.reason)
        assertEquals("friendship-1", friendship.friendshipId)
        assertEquals(FriendEventReason.FriendshipRemoved, removed.reason)
        assertEquals(FriendEventReason.Unknown, unknown.reason)
        assertTrue(unknown.requestId == "request-1")
    }

    private fun decodeCandidate(payload: String) =
        json.decodeFromString<FriendCandidateDto>(payload).toDomain()

    private suspend fun respondWith(status: HttpStatusCode, body: String): HttpResponse {
        val engine = MockEngine {
            respond(
                content = body,
                status = status,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }
        return HttpClient(engine).post("https://example.test/functions/v1/friend-command")
    }
}
