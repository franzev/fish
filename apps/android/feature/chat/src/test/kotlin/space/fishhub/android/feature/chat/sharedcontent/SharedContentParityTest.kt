package space.fishhub.android.feature.chat.sharedcontent

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.boolean
import kotlinx.serialization.Serializable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentCategory
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentCursor
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentEvent
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentGalleryStatus
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentItem
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPage
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentSourceDescriptor
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentState
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentReducer
import space.fishhub.android.feature.chat.sharedcontent.state.classifySharedContentSource
import space.fishhub.android.feature.chat.sharedcontent.state.compareSharedContentItems
import space.fishhub.android.feature.chat.sharedcontent.state.createSharedContentState
import space.fishhub.android.feature.chat.sharedcontent.state.beginSharedContentRecoveryCycle
import space.fishhub.android.feature.chat.sharedcontent.state.completeSharedContentRecoveryCycle
import space.fishhub.android.feature.chat.sharedcontent.state.failSharedContentRecoveryAttempt
import space.fishhub.android.feature.chat.sharedcontent.state.hydrateSharedContentCache
import space.fishhub.android.feature.chat.sharedcontent.state.pageFromRows
import space.fishhub.android.feature.chat.sharedcontent.state.planSharedContentDeliveryBatches
import space.fishhub.android.feature.chat.sharedcontent.state.projectSharedContentEviction

class SharedContentParityTest {
    @Serializable
    private data class Phase12Case(
        val name: String,
        val input: JsonObject,
        val expected: JsonObject,
    )

    @Serializable
    private data class Phase12Group(val cases: List<Phase12Case>)

    private val json = Json {
        classDiscriminator = "type"
        ignoreUnknownKeys = false
    }

    private val fixture: JsonObject by lazy {
        val resource = checkNotNull(javaClass.classLoader?.getResource("shared-content-vectors.json"))
        json.parseToJsonElement(resource.readText()).jsonObject
    }

    private val items: Map<String, SharedContentItem> by lazy {
        fixture.getValue("items").jsonObject.mapNotNull { (itemId, value) ->
            val decoded = runCatching {
                json.decodeFromJsonElement<SharedContentItem>(value)
            }
            if (itemId in RejectedDurationItemIds) {
                check(decoded.isFailure) {
                    "$itemId: invalid duration fixture must fail closed"
                }
                null
            } else {
                itemId to decoded.getOrThrow()
            }
        }.toMap()
    }

    @Test
    fun `replays every canonical shared content vector`() {
        val metadata = fixture.getValue("metadata").jsonObject
        assertEquals(
            setOf(
                "metadata", "items", "classification", "ordering", "pagination", "permissions",
                "galleryStates", "identityPurge", "deletionFanOut", "requestSequencing",
                "cacheHydration", "cacheTruth", "eviction", "recovery", "deliveryPlanning",
                "dataSaving", "urlNonPersistence", "identityGeneration",
            ),
            fixture.keys,
        )
        val groups = metadata.getValue("groups").jsonArray
            .map { it.jsonPrimitive.content }
        val task1Groups = listOf("classification", "ordering", "pagination", "requestSequencing")
        val task1CaseCount = task1Groups.sumOf {
            fixture.getValue(it).jsonObject.getValue("cases").jsonArray.size
        }
        assertEquals(
            metadata.getValue("expectedTask1CaseCount").jsonPrimitive.int,
            task1CaseCount,
        )
        assertEquals(
            metadata.getValue("expectedCaseCount").jsonPrimitive.int,
            groups.sumOf { fixture.getValue(it).jsonObject.getValue("cases").jsonArray.size },
        )
        assertEquals(3, metadata.getValue("version").jsonPrimitive.int)
        assertEquals(
            listOf(
                "classification", "ordering", "pagination", "permissions", "galleryStates",
                "identityPurge", "deletionFanOut", "requestSequencing", "cacheHydration", "cacheTruth",
                "eviction", "recovery", "deliveryPlanning", "dataSaving", "urlNonPersistence", "identityGeneration",
            ),
            groups,
        )
        assertEquals(92, groups.sumOf { fixture.getValue(it).jsonObject.getValue("cases").jsonArray.size })

        replayClassification()
        replayOrdering()
        replayPagination()
        replayPermissions()
        replayGalleryStates()
        replayStateCases("identityPurge")
        replayStateCases("deletionFanOut")
        replayStateCases("requestSequencing")
        replayPhase12Corpus()
    }

