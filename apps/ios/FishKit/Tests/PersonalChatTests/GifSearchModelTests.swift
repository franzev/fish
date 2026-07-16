import ChatData
import Foundation
import Testing
@testable import PersonalChat

/// Records every sleep and returns immediately — debounce flow stays
/// deterministic without wall-clock waits.
private final class RecordingClock: Clock, @unchecked Sendable {
    typealias Instant = ContinuousClock.Instant
    private let start = ContinuousClock().now
    var now: Instant { start }
    var minimumResolution: Duration { .zero }
    private(set) var sleeps: [Duration] = []

    func sleep(until deadline: Instant, tolerance: Duration?) async throws {
        sleeps.append(start.duration(to: deadline))
    }
}

/// Scripted provider: queued results per call, recorded calls.
private actor ScriptedGifProvider: GifProviding {
    nonisolated let isAvailable: Bool
    private(set) var trendingCalls: [String?] = []
    private(set) var searchCalls: [(query: String, cursor: String?)] = []
    private var results: [Result<GifPage, Error>]

    init(results: [Result<GifPage, Error>], available: Bool = true) {
        self.results = results
        self.isAvailable = available
    }

    func trending(cursor: String?) async throws -> GifPage {
        trendingCalls.append(cursor)
        return try nextResult()
    }

    func search(query: String, cursor: String?) async throws -> GifPage {
        searchCalls.append((query, cursor))
        return try nextResult()
    }

    func registerShare(gif: ChatGif, query: String) async {}

    private func nextResult() throws -> GifPage {
        guard !results.isEmpty else { return GifPage(gifs: [], next: nil) }
        return try results.removeFirst().get()
    }
}

/// Parks each request until the test resolves it — for staleness ordering.
private actor GatedGifProvider: GifProviding {
    nonisolated let isAvailable = true
    private var pending: [String: CheckedContinuation<GifPage, Error>] = [:]

    func trending(cursor: String?) async throws -> GifPage {
        try await park(key: "")
    }

    func search(query: String, cursor: String?) async throws -> GifPage {
        try await park(key: query)
    }

    func registerShare(gif: ChatGif, query: String) async {}

    func pendingKeys() -> Set<String> { Set(pending.keys) }

    func resolve(_ key: String, with page: GifPage) {
        pending.removeValue(forKey: key)?.resume(returning: page)
    }

    private func park(key: String) async throws -> GifPage {
        try await withCheckedThrowingContinuation { pending[key] = $0 }
    }
}

@MainActor
private func settle(until condition: @escaping () async -> Bool) async {
    for _ in 0..<2000 {
        if await condition() { return }
        await Task.yield()
    }
}

private func page(_ ids: [String], next: String? = nil) -> GifPage {
    GifPage(gifs: ids.map { .fixture(providerId: $0) }, next: next)
}

@MainActor struct GifSearchModelTests {
    @Test func startLoadsTrendingOnce() async {
        let provider = ScriptedGifProvider(results: [.success(page(["a", "b"], next: "p2"))])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        #expect(model.status == .loading)
        model.start()
        model.start()
        await settle { model.status == .ready }
        #expect(model.gifs.map(\.providerId) == ["a", "b"])
        let trendingCalls = await provider.trendingCalls
        #expect(trendingCalls == [nil])
    }

    @Test func rapidTypingCoalescesIntoOneSearchForTheFinalQuery() async {
        let provider = ScriptedGifProvider(results: [.success(page(["match"]))])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.query = "o"
        model.query = "ot"
        model.query = "otter"
        await settle { model.status == .ready }
        let calls = await provider.searchCalls
        #expect(calls.count == 1)
        #expect(calls.first?.query == "otter")
    }

    @Test func typingDebouncesButClearingLoadsImmediately() async {
        let clock = RecordingClock()
        let provider = ScriptedGifProvider(results: [
            .success(page(["searched"])),
            .success(page(["trending"])),
        ])
        let model = GifSearchModel(provider: provider, clock: clock)
        model.query = "otter"
        await settle { model.status == .ready }
        #expect(clock.sleeps == [.milliseconds(300)])
        model.query = ""
        await settle { model.gifs.first?.providerId == "trending" }
        #expect(clock.sleeps == [.milliseconds(300)])
    }

