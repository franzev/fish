package space.fishhub.android.data.presence.remote

import space.fishhub.android.data.presence.PresenceCommandResult
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresencePreferenceSetting
import space.fishhub.android.data.presence.PresenceSnapshot
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.HasRecord
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecordOrNull
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

internal class SupabasePresenceRemoteDataSource(
    private val client: SupabaseClient,
) : PresenceRemoteDataSource {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    override suspend fun listVisible(): List<PresenceSnapshot> =
        client.postgrest.rpc("list_visible_presence")
            .decodeList<PresenceSnapshotDto>()
            .map(PresenceSnapshotDto::toDomain)

    override suspend fun getOwnPreference(): PresencePreferenceSetting {
        val row = client.from("presence_preferences").select {
            limit(1)
        }.decodeSingle<PresencePreferenceDto>()
        return PresencePreferenceSetting(row.mode.toPresencePreference(), row.expiresAt)
    }

    override suspend fun touchSession(
        sessionId: String,
        activity: Boolean,
        ended: Boolean,
    ): PresenceSnapshot = client.postgrest.rpc(
        function = "touch_presence_session",
        parameters = buildJsonObject {
            put("p_session_id", sessionId)
            put("p_activity", activity)
            put("p_ended", ended)
        },
    ).decodeSingle<PresenceSnapshotDto>().toDomain()

    override suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceCommandResult = withTimeout(CommandTimeoutMs) {
        val response = client.functions.invoke(
            function = "presence-command",
            body = PresenceCommandRequest(preference.toWire(), duration.seconds),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val body = response.bodyAsText()
        if (!response.status.isSuccess()) {
            val message = runCatching {
                json.decodeFromString<CalmErrorDto>(body).error
            }.getOrNull().orEmpty().ifBlank { DefaultCommandError }
            throw PresenceRemoteException(message)
        }
        json.decodeFromString<PresenceCommandResponse>(body).toDomain()
    }

    override fun observeRealtime(
        userId: String,
        subjectIds: Set<String>,
    ): Flow<PresenceRealtimeEvent> = kotlinx.coroutines.flow.callbackFlow {
        val subscriptionId = UUID.randomUUID().toString()
        val preferenceChannel = client.channel("presence:user:$userId") {
            isPrivate = true
        }
        val preferenceChanges = preferenceChannel
            .broadcastFlow<PresencePreferenceBroadcastDto>("presence.preference.changed")
        val subjectChanges = preferenceChannel
            .broadcastFlow<PresenceSubjectsBroadcastDto>("presence.subjects.changed")
        val ids = (subjectIds + userId).distinct()
        val snapshotChannels = ids.chunked(SnapshotChunkSize).mapIndexed { index, chunk ->
            client.channel("presence:snapshots:$userId:$subscriptionId:$index") to chunk
        }
        val channels = listOf(preferenceChannel) + snapshotChannels.map { it.first }

        launch {
            preferenceChanges.collectLatest { payload ->
                val setting = runCatching {
                    PresencePreferenceSetting(
                        payload.mode.toPresencePreference(),
                        payload.expiresAt,
                    )
                }.getOrNull() ?: return@collectLatest
                trySend(PresenceRealtimeEvent.PreferenceChanged(setting, payload.revision))
            }
        }
        launch {
            subjectChanges.collectLatest { trySend(PresenceRealtimeEvent.SubjectsChanged) }
        }
        snapshotChannels.forEach { (channel, chunk) ->
            val changes = channel.postgresChangeFlow<PostgresAction>("public") {
                table = "presence_snapshots"
                filter("user_id", FilterOperator.IN, chunk)
            }
            launch {
                changes.collectLatest { action ->
                    val snapshot = (action as? HasRecord)
                        ?.decodeRecordOrNull<PresenceSnapshotDto>()
                        ?.let { runCatching { it.toDomain() }.getOrNull() }
                    if (snapshot != null) {
                        trySend(PresenceRealtimeEvent.SnapshotChanged(snapshot))
                    }
                }
            }
        }

        try {
            client.realtime.setAuth()
            channels.forEach { channel -> channel.subscribe(blockUntilSubscribed = true) }
            trySend(PresenceRealtimeEvent.Connected)
            channels.forEach { channel ->
                launch {
                    channel.status.drop(1).collect { status ->
                        if (
                            status == RealtimeChannel.Status.SUBSCRIBED &&
                            channels.all { it.status.value == RealtimeChannel.Status.SUBSCRIBED }
                        ) {
                            trySend(PresenceRealtimeEvent.Connected)
                        } else if (status != RealtimeChannel.Status.SUBSCRIBED) {
                            trySend(PresenceRealtimeEvent.Disconnected)
                        }
                    }
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            trySend(PresenceRealtimeEvent.Disconnected)
        }

        awaitClose {
            channels.forEach { channel ->
                launch { runCatching { channel.unsubscribe() } }
            }
        }
    }

    private companion object {
        const val SnapshotChunkSize = 100
        const val CommandTimeoutMs = 15_000L
        const val DefaultCommandError = "Your status could not change. Try again."
    }
}

internal class PresenceRemoteException(message: String) : IllegalStateException(message)
