import ChatData
import Foundation
import Observation
import UIKit

@MainActor @Observable
public final class AttachmentUploadsModel {
    public private(set) var items: [StagedAttachment] = []
    public private(set) var notice: String?
    public private(set) var isConnected = true

    /// Fired when an upload owned by a queued send becomes ready, so the
    /// send queue can flush without waiting for a socket transition.
    public var onQueuedItemReady: (() -> Void)?

    /// False until the durable records have been replayed. Resolutions asked
    /// for before that must read as still-pending, never as gone — a flush
    /// racing the restore would otherwise fail queued sends spuriously.
    private var hasRestored = false

    public let conversationId: String

    private let commands: any AttachmentCommandProviding
    private let uploader: any AttachmentByteUploading
    private let preparer: any AttachmentPreparing
    private let staging: AttachmentStaging
    private let connectivity: any AttachmentConnectivityProviding
    private let outbox: (any ChatDraftProviding)?
    private let makeClientUploadId: @Sendable () -> String
    private let automaticRetryDelay: @Sendable (Int) async -> Void
    private let uploadGate = AttachmentAsyncGate(limit: 2)
    private let completionGate = AttachmentAsyncGate(limit: 1)

    private var candidates: [String: AttachmentCandidate] = [:]
    private var preparedFiles: [String: StagedAttachmentFile] = [:]
    private var serverAttachmentIds: [String: Set<String>] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]
    private var pipelineGenerations: [String: Int] = [:]
    private var backgroundTask = UIBackgroundTaskIdentifier.invalid

    public init(
        conversationId: String,
        commands: any AttachmentCommandProviding,
        uploader: any AttachmentByteUploading,
        preparer: any AttachmentPreparing = ImagePreparation(),
        staging: AttachmentStaging,
        connectivity: any AttachmentConnectivityProviding = NetworkAttachmentConnectivity(),
        outbox: (any ChatDraftProviding)? = nil,
        makeClientUploadId: @escaping @Sendable () -> String = { UUID().uuidString },
        automaticRetryDelay: @escaping @Sendable (Int) async -> Void = { attempt in
            let base = min(8, pow(2, Double(max(0, attempt - 1))))
            let jitter = Double.random(in: 0...0.35)
            try? await Task.sleep(for: .seconds(base + jitter))
        }
    ) {
        self.conversationId = conversationId
        self.commands = commands
        self.uploader = uploader
        self.preparer = preparer
        self.staging = staging
        self.connectivity = connectivity
        self.outbox = outbox
        self.makeClientUploadId = makeClientUploadId
        self.automaticRetryDelay = automaticRetryDelay
        Task { [weak self, connectivity] in
            for await connected in connectivity.updates {
                guard let self else { return }
                await self.connectivityChanged(connected)
            }
        }
        let launchCutoff = Date()
        Task { [staging, outbox] in
            let stagingRoot = await staging.root
            guard await attachmentLaunchSweepGate.claim(stagingRoot) else { return }
            // Bytes referenced by the durable outbox survive the launch sweep;
            // everything else in the staging root is an orphan.
            let keep = Set(
                ((try? await outbox?.pendingAttachments()) ?? [])
                    .map { $0.stagedFileUrl(in: stagingRoot) }
            )
            _ = await staging.sweep(keeping: keep, olderThan: launchCutoff)
        }
        Task { [weak self] in
            await self?.restoreFromOutbox()
        }
    }

    /// Rebuilds unfinished uploads from the durable outbox after a relaunch
    /// and re-enters the pipeline for anything not yet complete. The server
    /// deduplicates initialization by `clientUploadId`, so replay is safe.
    private func restoreFromOutbox() async {
        defer { hasRestored = true }
        guard let outbox else { return }
        let records = ((try? await outbox.pendingAttachments()) ?? [])
            .filter { $0.conversationId == conversationId }
            .sorted { $0.createdAt < $1.createdAt }
        guard !records.isEmpty else { return }
        let stagingRoot = await staging.root
        for record in records {
            guard items.count < AttachmentRules.maxCount else { return }
            guard !items.contains(where: { $0.id == record.itemId }) else { continue }
            let url = record.stagedFileUrl(in: stagingRoot)
            guard FileManager.default.fileExists(atPath: url.path) else {
                try? await outbox.removePendingAttachment(itemId: record.itemId)
                continue
            }
            preparedFiles[record.itemId] = StagedAttachmentFile(
                url: url,
                originalName: record.originalName,
                sourceMimeType: record.sourceMimeType,
                uploadMimeType: record.uploadMimeType,
                sourceByteSize: record.sourceByteSize,
                uploadByteSize: record.uploadByteSize,
                width: record.width,
                height: record.height,
                sha256: record.sha256
            )
            items.append(StagedAttachment(
                id: record.itemId,
                clientUploadId: record.clientUploadId,
                originalName: record.originalName,
                kind: AttachmentRules.imageMimeTypes.contains(record.sourceMimeType)
                    ? .image
                    : .file,
                sourceMimeType: record.sourceMimeType,
                localUrl: url,
                progress: record.readyAttachment != nil ? 1 : 0.25,
                status: record.readyAttachment != nil ? .ready : .uploading,
                attachmentId: record.serverAttachmentId,
                readyAttachment: record.readyAttachment
            ))
            if let attachmentId = record.serverAttachmentId {
                serverAttachmentIds[record.itemId, default: []].insert(attachmentId)
            }
            if record.readyAttachment == nil {
                startPipeline(id: record.itemId)
            }
        }
        // Items referenced by a queued send belong to that send, not the
        // composer; the send queue is the durable source of that ownership.
        let queuedUploadIds = Set(
            ((try? await outbox.pendingTextSends()) ?? [])
                .filter { $0.conversationId == conversationId }
                .flatMap(\.attachmentClientUploadIds)
        )
        if !queuedUploadIds.isEmpty {
            markQueuedForSend(clientUploadIds: Array(queuedUploadIds))
        }
    }

    /// Hands the listed uploads over to a queued send: they leave the
    /// composer but keep uploading and stay durable.
    public func markQueuedForSend(clientUploadIds: [String]) {
        let ids = Set(clientUploadIds)
        for index in items.indices where ids.contains(items[index].clientUploadId) {
            items[index].isQueued = true
        }
    }

    private func placeholderAttachment(_ item: StagedAttachment) -> ChatAttachment {
        let prepared = preparedFiles[item.id]
        return ChatAttachment(
            id: "upload-\(item.clientUploadId)",
            status: "uploading",
            kind: item.kind,
            originalName: item.originalName,
            mimeType: prepared?.uploadMimeType ?? item.sourceMimeType,
            byteSize: prepared?.uploadByteSize,
            width: prepared?.width,
            height: prepared?.height,
            displayPath: "",
            thumbnailUrl: item.localUrl,
            displayUrl: item.localUrl
        )
    }

    private func persistRecord(_ id: String) async {
        guard let outbox,
              let item = items.first(where: { $0.id == id }),
              let prepared = preparedFiles[id] else { return }
        try? await outbox.savePendingAttachment(ChatPendingAttachment(
            conversationId: conversationId,
            itemId: id,
            clientUploadId: item.clientUploadId,
            stagedFileName: prepared.url.lastPathComponent,
            originalName: prepared.originalName,
            sourceMimeType: prepared.sourceMimeType,
            uploadMimeType: prepared.uploadMimeType,
            sourceByteSize: prepared.sourceByteSize,
            uploadByteSize: prepared.uploadByteSize,
            width: prepared.width,
            height: prepared.height,
            sha256: prepared.sha256,
            serverAttachmentId: item.attachmentId,
            readyAttachment: item.readyAttachment
        ))
    }

    /// The composer's view of the world: items a queued send owns are still
    /// uploading here but no longer belong to the strip or the next send.
    public var composerItems: [StagedAttachment] { items.filter { !$0.isQueued } }

    public var readyAttachmentIds: [String] {
        composerItems.compactMap { $0.isReady ? $0.attachmentId : nil }
    }

    public var optimisticAttachments: [MessageAttachmentUiModel] {
        composerItems.map { item in
            MessageAttachmentUiModel(
                attachment: item.readyAttachment ?? placeholderAttachment(item),
                localPreviewUrl: item.localUrl,
                isOptimistic: true
            )
        }
    }

    public var allSettled: Bool {
        !composerItems.isEmpty && composerItems.allSatisfy(\.isReady)
    }

    public var hasFailure: Bool { composerItems.contains(where: \.isFailed) }
    public var hasInFlight: Bool { composerItems.contains(where: \.isInFlight) }
    // Staging is local work; offline it queues against connectivity retry.
    public var canAdd: Bool { composerItems.count < AttachmentRules.maxCount }

    public var sendGuidance: String? {
        if hasFailure { return "Retry or remove the upload that didn't finish" }
        if hasInFlight { return "Let the files finish preparing, then send." }
        return nil
    }

    @discardableResult
    public func reserveLoadingItem(
        name: String = "Photo",
        kind: ChatAttachment.Kind = .image
    ) -> String? {
        guard canAdd else {
            if items.count >= AttachmentRules.maxCount {
                notice = "Add up to five files to one message."
            }
            return nil
        }
        let id = UUID().uuidString
        items.append(StagedAttachment(
            id: id,
            clientUploadId: makeClientUploadId(),
            originalName: name,
            kind: kind
        ))
        return id
    }

    public func fulfillLoadingItem(_ id: String, with candidate: AttachmentCandidate) {
        guard let index = index(of: id) else { return }
        let currentCount = items.count - 1
        if let failure = AttachmentRules.validate(candidate, currentCount: currentCount) {
            items.remove(at: index)
            setAdmissionNotice(failures: [failure])
            return
        }
        candidates[id] = candidate
        items[index].originalName = candidate.originalName.isEmpty ? "Photo" : candidate.originalName
        items[index].sourceMimeType = candidate.sourceMimeType
        items[index].kind = AttachmentRules.imageMimeTypes.contains(candidate.sourceMimeType)
            ? .image
            : .file
        items[index].status = .preparing
        items[index].progress = 0.02
        startPipeline(id: id)
    }

    public func failLoadingItem(_ id: String) {
        guard let index = index(of: id) else { return }
        items[index].status = .failed(.preparationFailed)
        items[index].notice = "That attachment could not be prepared. Choose it again."
        announce("1 file didn't finish")
    }

    @discardableResult
    public func add(
        _ incoming: [AttachmentCandidate],
        admissionFailures: [AttachmentFailureReason] = []
    ) -> [String] {
        notice = nil
        var failures = admissionFailures
        var addedIds: [String] = []
        for candidate in incoming {
            guard items.count < AttachmentRules.maxCount else {
                failures.append(.serverRejected("too_many_attachments"))
                continue
            }
            if let failure = AttachmentRules.validate(candidate, currentCount: items.count) {
                failures.append(failure)
                continue
            }
            guard let id = reserveLoadingItem(
                name: candidate.originalName,
                kind: AttachmentRules.imageMimeTypes.contains(candidate.sourceMimeType) ? .image : .file
            ) else { continue }
            addedIds.append(id)
            fulfillLoadingItem(id, with: candidate)
        }
        if !failures.isEmpty { setAdmissionNotice(failures: failures) }
        return addedIds
    }

    public func retry(_ id: String, automatic: Bool = false) {
        guard let index = index(of: id), items[index].isFailed,
              candidates[id] != nil || preparedFiles[id] != nil else { return }
        if automatic {
            guard items[index].automaticAttempts < 3 else { return }
            items[index].automaticAttempts += 1
        } else {
            items[index].automaticAttempts = 0
        }
        items[index].clientUploadId = makeClientUploadId()
        items[index].attachmentId = nil
        items[index].notice = nil
        items[index].status = preparedFiles[id] == nil ? .preparing : .uploading
        items[index].progress = preparedFiles[id] == nil ? 0.02 : 0.25
        startPipeline(
            id: id,
            cancelling: serverAttachmentIds[id] ?? []
        )
    }

    public func remove(_ id: String) {
        guard let item = items.first(where: { $0.id == id }) else { return }
        tasks[id]?.cancel()
        tasks[id] = nil
        pipelineGenerations[id] = nil
        items.removeAll { $0.id == id }
        candidates[id] = nil
        let prepared = preparedFiles.removeValue(forKey: id)
        let serverIds = serverAttachmentIds.removeValue(forKey: id) ?? []
        Task { [commands, staging, outbox] in
            try? await outbox?.removePendingAttachment(itemId: id)
            for attachmentId in serverIds { await commands.cancelUpload(attachmentId: attachmentId) }
            if let url = prepared?.url ?? item.localUrl {
                await staging.remove(url)
            }
        }
        endBackgroundGraceIfSettled()
    }

    public func consumeAfterSend(previewGraceSeconds: TimeInterval = 30) {
        // Only composer items the server already holds may lose their local
        // bytes. Queued sends own their items separately, and anything still
        // unconfirmed keeps its outbox record and staged file so a relaunch
        // restores it instead of losing it.
        let consumed = composerItems
        guard !consumed.isEmpty else { return }
        let consumedIds = Set(consumed.map(\.id))
        for id in consumedIds {
            tasks[id]?.cancel()
            tasks[id] = nil
            candidates[id] = nil
            pipelineGenerations[id] = nil
        }
        let sent = consumed.filter { $0.attachmentId != nil }
        let sentUrls = sent.compactMap(\.localUrl)
        for item in sent {
            preparedFiles[item.id] = nil
            serverAttachmentIds[item.id] = nil
        }
        items.removeAll { consumedIds.contains($0.id) }
        Task { [staging, outbox] in
            for item in sent {
                try? await outbox?.removePendingAttachment(itemId: item.id)
            }
            if previewGraceSeconds > 0 {
                try? await Task.sleep(for: .seconds(previewGraceSeconds))
            }
            for url in sentUrls { await staging.remove(url) }
        }
        endBackgroundGraceIfSettled()
    }

    /// Discards the composer's unsent items. Items owned by a queued send
    /// are deliberately untouched: their records and bytes must survive
    /// leaving the conversation so the send can still complete.
    public func dismiss() {
        let discarded = composerItems
        guard !discarded.isEmpty else { return }
        let discardedIds = Set(discarded.map(\.id))
        let discardedServerIds = serverAttachmentIds.filter { discardedIds.contains($0.key) }
        for id in discardedIds {
            tasks[id]?.cancel()
            tasks[id] = nil
            candidates[id] = nil
            preparedFiles[id] = nil
            serverAttachmentIds[id] = nil
            pipelineGenerations[id] = nil
        }
        items.removeAll { discardedIds.contains($0.id) }
        Task { [commands, staging, outbox] in
            for item in discarded {
                try? await outbox?.removePendingAttachment(itemId: item.id)
                for attachmentId in discardedServerIds[item.id] ?? [] {
                    await commands.cancelUpload(attachmentId: attachmentId)
                }
                if let localUrl = item.localUrl { await staging.remove(localUrl) }
            }
        }
        endBackgroundGraceIfSettled()
    }

    public func applicationDidEnterBackground() {
        guard hasInFlight, backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(
            withName: "Finish chat attachment"
        ) { [weak self] in
            Task { @MainActor in
                self?.pauseForBackgroundExpiry()
            }
        }
    }

    public func applicationWillEnterForeground() {
        endBackgroundGrace()
        Task { [weak self] in
            guard let self else { return }
            await self.connectivityChanged(await self.connectivity.current())
        }
    }

    private func startPipeline(
        id: String,
        cancelling previousAttachmentIds: Set<String> = []
    ) {
        let generation = (pipelineGenerations[id] ?? 0) + 1
        pipelineGenerations[id] = generation
        tasks[id]?.cancel()
        tasks[id] = Task { [weak self, commands] in
            for attachmentId in previousAttachmentIds {
                await commands.cancelUpload(attachmentId: attachmentId)
            }
            guard let self else { return }
            self.serverAttachmentIds[id]?.subtract(previousAttachmentIds)
            guard !Task.isCancelled else { return }
            await self.runPipeline(id: id, generation: generation)
        }
    }

    private func runPipeline(id: String, generation: Int) async {
        guard candidates[id] != nil || preparedFiles[id] != nil else { return }
        await uploadGate.acquire()
        var holdsUploadGate = true
        var shouldRetryAutomatically = false
        do {
            try Task.checkCancellation()
            let prepared: StagedAttachmentFile
            if let existing = preparedFiles[id] {
                prepared = existing
            } else if let candidate = candidates[id] {
                prepared = try await preparer.prepare(candidate, staging: staging)
                preparedFiles[id] = prepared
                update(id) {
                    $0.localUrl = prepared.url
                    $0.progress = 0.25
                }
                await persistRecord(id)
            } else {
                await uploadGate.release()
                return
            }
            try Task.checkCancellation()
            guard let item = items.first(where: { $0.id == id }) else {
                await uploadGate.release()
                holdsUploadGate = false
                return
            }
            update(id) { $0.status = .uploading; $0.progress = 0.25 }
            let authorization = try await commands.initializeUpload(
                InitializeAttachmentRequest(
                    conversationId: conversationId,
                    clientUploadId: item.clientUploadId,
                    originalName: prepared.originalName,
                    sourceMimeType: prepared.sourceMimeType,
                    sourceByteSize: prepared.sourceByteSize,
                    uploadMimeType: prepared.uploadMimeType,
                    uploadSha256: prepared.sha256
                )
            )
            serverAttachmentIds[id, default: []].insert(authorization.attachmentId)
            update(id) { $0.attachmentId = authorization.attachmentId }
            await persistRecord(id)
            for try await progress in uploader.upload(fileUrl: prepared.url, to: authorization) {
                try Task.checkCancellation()
                update(id) {
                    $0.status = .uploading
                    $0.progress = 0.25 + min(1, max(0, progress)) * 0.65
                }
            }
            await uploadGate.release()
            holdsUploadGate = false

            let queuePosition = await completionGate.position
            update(id) {
                $0.status = .finishing(queuePosition: queuePosition)
                $0.progress = min(0.99, 0.90 + 0.09 / Double(max(1, queuePosition)))
            }
            await completionGate.acquire()
            defer { Task { await completionGate.release() } }
            try Task.checkCancellation()
            let attachment = try await commands.completeUpload(
                attachmentId: authorization.attachmentId
            )
            update(id) {
                $0.status = .ready
                $0.progress = 1
                $0.readyAttachment = attachment
                $0.notice = nil
            }
            await persistRecord(id)
            if items.first(where: { $0.id == id })?.isQueued == true {
                onQueuedItemReady?()
            }
            announceReadyCount()
        } catch is CancellationError {
            if holdsUploadGate { await uploadGate.release() }
        } catch {
            if holdsUploadGate { await uploadGate.release() }
            let reason = Self.failureReason(error)
            update(id) {
                $0.status = .failed(reason)
                $0.notice = Self.notice(for: reason, error: error)
            }
            shouldRetryAutomatically = reason.isTransient
            announce("1 file didn't finish")
        }
        guard pipelineGenerations[id] == generation else { return }
        tasks[id] = nil
        if shouldRetryAutomatically { scheduleAutomaticRetry(id) }
        endBackgroundGraceIfSettled()
    }

    private func scheduleAutomaticRetry(_ id: String) {
        guard isConnected,
              let item = items.first(where: { $0.id == id }),
              item.isFailed,
              item.automaticAttempts < 3 else { return }
        let attempt = item.automaticAttempts + 1
        tasks[id] = Task { [weak self, automaticRetryDelay] in
            await automaticRetryDelay(attempt)
            guard !Task.isCancelled, let self, self.isConnected,
                  self.items.first(where: { $0.id == id })?.isFailed == true else { return }
            self.retry(id, automatic: true)
        }
    }

    private func connectivityChanged(_ connected: Bool) async {
        let wasConnected = isConnected
        isConnected = connected
        guard connected, !wasConnected else { return }
        for item in items {
            guard case .failed(let reason) = item.status, reason.isTransient else { continue }
            retry(item.id, automatic: true)
        }
    }

    private func pauseForBackgroundExpiry() {
        isConnected = false
        for item in items where item.isInFlight {
            tasks[item.id]?.cancel()
            update(item.id) {
                $0.status = .failed(.offline)
                $0.notice = "That attachment paused. It will try again when you return."
            }
        }
        endBackgroundGrace()
    }

    private func endBackgroundGraceIfSettled() {
        if !hasInFlight { endBackgroundGrace() }
    }

    private func endBackgroundGrace() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    private func update(_ id: String, mutation: (inout StagedAttachment) -> Void) {
        guard let index = index(of: id) else { return }
        mutation(&items[index])
    }

    private func index(of id: String) -> Int? { items.firstIndex { $0.id == id } }

    private func setAdmissionNotice(failures: [AttachmentFailureReason]) {
        let oversized = failures.filter { $0 == .tooLarge }.count
        let unsupported = failures.filter { $0 == .unsupportedType }.count
        let excess = failures.count - oversized - unsupported
        var parts: [String] = []
        if oversized > 0 {
            parts.append("\(oversized) \(oversized == 1 ? "file was" : "files were") left out because it was over the size limit.")
        }
        if unsupported > 0 {
            parts.append("\(unsupported) unsupported \(unsupported == 1 ? "file was" : "files were") left out.")
        }
        if excess > 0 { parts.append("Add up to five files to one message.") }
        notice = parts.joined(separator: " ")
    }

    private static func failureReason(_ error: any Error) -> AttachmentFailureReason {
        if let preparation = error as? ImagePreparation.Failure {
            return switch preparation {
            case .unsupportedType, .invalidBytes: .unsupportedType
            case .tooLarge: .tooLarge
            case .encodingFailed: .preparationFailed
            }
        }
        if let staging = error as? AttachmentStaging.Failure {
            return staging == .tooLarge ? .tooLarge : .preparationFailed
        }
        guard let failure = error as? AttachmentCommandFailure else {
            if let urlError = error as? URLError,
               [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(urlError.code) {
                return .offline
            }
            return .preparationFailed
        }
        switch failure.code {
        case "unsupported_type", "invalid_file", "macro_not_allowed", "malware_detected":
            return .unsupportedType
        case "too_large": return .tooLarge
        case "rate_limited": return .rateLimited
        case "upload_expired": return .expired
        default: return .serverRejected(failure.code)
        }
    }

    private static func notice(for reason: AttachmentFailureReason, error: any Error) -> String {
        if error as? ImagePreparation.Failure == .invalidBytes {
            return "That file doesn’t match its selected type. Choose another copy."
        }
        if let failure = error as? AttachmentCommandFailure { return failure.notice }
        return switch reason {
        case .unsupportedType: "That file type is not supported yet."
        case .tooLarge: "That file is too large. Try a smaller one."
        case .rateLimited: "You have added several files. Try again in a little while."
        case .expired: "That upload expired. Add the attachment again."
        case .offline: "That attachment paused. It will try again when you reconnect."
        default: "That attachment did not finish yet. Try again."
        }
    }

    private func announceReadyCount() {
        let count = items.filter(\.isReady).count
        announce("\(count) \(count == 1 ? "file" : "files") ready to send")
    }

    private func announce(_ value: String) {
        UIAccessibility.post(notification: .announcement, argument: value)
    }
}

