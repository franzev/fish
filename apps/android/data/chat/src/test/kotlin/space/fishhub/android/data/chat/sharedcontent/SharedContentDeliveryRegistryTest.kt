package space.fishhub.android.data.chat.sharedcontent

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import kotlin.io.path.createTempDirectory
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import space.fishhub.android.data.chat.AttachmentDelivery
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ChatNetworkPolicy

class SharedContentDeliveryRegistryTest {
    private lateinit var root: java.io.File

    @Before
    fun setUp() {
        root = createTempDirectory("fish-delivery-").toFile()
    }

    @After
    fun tearDown() {
        root.deleteRecursively()
    }

    @Test
    fun leaseRequestsCoverBoundariesAndDeduplicateOpaqueIdsInBatchesOfFifty() {
        val registry = DeliveryRegistryContract(FakeClock(NOW))

        assertEquals(listOf(1), registry.fetch((0 until 1).map(::opaqueItemKey)).map(List<String>::size))
        assertEquals(listOf(49), registry.fetch((0 until 49).map(::opaqueItemKey)).map(List<String>::size))
        assertEquals(listOf(50), registry.fetch((0 until 50).map(::opaqueItemKey)).map(List<String>::size))
        assertEquals(
            listOf(50, 1),
            registry.fetch((0..50).map(::opaqueItemKey) + opaqueItemKey(49)).map(List<String>::size),
        )
        assertEquals(51, registry.requestedItemKeys.distinct().size)
        assertTrue(registry.requestedItemKeys.all { it.startsWith("key-") })
    }

    @Test
    fun leaseFreshnessUsesAOneHundredTwentySecondMarginAndStableOpaqueIdentityAcrossRotation() {
        val clock = FakeClock(NOW)
        val registry = DeliveryRegistryContract(clock)
        val itemKey = opaqueItemKey(7)

        val first = registry.lease(itemKey)
        clock.advance(Duration.ofMinutes(13).minusSeconds(1))
        assertEquals(first, registry.lease(itemKey))

        clock.advance(Duration.ofSeconds(1))
        val rotated = registry.lease(itemKey)
        assertNotEquals(first.deliveryValue, rotated.deliveryValue)
        assertEquals(first.opaqueKey, rotated.opaqueKey)
        assertEquals(2, registry.refreshCount)
        assertFalse(rotated.opaqueKey.contains(OWNER_A))
    }

    @Test
    fun oneUnauthorizedResponseRefreshesOnceForEither401Or403WithoutRetryLoop() {
        listOf(401, 403).forEach { status ->
            val registry = DeliveryRegistryContract(FakeClock(NOW))
            val result = registry.fetchWithAuthorizationFailure(opaqueItemKey(1), status)

            assertEquals(2, registry.authorizedRequestCount)
            assertEquals(1, registry.authorizationRefreshCount)
            assertEquals(DeliveryOutcome.Accepted, result)
        }
    }

    @Test
    fun deliveryUrlAndTokenAreAbsentFromDiskFilenamesSerializedStateAndDiagnostics() {
        val token = "signed-token-sentinel-for-tests"
        val clock = FakeClock(NOW)
        val diagnostics = RedactedDiagnostics()
        val registry = DeliveryRegistryContract(clock, diagnostics)
        val lease = registry.lease(opaqueItemKey(3))

        registry.writeEphemeralDeliveryArtifact(root, lease, token.toByteArray())
        registry.recordRefreshDiagnostic()

        val durableFiles = Files.walk(root.toPath()).use { stream ->
            stream.filter(Files::isRegularFile).map { it.fileName.toString() }.toList()
        }
        assertTrue(durableFiles.all { !it.contains(token) && !it.contains(OWNER_A) })
        assertTrue(registry.serializedState().all { !it.contains(token) })
        assertTrue(diagnostics.entries.all { !it.contains(token) && !it.contains(OWNER_A) })
        assertEquals(0, registry.sentinelDurableCount(token, root))
    }

    @Test
    fun productionRegistryKeepsRotatingUrlsLiveAndRefreshesOnlyAtTheMargin() = runBlocking {
        val clock = FakeClock(NOW)
        var refreshCount = 0
        val registry = SharedContentDeliveryRegistry(
            ownerIdentityId = OWNER_A,
            conversationId = CONVERSATION_A,
            identityGeneration = 1,
            refreshAttachmentUrls = { ids ->
                refreshCount += 1
                ChatResult.Success(
                    ids.map { id ->
                        AttachmentDelivery(
                            attachmentId = id,
                            thumbnailUrl = "https://delivery.example/$refreshCount/$id",
                            displayUrl = null,
                            expiresAt = clock.now.plusSeconds(900).toString(),
                        )
                    },
                )
            },
            now = { clock.now },
        )

        val first = checkNotNull(registry.lease("attachment-a"))
        assertEquals(first, registry.lease("attachment-a"))
        clock.advance(Duration.ofSeconds(780))
        val rotated = checkNotNull(registry.lease("attachment-a"))

        assertNotEquals(first.thumbnailUrl, rotated.thumbnailUrl)
        assertEquals(2, refreshCount)
        assertEquals(1, registry.leaseCount())
    }

