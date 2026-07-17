package space.fishhub.android.data.call

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.HasRecord
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecordOrNull
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

internal class SupabaseCallRepository(
    private val client: SupabaseClient,
    private val scope: CoroutineScope,
) : CallRepository {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    override val authState = client.auth.sessionStatus.map { status ->
        when (status) {
            SessionStatus.Initializing -> CallAuthState.Loading
            is SessionStatus.Authenticated -> CallAuthState.SignedIn(
                checkNotNull(status.session.user?.id),
            )
            is SessionStatus.NotAuthenticated,
            is SessionStatus.RefreshFailure,
            -> CallAuthState.SignedOut
        }
    }.stateIn(scope, SharingStarted.Eagerly, CallAuthState.Loading)

    override suspend fun initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String,
    ): CallResult<CallCommandSuccess> = invoke(
        buildJsonObject {
            put("action", "initiate")
            put("recipientId", recipientId)
            put("kind", kind.wireValue)
            put("clientRequestId", clientRequestId)
        },
    )

    override suspend fun accept(callId: String) = callAction("accept", callId)
    override suspend fun reject(callId: String) = callAction("reject", callId)
    override suspend fun cancel(callId: String) = callAction("cancel", callId)
    override suspend fun end(callId: String) = callAction("end", callId)
    override suspend fun join(callId: String) = callAction("join", callId)

    override suspend fun findCurrentCall(userId: String): CallResult<CallWithCounterpart?> =
        guarded {
            val row = client.from("calls").select {
                filter {
                    isIn("status", listOf("ringing", "connecting", "active"))
                    or {
                        eq("coach_id", userId)
                        eq("client_id", userId)
                    }
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }.decodeList<CallRowDto>().firstOrNull()
            row?.withCounterpart()
        }

    override suspend fun findCall(callId: String): CallResult<CallWithCounterpart?> = guarded {
        client.from("calls").select {
            filter { eq("id", callId) }
            limit(1)
        }.decodeList<CallRowDto>().firstOrNull()?.withCounterpart()
    }

    override fun observeRealtime(userId: String): Flow<CallRealtimeEvent> = callbackFlow {
        val channel = client.channel("calls:user:$userId:android")
        val changes = channel.postgresChangeFlow<PostgresAction>("public") { table = "calls" }
        val job = launch {
            changes.collectLatest { action ->
                val row = (action as? HasRecord)?.decodeRecordOrNull<CallRowDto>()
                if (row != null && (row.coachId == userId || row.clientId == userId)) {
                    trySend(
                        CallRealtimeEvent(
                            callId = row.id,
                            status = row.status.toStatus(),
                            occurredAt = row.updatedAt,
                        ),
                    )
                }
            }
        }
        channel.subscribe(blockUntilSubscribed = true)
        awaitClose {
            job.cancel()
            scope.launch { client.realtime.removeChannel(channel) }
        }
    }

    override suspend fun registerPushDevice(
        installationId: String,
        providerInstallationId: String,
        appVersion: String,
    ): CallResult<Unit> = pushCommand(
        buildJsonObject {
            put("action", "register")
            put("installationId", installationId)
            put("providerInstallationId", providerInstallationId)
            put("platform", "android")
            put("appVersion", appVersion)
        },
    )

    override suspend fun unregisterPushDevice(installationId: String): CallResult<Unit> =
        pushCommand(
            buildJsonObject {
                put("action", "unregister")
                put("installationId", installationId)
            },
        )

    private suspend fun callAction(action: String, callId: String) = invoke(
        buildJsonObject {
            put("action", action)
            put("callId", callId)
        },
    )

    private suspend fun invoke(body: kotlinx.serialization.json.JsonObject): CallResult<CallCommandSuccess> =
        try {
            val response = client.functions.invoke(
                function = "call-command",
                body = body,
                headers = headers {
                    append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                },
            )
            val payload = response.bodyAsText()
            if (!response.status.isSuccess()) return failure(payload)
            val dto = json.decodeFromString<CallCommandResponseDto>(payload)
            val call = dto.call?.toDomain()
                ?: return CallResult.Failure(
                    code = "call_unavailable",
                    notice = DefaultCallError,
                    recoverable = true,
                )
            CallResult.Success(
                CallCommandSuccess(
                    call = call,
                    connection = dto.connection?.toDomain(),
                ),
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            CallResult.Failure("call_unavailable", DefaultCallError, recoverable = true)
        }

    private suspend fun pushCommand(body: kotlinx.serialization.json.JsonObject): CallResult<Unit> =
        try {
            val response = client.functions.invoke(
                function = "push-command",
                body = body,
                headers = headers {
                    append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                },
            )
            val payload = response.bodyAsText()
            if (response.status.isSuccess()) CallResult.Success(Unit) else failure(payload)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            CallResult.Failure(
                "push_unavailable",
                "Call notifications could not update. In-app calls still work.",
                recoverable = true,
            )
        }

    private suspend fun CallRowDto.withCounterpart(): CallWithCounterpart {
        val name = runCatching {
            client.postgrest.rpc(
                "get_call_counterpart_name",
                buildJsonObject { put("p_call_id", id) },
            ).decodeSingle<String>()
        }.getOrNull() ?: "Your call partner"
        return CallWithCounterpart(toDomain(), name)
    }

    private suspend fun <T> guarded(block: suspend () -> T): CallResult<T> = try {
        CallResult.Success(block())
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Throwable) {
        CallResult.Failure("call_unavailable", DefaultCallError, recoverable = true)
    }

    private fun failure(payload: String): CallResult.Failure = runCatching {
        val root = json.parseToJsonElement(payload).jsonObject
        CallResult.Failure(
            code = root["code"]?.jsonPrimitive?.content ?: "call_unavailable",
            notice = root["error"]?.jsonPrimitive?.content ?: DefaultCallError,
            recoverable = true,
        )
    }.getOrElse {
        CallResult.Failure("call_unavailable", DefaultCallError, recoverable = true)
    }
}

private const val DefaultCallError = "Calling is taking a break. Messages still work."

private val CallKind.wireValue get() = if (this == CallKind.Video) "video" else "audio"

@Serializable
private data class CounterpartRequest(@SerialName("p_call_id") val callId: String)

@Serializable
private data class CallCommandResponseDto(
    val call: CallDto? = null,
    val connection: CallConnectionDto? = null,
)

@Serializable
private data class CallConnectionDto(
    val serverUrl: String,
    val participantToken: String,
) {
    fun toDomain() = CallConnection(serverUrl, participantToken)
}

@Serializable
private data class CallDto(
    val id: String,
    val lessonSlotId: String? = null,
    val coachId: String,
    val clientId: String,
    val initiatedBy: String,
    val kind: String,
    val status: String,
    val expiresAt: String,
    val acceptedAt: String? = null,
    val connectedAt: String? = null,
    val endedAt: String? = null,
    val endReason: String? = null,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toDomain() = Call(
        id, lessonSlotId, coachId, clientId, initiatedBy, kind.toKind(), status.toStatus(),
        expiresAt, acceptedAt, connectedAt, endedAt, endReason, createdAt, updatedAt,
    )
}

@Serializable
private data class CallRowDto(
    val id: String,
    @SerialName("lesson_slot_id") val lessonSlotId: String? = null,
    @SerialName("coach_id") val coachId: String,
    @SerialName("client_id") val clientId: String,
    @SerialName("initiated_by") val initiatedBy: String,
    val kind: String,
    val status: String,
    @SerialName("expires_at") val expiresAt: String,
    @SerialName("accepted_at") val acceptedAt: String? = null,
    @SerialName("connected_at") val connectedAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
    @SerialName("end_reason") val endReason: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
) {
    fun toDomain() = Call(
        id, lessonSlotId, coachId, clientId, initiatedBy, kind.toKind(), status.toStatus(),
        expiresAt, acceptedAt, connectedAt, endedAt, endReason, createdAt, updatedAt,
    )
}

private fun String.toKind() = if (this == "video") CallKind.Video else CallKind.Audio

private fun String.toStatus() = when (this) {
    "ringing" -> CallStatus.Ringing
    "connecting" -> CallStatus.Connecting
    "active" -> CallStatus.Active
    "ended" -> CallStatus.Ended
    "rejected" -> CallStatus.Rejected
    "cancelled" -> CallStatus.Cancelled
    "missed" -> CallStatus.Missed
    else -> CallStatus.Failed
}
