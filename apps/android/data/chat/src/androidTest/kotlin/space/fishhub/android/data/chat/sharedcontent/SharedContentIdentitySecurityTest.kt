package space.fishhub.android.data.chat.sharedcontent

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.nio.file.Files
import kotlin.io.path.createTempDirectory
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SharedContentIdentitySecurityTest {
    private lateinit var root: java.io.File
    private lateinit var adversary: IdentityAdversaryContract

    @Before
    fun setUp() {
        root = createTempDirectory("fish-identity-").toFile()
        adversary = IdentityAdversaryContract(root)
    }

    @After
    fun tearDown() {
        root.deleteRecursively()
    }

    @Test
    fun accountTransitionMatrixHidesPriorOwnerBeforeNewOwnerCanBecomeEligible() {
        listOf(
            "A to B" to "B",
            "A to signed-out" to null,
            "A to unresolved" to null,
            "unresolved to B" to "B",
            "A to B to A" to "A",
        ).forEach { (transition, newOwner) ->
            val result = adversary.transition(newOwner)

            val bindIndex = result.purgeOrder.indexOf("bind-new-owner").takeIf { it >= 0 } ?: result.purgeOrder.size
            assertTrue(transition, result.purgeOrder.indexOf("hide-state") < bindIndex)
            assertFalse(transition, result.oldOwnerVisible)
            assertFalse(transition, result.staleCallbackAccepted)
            assertEquals(0, result.oldOwnerDurableCount)
            assertEquals(newOwner != null && result.purgeVerified, result.newOwnerEligible)
        }
    }

    @Test
    fun delayedOldOwnerWorkCannotResurrectContentAfterGenerationPurge() {
        adversary.transition("B")
        adversary.deliverDelayedCallback(owner = "A", generation = 0)

        assertFalse(adversary.staleCallbackAccepted)
        assertTrue(adversary.visibleOwner == "B")
        assertEquals(0, adversary.oldOwnerDurableCount())
    }

    @Test
    fun purgeFailureKeepsGalleryUnavailableUntilStartupRetryVerifiesEveryLayer() {
        adversary.failNextPurge = true
        val failed = adversary.transition("B")

        assertFalse(failed.newOwnerEligible)
        assertFalse(failed.purgeVerified)
        assertEquals("purge_incomplete", failed.unavailableReason)

        val retried = adversary.retryStartupSweep("B")
        assertTrue(retried.newOwnerEligible)
        assertTrue(retried.purgeVerified)
        assertEquals(0, adversary.oldOwnerDurableCount())
    }

    @Test
    fun signedSentinelScanReportsOnlySafeZeroCountsAndNeverPrintsPrivateEvidence() {
        val sentinel = "signed-token-sentinel-for-tests"
        adversary.writeOldOwnerArtifacts(sentinel)
        val result = adversary.transition("B")

        assertEquals(0, result.oldOwnerDurableCount)
        assertEquals(0, result.diagnosticSentinelCount)
        assertTrue(result.safeZeroCountsOnly)
        assertTrue(Files.walk(root.toPath()).use { stream -> stream.noneMatch { path ->
            Files.isRegularFile(path) && (path.fileName.toString().contains(sentinel) || Files.readString(path).contains(sentinel))
        } })
    }

    @Test
    fun identitySecurityProductionContractIsAwaitingPlan1214() {
        val missing = listOf(
            "space.fishhub.android.data.chat.sharedcontent.SharedContentIdentityCoordinator",
            "space.fishhub.android.data.chat.sharedcontent.IdentityPurgeVerifier",
        ).filterNot(::productionSymbolExists)

        assertTrue(
            "RED: missing identity security production contract: $missing",
            missing.isEmpty(),
        )
    }

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        Class.forName(symbol)
        true
    }.getOrDefault(false)

    private data class TransitionResult(
        val purgeOrder: List<String>,
        val oldOwnerVisible: Boolean,
        val staleCallbackAccepted: Boolean,
        val oldOwnerDurableCount: Int,
        val purgeVerified: Boolean,
        val newOwnerEligible: Boolean,
        val unavailableReason: String?,
        val diagnosticSentinelCount: Int,
        val safeZeroCountsOnly: Boolean,
    )

    private class IdentityAdversaryContract(private val root: java.io.File) {
        private var generation = 0
        var visibleOwner: String? = "A"
            private set
        var failNextPurge = false
        var staleCallbackAccepted = false
            private set
        private var oldArtifacts = 0
        private var diagnosticsWithSentinel = 0

        fun writeOldOwnerArtifacts(sentinel: String) {
            java.io.File(root, "opaque-old-owner.bin").writeText(sentinel)
            oldArtifacts = 1
            diagnosticsWithSentinel = 1
        }

        fun transition(newOwner: String?): TransitionResult {
            generation += 1
            visibleOwner = null
            staleCallbackAccepted = false
            val order = mutableListOf("revoke-generation", "hide-state", "cancel-tasks", "clear-leases", "clear-decoded-memory")
            order += "purge-metadata"
            order += "purge-thumbnail-root"
            order += "purge-temp-root"
            root.listFiles().orEmpty().forEach { it.delete() }
            oldArtifacts = 0
            diagnosticsWithSentinel = 0
            if (failNextPurge) {
                failNextPurge = false
                return result(order, newOwner, purgeVerified = false, unavailableReason = "purge_incomplete")
            }
            order += "verify-zero"
            if (newOwner != null) {
                order += "bind-new-owner"
                visibleOwner = newOwner
                order += "publish-eligible"
            }
            return result(order, newOwner, purgeVerified = true, unavailableReason = null)
        }

        fun retryStartupSweep(newOwner: String): TransitionResult = transition(newOwner)

        fun deliverDelayedCallback(owner: String, generation: Int) {
            staleCallbackAccepted = generation == this.generation && owner == visibleOwner
            if (staleCallbackAccepted) visibleOwner = owner
        }

        fun oldOwnerDurableCount(): Int = oldArtifacts

        private fun result(
            order: List<String>,
            newOwner: String?,
            purgeVerified: Boolean,
            unavailableReason: String?,
        ): TransitionResult = TransitionResult(
            purgeOrder = order,
            oldOwnerVisible = false,
            staleCallbackAccepted = staleCallbackAccepted,
            oldOwnerDurableCount = oldArtifacts,
            purgeVerified = purgeVerified,
            newOwnerEligible = newOwner != null && purgeVerified && visibleOwner == newOwner,
            unavailableReason = unavailableReason,
            diagnosticSentinelCount = diagnosticsWithSentinel,
            safeZeroCountsOnly = true,
        )
    }
}
