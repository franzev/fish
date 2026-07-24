import ChatCore
import ChatData
import Foundation
import PersonalChat
import Testing

@Suite(.serialized)
struct SharedContentMediaRuntimeTests {
    @Test func closeCancelsDelayedURLClearsLeaseGenerationAndPublishesNoBytes() async throws {
        let transport = DelayedThumbnailTransport()
        DelayedThumbnailURLProtocol.transport = transport
        defer { DelayedThumbnailURLProtocol.transport = nil }

        let configuration = SharedContentEphemeralSession.configuration()
        configuration.protocolClasses = [DelayedThumbnailURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let deliveryStore = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in
                ids.map {
                    SignedAttachmentUrl(
                        attachmentId: $0,
                        thumbnailUrl: URL(string: "https://media.fish.example.com/delayed-thumbnail"),
                        displayUrl: nil
                    )
                }
            }
        )
        let thumbnailStore = try SharedContentThumbnailStore(
            root: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        )
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://media.fish.example.com")
        )
        let runtime = SharedContentMediaRuntime(
            messaging: UnusedSharedContentMessaging(),
            deliveryStore: deliveryStore,
            thumbnailStore: thumbnailStore,
            urlPolicy: policy,
            session: session,
            mediaTransport: testTransport(policy)
        )
        let request = thumbnailRequest()
        let load = Task {
            await runtime.load(request, intent: .visibleThumbnail)
        }

        await transport.waitUntilStarted()
        load.cancel()
        await runtime.close(generation: 1)

        #expect(await load.value == nil)
        #expect(await transport.waitUntilCancelled())
        #expect(await deliveryStore.count == 0)
        #expect(await thumbnailStore.stagedCount == 0)
    }

    @Test func closeDuringDelayedLeaseRejectsLateAuthorityAndPublishesNoBytes() async throws {
        let refresh = DelayedLeaseRefresh()
        let deliveryStore = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in
                await refresh.resolve(ids)
            }
        )
        let thumbnailStore = try SharedContentThumbnailStore(
            root: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        )
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://media.fish.example.com")
        )
        let runtime = SharedContentMediaRuntime(
            messaging: UnusedSharedContentMessaging(),
            deliveryStore: deliveryStore,
            thumbnailStore: thumbnailStore,
            urlPolicy: policy
        )
        let request = thumbnailRequest()
        let load = Task {
            await runtime.load(request, intent: .visibleThumbnail)
        }

        await refresh.waitUntilStarted()
        load.cancel()
        await runtime.close(generation: 1)
        await refresh.finish()

        #expect(await load.value == nil)
        #expect(await deliveryStore.count == 0)
        #expect(await thumbnailStore.stagedCount == 0)
    }

    @Test func productionURLPolicyRejectsUntrustedPrivateAndPlaintextTargetsAndAllowsExpectedCDNs() {
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://project.supabase.co")
        )

        #expect(policy.allows(
            URL(string: "https://project.supabase.co/storage/v1/object")!,
            kind: .storage
        ))
        #expect(policy.allows(
            URL(string: "https://project.storage.supabase.co/object")!,
            kind: .storage
        ))
        #expect(policy.allows(
            URL(string: "https://static.klipy.com/poster.webp")!,
            kind: .gif
        ))
        #expect(policy.allows(
            URL(string: "https://media3.giphy.com/poster.webp")!,
            kind: .gif
        ))
        #expect(!policy.allows(
            URL(string: "https://unapproved.example/poster.webp")!,
            kind: .gif
        ))
        #expect(!policy.allows(
            URL(string: "http://project.supabase.co/storage/v1/object")!,
            kind: .storage
        ))

        let privatePolicy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://10.0.0.8")
        )
        #expect(!privatePolicy.allows(
            URL(string: "https://10.0.0.8/private")!,
            kind: .storage
        ))
        #expect(!policy.allowsRedirect(
            from: URL(string: "https://project.supabase.co/start")!,
            to: URL(string: "https://static.klipy.com/redirected")!,
            kind: .storage
        ))
    }

    @Test func localDevelopmentHTTPRequiresAnExplicitMatchingBackend() {
        let localURL = URL(string: "http://127.0.0.1:54321/storage/v1/object")!
        let denied = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "http://127.0.0.1:54321")
        )
        let allowed = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "http://127.0.0.1:54321"),
            allowsLocalDevelopment: true
        )

        #expect(!denied.allows(localURL, kind: .storage))
        #expect(allowed.allows(localURL, kind: .storage))
        #expect(!allowed.allows(localURL, kind: .gif))
        #expect(!allowed.allows(
            URL(string: "http://127.0.0.1:54322/storage/v1/object")!,
            kind: .storage
        ))
        #expect(!allowed.allows(
            URL(string: "https://127.0.0.1:54321/storage/v1/object")!,
            kind: .storage
        ))
    }

    @Test func canonicalPolicyRejectsLocalhostDescendantsAndTrailingDotLoopback() {
        let descendant = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://foo.localhost")
        )
        let trailingLoopback = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://127.0.0.1.")
        )
        #expect(!descendant.allows(
            URL(string: "https://foo.localhost/private")!,
            kind: .storage
        ))
        #expect(!trailingLoopback.allows(
            URL(string: "https://127.0.0.1./private")!,
            kind: .storage
        ))
        #expect(SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://project.supabase.co")
        ).allows(
            URL(string: "https://PROJECT.SUPABASE.CO./storage/v1/object")!,
            kind: .storage
        ))
    }

    @Test func dnsAndConnectedPeerValidationRejectPrivateMixedAndReboundAnswers() async {
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://project.supabase.co")
        )
        let url = URL(string: "https://project.supabase.co/storage/v1/object")!
        for answers in [
            ["10.0.0.8"],
            ["fd00::8"],
            ["93.184.216.34", "192.168.1.8"],
            ["2606:4700:4700::1111", "fe80::1"],
        ] {
            let validation = await policy.validate(
                url,
                kind: .storage,
                resolver: SharedContentDNSResolver { _ in answers }
            )
            #expect(validation == nil)
        }

        let publicValidation = await policy.validate(
            url,
            kind: .storage,
            resolver: SharedContentDNSResolver {
                _ in ["93.184.216.34", "2606:4700:4700::1111"]
            }
        )
        #expect(publicValidation != nil)
        #expect(policy.allowsConnectedPeer(
            "93.184.216.34",
            validation: publicValidation!
        ))
        #expect(!policy.allowsConnectedPeer(
            "127.0.0.1",
            validation: publicValidation!
        ))

        let sequence = SequencedDNSAnswers([
            ["93.184.216.34"],
            ["127.0.0.1"],
        ])
        let resolver = SharedContentDNSResolver { _ in
            await sequence.next()
        }
        #expect(await policy.validate(url, kind: .storage, resolver: resolver) != nil)
        #expect(await policy.validate(url, kind: .storage, resolver: resolver) == nil)
        #expect(await policy.validate(
            URL(string: "https://static.klipy.com/poster.webp")!,
            kind: .gif,
            resolver: SharedContentDNSResolver { _ in ["93.184.216.34"] }
        ) != nil)
    }

    @Test func unapprovedRuntimeHostNeverStartsTheInjectedTransport() async throws {
        DelayedThumbnailURLProtocol.requestCount = 0
        let configuration = SharedContentEphemeralSession.configuration()
        configuration.protocolClasses = [DelayedThumbnailURLProtocol.self]
        let deliveryStore = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in
                ids.map {
                    SignedAttachmentUrl(
                        attachmentId: $0,
                        thumbnailUrl: URL(string: "https://evil.test/thumbnail"),
                        displayUrl: nil
                    )
                }
            }
        )
        let thumbnailStore = try SharedContentThumbnailStore(
            root: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        )
        let policy = SharedContentMediaURLPolicy(
            supabaseURL: URL(string: "https://media.fish.example.com")
        )
        let runtime = SharedContentMediaRuntime(
            messaging: UnusedSharedContentMessaging(),
            deliveryStore: deliveryStore,
            thumbnailStore: thumbnailStore,
            urlPolicy: policy,
            session: URLSession(configuration: configuration),
            mediaTransport: testTransport(policy)
        )

        #expect(await runtime.load(thumbnailRequest(), intent: .visibleThumbnail) == nil)
        #expect(DelayedThumbnailURLProtocol.requestCount == 0)
    }

    private func thumbnailRequest() -> SharedContentMediaThumbnailRequest {
        SharedContentMediaThumbnailRequest(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            itemId: "item-a",
            contentVersion: "v1",
            kind: "photo",
            sourceMessageId: "message-a",
            attachmentId: "attachment-a"
        )
    }

    private func testTransport(
        _ policy: SharedContentMediaURLPolicy
    ) -> SharedContentMediaTransport {
        SharedContentMediaTransport(
            policy: policy,
            resolver: SharedContentDNSResolver { _ in ["93.184.216.34"] },
            requiresPeerValidation: false
        )
    }
}