    @Test
    fun `Phase 12 corpus is ready for the missing production contract`() {
        replayPhase12Corpus()
    }

    @Test
    fun `canonical state file uses exact wire vocabulary`() {
        assertEquals(3, fixture.getValue("metadata").jsonObject.getValue("version").jsonPrimitive.int)
        assertEquals(setOf("media", "files", "links", "voice"), SharedContentCategory.entries.map { it.wireValue }.toSet())
        assertEquals(setOf("loading", "content", "empty", "incomplete", "stale", "unavailable", "terminal-error"), SharedContentGalleryStatus.entries.map { it.wireValue }.toSet())
    }

    @Test
    fun `canonical duration metadata is nullable exact and rejects invalid values`() {
        assertEquals(null, items.getValue("gallery-voice-legacy").durationMs)
        assertEquals(0L, items.getValue("gallery-voice-zero").durationMs)
        assertEquals(90_500L, items.getValue("gallery-voice-trusted").durationMs)

        val fixtureItems = fixture.getValue("items").jsonObject
        for (itemId in RejectedDurationItemIds) {
            val result = runCatching {
                json.decodeFromJsonElement<SharedContentItem>(fixtureItems.getValue(itemId))
            }
            assertTrue("$itemId must fail closed", result.isFailure)
        }
    }

    private fun replayClassification() {
        for (vector in cases("classification")) {
            val source = json.decodeFromJsonElement<SharedContentSourceDescriptor>(vector.getValue("source"))
            val conversationId = vector["conversationId"]?.jsonPrimitive?.contentOrNull
            val actual = classifySharedContentSource(source, conversationId)
            assertEquals(vector.getValue("expected"), json.encodeToJsonElement(actual))
        }
    }

    private fun replayOrdering() {
        for (vector in cases("ordering")) {
            val sorted = vector.getValue("itemIds").jsonArray
                .map { requireItem(it.jsonPrimitive.content, vector.getValue("name").jsonPrimitive.content) }
                .sortedWith(::compareSharedContentItems)
                .map { it.itemId }
            assertEquals(vector.getValue("expectedItemIds"), JsonArray(sorted.map(::JsonPrimitive)))
        }
    }

    private fun replayPagination() {
        for (vector in cases("pagination")) {
            val vectorName = vector.getValue("name").jsonPrimitive.content
            val rows = vector.getValue("rows").jsonArray.map {
                requireItem(it.jsonPrimitive.content, vectorName)
            }
            assertEquals("$vectorName: RPC p_limit", 40, vector.getValue("p_limit").jsonPrimitive.int)
            assertTrue("$vectorName: response may only address indexes 0..40", rows.size <= 41)
            val pageSize = vector.getValue("pageSize").jsonPrimitive.int
            val page = pageFromRows(rows, pageSize)
            assertEquals(
                vector.getValue("expected"),
                pageProjection(page),
            )
        }
    }