    @Test func searchQueriesAreTrimmedButKeepInnerPunctuation() async {
        let provider = ScriptedGifProvider(results: [.success(page(["x"]))])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.query = "  thank you!! "
        await settle { model.status == .ready }
        let calls = await provider.searchCalls
        #expect(calls.first?.query == "thank you!!")
    }

    @Test func staleResponsesNeverClobberNewerOnes() async {
        let provider = GatedGifProvider()
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.query = "a"
        await settle { await provider.pendingKeys().contains("a") }
        model.query = "ab"
        await settle { await provider.pendingKeys().contains("ab") }

        await provider.resolve("ab", with: page(["fresh"]))
        await settle { model.status == .ready }
        await provider.resolve("a", with: page(["stale"]))
        await settle { true }

        #expect(model.gifs.map(\.providerId) == ["fresh"])
        #expect(model.status == .ready)
    }

    @Test func failureShowsNoticeAndRetryRecovers() async {
        let provider = ScriptedGifProvider(results: [
            .failure(URLError(.notConnectedToInternet)),
            .success(page(["recovered"])),
        ])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.start()
        await settle { model.status == .notice }
        #expect(model.gifs.isEmpty)
        model.retry()
        await settle { model.status == .ready }
        #expect(model.gifs.map(\.providerId) == ["recovered"])
    }

    @Test func emptyFirstPageIsTheEmptyState() async {
        let provider = ScriptedGifProvider(results: [.success(page([]))])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.start()
        await settle { model.status == .empty }
    }

    @Test func loadMoreAppendsDeduplicatesAndStopsAtTheLastPage() async {
        let provider = ScriptedGifProvider(results: [
            .success(page(["a", "b", "c"], next: "p2")),
            .success(page(["c", "d"], next: nil)),
        ])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.start()
        await settle { model.status == .ready }

        // Only the last two items act as the load-more sentinel.
        model.loadMoreIfNeeded(current: model.gifs[0])
        #expect(!model.isLoadingMore)

        model.loadMoreIfNeeded(current: model.gifs[2])
        await settle { model.gifs.count == 4 }
        #expect(model.gifs.map(\.providerId) == ["a", "b", "c", "d"])

        // Final page: no cursor left, so nothing more is requested.
        model.loadMoreIfNeeded(current: model.gifs[3])
        await settle { true }
        let trendingCalls = await provider.trendingCalls
        #expect(trendingCalls == [nil, "p2"])
    }

    @Test func animationPreferenceOverridesTheSystemDefault() {
        let model = GifSearchModel(provider: FixtureGifProviderStub(), debounce: .zero)
        #expect(model.animationsPaused(systemDefault: true))
        #expect(!model.animationsPaused(systemDefault: false))
        model.toggleAnimations(systemDefault: true)
        #expect(!model.animationsPaused(systemDefault: true))
        model.toggleAnimations(systemDefault: true)
        #expect(model.animationsPaused(systemDefault: false))
    }

    @Test func panelStateProjectsTheModel() async {
        let provider = ScriptedGifProvider(results: [.success(page(["a"]))])
        let model = GifSearchModel(provider: provider, debounce: .zero)
        model.query = " otter "
        await settle { model.status == .ready }
        let state = model.panelState
        #expect(state.resultLabel == "GIF results for otter")
        #expect(state.gifs.count == 1)
        #expect(GifPanelState(status: .loading).resultLabel == "Trending GIFs")
    }
}

private struct FixtureGifProviderStub: GifProviding {
    var isAvailable: Bool { true }
    func trending(cursor: String?) async throws -> GifPage { GifPage(gifs: [], next: nil) }
    func search(query: String, cursor: String?) async throws -> GifPage { GifPage(gifs: [], next: nil) }
    func registerShare(gif: ChatGif, query: String) async {}
}
