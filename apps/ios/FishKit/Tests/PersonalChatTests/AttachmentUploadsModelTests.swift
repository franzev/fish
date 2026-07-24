import ChatData
import Foundation
import Testing
@testable import PersonalChat

private actor ScriptedAttachmentCommands: AttachmentCommandProviding {
    var initializeFailures: [AttachmentCommandFailure]
    var completionFailures: [AttachmentCommandFailure]
    var initializeRequests: [InitializeAttachmentRequest] = []
    var cancelledIds: [String] = []
    var activeCompletions = 0
    var maximumActiveCompletions = 0
    let completionDelay: Duration

    init(
        initializeFailures: [AttachmentCommandFailure] = [],
        completionFailures: [AttachmentCommandFailure] = [],
        completionDelay: Duration = .zero
    ) {
        self.initializeFailures = initializeFailures
        self.completionFailures = completionFailures
        self.completionDelay = completionDelay
    }

    func initializeUpload(
        _ request: InitializeAttachmentRequest
    ) async throws -> AttachmentUploadAuthorization {
        initializeRequests.append(request)
        if !initializeFailures.isEmpty { throw initializeFailures.removeFirst() }
        return AttachmentUploadAuthorization(
            attachmentId: "server-\(request.clientUploadId)",
            bucket: "chat-images",
            objectPath: "c/server-\(request.clientUploadId)/staging",
            uploadToken: "token",
            uploadMimeType: request.uploadMimeType,
            signedUploadUrl: URL(string: "https://fish.test/upload")!,
            expiresAt: Date().addingTimeInterval(7_200)
        )
    }

    func completeUpload(attachmentId: String) async throws -> ChatAttachment {
        activeCompletions += 1
        maximumActiveCompletions = max(maximumActiveCompletions, activeCompletions)
        if completionDelay != .zero { try? await Task.sleep(for: completionDelay) }
        defer { activeCompletions -= 1 }
        if !completionFailures.isEmpty { throw completionFailures.removeFirst() }
        return ChatAttachment(
            id: attachmentId,
            kind: .file,
            originalName: "notes.txt",
            mimeType: "text/plain",
            byteSize: 5,
            displayPath: "c/\(attachmentId)/file.txt"
        )
    }

    func cancelUpload(attachmentId: String) async { cancelledIds.append(attachmentId) }
    func refreshUrls(attachmentIds: [String]) async throws -> [SignedAttachmentUrl] { [] }
}

private struct ImmediateAttachmentUploader: AttachmentByteUploading {
    func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(0)
            continuation.yield(0.5)
            continuation.yield(1)
            continuation.finish()
        }
    }
}

private struct DelayedAttachmentUploader: AttachmentByteUploading {
    func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                continuation.yield(0.5)
                try? await Task.sleep(for: .milliseconds(150))
                guard !Task.isCancelled else { return }
                continuation.yield(1)
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

private struct PausingAttachmentUploader: AttachmentByteUploading {
    func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(0.25)
        }
    }
}

private struct FailingAttachmentPreparer: AttachmentPreparing {
    let failure: ImagePreparation.Failure

    func prepare(
        _ candidate: AttachmentCandidate,
        staging: AttachmentStaging
    ) async throws -> StagedAttachmentFile {
        throw failure
    }
}

private final class SequentialIds: @unchecked Sendable {
    private let lock = NSLock()
    private var next = 0

    func make() -> String {
        lock.lock()
        defer { lock.unlock() }
        next += 1
        return "client-\(next)"
    }
}

@MainActor struct AttachmentUploadsModelTests {
    @Test func pipelineMapsProgressPreservesOrderAndSerializesCompletes() async throws {
        let commands = ScriptedAttachmentCommands(completionDelay: .milliseconds(40))
        let model = try makeModel(commands: commands, uploader: ImmediateAttachmentUploader())
        model.add([candidate("one"), candidate("two"), candidate("three")])

        #expect(await eventually { model.items.count == 3 && model.items.allSatisfy(\.isReady) })
        #expect(model.items.map(\.progress) == [1, 1, 1])
        #expect(model.readyAttachmentIds == model.items.compactMap(\.attachmentId))
        #expect(await commands.maximumActiveCompletions == 1)
        #expect(await commands.initializeRequests.count == 3)
    }

