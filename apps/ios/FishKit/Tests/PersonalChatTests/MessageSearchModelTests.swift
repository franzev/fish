import ChatCore
import ChatData
import Foundation
import Testing
@testable import PersonalChat

private final class SearchRecordingClock: Clock, @unchecked Sendable {
    typealias Instant = ContinuousClock.Instant
    private let start = ContinuousClock().now
    private(set) var sleeps: [Duration] = []

    var now: Instant { start }
    var minimumResolution: Duration { .zero }

    func sleep(until deadline: Instant, tolerance: Duration?) async throws {
        sleeps.append(start.duration(to: deadline))
    }
}

private struct SearchTestError: Error {}

private actor SearchMessaging: ChatMessagingProviding {
    struct Call: Sendable, Equatable {
        let query: String
        let cursor: ChatMessageSearchCursor?
        let limit: Int
    }

    private var pages: [Result<ChatMessageSearchPage, Error>]
    private(set) var calls: [Call] = []

    init(pages: [Result<ChatMessageSearchPage, Error>]) {
        self.pages = pages
    }

    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage {
        throw SearchTestError()
    }

    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage {
        ChatMessagePage(messages: [], hasMoreOlder: false, oldestCursor: nil)
    }

    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow {
        ChatNewestWindow(messages: [], readStates: [], hasMoreOlder: false, oldestCursor: nil)
    }

    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage {
        ChatBackfillPage(messages: [], needsReset: false)
    }

    func messages(ids: [String]) async throws -> [ChatMessage] { [] }

    func searchMessages(
        conversationId: String,
        query: String,
        before cursor: ChatMessageSearchCursor?,
        limit: Int
    ) async throws -> ChatMessageSearchPage {
        calls.append(Call(query: query, cursor: cursor, limit: limit))
        guard !pages.isEmpty else { return ChatMessageSearchPage(hits: [], nextCursor: nil) }
        return try pages.removeFirst().get()
    }

    func recordedCalls() -> [Call] { calls }
}

private actor GatedSearchMessaging: ChatMessagingProviding {
    private var pending: [String: CheckedContinuation<ChatMessageSearchPage, Error>] = [:]

    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage { throw SearchTestError() }
    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage {
        ChatMessagePage(messages: [], hasMoreOlder: false, oldestCursor: nil)
    }
    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow {
        ChatNewestWindow(messages: [], readStates: [], hasMoreOlder: false, oldestCursor: nil)
    }
    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage {
        ChatBackfillPage(messages: [], needsReset: false)
    }
    func messages(ids: [String]) async throws -> [ChatMessage] { [] }

    func searchMessages(
        conversationId: String,
        query: String,
        before cursor: ChatMessageSearchCursor?,
        limit: Int
    ) async throws -> ChatMessageSearchPage {
        try await withCheckedThrowingContinuation { pending[query] = $0 }
    }

    func pendingQueries() -> Set<String> { Set(pending.keys) }

    func resolve(_ query: String, with page: ChatMessageSearchPage) {
        pending.removeValue(forKey: query)?.resume(returning: page)
    }
}

@MainActor
private func settleSearch(
    until condition: @escaping @MainActor () async -> Bool
) async {
    for _ in 0..<500 {
        if await condition() { return }
        await Task.yield()
    }
}

private func searchHit(
    _ id: String,
    senderId: String = "coach",
    body: String = "A search result",
    at seconds: TimeInterval = 100
) -> ChatMessageSearchHit {
    ChatMessageSearchHit(
        id: id,
        conversationId: "c1",
        senderId: senderId,
        body: body,
        createdAt: Date(timeIntervalSince1970: seconds)
    )
}

private func searchPage(
    _ hits: [ChatMessageSearchHit],
    next: ChatMessageSearchCursor? = nil
) -> ChatMessageSearchPage {
    ChatMessageSearchPage(hits: hits, nextCursor: next)
}

@Suite(.serialized)
@MainActor
struct MessageSearchModelTests {
    @Test func openAndCloseResetTheEntireSession() {
        let provider = SearchMessaging(pages: [])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider
        )