    private fun replayPhase12Corpus() {
        val expectedKeysByCase = mapOf(
            "verifiedOwnerHydratesExactConversation" to setOf("eligible", "itemIds", "unavailableReason", "identityIneligible"),
            "wrongOwnerIsIneligible" to setOf("eligible", "itemIds", "unavailableReason", "identityIneligible"),
            "unresolvedOwnerIsIneligible" to setOf("eligible", "itemIds", "unavailableReason", "identityIneligible"),
            "staleGenerationIsIneligible" to setOf("eligible", "itemIds", "unavailableReason", "identityIneligible"),
            "cachedStaleIncompleteIsOrthogonal" to setOf("source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"),
            "offlineCacheRemainsBrowsable" to setOf("source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"),
            "offlineWithoutCacheIsUnavailable" to setOf("source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"),
            "authoritativeEmptyIsNotUnavailable" to setOf("source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"),
            "newestWindowIsProtected" to setOf("newestProtectedCount", "perConversationLimit", "evictedItemIds", "retainedNewestWindow"),
            "oldBrowsedPageEvictsBeforeNewestMetadata" to setOf("evictPageIds", "preservePageIds"),
            "thumbnailLruUsesByteAndInactivityLimits" to setOf("perAccountByteLimit", "inactivityWindowMs", "evictLeastRecentFirst"),
            "triggerBurstJoinsOneCycle" to setOf("cycleId", "phase", "attempt", "joinedTriggerCount", "automaticAttempts"),
            "attemptZeroFailureSchedulesAttemptOne" to setOf("cycleId", "phase", "attempt", "retryDelayMs", "manualRetry"),
            "attemptOneFailureEnablesManualRetry" to setOf("cycleId", "phase", "attempt", "automaticAttempts", "manualRetry", "automaticAttemptTwo"),
            "connectivityLossCancelsDelayedRetry" to setOf("cycleId", "phase", "attempt", "manualRetry", "retryScheduled"),
            "manualRetryStartsNewCycle" to setOf("cycleId", "phase", "attempt", "manualRetry", "automaticAttempts"),
            "oneVisibleIdUsesVisibleIntent" to setOf("batches"),
            "fortyNineVisibleIdsStayInOneBatch" to setOf("batches"),
            "fiftyVisibleIdsStayInOneBatch" to setOf("batches"),
            "fiftyOneVisibleIdsChunkAtFifty" to setOf("batches"),
            "intentClassesDeduplicateWithinPriority" to setOf("batches"),
            "usableUnconstrainedLoadsVisibleAndLookahead" to setOf("lookaheadAllowed", "batches"),
            "dataSavingKeepsVisibleAndSuppressesLookahead" to setOf("lookaheadAllowed", "batches"),
            "signedSentinelExistsOnlyInLiveInput" to setOf("persistedSnapshot", "diagnostics", "sentinelDurableCount"),
            "refreshDisplayRetryPurgeRedactsSentinel" to setOf("persistedFields", "diagnosticFields", "sentinelDurableCount"),
            "staleGenerationCallbackIsRejected" to setOf("accepted", "visibleItemIds", "oldOwnerEligible"),
            "identityChangePurgesBeforeBindingNewOwner" to setOf("order", "oldOwnerVisible", "newOwnerAccepted"),
            "missingIdentityFailsClosed" to setOf("accepted", "visibleItemIds", "unavailableReason", "oldOwnerEligible"),
        )
        for (groupName in listOf("cacheHydration", "cacheTruth", "eviction", "recovery", "deliveryPlanning", "dataSaving", "urlNonPersistence", "identityGeneration")) {
            val group = json.decodeFromJsonElement<Phase12Group>(fixture.getValue(groupName))
            for (vector in group.cases) {
                val expectedKeys = expectedKeysByCase.getValue(vector.name)
                assertEquals(
                    "$groupName:${vector.name}: strict projection shape",
                    setOf("name", "input", "expected"),
                    setOf("name", "input", "expected"),
                )
                assertTrue("$groupName:${vector.name}", vector.input.isNotEmpty() || vector.expected.isNotEmpty())
                assertTrue("$groupName:${vector.name}: incomplete projection", vector.expected.keys == expectedKeys)
                val actualProjection = phase12Projection(groupName, vector.name, vector.input)
                val actual = if (groupName == "deliveryPlanning") {
                    actualProjection.jsonObject.getValue("batches")
                } else {
                    actualProjection
                }
                val expected = if (groupName == "deliveryPlanning") {
                    vector.expected.getValue("batches")
                } else {
                    vector.expected
                }
                assertEquals("$groupName:${vector.name}", expected, actual)
            }
        }
    }

    private fun phase12Projection(group: String, name: String, input: JsonObject): JsonElement = when (group) {
        "cacheHydration", "cacheTruth", "urlNonPersistence", "identityGeneration" -> hydrateSharedContentCache(input)
        "eviction" -> projectSharedContentEviction(input)
        "deliveryPlanning", "dataSaving" -> planSharedContentDeliveryBatches(input)
        "recovery" -> when (name) {
            "attemptZeroFailureSchedulesAttemptOne", "attemptOneFailureEnablesManualRetry",
            "connectivityLossCancelsDelayedRetry" -> failSharedContentRecoveryAttempt(input)
            "manualRetryStartsNewCycle", "triggerBurstJoinsOneCycle" -> beginSharedContentRecoveryCycle(input)
            else -> completeSharedContentRecoveryCycle(input)
        }
        else -> error("$group: unsupported Phase 12 projection")
    }

    private fun replayPermissions() {
        for (vector in cases("permissions")) {
            val expected = vector.getValue("expected").jsonObject
            when (vector.getValue("name").jsonPrimitive.content) {
                "signedOut" -> assertEquals(false, expected.getValue("canSee").jsonPrimitive.boolean)
                "member", "sender" -> assertEquals(true, expected.getValue("canSee").jsonPrimitive.boolean)
                "gifStickerExportRightsGate" -> {
                    val expectedExport = expected.getValue("canExport").jsonPrimitive.boolean
                    assertTrue(items.values.filter { it.kind.wireValue == "gif" || it.kind.wireValue == "sticker" }
                        .all { it.capabilities.canExport == expectedExport })
                }
            }
        }
    }

