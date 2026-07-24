package space.fishhub.android.data.chat.sharedcontent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import space.fishhub.android.data.chat.AttachmentDelivery
import space.fishhub.android.data.chat.ChatDataModule
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.UnconfiguredChatRepository

class SharedContentIdentityCoordinatorTest {
    @Test
    fun identityChangesUseExactPurgeBeforeBindOrderForAtoB() {
        val coordinator = IdentityCoordinatorContract()

        assertTrue(coordinator.transition(oldOwner = "A", newOwner = "B"))

        assertEquals(EXACT_PURGE_ORDER, coordinator.operations)
        assertTrue(coordinator.ownerEligible("B"))
        assertFalse(coordinator.ownerEligible("A"))
    }

    @Test
    fun signedOutAndUnresolvedTransitionsHideOldStateAndNeverBindAnUnknownOwner() {
        listOf(
            "A to signed-out" to null,
            "A to unresolved" to null,
        ).forEach { (_, newOwner) ->
            val coordinator = IdentityCoordinatorContract()
            coordinator.seedOwner("A")

            assertFalse(coordinator.transition(oldOwner = "A", newOwner = newOwner))
            assertFalse(coordinator.ownerEligible("A"))
            assertFalse(coordinator.anyOwnerVisible())
            assertEquals(EXACT_PURGE_ORDER.dropLast(2), coordinator.operations)
        }
    }

    @Test
    fun unresolvedToBAndAtoBtoARequireASecondGenerationPurgeBeforeRebinding() {
        val coordinator = IdentityCoordinatorContract()

        assertTrue(coordinator.transition(oldOwner = null, newOwner = "B"))
        assertTrue(coordinator.transition(oldOwner = "B", newOwner = "A"))

        assertEquals(2, coordinator.generation)
        assertEquals(EXACT_PURGE_ORDER + EXACT_PURGE_ORDER, coordinator.operations)
        assertTrue(coordinator.ownerEligible("A"))
        assertFalse(coordinator.ownerEligible("B"))
    }

    @Test
    fun delayedACallbackIsRejectedAfterGenerationAdvancesToB() {
        val coordinator = IdentityCoordinatorContract()
        coordinator.transition(oldOwner = "A", newOwner = "B")

        assertFalse(coordinator.acceptCallback(owner = "A", callbackGeneration = 0))
        assertTrue(coordinator.acceptCallback(owner = "B", callbackGeneration = coordinator.generation))
        assertFalse(coordinator.ownerVisibleFromCallback("A"))
    }

    @Test
    fun purgeFailureLeavesGalleryUnavailableAndRetryBindsOnlyAfterEveryLayerIsZero() {
        val coordinator = IdentityCoordinatorContract()
        coordinator.failNextPurge = true

        assertFalse(coordinator.transition(oldOwner = "A", newOwner = "B"))
        assertFalse(coordinator.ownerEligible("B"))
        assertEquals("purge_incomplete", coordinator.unavailableReason)

        assertTrue(coordinator.retryPurgeAndBind("B"))
        assertTrue(coordinator.ownerEligible("B"))
        assertEquals(2, coordinator.generation)
    }

    @Test
    fun identityCoordinatorProductionContractIsAwaitingPlan1214() {
        val missing = listOf(
            "space.fishhub.android.data.chat.sharedcontent.SharedContentIdentityCoordinator",
            "space.fishhub.android.data.chat.sharedcontent.IdentityGeneration",
        ).filterNot(::productionSymbolExists)

        assertTrue(
            "RED: missing SharedContentIdentityCoordinator purge contract: $missing",
            missing.isEmpty(),
        )
    }

    @Test
    fun productionCoordinatorPublishesOnlyAfterOrderedVerifiedPurge() = runBlocking {
        val port = RecordingPurgePort()
        val coordinator = SharedContentIdentityCoordinator(port)

        assertTrue(coordinator.transitionTo("A"))
        assertTrue(coordinator.transitionTo("B"))

        assertEquals(
            listOf(
                "store",
                "tasks",
                "leases",
                "decoded",
                "metadata",
                "sweep",
                "thumbnails",
                "temp",
                "verify",
            ),
            port.operations.takeLast(9),
        )
        assertFalse(coordinator.accepts("A", 1))
        assertTrue(coordinator.accepts("B", coordinator.currentState.generation))
        assertEquals(SharedContentIdentityStatus.ELIGIBLE, coordinator.currentState.status)
    }

    @Test
    fun productionCoordinatorMakesPurgeFailureUnavailableUntilExplicitRetry() = runBlocking {
        val port = RecordingPurgePort().apply { verify = false }
        val coordinator = SharedContentIdentityCoordinator(port)

        assertFalse(coordinator.transitionTo("A"))
        assertEquals(SharedContentIdentityStatus.UNAVAILABLE, coordinator.currentState.status)
        assertFalse(coordinator.currentState.isGalleryEligible)

        port.verify = true
        assertTrue(coordinator.retryPurgeAndBind("A"))
        assertEquals(SharedContentIdentityStatus.ELIGIBLE, coordinator.currentState.status)
        assertEquals(2L, coordinator.currentState.generation.value)
    }

