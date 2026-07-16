import ChatData
import Foundation
import Observation

/// Value snapshot the GIF panel renders — projecting the model into a plain
/// struct keeps the view stateless and the snapshot matrix deterministic.
public struct GifPanelState: Equatable, Sendable {
    public var status: GifSearchModel.Status
    public var gifs: [ChatGif]
    public var isLoadingMore: Bool
    public var trimmedQuery: String
    public var animationPreference: Bool?
    public var providerIsAvailable: Bool

    public init(
        status: GifSearchModel.Status,
        gifs: [ChatGif] = [],
        isLoadingMore: Bool = false,
        trimmedQuery: String = "",
        animationPreference: Bool? = nil,
        providerIsAvailable: Bool = true
    ) {
        self.status = status
        self.gifs = gifs
        self.isLoadingMore = isLoadingMore
        self.trimmedQuery = trimmedQuery
        self.animationPreference = animationPreference
        self.providerIsAvailable = providerIsAvailable
    }

    public var resultLabel: String {
        trimmedQuery.isEmpty ? "Trending GIFs" : "GIF results for \(trimmedQuery)"
    }
}

/// Owns the GIF tab's async state: trending on open, debounced search while
/// typing (300 ms, immediate when cleared — the web contract), cursor
/// pagination with id-level deduplication, and the session-scoped animation
/// preference. Stale responses can never clobber newer ones: every load
/// carries a generation stamp and only the newest may publish.
@MainActor @Observable
public final class GifSearchModel {
    public enum Status: Equatable, Sendable {
        case loading
        case ready
        case empty
        case notice
    }

    public private(set) var gifs: [ChatGif] = []
    public private(set) var status: Status = .loading
    public private(set) var isLoadingMore = false

    /// Explicit pause/play choice for this picker session. `nil` follows the
    /// system Reduce Motion setting.
    public var animationPreference: Bool?

    public var query = "" {
        didSet {
            guard query != oldValue else { return }
            scheduleLoad(debounced: !query.isEmpty)
        }
    }

    public var providerIsAvailable: Bool { provider.isAvailable }

    private let provider: any GifProviding
    private let clock: any Clock<Duration>
    private let debounceDuration: Duration
    private var next: String?
    private var generation = 0
    private var scheduledLoad: Task<Void, Never>?
    private var hasStarted = false

    public init(
        provider: any GifProviding,
        clock: any Clock<Duration> = ContinuousClock(),
        debounce: Duration = .milliseconds(300)
    ) {
        self.provider = provider
        self.clock = clock
        self.debounceDuration = debounce
    }

    public var panelState: GifPanelState {
        GifPanelState(
            status: status,
            gifs: gifs,
            isLoadingMore: isLoadingMore,
            trimmedQuery: query.trimmingCharacters(in: .whitespacesAndNewlines),
            animationPreference: animationPreference,
            providerIsAvailable: providerIsAvailable
        )
    }

    /// Idempotent initial load — call from the panel's `.task`.
    public func start() {
        guard !hasStarted else { return }
        hasStarted = true
        scheduleLoad(debounced: false)
    }

    public func retry() {
        scheduleLoad(debounced: false)
    }

    /// Whether previews are paused right now, honoring an explicit choice
    /// over the system default — `animationPreference ?? reduceMotion`.
    public func animationsPaused(systemDefault: Bool) -> Bool {
        animationPreference ?? systemDefault
    }

    public func toggleAnimations(systemDefault: Bool) {
        animationPreference = !animationsPaused(systemDefault: systemDefault)
    }

    /// Cursor pagination driven by grid appearance — the last row standing in
    /// for the web scroll sentinel.
    public func loadMoreIfNeeded(current gif: ChatGif) {
        guard
            status == .ready,
            !isLoadingMore,
            let next,
            gifs.suffix(2).contains(gif)
        else { return }
        isLoadingMore = true
        generation += 1
        let stamped = generation
        Task { await load(cursor: next, generation: stamped) }
    }

    private func scheduleLoad(debounced: Bool) {
        scheduledLoad?.cancel()
        generation += 1
        let stamped = generation
        scheduledLoad = Task {
            if debounced, debounceDuration > .zero {
                try? await clock.sleep(for: debounceDuration)
            }
            guard !Task.isCancelled, stamped == generation else { return }
            await load(cursor: nil, generation: stamped)
        }
    }

    private func load(cursor: String?, generation stamped: Int) async {
        if cursor == nil { status = .loading }
        do {
            let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let page = trimmed.isEmpty
                ? try await provider.trending(cursor: cursor)
                : try await provider.search(query: trimmed, cursor: cursor)
            guard stamped == generation else { return }
            gifs = Self.deduplicated(cursor == nil ? page.gifs : gifs + page.gifs)
            next = page.next
            status = gifs.isEmpty ? .empty : .ready
        } catch {
            guard stamped == generation else { return }
            if cursor == nil { gifs = [] }
            status = .notice
        }
        isLoadingMore = false
    }

    private static func deduplicated(_ gifs: [ChatGif]) -> [ChatGif] {
        var seen = Set<String>()
        return gifs.filter { seen.insert($0.id).inserted }
    }
}