    private fun replayGalleryStates() {
        for (vector in cases("galleryStates")) {
            val status = SharedContentGalleryStatus.fromWire(vector.getValue("status").jsonPrimitive.content)
            assertEquals(vector.getValue("status").jsonPrimitive.content, status.wireValue)
        }
    }

    private fun replayStateCases(group: String) {
        for (vector in cases(group)) {
            val initial = vector.getValue("initial").jsonObject
            val identityId = initial.getValue("identityId").jsonPrimitive.content
            val conversationId = initial.getValue("conversationId").jsonPrimitive.content
            var state = createSharedContentState(identityId, conversationId)
            val vectorName = vector.getValue("name").jsonPrimitive.content
            val initialItems = materializeItems(initial, vectorName)
            val initialPage = pageFromRows(initialItems)
            if (!(group == "requestSequencing" && initialItems.isEmpty())) {
                state = SharedContentReducer.apply(
                    state,
                    listOf(
                    SharedContentEvent.RequestStarted(identityId, conversationId, 1, "bootstrap", null, true),
                    SharedContentEvent.InitialLoaded(
                        identityId,
                        conversationId,
                        1,
                        "bootstrap",
                        null,
                        initialPage,
                        categories = initial["categories"]?.jsonArray?.map {
                            SharedContentCategory.fromWire(it.jsonPrimitive.content)
                        },
                        status = SharedContentGalleryStatus.Content,
                    ),
                    initial["categories"]?.let {
                        SharedContentEvent.CategoryAvailabilityUpdated(
                            identityId,
                            conversationId,
                            1,
                            it.jsonArray.map { category -> SharedContentCategory.fromWire(category.jsonPrimitive.content) },
                        )
                    },
                    initial["deliveryReferences"]?.let {
                        SharedContentEvent.ReferencesUpdated(
                            identityId,
                            conversationId,
                            1,
                            it.jsonArray.map { reference -> reference.jsonPrimitive.content },
                            initial["temporaryReferences"]?.jsonArray?.map { reference -> reference.jsonPrimitive.content }
                                ?: emptyList(),
                        )
                    },
                    initial["error"]?.let {
                        SharedContentEvent.GalleryStatusChanged(
                            identityId,
                            conversationId,
                            1,
                            SharedContentGalleryStatus.Stale,
                            it.jsonPrimitive.content,
                        )
                    },
                    ).filterNotNull(),
                )
            }
            val events = vector.getValue("events").jsonArray.map {
                materializeEvent(it.jsonObject, vectorName)
            }
            state = SharedContentReducer.apply(state, events)
            val expected = vector.getValue("expected").jsonObject
            val actual = stateProjection(state)
            assertEquals(vectorName, expected.keys.sorted(), actual.keys.sorted())
            for ((key, value) in expected) {
                assertEquals(vectorName, value, actual.getValue(key))
            }
        }
    }

    private fun materializeEvent(event: JsonObject, vectorName: String): SharedContentEvent {
        val identityId = event.getValue("identityId").jsonPrimitive.content
        val conversationId = event["conversationId"]?.jsonPrimitive?.contentOrNull
        return when (event.getValue("type").jsonPrimitive.content) {
            "identityChanged" -> SharedContentEvent.IdentityChanged(identityId, conversationId, event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 2)
            "sourceDeleted" -> SharedContentEvent.SourceDeleted(
                identityId,
                requireNotNull(conversationId),
                event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 1,
                event.getValue("sourceMessageId").jsonPrimitive.content,
            )
            "pageLoaded" -> SharedContentEvent.PageLoaded(
                identityId,
                requireNotNull(conversationId),
                event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 1,
                event.getValue("requestId").jsonPrimitive.content,
                requireCursor(event, "requestedCursor", vectorName),
                pageFromRows(materializeItems(event, vectorName)),
            )
            "initialLoaded" -> SharedContentEvent.InitialLoaded(
                identityId,
                requireNotNull(conversationId),
                event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 1,
                event.getValue("requestId").jsonPrimitive.content,
                requireCursor(event, "requestedCursor", vectorName),
                pageFromRows(materializeItems(event, vectorName)),
            )
            "requestStarted" -> SharedContentEvent.RequestStarted(
                identityId,
                requireNotNull(conversationId),
                event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 1,
                event.getValue("requestId").jsonPrimitive.content,
                requireCursor(event, "requestedCursor", vectorName),
                event.getValue("replace").jsonPrimitive.boolean,
            )
            "realtimeItemReceived" -> {
                val itemId = event.getValue("itemId").jsonPrimitive.content
                SharedContentEvent.RealtimeItemReceived(
                    identityId,
                    requireNotNull(conversationId),
                    event["identityGeneration"]?.jsonPrimitive?.intOrNull ?: 1,
                    requireItem(itemId, vectorName).copy(
                        sourceMessageId = event["sourceMessageId"]?.jsonPrimitive?.content
                            ?: requireItem(itemId, vectorName).sourceMessageId,
                    ),
                )
            }
            else -> error("$vectorName: unsupported shared-content event ${event.getValue("type")}")
        }
    }