extension AttachmentUploadsModel: QueuedAttachmentResolving {
    public func resolution(clientUploadId: String) -> QueuedAttachmentResolution {
        guard let item = items.first(where: { $0.clientUploadId == clientUploadId }) else {
            guard hasRestored else {
                return .pending(ChatAttachment(
                    id: "upload-\(clientUploadId)",
                    status: "uploading",
                    kind: .file,
                    originalName: "Attachment",
                    displayPath: ""
                ))
            }
            return .gone
        }
        if let attachment = item.readyAttachment { return .ready(attachment) }
        if case .failed(let reason) = item.status, !reason.isTransient { return .gone }
        return .pending(placeholderAttachment(item))
    }

    public func releaseQueued(clientUploadIds: [String]) {
        let ids = Set(clientUploadIds)
        let released = items.filter { ids.contains($0.clientUploadId) }
        guard !released.isEmpty else { return }
        for item in released {
            tasks[item.id]?.cancel()
            tasks[item.id] = nil
            pipelineGenerations[item.id] = nil
            candidates[item.id] = nil
            preparedFiles[item.id] = nil
            serverAttachmentIds[item.id] = nil
        }
        items.removeAll { ids.contains($0.clientUploadId) }
        let urls = released.compactMap(\.localUrl)
        Task { [staging, outbox] in
            for item in released {
                try? await outbox?.removePendingAttachment(itemId: item.id)
            }
            // Grace period: optimistic bubbles read local previews until the
            // confirmed message's signed URLs take over.
            try? await Task.sleep(for: .seconds(30))
            for url in urls { await staging.remove(url) }
        }
        endBackgroundGraceIfSettled()
    }
}

private let attachmentLaunchSweepGate = AttachmentLaunchSweepGate()

private actor AttachmentLaunchSweepGate {
    private var sweptRoots: Set<String> = []

    func claim(_ root: URL) -> Bool {
        sweptRoots.insert(root.standardizedFileURL.path).inserted
    }
}

private actor AttachmentAsyncGate {
    private let limit: Int
    private var active = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    init(limit: Int) { self.limit = max(1, limit) }

    var position: Int { active + waiters.count + 1 }

    func acquire() async {
        if active < limit {
            active += 1
            return
        }
        await withCheckedContinuation { waiters.append($0) }
    }

    func release() {
        if waiters.isEmpty {
            active = max(0, active - 1)
        } else {
            waiters.removeFirst().resume()
        }
    }

}