    @Test
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    fun accountSwitchFencesDelayedRuntimeLeaseAndBindsOnlyAfterRegistryIsZero() = runTest {
        val refreshStarted = CompletableDeferred<Unit>()
        val refreshResult = CompletableDeferred<ChatResult<List<AttachmentDelivery>>>()
        val runtime = ChatDataModule.SharedContentGalleryRuntime(
            repository = UnconfiguredChatRepository,
            thumbnailStore = null,
            refreshAttachmentUrls = {
                refreshStarted.complete(Unit)
                refreshResult.await()
            },
        )
        val port = RuntimePurgePort(runtime)
        val coordinator = SharedContentIdentityCoordinator(port)
        assertTrue(coordinator.transitionTo("owner-a"))

        val load = async {
            runtime.loadThumbnail(
                ChatDataModule.SharedContentThumbnailRequest(
                    ownerIdentityId = "owner-a",
                    conversationId = "conversation-a",
                    identityGeneration = coordinator.currentState.generation.value,
                    itemId = "item-a",
                    contentVersion = "version-a",
                    kind = "photo",
                    attachmentId = "attachment-a",
                ),
            )
        }
        refreshStarted.await()
        assertEquals(1, runtime.deliveryRegistryCount("owner-a"))

        val transition = async { coordinator.transitionTo("owner-b") }
        runCurrent()

        assertFalse(transition.isCompleted)
        assertEquals(SharedContentIdentityStatus.PURGING, coordinator.currentState.status)
        assertFalse(coordinator.accepts("owner-b", coordinator.currentState.generation))

        refreshResult.complete(
            ChatResult.Success(
                listOf(
                    AttachmentDelivery(
                        attachmentId = "attachment-a",
                        thumbnailUrl = "https://delivery.example/old-owner",
                        displayUrl = null,
                        expiresAt = Instant.now().plusSeconds(900).toString(),
                    ),
                ),
            ),
        )

        assertNull(load.await())
        assertTrue(transition.await())
        assertTrue(coordinator.accepts("owner-b", coordinator.currentState.generation))
        assertEquals(0, runtime.deliveryRegistryCount())
        assertEquals(0, runtime.deliveryLeaseCount())
        assertTrue(port.observedZeroBeforeBind)
    }

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        Class.forName(symbol)
        true
    }.getOrDefault(false)

    private class IdentityCoordinatorContract {
        var generation = 0
            private set
        var failNextPurge = false
        var unavailableReason: String? = null
            private set
        val operations = mutableListOf<String>()
        private val eligibleOwners = mutableSetOf<String>()
        private var callbackVisibleOwner: String? = null

        fun seedOwner(owner: String) {
            eligibleOwners += owner
            callbackVisibleOwner = owner
        }

        fun transition(oldOwner: String?, newOwner: String?): Boolean {
            generation += 1
            operations += "revoke-generation"
            operations += "hide-state"
            eligibleOwners.remove(oldOwner)
            callbackVisibleOwner = null
            operations += "cancel-tasks"
            operations += "clear-leases"
            operations += "clear-decoded-memory"
            operations += "purge-metadata"
            operations += "purge-thumbnail-root"
            operations += "purge-temp-root"
            if (failNextPurge) {
                failNextPurge = false
                unavailableReason = "purge_incomplete"
                return false
            }
            operations += "verify-zero"
            if (newOwner == null) return false
            operations += "bind-new-owner"
            eligibleOwners += newOwner
            operations += "publish-eligible"
            unavailableReason = null
            return true
        }

        fun retryPurgeAndBind(newOwner: String): Boolean = transition(oldOwner = null, newOwner = newOwner)

        fun ownerEligible(owner: String): Boolean = owner in eligibleOwners

        fun anyOwnerVisible(): Boolean = callbackVisibleOwner != null

        fun acceptCallback(owner: String, callbackGeneration: Int): Boolean =
            callbackGeneration == generation && owner in eligibleOwners

        fun ownerVisibleFromCallback(owner: String): Boolean = callbackVisibleOwner == owner
    }

    private class RecordingPurgePort : SharedContentPurgePort {
        val operations = mutableListOf<String>()
        var verify = true

        override suspend fun revokeSharedContentStore() { operations += "store" }
        override suspend fun cancelTasks() { operations += "tasks" }
        override suspend fun clearLeases(
            ownerIdentityId: String?,
            revokedBeforeGeneration: IdentityGeneration,
        ) {
            operations += "leases"
        }
        override suspend fun clearDecodedMemory() { operations += "decoded" }
        override suspend fun purgeMetadata(ownerIdentityId: String?) { operations += "metadata" }
        override suspend fun sweepNonCurrentNamespaces(currentOwnerIdentityId: String?) {
            operations += "sweep"
        }
        override suspend fun purgeThumbnailRoot(ownerIdentityId: String?): Boolean {
            operations += "thumbnails"
            return true
        }
        override suspend fun purgeTempRoot(ownerIdentityId: String?): Boolean {
            operations += "temp"
            return true
        }
        override suspend fun verifyZero(ownerIdentityId: String?): Boolean {
            operations += "verify"
            return verify
        }
    }

    private class RuntimePurgePort(
        private val runtime: ChatDataModule.SharedContentGalleryRuntime,
    ) : SharedContentPurgePort {
        var observedZeroBeforeBind = false
            private set

        override suspend fun clearLeases(
            ownerIdentityId: String?,
            revokedBeforeGeneration: IdentityGeneration,
        ) {
            runtime.purgeDeliveryRegistries(ownerIdentityId, revokedBeforeGeneration)
        }

        override suspend fun verifyZero(ownerIdentityId: String?): Boolean {
            val zero = runtime.deliveryRegistryCount(ownerIdentityId) == 0 &&
                runtime.deliveryLeaseCount(ownerIdentityId) == 0
            observedZeroBeforeBind = zero
            return zero
        }
    }

    private companion object {
        val EXACT_PURGE_ORDER = listOf(
            "revoke-generation",
            "hide-state",
            "cancel-tasks",
            "clear-leases",
            "clear-decoded-memory",
            "purge-metadata",
            "purge-thumbnail-root",
            "purge-temp-root",
            "verify-zero",
            "bind-new-owner",
            "publish-eligible",
        )
    }
}