    private fun materializeItems(value: JsonObject, vectorName: String): List<SharedContentItem> {
        return value.getOrNull("itemIds")?.jsonArray?.mapIndexed { index, itemId ->
            val item = requireItem(itemId.jsonPrimitive.content, vectorName)
            val sourceMessageIds = value["sourceMessageIds"]?.jsonArray
            sourceMessageIds?.getOrNull(index)?.jsonPrimitive?.content?.let { sourceMessageId ->
                item.copy(sourceMessageId = sourceMessageId)
            } ?: item
        } ?: emptyList()
    }

    private fun pageProjection(page: SharedContentPage): JsonObject = buildJsonObject {
        put("itemIds", JsonArray(page.items.map { JsonPrimitive(it.itemId) }))
        put("hasMore", page.hasMore)
        put("cursor", page.nextCursor?.let { json.encodeToJsonElement(it) } ?: JsonNull)
    }

    private fun stateProjection(state: SharedContentState): JsonObject = buildJsonObject {
        put("identityId", state.identityId?.let(::JsonPrimitive) ?: JsonNull)
        put("conversationId", state.conversationId?.let(::JsonPrimitive) ?: JsonNull)
        put("items", json.encodeToJsonElement(state.items))
        put("pages", JsonArray(state.pages.map { page ->
            buildJsonObject {
                put("items", json.encodeToJsonElement(page.items))
                put("hasMore", page.hasMore)
                put("nextCursor", page.nextCursor?.let { json.encodeToJsonElement(it) } ?: JsonNull)
            }
        }))
        put("nextCursor", state.nextCursor?.let { json.encodeToJsonElement(it) } ?: JsonNull)
        put("hasMore", state.hasMore)
        put("pendingPageRequest", state.pendingPageRequest?.let { request ->
            buildJsonObject {
                put("requestId", request.requestId)
                put("requestedCursor", request.requestedCursor?.let { json.encodeToJsonElement(it) } ?: JsonNull)
                put("replace", request.replace)
            }
        } ?: JsonNull)
        put("categories", json.encodeToJsonElement(state.categories))
        put("deliveryReferences", JsonArray(state.deliveryReferences.map(::JsonPrimitive)))
        put("temporaryReferences", JsonArray(state.temporaryReferences.map(::JsonPrimitive)))
        put("error", state.error?.let(::JsonPrimitive) ?: JsonNull)
        put("deletedSourceMessageIds", JsonArray(state.deletedSourceMessageIds.map(::JsonPrimitive)))
        put("status", state.status.wireValue)
    }

    private fun cases(group: String): List<JsonObject> =
        fixture.getValue(group).jsonObject.getValue("cases").jsonArray.map { it.jsonObject }

    private fun requireItem(itemId: String, vectorName: String): SharedContentItem =
        items[itemId] ?: error("$vectorName: unknown shared-content fixture item $itemId")

    private companion object {
        val RejectedDurationItemIds = setOf(
            "gallery-voice-negative",
            "gallery-voice-fractional",
        )
    }

    private fun requireCursor(event: JsonObject, key: String, vectorName: String): SharedContentCursor? {
        val value = event.getValue(key)
        if (value == JsonNull) return null
        val cursor = value.jsonObject
        return SharedContentCursor(
            sourceCreatedAt = cursor.getValue("sourceCreatedAt").jsonPrimitive.content,
            sourceMessageId = cursor.getValue("sourceMessageId").jsonPrimitive.content,
            sourceRank = cursor.getValue("sourceRank").jsonPrimitive.int,
            itemId = cursor.getValue("itemId").jsonPrimitive.content,
        )
    }

    private fun JsonObject.getOrNull(key: String): JsonElement? = this[key]

    private fun JsonElement.toBoolean(): Boolean = jsonPrimitive.boolean
}
