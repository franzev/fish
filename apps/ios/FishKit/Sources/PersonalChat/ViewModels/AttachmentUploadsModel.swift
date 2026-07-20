import ChatData
import Foundation
import Observation
import UIKit

@MainActor @Observable
public final class AttachmentUploadsModel {
    public private(set) var items: [StagedAttachment] = []
    public private(set) var notice: String?
    public private(set) var isConnected = true

    public let conversationId: String

    private let commands: any AttachmentCommandProviding
    private let uploader: any AttachmentByteUploading
    private let preparer: any AttachmentPreparing
    private let staging: AttachmentStaging
    private let connectivity: any AttachmentConnectivityProviding
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
        self.makeClientUploadId = makeClientUploadId
        self.automaticRetryDelay = automaticRetryDelay
        Task { [weak self, connectivity] in
            for await connected in connectivity.updates {
                guard let self else { return }
                await self.connectivityChanged(connected)
            }
        }
        let launchCutoff = Date()
        Task { [staging] in
            guard await attachmentLaunchSweepGate.claim(staging.root) else { return }
            _ = await staging.sweep(olderThan: launchCutoff)
        }
    }

    public var readyAttachmentIds: [String] {
        items.compactMap { $0.isReady ? $0.attachmentId : nil }
    }

    public var optimisticAttachments: [MessageAttachmentUiModel] {
        items.compactMap { item in
            guard let attachment = item.readyAttachment else { return nil }
            return MessageAttachmentUiModel(
                attachment: attachment,
                localPreviewUrl: item.localUrl,
                isOptimistic: true
            )
        }
    }

    public var allSettled: Bool {
        !items.isEmpty && items.allSatisfy(\.isReady)
    }

    public var hasFailure: Bool { items.contains(where: \.isFailed) }
    public var hasInFlight: Bool { items.contains(where: \.isInFlight) }
    public var canAdd: Bool { isConnected && items.count < AttachmentRules.maxCount }

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
        guard let index = index(of: id), items[index].isFailed, candidates[id] != nil else { return }
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
        Task { [commands, staging] in
            for attachmentId in serverIds { await commands.cancelUpload(attachmentId: attachmentId) }
            if let url = prepared?.url ?? item.localUrl {
                await staging.remove(url)
            }
        }
        endBackgroundGraceIfSettled()
    }

    public func consumeAfterSend(previewGraceSeconds: TimeInterval = 30) {
        let urls = items.compactMap(\.localUrl)
        tasks.values.forEach { $0.cancel() }
        tasks.removeAll()
        items.removeAll()
        candidates.removeAll()
        preparedFiles.removeAll()
        serverAttachmentIds.removeAll()
        pipelineGenerations.removeAll()
        Task { [staging] in
            if previewGraceSeconds > 0 {
                try? await Task.sleep(for: .seconds(previewGraceSeconds))
            }
            for url in urls { await staging.remove(url) }
        }
        endBackgroundGraceIfSettled()
    }

    public func dismiss() {
        let current = items
        let currentServerIds = serverAttachmentIds
        tasks.values.forEach { $0.cancel() }
        tasks.removeAll()
        items.removeAll()
        candidates.removeAll()
        preparedFiles.removeAll()
        serverAttachmentIds.removeAll()
        pipelineGenerations.removeAll()
        Task { [commands, staging] in
            for item in current {
                for attachmentId in currentServerIds[item.id] ?? [] {
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
        guard let candidate = candidates[id] else { return }
        await uploadGate.acquire()
        var holdsUploadGate = true
        var shouldRetryAutomatically = false
        do {
            try Task.checkCancellation()
            let prepared: StagedAttachmentFile
            if let existing = preparedFiles[id] {
                prepared = existing
            } else {
                prepared = try await preparer.prepare(candidate, staging: staging)
                preparedFiles[id] = prepared
                update(id) {
                    $0.localUrl = prepared.url
                    $0.progress = 0.25
                }
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
