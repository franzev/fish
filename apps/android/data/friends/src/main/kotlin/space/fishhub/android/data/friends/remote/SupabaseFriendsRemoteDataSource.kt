package space.fishhub.android.data.friends.remote

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendEvent
import space.fishhub.android.data.friends.FriendRequestOutcome
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest

internal class SupabaseFriendsRemoteDataSource(
    private val client: SupabaseClient,
    private val scope: CoroutineScope,
) : FriendsRemoteDataSource {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    override suspend fun searchCandidate(username: String): FriendCandidate =
        client.postgrest.rpc(
            function = "search_friend_candidate",
            parameters = buildJsonObject {
                put("p_username", JsonPrimitive(username))
            },
        ).decodeAs<FriendCandidateDto>().toDomain()

    override suspend fun listIncomingRequests(): List<IncomingFriendRequest> =
        client.postgrest.rpc(
            function = "list_incoming_friend_requests",
            parameters = buildJsonObject {
                put("p_limit", JsonPrimitive(RequestPageSize))
            },
        ).decodeList<IncomingFriendRequestDto>().map(IncomingFriendRequestDto::toDomain)

    override suspend fun countIncomingRequests(): Int =
        client.postgrest.rpc("count_incoming_friend_requests").decodeAs<Int>()

    override suspend fun sendRequest(
        targetId: String,
        clientRequestId: String,
    ): FriendRequestOutcome = friendCommand(
        SendFriendRequestBody(targetId = targetId, clientRequestId = clientRequestId),
    )

    override suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendRequestOutcome = friendCommand(
        RespondFriendRequestBody(requestId = requestId, response = response.toWire()),
    )

    /**
     * The functions client throws on any non-2xx instead of handing the
     * response back, carrying the raw body in [RestException.error]. The
     * server's `{code, error}` has to be recovered from there or friends loses
     * both the codes it branches on and every calm line the server authored.
     */
    private suspend inline fun <reified T : Any> friendCommand(body: T): FriendRequestOutcome = try {
        client.functions.invoke(
            function = "friend-command",
            body = body,
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        ).decodeFriendRequest(json)
    } catch (restFailure: RestException) {
        throw readFriendCommandFailure(json, restFailure.error)
    }

    override fun events(userId: String): Flow<FriendEvent> = callbackFlow {
        val channel = client.channel("friends:user:$userId") { isPrivate = true }
        val changes = channel.broadcastFlow<FriendEventDto>(FriendsChangedEvent)
        launch {
            changes.collect { payload -> trySend(payload.toDomain()) }
        }
        try {
            client.realtime.setAuth()
            channel.subscribe(blockUntilSubscribed = true)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // Events are only a nudge to refetch. Losing them keeps the surface
            // one manual refresh behind rather than taking it down.
        }
        awaitClose {
            scope.launch { runCatching { client.realtime.removeChannel(channel) } }
        }
    }

    private companion object {
        const val RequestPageSize = 50
        const val FriendsChangedEvent = "friends.changed"
    }
}

/**
 * The `friend-command` success body is `{request: {...}}`. A 2xx that carries
 * no request row still means friends could not do the thing, so it degrades to
 * the one fallback line rather than inventing a message here.
 *
 * The status guard is a backstop: today the functions client raises a
 * [RestException] before a failed response ever reaches this function, and
 * [friendCommand] is what turns that back into a coded failure.
 */
internal suspend fun HttpResponse.decodeFriendRequest(json: Json): FriendRequestOutcome {
    val payload = bodyAsText()
    if (!status.isSuccess()) throw readFriendCommandFailure(json, payload)
    val request = runCatching {
        json.decodeFromString<FriendCommandResponseDto>(payload).request
    }.getOrNull() ?: throw RemoteFriendCommandException(
        FriendCommandCode.FriendsUnavailable,
        DefaultFriendsError,
    )
    return request.toDomain()
}

internal fun readFriendCommandFailure(json: Json, payload: String): RemoteFriendCommandException {
    val body = runCatching {
        json.decodeFromString<FriendCommandFailureDto>(payload)
    }.getOrNull()
    return RemoteFriendCommandException(
        code = body?.code?.takeIf(String::isNotBlank) ?: FriendCommandCode.FriendsUnavailable,
        message = body?.error?.takeIf(String::isNotBlank) ?: DefaultFriendsError,
    )
}

internal const val DefaultFriendsError = "Friends is taking a break. Chat still works."
