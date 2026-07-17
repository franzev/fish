package space.fishhub.android.data.presence

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import space.fishhub.android.data.presence.remote.SupabasePresenceRemoteDataSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

object PresenceDataModule {
    data class Dependencies(
        val repository: PresenceRepository,
        val scope: CoroutineScope,
    )

    fun create(
        supabaseClient: SupabaseClient?,
        diagnostics: PresenceDiagnostics = NoOpPresenceDiagnostics,
    ): Dependencies {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        if (supabaseClient == null) return Dependencies(UnconfiguredPresenceRepository, scope)
        val authUserId = supabaseClient.auth.sessionStatus.map { status ->
            (status as? SessionStatus.Authenticated)?.session?.user?.id
        }.stateIn(scope, SharingStarted.Eagerly, null)
        return Dependencies(
            repository = DefaultPresenceRepository(
                remote = SupabasePresenceRemoteDataSource(supabaseClient),
                authUserId = authUserId,
                parentScope = scope,
                diagnostics = diagnostics,
            ),
            scope = scope,
        )
    }
}

private object UnconfiguredPresenceRepository : PresenceRepository {
    override val state = MutableStateFlow(PresenceState())
    override fun setAppForegrounded(foregrounded: Boolean) = Unit
    override fun markActive() = Unit
    override suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceResult<PresenceCommandResult> = PresenceResult.Failure(
        "This build is not connected yet.",
    )
    override suspend fun endSession() = Unit
}