    @Test func realUploadProgressMapsIntoTheReservedTwentyFiveToNinetyRange() async throws {
        let commands = ScriptedAttachmentCommands()
        let model = try makeModel(commands: commands, uploader: DelayedAttachmentUploader())
        model.add([candidate("progress")])
        #expect(await eventually {
            guard let item = model.items.first else { return false }
            return item.status == .uploading && item.progress >= 0.57 && item.progress <= 0.58
        })
        #expect(await eventually { model.items.first?.isReady == true })
    }

    @Test func rateLimitAndExpiryUseCalmTypedFailureCopy() async throws {
        let commands = ScriptedAttachmentCommands(initializeFailures: [
            AttachmentCommandFailure(
                code: "rate_limited",
                notice: "You have added several files. Try again in a little while.",
                statusCode: 429
            ),
        ])
        let ids = SequentialIds()
        let model = try makeModel(
            commands: commands,
            uploader: ImmediateAttachmentUploader(),
            ids: ids
        )
        model.add([candidate("rate")])
        #expect(await eventually { model.items.first?.isFailed == true })
        #expect(model.items.first?.status == .failed(.rateLimited))
        #expect(model.items.first?.notice?.contains("little while") == true)

        model.retry(try #require(model.items.first?.id))
        #expect(await eventually { model.items.first?.isReady == true })
        let requests = await commands.initializeRequests
        #expect(requests.map(\.clientUploadId) == ["client-1", "client-2"])

        let expiredCommands = ScriptedAttachmentCommands(initializeFailures: [
            AttachmentCommandFailure(
                code: "upload_expired",
                notice: "That upload expired. Add the attachment again.",
                statusCode: 410
            ),
        ])
        let expired = try makeModel(
            commands: expiredCommands,
            uploader: ImmediateAttachmentUploader()
        )
        expired.add([candidate("expired")])
        #expect(await eventually { expired.items.first?.status == .failed(.expired) })
    }

    @Test func transientFailuresRetryAutomaticallyAtMostThreeTimesWithFreshIds() async throws {
        let commands = ScriptedAttachmentCommands(initializeFailures: [
            .init(code: "upload_unavailable", notice: "Try again."),
            .init(code: "processing", notice: "Still checking."),
        ])
        let ids = SequentialIds()
        let model = try makeModel(
            commands: commands,
            uploader: ImmediateAttachmentUploader(),
            ids: ids,
            automaticRetryDelay: { _ in }
        )
        model.add([candidate("retry")])
        #expect(await eventually { model.items.first?.isReady == true })
        #expect(await commands.initializeRequests.map(\.clientUploadId) == [
            "client-1", "client-2", "client-3",
        ])
        #expect(model.items.first?.automaticAttempts == 2)
    }

    @Test func automaticRetryStopsAfterThreeAttempts() async throws {
        let commands = ScriptedAttachmentCommands(initializeFailures: Array(
            repeating: .init(code: "upload_unavailable", notice: "Try again."),
            count: 4
        ))
        let ids = SequentialIds()
        let model = try makeModel(
            commands: commands,
            uploader: ImmediateAttachmentUploader(),
            ids: ids,
            automaticRetryDelay: { _ in }
        )
        model.add([candidate("retry-limit")])

        #expect(await eventually {
            let requestCount = await commands.initializeRequests.count
            return model.items.first?.isFailed == true
                && model.items.first?.automaticAttempts == 3
                && requestCount == 4
        })
        #expect(await commands.initializeRequests.map(\.clientUploadId) == [
            "client-1", "client-2", "client-3", "client-4",
        ])
    }

    @Test func retryCancelsAnInitializedServerRowBeforeStartingFresh() async throws {
        let commands = ScriptedAttachmentCommands(completionFailures: [
            .init(code: "processing_failed", notice: "Try again."),
        ])
        let ids = SequentialIds()
        let model = try makeModel(
            commands: commands,
            uploader: ImmediateAttachmentUploader(),
            ids: ids,
            automaticRetryDelay: { _ in }
        )
        model.add([candidate("server-cleanup")])

        #expect(await eventually { model.items.first?.isReady == true })
        #expect(await commands.cancelledIds == ["server-client-1"])
        #expect(await commands.initializeRequests.map(\.clientUploadId) == [
            "client-1", "client-2",
        ])
    }

    @Test func removeAndDismissCancelServerRowsAndDeleteStagedFiles() async throws {
        let commands = ScriptedAttachmentCommands()
        let root = temporaryDirectory()
        let model = try makeModel(
            commands: commands,
            uploader: PausingAttachmentUploader(),
            root: root
        )
        model.add([candidate("remove")])
        #expect(await eventually { model.items.first?.attachmentId != nil })
        let item = try #require(model.items.first)
        let local = try #require(item.localUrl)
        model.remove(item.id)
        #expect(await eventually { !(await commands.cancelledIds).isEmpty })
        #expect(await eventually { !FileManager.default.fileExists(atPath: local.path) })
        #expect(model.items.isEmpty)

        model.add([candidate("dismiss")])
        #expect(await eventually { model.items.first?.attachmentId != nil })
        let second = try #require(model.items.first)
        model.dismiss()
        #expect(await eventually { (await commands.cancelledIds).count == 2 })
        #expect(await eventually {
            guard let url = second.localUrl else { return false }
            return !FileManager.default.fileExists(atPath: url.path)
        })
        try? FileManager.default.removeItem(at: root)
    }

    @Test func admissionKeepsValidFilesAndCombinesSkipReasons() async throws {
        let model = try makeModel(
            commands: ScriptedAttachmentCommands(),
            uploader: ImmediateAttachmentUploader()
        )
        model.add(
            [candidate("valid")],
            admissionFailures: [.tooLarge, .unsupportedType, .preparationFailed]
        )
        #expect(model.items.count == 1)
        #expect(model.notice?.contains("over the size limit") == true)
        #expect(model.notice?.contains("unsupported") == true)
        #expect(model.notice?.contains("five files") == true)
        #expect(await eventually { model.items.first?.isReady == true })
    }

    @Test func localPreparationFailuresKeepSpecificCalmGuidance() async throws {
        let mismatch = try makeModel(
            commands: ScriptedAttachmentCommands(),
            uploader: ImmediateAttachmentUploader(),
            preparer: FailingAttachmentPreparer(failure: .invalidBytes)
        )
        mismatch.add([candidate("mismatch")])
        #expect(await eventually { mismatch.items.first?.isFailed == true })
        #expect(mismatch.items.first?.status == .failed(.unsupportedType))
        #expect(mismatch.items.first?.notice?.contains("selected type") == true)

        let oversized = try makeModel(
            commands: ScriptedAttachmentCommands(),
            uploader: ImmediateAttachmentUploader(),
            preparer: FailingAttachmentPreparer(failure: .tooLarge)
        )
        oversized.add([candidate("oversized")])
        #expect(await eventually { oversized.items.first?.status == .failed(.tooLarge) })
        #expect(oversized.items.first?.notice?.contains("too large") == true)
    }

    @Test func creatingAnotherModelDoesNotSweepAnActiveStagedFile() async throws {
        let root = temporaryDirectory()
        let first = try makeModel(
            commands: ScriptedAttachmentCommands(),
            uploader: PausingAttachmentUploader(),
            root: root
        )
        first.add([candidate("active")])
        #expect(await eventually { first.items.first?.localUrl != nil })
        let local = try #require(first.items.first?.localUrl)

        let second = try makeModel(
            commands: ScriptedAttachmentCommands(),
            uploader: PausingAttachmentUploader(),
            root: root
        )
        try? await Task.sleep(for: .milliseconds(100))
        #expect(FileManager.default.fileExists(atPath: local.path))

        first.dismiss()
        second.dismiss()
        try? FileManager.default.removeItem(at: root)
    }

    private func makeModel(
        commands: ScriptedAttachmentCommands,
        uploader: any AttachmentByteUploading,
        preparer: any AttachmentPreparing = ImagePreparation(),
        ids: SequentialIds = SequentialIds(),
        root: URL? = nil,
        automaticRetryDelay: @escaping @Sendable (Int) async -> Void = { _ in }
    ) throws -> AttachmentUploadsModel {
        AttachmentUploadsModel(
            conversationId: "conversation-1",
            commands: commands,
            uploader: uploader,
            preparer: preparer,
            staging: try AttachmentStaging(root: root ?? temporaryDirectory()),
            connectivity: AlwaysConnectedAttachmentConnectivity(),
            makeClientUploadId: ids.make,
            automaticRetryDelay: automaticRetryDelay
        )
    }

    private func candidate(_ name: String) -> AttachmentCandidate {
        AttachmentCandidate(
            data: Data("hello".utf8),
            originalName: "\(name).txt",
            sourceMimeType: "text/plain"
        )
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-upload-model-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    private func eventually(
        // Snapshot suites render synchronously on the same MainActor in the
        // package-wide test process, so leave enough wall-clock headroom for
        // those captures without weakening the per-state assertions.
        timeout: Duration = .seconds(30),
        _ predicate: @MainActor () async -> Bool
    ) async -> Bool {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while clock.now < deadline {
            if await predicate() { return true }
            try? await Task.sleep(for: .milliseconds(10))
        }
        return await predicate()
    }
}