        model.open()
        #expect(model.isPresented)
        model.query = "practice"
        model.close()
        #expect(!model.isPresented)
        #expect(model.status == .initial)
        #expect(model.query.isEmpty)
        #expect(model.results.isEmpty)
        #expect(model.notice == nil)
        #expect(!model.hasMoreResults)
    }

    @Test func blankQueryNeverCallsTheProvider() async {
        let provider = SearchMessaging(pages: [])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            debounce: .zero
        )
        model.open()
        model.query = " \n\t "
        await settleSearch { model.status == .initial }
        #expect(await provider.recordedCalls().isEmpty)
    }

    @Test func queryDebouncesTrimsAndImmediateSubmitSkipsTheWait() async {
        let clock = SearchRecordingClock()
        let provider = SearchMessaging(pages: [
            .success(searchPage([searchHit("m1")])),
            .success(searchPage([searchHit("m2")])),
        ])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            clock: clock
        )
        model.open()
        model.query = "  practice  "
        await settleSearch { model.results.count == 1 }
        #expect(clock.sleeps == [.milliseconds(300)])
        #expect(await provider.recordedCalls().first?.query == "practice")

        let immediateProvider = SearchMessaging(pages: [
            .success(searchPage([searchHit("m2")])),
        ])
        let immediateModel = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: immediateProvider,
            debounce: .milliseconds(300)
        )
        immediateModel.open()
        immediateModel.query = "later"
        immediateModel.submitImmediately()
        await settleSearch { immediateModel.results.first?.id == "m2" }
        #expect(clock.sleeps == [.milliseconds(300)])
        #expect(await immediateProvider.recordedCalls().map(\.query) == ["later"])
    }

    @Test func staleResponsesCannotReplaceTheNewestQuery() async {
        let provider = GatedSearchMessaging()
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            debounce: .zero
        )
        model.open()
        model.query = "old"
        await settleSearch { await provider.pendingQueries().contains("old") }
        model.query = "new"
        await settleSearch { await provider.pendingQueries().contains("new") }

        await provider.resolve("new", with: searchPage([searchHit("fresh")]))
        await settleSearch { model.results.map(\.id) == ["fresh"] }
        await provider.resolve("old", with: searchPage([searchHit("stale")]))
        await Task.yield()

        #expect(model.results.map(\.id) == ["fresh"])
        #expect(model.status == .ready)
    }

    @Test func failureRetryAndEmptyStatesAreDistinct() async {
        let provider = SearchMessaging(pages: [
            .failure(SearchTestError()),
            .success(searchPage([])),
        ])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            debounce: .zero
        )
        model.open()
        model.query = "practice"
        await settleSearch { model.status == .notice }
        #expect(model.notice == MessageSearchModel.searchNotice)
        model.retry()
        await settleSearch { model.status == .empty }
        #expect(model.results.isEmpty)
        #expect(model.notice == nil)
    }

    @Test func paginationAppendsDeduplicatesAndPreservesResultsOnFailure() async {
        let cursor = ChatMessageSearchCursor(createdAt: "2026-07-18T00:00:00.000Z", id: "m1")
        let provider = SearchMessaging(pages: [
            .success(searchPage([searchHit("m1"), searchHit("m2")], next: cursor)),
            .failure(SearchTestError()),
            .success(searchPage([searchHit("m2"), searchHit("m3")])),
        ])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            debounce: .zero
        )
        model.open()
        model.query = "practice"
        await settleSearch { model.results.count == 2 }
        model.loadMore()
        await settleSearch { model.notice != nil }
        #expect(model.results.map(\.id) == ["m1", "m2"])
        #expect(model.hasMoreResults)
        model.retry()
        await settleSearch { model.results.count == 3 }
        #expect(model.results.map(\.id) == ["m1", "m2", "m3"])
        #expect(!model.hasMoreResults)
        #expect(model.notice == nil)
        #expect(await provider.recordedCalls().map(\.cursor) == [nil, cursor, cursor])
    }

    @Test func resultMappingUsesKnownSenderDateAndPlainExcerpt() async {
        let calendar: Calendar = {
            var value = Calendar(identifier: .gregorian)
            value.timeZone = TimeZone(identifier: "UTC")!
            return value
        }()
        let now = Date(timeIntervalSince1970: 1721260800)
        let provider = SearchMessaging(pages: [.success(searchPage([
            searchHit(
                "m1",
                senderId: "me",
                body: "  One\n\ttwo   three  ",
                at: 1721217600
            ),
        ]))])
        let model = MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            now: { now },
            calendar: calendar,
            locale: Locale(identifier: "en_US"),
            debounce: .zero
        )
        model.open()
        model.query = "one"
        await settleSearch { model.status == .ready }

        let result = model.results[0]
        #expect(result.senderLabel == "You")
        #expect(result.excerpt == "One two three")
        #expect(result.dateLabel.hasPrefix("Yesterday"))
        #expect(result.accessibilityLabel == "You, One two three, \(result.dateLabel)")
    }
}
