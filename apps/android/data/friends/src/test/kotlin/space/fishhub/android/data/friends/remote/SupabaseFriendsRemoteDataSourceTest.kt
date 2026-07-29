package space.fishhub.android.data.friends.remote

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.logging.LogLevel
import io.github.jan.supabase.serializer.KotlinXSerializer
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.friends.FriendRequestResponse

/**
 * The seam this closes: the functions client throws on a failed response
 * instead of returning it, so a hand-built [io.ktor.client.statement.HttpResponse]
 * fed straight to the decoder proves nothing about production. Everything here
 * goes through a real [SupabaseClient] over a mock engine.
 */
class SupabaseFriendsRemoteDataSourceTest {
    @Test
    fun aConflictKeepsTheServersCodeAndItsCalmCopy() = runTest {
        val remote = remote {
            respond(
                content = """{"code":"already_friends","error":"You’re already friends."}""",
                status = HttpStatusCode.Conflict,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }

        val failure = runCatching {
            remote.sendRequest(targetId = "client-2", clientRequestId = "request-key-1")
        }.exceptionOrNull()

        assertTrue("expected a coded friend failure, got $failure", failure is RemoteFriendCommandException)
        failure as RemoteFriendCommandException
        assertEquals("already_friends", failure.code)
        assertEquals("You’re already friends.", failure.message)
    }

    @Test
    fun aServiceOutageFallsBackToTheOneCalmLine() = runTest {
        val remote = remote {
            respond(
                content = "<html>gateway</html>",
                status = HttpStatusCode.ServiceUnavailable,
                headers = headersOf(HttpHeaders.ContentType, "text/html"),
            )
        }

        val failure = runCatching {
            remote.respondRequest("request-1", FriendRequestResponse.Decline)
        }.exceptionOrNull() as RemoteFriendCommandException

        assertEquals("friends_unavailable", failure.code)
        assertEquals("Friends is taking a break. Chat still works.", failure.message)
    }

    @Test
    fun aSignedOutCallerKeepsTheNotAuthenticatedCode() = runTest {
        // 401 becomes UnauthorizedRestException rather than the catch-all, so
        // the code the repository reads has to survive that branch too.
        val remote = remote {
            respond(
                content = """{"code":"not_authenticated","error":"Sign in to manage friends."}""",
                status = HttpStatusCode.Unauthorized,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }

        val failure = runCatching {
            remote.sendRequest(targetId = "client-2", clientRequestId = "request-key-1")
        }.exceptionOrNull() as RemoteFriendCommandException

        assertEquals("not_authenticated", failure.code)
        assertEquals("Sign in to manage friends.", failure.message)
    }

    @Test
    fun aSuccessfulSendDecodesTheServerRequestRow() = runTest {
        val remote = remote {
            respond(
                content = """
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
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }

        val outcome = remote.sendRequest(targetId = "client-2", clientRequestId = "request-key-1")

        assertEquals("request-1", outcome.requestId)
        assertEquals("pending", outcome.status)
    }

    @Test
    fun theActionLiteralAndCamelCaseKeysGoOverTheWire() = runTest {
        // The client's own serializer encodes the body, so the action default
        // only survives while that serializer keeps encodeDefaults on.
        val sent = mutableListOf<String>()
        val remote = remote(sent) {
            respond(
                content = """{"request":{"id":"request-1","status":"pending"}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }

        remote.sendRequest(targetId = "client-2", clientRequestId = "request-key-1")
        remote.respondRequest("request-1", FriendRequestResponse.Accept)

        assertEquals(
            "{\"action\":\"send-request\",\"targetId\":\"client-2\"," +
                "\"clientRequestId\":\"request-key-1\"}",
            sent.first(),
        )
        assertEquals(
            "{\"action\":\"respond-request\",\"requestId\":\"request-1\",\"response\":\"accept\"}",
            sent.last(),
        )
    }

    private fun TestScope.remote(
        sentBodies: MutableList<String>? = null,
        handler: MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): FriendsRemoteDataSource = SupabaseFriendsRemoteDataSource(
        client = testClient(sentBodies, handler),
        scope = CoroutineScope(coroutineContext),
    )

    private fun testClient(
        sentBodies: MutableList<String>?,
        handler: MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): SupabaseClient {
        // Mirrors core/supabase SupabaseClientFactory; the serializer settings
        // there are what encode every outbound command body.
        val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = true
        }
        val engine = MockEngine { request ->
            sentBodies?.add(request.body.toByteArray().decodeToString())
            handler(request)
        }
        return createSupabaseClient("example.test", "test-publishable-key") {
            defaultLogLevel = LogLevel.NONE
            defaultSerializer = KotlinXSerializer(json)
            httpEngine = engine
            // No Auth plugin in a unit test: the publishable key stands in for
            // the session the real app always has.
            install(Functions) { requireValidSession = false }
        }
    }
}

private typealias TestScope = kotlinx.coroutines.test.TestScope
