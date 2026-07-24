import ChatCore
import Foundation
import Testing
import TestSupport

struct SharedContentContractTests {
    @Test func canonicalCorpusReplaysAcrossThePortableContract() throws {
        let vectors = try SharedContentVectors.load()
        let task1Count = vectors.classification.count
            + vectors.ordering.count
            + vectors.pagination.count
            + vectors.requestSequencing.count
        let totalCount = task1Count
            + vectors.permissions.count
            + vectors.galleryStates.count
            + vectors.identityPurge.count
            + vectors.deletionFanOut.count
            + vectors.cacheHydration.count
            + vectors.cacheTruth.count
            + vectors.eviction.count
            + vectors.recovery.count
            + vectors.deliveryPlanning.count
            + vectors.dataSaving.count
            + vectors.urlNonPersistence.count
            + vectors.identityGeneration.count

        #expect(vectors.metadata.version == 3)
        #expect(vectors.metadata.groups == [
            "classification",
            "ordering",
            "pagination",
            "permissions",
            "galleryStates",
            "identityPurge",
            "deletionFanOut",
            "requestSequencing",
            "cacheHydration",
            "cacheTruth",
            "eviction",
            "recovery",
            "deliveryPlanning",
            "dataSaving",
            "urlNonPersistence",
            "identityGeneration",
        ])
        #expect(task1Count == vectors.metadata.expectedTask1CaseCount)
        #expect(totalCount == vectors.metadata.expectedCaseCount)
        #expect(task1Count == 48)
        #expect(totalCount == 92)

        for vector in vectors.classification {
            #expect(
                classifySharedContentSource(vector.source, conversationId: vector.conversationId) == vector.expected,
                Comment(rawValue: vector.name)
            )
        }
        for vector in vectors.ordering {
            let sorted = try vector.itemIds
                .map { try requireFixtureItem($0, vectorName: vector.name, vectors: vectors) }
                .sorted(by: compareSharedContentItems)
            #expect(sorted.map(\.itemId) == vector.expectedItemIds, Comment(rawValue: vector.name))
        }
        for vector in vectors.pagination {
            #expect(vector.pLimit == 40, Comment(rawValue: "\(vector.name): RPC p_limit"))
            #expect(vector.rows.count <= 41, Comment(rawValue: "\(vector.name): response may only address indexes 0..40"))
            let page = try pageFromRows(
                vector.rows.map { try requireFixtureItem($0, vectorName: vector.name, vectors: vectors) },
                pageSize: vector.pageSize
            )
            #expect(page.items.map(\.itemId) == vector.expected.itemIds, Comment(rawValue: vector.name))
            #expect(page.hasMore == vector.expected.hasMore, Comment(rawValue: vector.name))
            #expect(page.nextCursor == vector.expected.cursor, Comment(rawValue: vector.name))
        }
        for vector in vectors.permissions {
            if let permissionItems = vector.items {
                for permissionItem in permissionItems {
                    let matching = vectors.items.values.filter { $0.kind == permissionItem.kind }
                    #expect(
                        matching.allSatisfy {
                            $0.capabilities.canExport == permissionItem.canExport
                        },
                        Comment(rawValue: vector.name)
                    )
                }
            }
            #expect(
                vector.expected["canExport"] != nil || vector.expected["canSee"] != nil,
                Comment(rawValue: vector.name)
            )
        }
        for vector in vectors.galleryStates {
            let status = try #require(
                SharedContentGalleryStatus(rawValue: vector.status),
                Comment(rawValue: "\(vector.name): unknown gallery status \(vector.status)")
            )
            #expect(status.rawValue == vector.status, Comment(rawValue: vector.name))
        }
        for vector in vectors.identityPurge + vectors.deletionFanOut {
            try replay(vector, vectors: vectors, group: "state")
        }
        for vector in vectors.requestSequencing {
            try replay(vector, vectors: vectors, group: "requestSequencing")
        }

        try replayPhase12Corpus(vectors)
    }

    @Test func phase12CorpusReplaysProductionContract() throws {
        let vectors = try SharedContentVectors.load()
        try replayPhase12Corpus(vectors)
    }

    private func replayPhase12Corpus(_ vectors: SharedContentVectors) throws {
        let expectedKeysByCase: [String: Set<String>] = [
            "verifiedOwnerHydratesExactConversation": ["eligible", "itemIds", "unavailableReason", "identityIneligible"],
            "wrongOwnerIsIneligible": ["eligible", "itemIds", "unavailableReason", "identityIneligible"],
            "unresolvedOwnerIsIneligible": ["eligible", "itemIds", "unavailableReason", "identityIneligible"],
            "staleGenerationIsIneligible": ["eligible", "itemIds", "unavailableReason", "identityIneligible"],
            "cachedStaleIncompleteIsOrthogonal": ["source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"],
            "offlineCacheRemainsBrowsable": ["source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"],
            "offlineWithoutCacheIsUnavailable": ["source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"],
            "authoritativeEmptyIsNotUnavailable": ["source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"],
            "newestWindowIsProtected": ["newestProtectedCount", "perConversationLimit", "evictedItemIds", "retainedNewestWindow"],
            "oldBrowsedPageEvictsBeforeNewestMetadata": ["evictPageIds", "preservePageIds"],
            "thumbnailLruUsesByteAndInactivityLimits": ["perAccountByteLimit", "inactivityWindowMs", "evictLeastRecentFirst"],
            "triggerBurstJoinsOneCycle": ["cycleId", "phase", "attempt", "joinedTriggerCount", "automaticAttempts"],
            "attemptZeroFailureSchedulesAttemptOne": ["cycleId", "phase", "attempt", "retryDelayMs", "manualRetry"],
            "attemptOneFailureEnablesManualRetry": ["cycleId", "phase", "attempt", "automaticAttempts", "manualRetry", "automaticAttemptTwo"],
            "connectivityLossCancelsDelayedRetry": ["cycleId", "phase", "attempt", "manualRetry", "retryScheduled"],
            "manualRetryStartsNewCycle": ["cycleId", "phase", "attempt", "manualRetry", "automaticAttempts"],
            "oneVisibleIdUsesVisibleIntent": ["batches"],
            "fortyNineVisibleIdsStayInOneBatch": ["batches"],
            "fiftyVisibleIdsStayInOneBatch": ["batches"],
            "fiftyOneVisibleIdsChunkAtFifty": ["batches"],
            "intentClassesDeduplicateWithinPriority": ["batches"],
            "usableUnconstrainedLoadsVisibleAndLookahead": ["lookaheadAllowed", "batches"],
            "dataSavingKeepsVisibleAndSuppressesLookahead": ["lookaheadAllowed", "batches"],
            "signedSentinelExistsOnlyInLiveInput": ["persistedSnapshot", "diagnostics", "sentinelDurableCount"],
            "refreshDisplayRetryPurgeRedactsSentinel": ["persistedFields", "diagnosticFields", "sentinelDurableCount"],
            "staleGenerationCallbackIsRejected": ["accepted", "visibleItemIds", "oldOwnerEligible"],
            "identityChangePurgesBeforeBindingNewOwner": ["order", "oldOwnerVisible", "newOwnerAccepted"],
            "missingIdentityFailsClosed": ["accepted", "visibleItemIds", "unavailableReason", "oldOwnerEligible"],
        ]
        let groups: [(String, [SharedContentVectors.Phase12Case])] = [
            ("cacheHydration", vectors.cacheHydration),
            ("cacheTruth", vectors.cacheTruth),
            ("eviction", vectors.eviction),
            ("recovery", vectors.recovery),
            ("deliveryPlanning", vectors.deliveryPlanning),
            ("dataSaving", vectors.dataSaving),
            ("urlNonPersistence", vectors.urlNonPersistence),
            ("identityGeneration", vectors.identityGeneration),
        ]
        for (group, cases) in groups {
            for vector in cases {
                #expect(!vector.input.isEmpty || !vector.expected.isEmpty, Comment(rawValue: "\(group):\(vector.name)"))
                #expect(Set(vector.expected.keys) == expectedKeysByCase[vector.name], Comment(rawValue: "\(group):\(vector.name): incomplete projection"))
                let actual = try phase12Projection(group: group, vector: vector)
                let expected: SharedContentJSONValue = group == "deliveryPlanning"
                    ? .object(["batches": vector.expected["batches"] ?? .null])
                    : .object(vector.expected)
                #expect(actual == expected, Comment(rawValue: "\(group):\(vector.name): projection drift"))
            }
        }
    }

    @Test func gifAndStickerExportRemainRightsGated() throws {
        let vectors = try SharedContentVectors.load()
        let gated = vectors.items.values.filter { $0.kind == .gif || $0.kind == .sticker }
        #expect(!gated.isEmpty)
        #expect(gated.allSatisfy { !$0.capabilities.canExport })
    }

    @Test func realtimeItemBindsAnUnboundConversation() throws {
        let vectors = try SharedContentVectors.load()
        let item = try requireFixtureItem("row-01", vectorName: "unboundRealtime", vectors: vectors)
        let state = SharedContentReducer.reduce(
            createSharedContentState(identityId: "user-a"),
            .realtimeItemReceived(
                identityId: "user-a",
                conversationId: item.conversationId,
                identityGeneration: 1,
                item: item
            )
        )
        #expect(state.conversationId == item.conversationId)
        #expect(state.items == [item])
    }

    private func replay(
        _ vector: SharedContentVectors.StateCase,
        vectors: SharedContentVectors,
        group: String
    ) throws {
        var state = createSharedContentState(
            identityId: vector.initial.identityId,
            conversationId: vector.initial.conversationId
        )
        let initialItems = try materializeItems(vector.initial, vectors: vectors, vectorName: vector.name)
        if !(group == "requestSequencing" && initialItems.isEmpty) {
            let initialPage = pageFromRows(initialItems)
            state = SharedContentReducer.apply([
                .requestStarted(
                    identityId: vector.initial.identityId,
                    conversationId: vector.initial.conversationId,
                    identityGeneration: 1,
                    requestId: "bootstrap",
                    requestedCursor: nil,
                    replace: true
                ),
                .initialLoaded(
                    identityId: vector.initial.identityId,
                    conversationId: vector.initial.conversationId,
                    identityGeneration: 1,
                    requestId: "bootstrap",
                    requestedCursor: nil,
                    page: initialPage,
                    categories: nil,
                    status: .content
                ),
            ], to: state)
        }

        var initialEvents: [SharedContentEvent] = []
        if let categories = vector.initial.categories {
            initialEvents.append(.categoryAvailabilityUpdated(
                identityId: vector.initial.identityId,
                conversationId: vector.initial.conversationId,
                identityGeneration: 1,
                categories: categories
            ))
        }
        if let deliveryReferences = vector.initial.deliveryReferences {
            initialEvents.append(.referencesUpdated(
                identityId: vector.initial.identityId,
                conversationId: vector.initial.conversationId,
                identityGeneration: 1,
                deliveryReferences: deliveryReferences,
                temporaryReferences: vector.initial.temporaryReferences ?? []
            ))
        }
        if let error = vector.initial.error {
            initialEvents.append(.galleryStatusChanged(
                identityId: vector.initial.identityId,
                conversationId: vector.initial.conversationId,
                identityGeneration: 1,
                status: .stale,
                error: error
            ))
        }
        state = SharedContentReducer.apply(initialEvents, to: state)
        state = SharedContentReducer.apply(
            try vector.events.map { try materialize($0, vectors: vectors, vectorName: vector.name) },
            to: state
        )

        let expectedKeys = Set(vector.expected.keys)
        let actual = try stateProjection(state)
        let knownKeys = Set([
            "identityId",
            "conversationId",
            "items",
            "pages",
            "nextCursor",
            "hasMore",
            "pendingPageRequest",
            "categories",
            "status",
            "error",
            "deliveryReferences",
            "temporaryReferences",
            "deletedSourceMessageIds",
        ])
        #expect(expectedKeys == knownKeys, Comment(rawValue: vector.name))
        #expect(Set(actual.keys) == expectedKeys, Comment(rawValue: vector.name))
        for (key, expected) in vector.expected {
            guard let value = actual[key] else {
                Issue.record("Missing shared-content projection \(key) for \(vector.name)")
                continue
            }
            #expect(value == expected, Comment(rawValue: "\(vector.name):\(key)"))
        }
    }

    private func materialize(
        _ event: SharedContentVectors.RawEvent,
        vectors: SharedContentVectors,
        vectorName: String
    ) throws -> SharedContentEvent {
        switch event.type {
        case "identityChanged":
            return .identityChanged(identityId: event.identityId, conversationId: event.conversationId, identityGeneration: event.identityGeneration ?? 2)
        case "sourceDeleted":
            return .sourceDeleted(
                identityId: event.identityId,
                conversationId: try requireString(event.conversationId, label: "sourceDeleted.conversationId", vectorName: vectorName),
                identityGeneration: event.identityGeneration ?? 1,
                sourceMessageId: try requireString(event.sourceMessageId, label: "sourceDeleted.sourceMessageId", vectorName: vectorName)
            )
        case "pageLoaded":
            return .pageLoaded(
                identityId: event.identityId,
                conversationId: try requireString(event.conversationId, label: "pageLoaded.conversationId", vectorName: vectorName),
                identityGeneration: event.identityGeneration ?? 1,
                requestId: try requireString(event.requestId, label: "pageLoaded.requestId", vectorName: vectorName),
                requestedCursor: try requireRequestedCursor(event, label: "pageLoaded.requestedCursor", vectorName: vectorName),
                page: pageFromRows(try materializeItems(event, vectors: vectors, vectorName: vectorName))
            )
        case "initialLoaded":
            return .initialLoaded(
                identityId: event.identityId,
                conversationId: try requireString(event.conversationId, label: "initialLoaded.conversationId", vectorName: vectorName),
                identityGeneration: event.identityGeneration ?? 1,
                requestId: try requireString(event.requestId, label: "initialLoaded.requestId", vectorName: vectorName),
                requestedCursor: try requireRequestedCursor(event, label: "initialLoaded.requestedCursor", vectorName: vectorName),
                page: pageFromRows(try materializeItems(event, vectors: vectors, vectorName: vectorName)),
                categories: nil,
                status: nil
            )
        case "requestStarted":
            return .requestStarted(
                identityId: event.identityId,
                conversationId: try requireString(event.conversationId, label: "requestStarted.conversationId", vectorName: vectorName),
                identityGeneration: event.identityGeneration ?? 1,
                requestId: try requireString(event.requestId, label: "requestStarted.requestId", vectorName: vectorName),
                requestedCursor: try requireRequestedCursor(event, label: "requestStarted.requestedCursor", vectorName: vectorName),
                replace: try requireBool(event.replace, label: "requestStarted.replace", vectorName: vectorName)
            )
        case "realtimeItemReceived":
            let itemId = try requireString(event.itemId, label: "realtimeItemReceived.itemId", vectorName: vectorName)
            var item = try requireFixtureItem(itemId, vectorName: vectorName, vectors: vectors)
            if let sourceMessageId = event.sourceMessageId {
                item.sourceMessageId = sourceMessageId
            }
            return .realtimeItemReceived(
                identityId: event.identityId,
                conversationId: try requireString(event.conversationId, label: "realtimeItemReceived.conversationId", vectorName: vectorName),
                identityGeneration: event.identityGeneration ?? 1,
                item: item
            )
        default:
            throw CocoaError(.coderReadCorrupt, userInfo: [NSLocalizedDescriptionKey: "\(vectorName): unsupported event \(event.type)"])
        }
    }

    private func materializeItems(
        _ value: SharedContentVectors.InitialState,
        vectors: SharedContentVectors,
        vectorName: String
    ) throws -> [SharedContentItem] {
        try value.itemIds.enumerated().map { index, itemId in
            var item = try requireFixtureItem(itemId, vectorName: vectorName, vectors: vectors)
            if index < value.sourceMessageIds.count {
                item.sourceMessageId = value.sourceMessageIds[index]
            }
            return item
        }
    }

    private func materializeItems(
        _ event: SharedContentVectors.RawEvent,
        vectors: SharedContentVectors,
        vectorName: String
    ) throws -> [SharedContentItem] {
        guard event.itemIdsPresent, let itemIds = event.itemIds else {
            throw CocoaError(.coderReadCorrupt, userInfo: [NSLocalizedDescriptionKey: "\(vectorName): missing event.itemIds"])
        }
        return try itemIds.enumerated().map { index, itemId in
            var item = try requireFixtureItem(itemId, vectorName: vectorName, vectors: vectors)
            if let sourceMessageIds = event.sourceMessageIds, index < sourceMessageIds.count {
                item.sourceMessageId = sourceMessageIds[index]
            }
            return item
        }
    }

    private func requireFixtureItem(
        _ itemId: String,
        vectorName: String,
        vectors: SharedContentVectors
    ) throws -> SharedContentItem {
        try #require(
            vectors.items[itemId],
            Comment(rawValue: "\(vectorName): unknown shared-content fixture item \(itemId)")
        )
    }

    private func requireString(_ value: String?, label: String, vectorName: String) throws -> String {
        try #require(value, Comment(rawValue: "\(vectorName): missing \(label)"))
    }

    private func requireBool(_ value: Bool?, label: String, vectorName: String) throws -> Bool {
        try #require(value, Comment(rawValue: "\(vectorName): missing \(label)"))
    }

    private func requireRequestedCursor(
        _ event: SharedContentVectors.RawEvent,
        label: String,
        vectorName: String
    ) throws -> SharedContentCursor? {
        #expect(event.requestedCursorPresent, Comment(rawValue: "\(vectorName): missing \(label)"))
        return event.requestedCursor
    }

    private func stateProjection(
        _ state: SharedContentState
    ) throws -> [String: SharedContentJSONValue] {
        [
            "identityId": try jsonValue(state.identityId),
            "conversationId": try jsonValue(state.conversationId),
            "items": try jsonValue(state.items),
            "pages": try jsonValue(state.pages),
            "nextCursor": try jsonValue(state.nextCursor),
            "hasMore": try jsonValue(state.hasMore),
            "pendingPageRequest": try jsonValue(state.pendingPageRequest),
            "categories": try jsonValue(state.categories),
            "status": try jsonValue(state.status),
            "error": try jsonValue(state.error),
            "deliveryReferences": try jsonValue(state.deliveryReferences),
            "temporaryReferences": try jsonValue(state.temporaryReferences),
            "deletedSourceMessageIds": try jsonValue(state.deletedSourceMessageIds),
        ]
    }

    private func phase12Projection(
        group: String,
        vector: SharedContentVectors.Phase12Case
    ) throws -> SharedContentJSONValue {
        let input = foundationObject(vector.input)
        let output: [String: Any]
        switch group {
        case "cacheHydration", "cacheTruth", "urlNonPersistence", "identityGeneration":
            output = hydrateSharedContentCache(input)
        case "eviction":
            output = projectSharedContentEviction(input)
        case "deliveryPlanning", "dataSaving":
            output = planSharedContentDeliveryBatches(input)
        case "recovery":
            switch vector.name {
            case "attemptZeroFailureSchedulesAttemptOne", "attemptOneFailureEnablesManualRetry", "connectivityLossCancelsDelayedRetry":
                output = failSharedContentRecoveryAttempt(input)
            case "triggerBurstJoinsOneCycle", "manualRetryStartsNewCycle":
                output = beginSharedContentRecoveryCycle(input)
            default:
                output = completeSharedContentRecoveryCycle(input)
            }
        default:
            throw CocoaError(.coderReadCorrupt, userInfo: [NSLocalizedDescriptionKey: "Unsupported Phase 12 group \(group)"])
        }
        let actual = try jsonValue(output)
        if group == "deliveryPlanning", case let .object(values) = actual, let batches = values["batches"] {
            return .object(["batches": batches])
        }
        return actual
    }

    private func foundationObject(_ value: [String: SharedContentJSONValue]) -> [String: Any] {
        value.mapValues(foundationValue)
    }

    private func foundationValue(_ value: SharedContentJSONValue) -> Any {
        switch value {
        case let .string(value): return value
        case let .number(value): return value
        case let .bool(value): return value
        case let .object(value): return foundationObject(value)
        case let .array(value): return value.map(foundationValue)
        case .null: return NSNull()
        }
    }

    private func jsonValue(_ value: [String: Any]) throws -> SharedContentJSONValue {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        return try JSONDecoder().decode(SharedContentJSONValue.self, from: data)
    }

    private func jsonValue<Value: Encodable>(_ value: Value) throws -> SharedContentJSONValue {
        let data = try JSONEncoder().encode(value)
        return try JSONDecoder().decode(SharedContentJSONValue.self, from: data)
    }
}
