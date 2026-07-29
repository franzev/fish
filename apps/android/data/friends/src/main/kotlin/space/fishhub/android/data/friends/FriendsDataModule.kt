package space.fishhub.android.data.friends

import io.github.jan.supabase.SupabaseClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import space.fishhub.android.data.friends.remote.SupabaseFriendsRemoteDataSource

object FriendsDataModule {
    data class Dependencies(val repository: FriendsRepository)

    fun create(supabaseClient: SupabaseClient?): Dependencies {
        if (supabaseClient == null) return Dependencies(UnconfiguredFriendsRepository)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        return Dependencies(
            repository = DefaultFriendsRepository(
                remote = SupabaseFriendsRemoteDataSource(supabaseClient, scope),
            ),
        )
    }
}

private object UnconfiguredFriendsRepository : FriendsRepository {
    private val failure = FriendsResult.Failure(
        message = "This build is not connected yet.",
        recoverable = false,
    )

    override suspend fun searchCandidate(username: String) = failure
    override suspend fun listIncomingRequests() = failure
    override suspend fun countIncomingRequests() = failure
    override suspend fun sendRequest(targetId: String, clientRequestId: String) = failure
    override suspend fun respondRequest(requestId: String, response: FriendRequestResponse) = failure
    override fun events(userId: String): Flow<FriendEvent> = emptyFlow()
}