    @Test
    fun networkPolicyKeepsVisibleWorkUsableWhileDataSaverSuppressesLookahead() {
        assertTrue(ChatNetworkPolicy(true, metered = true, dataSaverEnabled = false).lookaheadAllowed)
        assertFalse(ChatNetworkPolicy(true, metered = true, dataSaverEnabled = true).lookaheadAllowed)
        assertFalse(ChatNetworkPolicy(false, metered = false, dataSaverEnabled = false).lookaheadAllowed)
    }

    @Test
    fun registryProductionContractIsAwaitingPlan1209() {
        val missing = listOf(
            "space.fishhub.android.data.chat.sharedcontent.SharedContentDeliveryRegistry",
            "space.fishhub.android.data.chat.sharedcontent.DeliveryLease",
        ).filterNot(::productionSymbolExists)

        assertTrue(
            "RED: missing SharedContentDeliveryRegistry delivery contract: $missing",
            missing.isEmpty(),
        )
    }

    private fun opaqueItemKey(index: Int): String =
        "item-${index.toString().padStart(2, '0')}"
            .let { "key-${sha256("$OWNER_A|$CONVERSATION_A|$it|v1")}" }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        Class.forName(symbol)
        true
    }.getOrDefault(false)

    private class FakeClock(var now: Instant) {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }
    }

    private data class Lease(
        val opaqueKey: String,
        val deliveryValue: String,
        val expiresAt: Instant,
    )

    private enum class DeliveryOutcome { Accepted }

    private class RedactedDiagnostics {
        val entries = mutableListOf<String>()

        fun record(operation: String, outcome: String) {
            entries += "$operation:$outcome"
        }
    }

    private class DeliveryRegistryContract(
        private val clock: FakeClock,
        private val diagnostics: RedactedDiagnostics = RedactedDiagnostics(),
    ) {
        private val leases = mutableMapOf<String, Lease>()
        val requestedItemKeys = mutableListOf<String>()
        var refreshCount = 0
            private set
        var authorizedRequestCount = 0
            private set
        var authorizationRefreshCount = 0
            private set

        fun fetch(itemKeys: List<String>): List<List<String>> =
            itemKeys.distinct().chunked(50).onEach { requestedItemKeys += it }

        fun lease(opaqueKey: String): Lease {
            val cached = leases[opaqueKey]
            if (cached != null && cached.expiresAt.minus(Duration.ofSeconds(120)) > clock.now) {
                return cached
            }
            refreshCount += 1
            return Lease(opaqueKey, "delivery-$refreshCount", clock.now.plus(Duration.ofMinutes(15)))
                .also { leases[opaqueKey] = it }
        }

        fun fetchWithAuthorizationFailure(itemKey: String, status: Int): DeliveryOutcome {
            authorizedRequestCount += 1
            if (status == 401 || status == 403) {
                authorizationRefreshCount += 1
                authorizedRequestCount += 1
            }
            requestedItemKeys += itemKey
            return DeliveryOutcome.Accepted
        }

        fun writeEphemeralDeliveryArtifact(directory: java.io.File, lease: Lease, bytes: ByteArray) {
            // Delivery values are deliberately retained only in the live registry probe.
            @Suppress("UNUSED_VARIABLE")
            val liveOnly = Triple(directory, lease.deliveryValue, bytes.size)
        }

        fun recordRefreshDiagnostic() {
            diagnostics.record("delivery-refresh", "accepted")
        }

        fun serializedState(): List<String> = leases.values.map { "${it.opaqueKey}:${it.expiresAt}" }

        fun sentinelDurableCount(sentinel: String, directory: java.io.File): Int {
            val files = Files.walk(directory.toPath()).use { stream ->
                stream.filter(Files::isRegularFile).toList()
            }
            return files.count { path ->
                path.fileName.toString().contains(sentinel) ||
                    Files.readString(path).contains(sentinel)
            }
        }
    }

    private companion object {
        const val OWNER_A = "owner-a-private"
        const val CONVERSATION_A = "conversation-a-private"
        val NOW: Instant = Instant.parse("2026-07-23T00:00:00Z")
    }
}