private actor SequencedDNSAnswers {
    private var answers: [[String]]

    init(_ answers: [[String]]) {
        self.answers = answers
    }

    func next() -> [String] {
        answers.isEmpty ? [] : answers.removeFirst()
    }
}

private actor DelayedLeaseRefresh {
    private var continuation: CheckedContinuation<[SignedAttachmentUrl], Never>?
    private var startedWaiters: [CheckedContinuation<Void, Never>] = []

    func resolve(_ ids: [String]) async -> [SignedAttachmentUrl] {
        startedWaiters.forEach { $0.resume() }
        startedWaiters.removeAll()
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilStarted() async {
        if continuation != nil { return }
        await withCheckedContinuation { continuation in
            startedWaiters.append(continuation)
        }
    }

    func finish() {
        continuation?.resume(returning: [
            SignedAttachmentUrl(
                attachmentId: "attachment-a",
                thumbnailUrl: URL(string: "https://media.fish.example.com/late"),
                displayUrl: nil
            ),
        ])
        continuation = nil
    }
}

private final class DelayedThumbnailTransport: @unchecked Sendable {
    private let lock = NSLock()
    private var started = false
    private var cancelled = false
    private var startedWaiters: [CheckedContinuation<Void, Never>] = []

    var wasCancelled: Bool {
        lock.withLock { cancelled }
    }

    func start() {
        let waiters = lock.withLock {
            started = true
            defer { startedWaiters.removeAll() }
            return startedWaiters
        }
        waiters.forEach { $0.resume() }
    }

    func cancel() {
        lock.withLock { cancelled = true }
    }

    func waitUntilStarted() async {
        if lock.withLock({ started }) { return }
        await withCheckedContinuation { continuation in
            let shouldResume = lock.withLock {
                if started { return true }
                startedWaiters.append(continuation)
                return false
            }
            if shouldResume { continuation.resume() }
        }
    }

    func waitUntilCancelled() async -> Bool {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(1))
        while clock.now < deadline {
            if wasCancelled { return true }
            await Task.yield()
        }
        return wasCancelled
    }
}

private final class DelayedThumbnailURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var transport: DelayedThumbnailTransport?
    nonisolated(unsafe) static var requestCount = 0

    override class func canInit(with request: URLRequest) -> Bool {
        requestCount += 1
        return request.url?.host == "media.fish.example.com"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        Self.transport?.start()
    }

    override func stopLoading() {
        Self.transport?.cancel()
        client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
    }
}

private actor UnusedSharedContentMessaging: ChatMessagingProviding {
    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage {
        fatalError("Unused by shared-content thumbnail tests")
    }

    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage {
        fatalError("Unused by shared-content thumbnail tests")
    }

    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow {
        fatalError("Unused by shared-content thumbnail tests")
    }

    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage {
        fatalError("Unused by shared-content thumbnail tests")
    }

    func messages(ids: [String]) async throws -> [ChatMessage] {
        fatalError("Unused by shared-content thumbnail tests")
    }

    func searchMessages(
        conversationId: String,
        query: String,
        before: ChatMessageSearchCursor?,
        limit: Int
    ) async throws -> ChatMessageSearchPage {
        fatalError("Unused by shared-content thumbnail tests")
    }
}
