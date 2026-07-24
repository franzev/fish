@preconcurrency import CoreData
import Foundation

public actor CoreDataSharedContentCache: SharedContentCaching {
    private static let modelName = "SharedContentCache"
    private static let ownerEntity = "SharedContentCacheOwnerRecord"
    private static let pageEntity = "SharedContentCachePageRecord"
    private static let itemEntity = "SharedContentCacheItemRecord"
    private static let newestPageId = "newest"

    private let configuration: SharedContentCacheConfiguration
    private let container: NSPersistentContainer
    private let storeLoadFailure: SharedContentCacheFailure?
    private var minimumIdentityGeneration = 0

    public init(
        configuration: SharedContentCacheConfiguration = .init()
    ) throws {
        self.configuration = configuration
        guard let model = Self.loadModelForTesting() else {
            throw SharedContentCacheFailure.storeUnavailable
        }

        let container = NSPersistentContainer(name: Self.modelName, managedObjectModel: model)
        let description = try Self.makeStoreDescription(configuration: configuration)
        guard Self.verifySharedContentStoreProtection(description) else {
            throw SharedContentCacheFailure.protectionUnavailable
        }
        container.persistentStoreDescriptions = [description]

        var loadError: Error?
        container.loadPersistentStores { _, error in loadError = error }
        self.container = container
        self.storeLoadFailure = loadError.map { _ in .storeUnavailable }

        if !configuration.inMemory, let storeURL = configuration.storeURL {
            try Self.excludeSharedContentStoreFromBackup(storeURL.deletingLastPathComponent())
            try Self.excludeSharedContentStoreFromBackup(storeURL)
        }
    }

    internal static func loadModelForTesting() -> NSManagedObjectModel? {
        guard let url = Bundle.module.url(forResource: modelName, withExtension: "momd") else {
            return nil
        }
        return NSManagedObjectModel(contentsOf: url)
    }

    internal static func storeDescriptionForTesting(
        configuration: SharedContentCacheConfiguration
    ) throws -> NSPersistentStoreDescription? {
        try makeStoreDescription(configuration: configuration)
    }

    private static func makeStoreDescription(
        configuration: SharedContentCacheConfiguration
    ) throws -> NSPersistentStoreDescription {
        if configuration.inMemory {
            let description = NSPersistentStoreDescription()
            description.type = NSInMemoryStoreType
            description.setOption(
                FileProtectionType.complete as NSObject,
                forKey: NSPersistentStoreFileProtectionKey
            )
            return description
        }

        guard let storeURL = configuration.storeURL else {
            throw SharedContentCacheFailure.storeUnavailable
        }
        try FileManager.default.createDirectory(
            at: storeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let description = NSPersistentStoreDescription(url: storeURL)
        description.type = NSSQLiteStoreType
        description.shouldMigrateStoreAutomatically = true
        description.shouldInferMappingModelAutomatically = true
        description.setOption(
            FileProtectionType.complete as NSObject,
            forKey: NSPersistentStoreFileProtectionKey
        )
        return description
    }

    private static func verifySharedContentStoreProtection(
        _ description: NSPersistentStoreDescription
    ) -> Bool {
        description.options[NSPersistentStoreFileProtectionKey] as? FileProtectionType == .complete
    }

    private static func excludeSharedContentStoreFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }

    private func requireStore() throws {
        if let storeLoadFailure { throw storeLoadFailure }
    }

    public func revokeIdentityGeneration(through generation: Int) {
        guard generation > 0 else { return }
        minimumIdentityGeneration = max(minimumIdentityGeneration, generation)
    }

    private func requireCurrentIdentityGeneration(_ generation: Int) throws {
        guard generation > 0, generation >= minimumIdentityGeneration else {
            throw SharedContentCacheFailure.staleGeneration
        }
        minimumIdentityGeneration = generation
    }

    public func hydrateVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String
    ) async throws -> StoredSharedContentSnapshot? {
        guard let verifiedOwnerId, !verifiedOwnerId.isEmpty, !conversationId.isEmpty else {
            return nil
        }
        try requireStore()
        return try read { context in
            guard let owner = try self.fetchOwner(
                ownerIdentityId: verifiedOwnerId,
                conversationId: conversationId,
                in: context
            ) else { return nil }

            let items = try self.fetchItems(
                ownerIdentityId: verifiedOwnerId,
                conversationId: conversationId,
                in: context
            ).sorted(by: Self.itemOrder).map(Self.storedItem)
            let source: SharedContentCacheSource = owner.date(Self.lastAuthoritativeAt) != nil || owner.bool(Self.authoritativeEmptyConfirmed)
                ? .authoritative
                : .verifiedDeviceCache
            return StoredSharedContentSnapshot(
                schemaVersion: owner.int(Self.schemaVersion),
                ownerIdentityId: verifiedOwnerId,
                conversationId: conversationId,
                items: items,
                source: source,
                stale: false,
                retainedHistoryComplete: owner.bool(Self.retainedHistoryComplete),
                authoritativeEmptyConfirmed: owner.bool(Self.authoritativeEmptyConfirmed),
                retainedOldestCursor: owner.optionalString(Self.retainedOldestCursor),
                newestWindowProtected: owner.bool(Self.newestWindowProtected)
            )
        }
    }

    public func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String? = nil,
        retainedHistoryComplete: Bool = true
    ) async throws {
        try await replaceNewestWindow(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            items: items,
            retainedOldestCursor: retainedOldestCursor,
            retainedHistoryComplete: retainedHistoryComplete,
            authoritativeEmptyConfirmed: items.isEmpty
        )
    }

    public func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool
    ) async throws {
        try replaceNewestWindow(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            items: items,
            retainedOldestCursor: retainedOldestCursor,
            retainedHistoryComplete: retainedHistoryComplete,
            authoritativeEmptyConfirmed: authoritativeEmptyConfirmed,
            requiringIdentityGeneration: nil
        )
    }

    public func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool
    ) async throws {
        try replaceNewestWindow(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            items: items,
            retainedOldestCursor: retainedOldestCursor,
            retainedHistoryComplete: retainedHistoryComplete,
            authoritativeEmptyConfirmed: authoritativeEmptyConfirmed,
            requiringIdentityGeneration: identityGeneration
        )
    }

    private func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool,
        requiringIdentityGeneration identityGeneration: Int?
    ) throws {
        if let identityGeneration {
            try requireCurrentIdentityGeneration(identityGeneration)
        }
        try validateOwnerAndConversation(ownerIdentityId, conversationId: conversationId)
        try validateItems(items, conversationId: conversationId)
        try requireStore()
        try transaction { context in
            let now = self.configuration.now()
            let previousOwner = try self.fetchOwner(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                in: context
            )
            let hasRetainedBrowsedPages = try self.fetchAll(Self.pageEntity, in: context).contains {
                $0.string(Self.ownerIdentityId) == ownerIdentityId &&
                    $0.string(Self.conversationId) == conversationId &&
                    !$0.bool(Self.isNewestWindow)
            }
            let owner = try self.upsertOwner(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                in: context,
                now: now,
                retainedOldestCursor: hasRetainedBrowsedPages
                    ? previousOwner?.optionalString(Self.retainedOldestCursor)
                    : retainedOldestCursor,
                retainedHistoryComplete: hasRetainedBrowsedPages
                    ? (previousOwner?.bool(Self.retainedHistoryComplete) ?? retainedHistoryComplete)
                    : retainedHistoryComplete,
                authoritativeEmptyConfirmed: authoritativeEmptyConfirmed,
                authoritative: true
            )
            let page = try self.upsertPage(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                pageId: Self.newestPageId,
                pageOrdinal: 0,
                retainedCursor: retainedOldestCursor,
                isNewestWindow: true,
                now: now,
                in: context
            )
            try self.deleteItems(pageId: Self.newestPageId, ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
            for item in items {
                try self.upsert(item: item, ownerIdentityId: ownerIdentityId, pageId: page.string(Self.pageId), in: context)
            }
            try self.pruneSharedContentCache(in: context, now: now)
            _ = owner
        }
    }

    public func appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws {
        _ = try appendBrowsedPage(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            pageId: pageId,
            pageOrdinal: pageOrdinal,
            retainedCursor: retainedCursor,
            items: items,
            retainedHistoryComplete: retainedHistoryComplete,
            requiringIdentityGeneration: nil
        )
    }

    public func appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws {
        _ = try appendBrowsedPage(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            pageId: pageId,
            pageOrdinal: pageOrdinal,
            retainedCursor: retainedCursor,
            items: items,
            retainedHistoryComplete: retainedHistoryComplete,
            requiringIdentityGeneration: identityGeneration
        )
    }

    public func appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws -> Int {
        try appendBrowsedPage(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            pageId: pageId,
            pageOrdinal: nil,
            retainedCursor: retainedCursor,
            items: items,
            retainedHistoryComplete: retainedHistoryComplete,
            requiringIdentityGeneration: nil
        )
    }

    public func appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        pageId: String,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws -> Int {
        try appendBrowsedPage(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            pageId: pageId,
            pageOrdinal: nil,
            retainedCursor: retainedCursor,
            items: items,
            retainedHistoryComplete: retainedHistoryComplete,
            requiringIdentityGeneration: identityGeneration
        )
    }

    private func appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int?,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool,
        requiringIdentityGeneration identityGeneration: Int?
    ) throws -> Int {
        if let identityGeneration {
            try requireCurrentIdentityGeneration(identityGeneration)
        }
        try validateOwnerAndConversation(ownerIdentityId, conversationId: conversationId)
        guard !pageId.isEmpty, pageId != Self.newestPageId,
              pageOrdinal.map({ $0 > 0 }) ?? true
        else {
            throw SharedContentCacheFailure.invalidInput
        }
        try validateItems(items, conversationId: conversationId)
        try requireStore()
        return try transaction { context in
            let now = self.configuration.now()
            let allocatedOrdinal = try pageOrdinal ?? self.nextBrowsedPageOrdinal(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                in: context
            )
            let owner = try self.upsertOwner(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                in: context,
                now: now,
                retainedOldestCursor: retainedCursor,
                retainedHistoryComplete: retainedHistoryComplete,
                authoritativeEmptyConfirmed: false,
                authoritative: false
            )
            let page = try self.upsertPage(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                pageId: pageId,
                pageOrdinal: allocatedOrdinal,
                retainedCursor: retainedCursor,
                isNewestWindow: false,
                now: now,
                in: context
            )
            try self.deleteItems(pageId: pageId, ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
            for item in items {
                try self.upsert(item: item, ownerIdentityId: ownerIdentityId, pageId: page.string(Self.pageId), in: context)
            }
            try self.pruneSharedContentCache(in: context, now: now)
            _ = owner
            return allocatedOrdinal
        }
    }

    public func applyAcceptedTombstones(
        ownerIdentityId: String,
        conversationId: String,
        sourceMessageIds: Set<String>
    ) async throws {
        try validateOwnerAndConversation(ownerIdentityId, conversationId: conversationId)
        guard !sourceMessageIds.isEmpty else { return }
        try requireStore()
        try transaction { context in
            guard let owner = try self.fetchOwner(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context) else {
                return
            }
            let items = try self.fetchItems(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
            for item in items where sourceMessageIds.contains(item.string(Self.sourceMessageId)) {
                context.delete(item)
            }
            owner.setValue(self.configuration.now(), forKey: Self.lastAccessedAt)
            try self.pruneSharedContentCache(in: context, now: self.configuration.now())
        }
    }

    public func purgeConversation(ownerIdentityId: String, conversationId: String) async throws {
        try validateOwnerAndConversation(ownerIdentityId, conversationId: conversationId)
        try requireStore()
        try transaction { context in
            try self.deleteNamespace(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
        }
    }

    public func purgeOwner(ownerIdentityId: String) async throws {
        guard !ownerIdentityId.isEmpty else { throw SharedContentCacheFailure.invalidInput }
        try requireStore()
        try transaction { context in
            for entity in try self.fetchAll(Self.itemEntity, in: context) where entity.string(Self.ownerIdentityId) == ownerIdentityId {
                context.delete(entity)
            }
            for entity in try self.fetchAll(Self.pageEntity, in: context) where entity.string(Self.ownerIdentityId) == ownerIdentityId {
                context.delete(entity)
            }
            for entity in try self.fetchAll(Self.ownerEntity, in: context) where entity.string(Self.ownerIdentityId) == ownerIdentityId {
                context.delete(entity)
            }
        }
    }

    public func verifyOwnerPurged(
        ownerIdentityId: String,
        conversationId: String? = nil
    ) async throws -> Bool {
        guard !ownerIdentityId.isEmpty else { return false }
        try requireStore()
        return try read { context in
            let owners = try self.fetchAll(Self.ownerEntity, in: context).filter {
                $0.string(Self.ownerIdentityId) == ownerIdentityId && (conversationId == nil || $0.string(Self.conversationId) == conversationId)
            }
            let pages = try self.fetchAll(Self.pageEntity, in: context).filter {
                $0.string(Self.ownerIdentityId) == ownerIdentityId && (conversationId == nil || $0.string(Self.conversationId) == conversationId)
            }
            let items = try self.fetchAll(Self.itemEntity, in: context).filter {
                $0.string(Self.ownerIdentityId) == ownerIdentityId && (conversationId == nil || $0.string(Self.conversationId) == conversationId)
            }
            return owners.isEmpty && pages.isEmpty && items.isEmpty
        }
    }

    public func sweepNonCurrentOwners(currentOwnerIdentityId: String) async throws {
        guard !currentOwnerIdentityId.isEmpty else { throw SharedContentCacheFailure.invalidInput }
        try requireStore()
        try transaction { context in
            for entityName in [Self.itemEntity, Self.pageEntity, Self.ownerEntity] {
                for entity in try self.fetchAll(entityName, in: context) where entity.string(Self.ownerIdentityId) != currentOwnerIdentityId {
                    context.delete(entity)
                }
            }
        }
    }

    private func read<T>(_ body: @escaping (NSManagedObjectContext) throws -> T) throws -> T {
        try withPrivateContext(body)
    }

    private func transaction<T>(_ body: @escaping (NSManagedObjectContext) throws -> T) throws -> T {
        try withPrivateContext { context in
            do {
                let result = try body(context)
                if self.configuration.simulateSaveFailure {
                    throw SharedContentCacheFailure.transactionFailed
                }
                if context.hasChanges {
                    try context.save()
                }
                try Self.reapplyBackupExclusion(configuration: self.configuration)
                return result
            } catch let failure as SharedContentCacheFailure {
                context.rollback()
                throw failure
            } catch {
                context.rollback()
                throw SharedContentCacheFailure.transactionFailed
            }
        }
    }

    private func withPrivateContext<T>(_ body: @escaping (NSManagedObjectContext) throws -> T) throws -> T {
        let context = container.newBackgroundContext()
        context.mergePolicy = NSMergePolicy(merge: .mergeByPropertyObjectTrumpMergePolicyType)
        let work = ContextWork(body)
        context.performAndWait {
            do {
                work.result = .success(try work.body(context))
            } catch {
                work.result = .failure(error)
            }
        }
        guard let result = work.result else { throw SharedContentCacheFailure.transactionFailed }
        return try result.get()
    }

    private func validateOwnerAndConversation(_ owner: String, conversationId: String) throws {
        guard !owner.isEmpty, !conversationId.isEmpty else {
            throw SharedContentCacheFailure.invalidInput
        }
    }

    private func validateItems(_ items: [StoredSharedContentItem], conversationId: String) throws {
        guard items.allSatisfy({
            !$0.itemId.isEmpty &&
                !$0.sourceMessageId.isEmpty &&
                $0.conversationId == conversationId &&
                ($0.durationMs.map { $0 >= 0 } ?? true)
        }) else {
            throw SharedContentCacheFailure.invalidInput
        }
    }

    private func fetchAll(_ entityName: String, in context: NSManagedObjectContext) throws -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
        return try context.fetch(request)
    }

    private func fetchOwner(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws -> NSManagedObject? {
        try fetchFirst(Self.ownerEntity, predicate: NSPredicate(
            format: "%K == %@ AND %K == %@",
            Self.ownerIdentityId, ownerIdentityId, Self.conversationId, conversationId
        ), in: context)
    }

    private func fetchPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        in context: NSManagedObjectContext
    ) throws -> NSManagedObject? {
        try fetchFirst(Self.pageEntity, predicate: NSPredicate(
            format: "%K == %@ AND %K == %@ AND %K == %@",
            Self.ownerIdentityId, ownerIdentityId, Self.conversationId, conversationId, Self.pageId, pageId
        ), in: context)
    }

    private func nextBrowsedPageOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws -> Int {
        let request = NSFetchRequest<NSManagedObject>(entityName: Self.pageEntity)
        request.predicate = NSPredicate(
            format: "%K == %@ AND %K == %@ AND %K == NO",
            Self.ownerIdentityId,
            ownerIdentityId,
            Self.conversationId,
            conversationId,
            Self.isNewestWindow
        )
        request.sortDescriptors = [
            NSSortDescriptor(key: Self.pageOrdinal, ascending: false),
        ]
        request.fetchLimit = 1
        return (try context.fetch(request).first?.int(Self.pageOrdinal) ?? 0) + 1
    }

    private func fetchItems(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: Self.itemEntity)
        request.predicate = NSPredicate(
            format: "%K == %@ AND %K == %@",
            Self.ownerIdentityId, ownerIdentityId, Self.conversationId, conversationId
        )
        return try context.fetch(request)
    }

    private func fetchFirst(
        _ entityName: String,
        predicate: NSPredicate,
        in context: NSManagedObjectContext
    ) throws -> NSManagedObject? {
        let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
        request.predicate = predicate
        request.fetchLimit = 1
        return try context.fetch(request).first
    }

    private func upsertOwner(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext,
        now: Date,
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool,
        authoritative: Bool
    ) throws -> NSManagedObject {
        let owner = try fetchOwner(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
            ?? NSEntityDescription.insertNewObject(forEntityName: Self.ownerEntity, into: context)
        owner.setValue(ownerIdentityId, forKey: Self.ownerIdentityId)
        owner.setValue(conversationId, forKey: Self.conversationId)
        if owner.value(forKey: Self.savedAt) == nil { owner.setValue(now, forKey: Self.savedAt) }
        owner.setValue(1, forKey: Self.schemaVersion)
        owner.setValue(now, forKey: Self.lastAccessedAt)
        owner.setValue(retainedOldestCursor, forKey: Self.retainedOldestCursor)
        owner.setValue(retainedHistoryComplete, forKey: Self.retainedHistoryComplete)
        owner.setValue(true, forKey: Self.newestWindowProtected)
        if authoritative {
            owner.setValue(now, forKey: Self.lastAuthoritativeAt)
            owner.setValue(authoritativeEmptyConfirmed, forKey: Self.authoritativeEmptyConfirmed)
        } else if owner.value(forKey: Self.authoritativeEmptyConfirmed) == nil {
            owner.setValue(false, forKey: Self.authoritativeEmptyConfirmed)
        }
        return owner
    }

    private func upsertPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        isNewestWindow: Bool,
        now: Date,
        in context: NSManagedObjectContext
    ) throws -> NSManagedObject {
        let page = try fetchPage(ownerIdentityId: ownerIdentityId, conversationId: conversationId, pageId: pageId, in: context)
            ?? NSEntityDescription.insertNewObject(forEntityName: Self.pageEntity, into: context)
        page.setValue(ownerIdentityId, forKey: Self.ownerIdentityId)
        page.setValue(conversationId, forKey: Self.conversationId)
        page.setValue(pageId, forKey: Self.pageId)
        page.setValue(pageOrdinal, forKey: Self.pageOrdinal)
        page.setValue(retainedCursor, forKey: Self.retainedCursor)
        page.setValue(now, forKey: Self.lastAccessedAt)
        page.setValue(isNewestWindow, forKey: Self.isNewestWindow)
        return page
    }

    private func upsert(
        item: StoredSharedContentItem,
        ownerIdentityId: String,
        pageId: String,
        in context: NSManagedObjectContext
    ) throws {
        let request = NSFetchRequest<NSManagedObject>(entityName: Self.itemEntity)
        request.predicate = NSPredicate(
            format: "%K == %@ AND %K == %@ AND %K == %@",
            Self.ownerIdentityId, ownerIdentityId, Self.conversationId, item.conversationId, Self.itemId, item.itemId
        )
        let record = try context.fetch(request).first
            ?? NSEntityDescription.insertNewObject(forEntityName: Self.itemEntity, into: context)
        record.setValue(ownerIdentityId, forKey: Self.ownerIdentityId)
        record.setValue(item.conversationId, forKey: Self.conversationId)
        record.setValue(item.itemId, forKey: Self.itemId)
        record.setValue(item.sourceMessageId, forKey: Self.sourceMessageId)
        record.setValue(item.senderId, forKey: Self.senderId)
        record.setValue(item.sourceCreatedAt, forKey: Self.sourceCreatedAt)
        record.setValue(item.sourceRank, forKey: Self.sourceRank)
        record.setValue(item.category, forKey: Self.category)
        record.setValue(item.kind, forKey: Self.kind)
        record.setValue(item.attachmentId, forKey: Self.attachmentId)
        record.setValue(item.attachmentOriginalName, forKey: Self.attachmentOriginalName)
        record.setValue(item.attachmentMimeType, forKey: Self.attachmentMimeType)
        record.setValue(item.attachmentByteSize, forKey: Self.attachmentByteSize)
        record.setValue(item.attachmentWidth, forKey: Self.attachmentWidth)
        record.setValue(item.attachmentHeight, forKey: Self.attachmentHeight)
        record.setValue(item.durationMs, forKey: Self.durationMs)
        record.setValue(item.gifProvider, forKey: Self.gifProvider)
        record.setValue(item.gifProviderContentId, forKey: Self.gifProviderContentId)
        record.setValue(item.gifTitle, forKey: Self.gifTitle)
        record.setValue(item.gifDescription, forKey: Self.gifDescription)
        record.setValue(item.stickerId, forKey: Self.stickerId)
        record.setValue(item.linkMetadataJson, forKey: Self.linkMetadataJson)
        record.setValue(pageId, forKey: Self.pageId)
    }

    private func deleteItems(
        pageId: String,
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws {
        let request = NSFetchRequest<NSManagedObject>(entityName: Self.itemEntity)
        request.predicate = NSPredicate(
            format: "%K == %@ AND %K == %@ AND %K == %@",
            Self.ownerIdentityId, ownerIdentityId, Self.conversationId, conversationId, Self.pageId, pageId
        )
        for item in try context.fetch(request) { context.delete(item) }
    }

    private func deleteNamespace(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws {
        let items = try fetchItems(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
        for item in items { context.delete(item) }
        let pages = try fetchAll(Self.pageEntity, in: context).filter {
            $0.string(Self.ownerIdentityId) == ownerIdentityId && $0.string(Self.conversationId) == conversationId
        }
        for page in pages { context.delete(page) }
        if let owner = try fetchOwner(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context) {
            context.delete(owner)
        }
    }

    private func pruneSharedContentCache(in context: NSManagedObjectContext, now: Date) throws {
        let cutoff = now.addingTimeInterval(-configuration.inactivityWindow)
        let namespaces = Set(try fetchAll(Self.pageEntity, in: context)
            .filter { !$0.bool(Self.isNewestWindow) }
            .map {
                CacheNamespace(
                    ownerIdentityId: $0.string(Self.ownerIdentityId),
                    conversationId: $0.string(Self.conversationId)
                )
            })
        for namespace in namespaces {
            while let deepest = try deepestBrowsedPage(
                ownerIdentityId: namespace.ownerIdentityId,
                conversationId: namespace.conversationId,
                in: context
            ), (deepest.date(Self.lastAccessedAt) ?? .distantPast) <= cutoff {
                try deleteDeepestPageAndRepair(deepest, in: context)
            }
        }

        let owners = try fetchAll(Self.ownerEntity, in: context)
        for owner in owners {
            let ownerId = owner.string(Self.ownerIdentityId)
            let conversationId = owner.string(Self.conversationId)
            try pruneConversation(
                ownerIdentityId: ownerId,
                conversationId: conversationId,
                in: context
            )
        }

        while true {
            let items = try fetchAll(Self.itemEntity, in: context)
            guard items.count > configuration.perAccountItemLimit else { break }
            let deepestByConversation = Dictionary(
                grouping: try fetchAll(Self.pageEntity, in: context)
                    .filter { !$0.bool(Self.isNewestWindow) },
                by: {
                    CacheNamespace(
                        ownerIdentityId: $0.string(Self.ownerIdentityId),
                        conversationId: $0.string(Self.conversationId)
                    )
                }
            ).values.compactMap { pages in
                pages.max(by: { Self.pageOrdinalOrder($0, $1) })
            }
            guard let page = deepestByConversation.sorted(by: Self.pageOrder).first else { break }
            try deleteDeepestPageAndRepair(page, in: context)
        }
    }

    private func pruneConversation(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws {
        while true {
            let items = try fetchItems(ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
            guard items.count > configuration.perConversationItemLimit else { break }
            guard let page = try fetchAll(Self.pageEntity, in: context)
                .filter({
                    !$0.bool(Self.isNewestWindow) &&
                    $0.string(Self.ownerIdentityId) == ownerIdentityId &&
                    $0.string(Self.conversationId) == conversationId
                })
                .max(by: { Self.pageOrdinalOrder($0, $1) }) else {
                try trimNewestWindow(items, ownerIdentityId: ownerIdentityId, conversationId: conversationId, in: context)
                break
            }
            try deleteDeepestPageAndRepair(page, in: context)
        }
    }

    private func trimNewestWindow(
        _ items: [NSManagedObject],
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws {
        let newest = items.filter { $0.bool(Self.isNewestWindow) || $0.string(Self.pageId) == Self.newestPageId }
            .sorted(by: Self.itemOrder)
        guard newest.count > configuration.newestProtectedCount else { return }
        for item in newest.dropFirst(configuration.newestProtectedCount) { context.delete(item) }
    }

    private func deletePage(_ page: NSManagedObject, in context: NSManagedObjectContext) throws {
        let owner = page.string(Self.ownerIdentityId)
        let conversation = page.string(Self.conversationId)
        let pageId = page.string(Self.pageId)
        try deleteItems(pageId: pageId, ownerIdentityId: owner, conversationId: conversation, in: context)
        context.delete(page)
    }

    private func deepestBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        in context: NSManagedObjectContext
    ) throws -> NSManagedObject? {
        try fetchAll(Self.pageEntity, in: context)
            .filter {
                !$0.bool(Self.isNewestWindow) &&
                    $0.string(Self.ownerIdentityId) == ownerIdentityId &&
                    $0.string(Self.conversationId) == conversationId
            }
            .max(by: { Self.pageOrdinalOrder($0, $1) })
    }

    private func deleteDeepestPageAndRepair(
        _ page: NSManagedObject,
        in context: NSManagedObjectContext
    ) throws {
        let ownerIdentityId = page.string(Self.ownerIdentityId)
        let conversationId = page.string(Self.conversationId)
        try deletePage(page, in: context)
        guard let owner = try fetchOwner(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            in: context
        ) else { return }
        let retainedBoundary = try deepestBrowsedPage(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            in: context
        ) ?? fetchAll(Self.pageEntity, in: context).first {
            $0.string(Self.ownerIdentityId) == ownerIdentityId &&
                $0.string(Self.conversationId) == conversationId &&
                $0.bool(Self.isNewestWindow)
        }
        owner.setValue(retainedBoundary?.optionalString(Self.retainedCursor), forKey: Self.retainedOldestCursor)
        owner.setValue(false, forKey: Self.retainedHistoryComplete)
    }

    private static func itemOrder(_ lhs: NSManagedObject, _ rhs: NSManagedObject) -> Bool {
        let createdAtL = lhs.string(sourceCreatedAt)
        let createdAtR = rhs.string(sourceCreatedAt)
        if createdAtL != createdAtR { return createdAtL > createdAtR }
        let messageIdL = lhs.string(sourceMessageId)
        let messageIdR = rhs.string(sourceMessageId)
        if messageIdL != messageIdR { return messageIdL > messageIdR }
        let rankL = lhs.int(sourceRank)
        let rankR = rhs.int(sourceRank)
        if rankL != rankR { return rankL > rankR }
        let itemIdL = Array(lhs.string(itemId).utf8)
        let itemIdR = Array(rhs.string(itemId).utf8)
        return itemIdR.lexicographicallyPrecedes(itemIdL)
    }

    private static func pageOrder(_ lhs: NSManagedObject, _ rhs: NSManagedObject) -> Bool {
        let dateL = lhs.date(lastAccessedAt) ?? .distantPast
        let dateR = rhs.date(lastAccessedAt) ?? .distantPast
        if dateL != dateR { return dateL < dateR }
        let ordinalL = lhs.int(pageOrdinal)
        let ordinalR = rhs.int(pageOrdinal)
        return ordinalL == ordinalR ? lhs.string(pageId) < rhs.string(pageId) : ordinalL < ordinalR
    }

    private static func pageOrdinalOrder(_ lhs: NSManagedObject, _ rhs: NSManagedObject) -> Bool {
        let ordinalL = lhs.int(pageOrdinal)
        let ordinalR = rhs.int(pageOrdinal)
        return ordinalL == ordinalR ? lhs.string(pageId) < rhs.string(pageId) : ordinalL < ordinalR
    }

    private static func storedItem(_ record: NSManagedObject) -> StoredSharedContentItem {
        StoredSharedContentItem(
            itemId: record.string(itemId),
            conversationId: record.string(conversationId),
            sourceMessageId: record.string(sourceMessageId),
            senderId: record.string(senderId),
            sourceCreatedAt: record.string(sourceCreatedAt),
            sourceRank: record.int(sourceRank),
            category: record.string(category),
            kind: record.string(kind),
            attachmentId: record.optionalString(attachmentId),
            attachmentOriginalName: record.optionalString(attachmentOriginalName),
            attachmentMimeType: record.optionalString(attachmentMimeType),
            attachmentByteSize: record.int64(attachmentByteSize),
            attachmentWidth: record.intOptional(attachmentWidth),
            attachmentHeight: record.intOptional(attachmentHeight),
            durationMs: record.int64(durationMs),
            gifProvider: record.optionalString(gifProvider),
            gifProviderContentId: record.optionalString(gifProviderContentId),
            gifTitle: record.optionalString(gifTitle),
            gifDescription: record.optionalString(gifDescription),
            stickerId: record.optionalString(stickerId),
            linkMetadataJson: record.optionalString(linkMetadataJson)
        )
    }

    private static func reapplyBackupExclusion(configuration: SharedContentCacheConfiguration) throws {
        guard !configuration.inMemory, let storeURL = configuration.storeURL else { return }
        try excludeSharedContentStoreFromBackup(storeURL.deletingLastPathComponent())
        for suffix in ["", "-wal", "-shm"] {
            let companion = URL(fileURLWithPath: storeURL.path + suffix)
            if FileManager.default.fileExists(atPath: companion.path) {
                try excludeSharedContentStoreFromBackup(companion)
            }
        }
    }

    private static let ownerIdentityId = "ownerIdentityId"
    private static let conversationId = "conversationId"
    private static let pageId = "pageId"
    private static let pageOrdinal = "pageOrdinal"
    private static let sourceRank = "sourceRank"
    private static let sourceMessageId = "sourceMessageId"
    private static let sourceCreatedAt = "sourceCreatedAt"
    private static let senderId = "senderId"
    private static let itemId = "itemId"
    private static let category = "category"
    private static let kind = "kind"
    private static let attachmentId = "attachmentId"
    private static let attachmentOriginalName = "attachmentOriginalName"
    private static let attachmentMimeType = "attachmentMimeType"
    private static let attachmentByteSize = "attachmentByteSize"
    private static let attachmentWidth = "attachmentWidth"
    private static let attachmentHeight = "attachmentHeight"
    private static let durationMs = "durationMs"
    private static let gifProvider = "gifProvider"
    private static let gifProviderContentId = "gifProviderContentId"
    private static let gifTitle = "gifTitle"
    private static let gifDescription = "gifDescription"
    private static let stickerId = "stickerId"
    private static let linkMetadataJson = "linkMetadataJson"
    private static let savedAt = "savedAt"
    private static let lastAuthoritativeAt = "lastAuthoritativeAt"
    private static let lastAccessedAt = "lastAccessedAt"
    private static let schemaVersion = "schemaVersion"
    private static let authoritativeEmptyConfirmed = "authoritativeEmptyConfirmed"
    private static let retainedOldestCursor = "retainedOldestCursor"
    private static let retainedCursor = "retainedCursor"
    private static let retainedHistoryComplete = "retainedHistoryComplete"
    private static let newestWindowProtected = "newestWindowProtected"
    private static let isNewestWindow = "isNewestWindow"
}

private final class ContextWork<Value>: @unchecked Sendable {
    let body: (NSManagedObjectContext) throws -> Value
    var result: Result<Value, Error>?

    init(_ body: @escaping (NSManagedObjectContext) throws -> Value) {
        self.body = body
    }
}

private struct CacheNamespace: Hashable {
    let ownerIdentityId: String
    let conversationId: String
}

private extension NSManagedObject {
    func string(_ key: String) -> String {
        value(forKey: key) as? String ?? ""
    }

    func optionalString(_ key: String) -> String? {
        guard let value = value(forKey: key) as? String, !value.isEmpty else {
            return nil
        }
        return value
    }

    func int(_ key: String) -> Int {
        (value(forKey: key) as? NSNumber)?.intValue ?? 0
    }

    func int64(_ key: String) -> Int64? {
        (value(forKey: key) as? NSNumber)?.int64Value
    }

    func intOptional(_ key: String) -> Int? {
        (value(forKey: key) as? NSNumber)?.intValue
    }

    func bool(_ key: String) -> Bool {
        (value(forKey: key) as? NSNumber)?.boolValue ?? false
    }

    func date(_ key: String) -> Date? {
        value(forKey: key) as? Date
    }
}
