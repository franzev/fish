import ChatData
import Foundation
import Observation

public struct MessageSearchResultUiModel: Identifiable, Equatable, Sendable {
    public let id: String
    public let senderLabel: String
    public let dateLabel: String
    public let excerpt: String
    public let accessibilityLabel: String

    public init(
        id: String,
        senderLabel: String,
        dateLabel: String,
        excerpt: String,
        accessibilityLabel: String
    ) {
        self.id = id
        self.senderLabel = senderLabel
        self.dateLabel = dateLabel
        self.excerpt = excerpt
        self.accessibilityLabel = accessibilityLabel
    }
}

/// Session-only state for searching the currently open direct conversation.
/// The provider owns authorization and transport; this model only coordinates
/// presentation, cancellation, debounce, and cursor pagination.
@MainActor @Observable
public final class MessageSearchModel {
    public enum Status: Equatable, Sendable {
        case initial
        case loading
        case ready
        case empty
        case notice
    }

    public private(set) var status: Status = .initial
    public private(set) var results: [MessageSearchResultUiModel] = []
    public private(set) var isLoadingMore = false
    public private(set) var isPresented = false
    public private(set) var notice: String?

    public var query = "" {
        didSet {
            guard query != oldValue, !isResetting else { return }
            queryChanged()
        }
    }

    public var hasMoreResults: Bool { nextCursor != nil }

    public static let searchNotice =
        "Search is taking a little longer. Check your connection and try again."

    private let conversationId: String
    private let currentUserId: String
    private let participantName: String
    private let messaging: any ChatMessagingProviding
    private let clock: any Clock<Duration>
    private let debounceDuration: Duration
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let locale: Locale
    private var nextCursor: ChatMessageSearchCursor?
    private var generation = 0
    private var requestTask: Task<Void, Never>?
    private var isResetting = false

    public init(
        conversationId: String,
        currentUserId: String,
        participantName: String,
        messaging: any ChatMessagingProviding,
        clock: any Clock<Duration> = ContinuousClock(),
        now: @escaping @Sendable () -> Date = Date.init,
        calendar: Calendar = .current,
        locale: Locale = .current,
        debounce: Duration = .milliseconds(300)
    ) {
        self.conversationId = conversationId
        self.currentUserId = currentUserId
        self.participantName = participantName
        self.messaging = messaging
        self.clock = clock
        self.debounceDuration = debounce
        self.now = now
        self.calendar = calendar
        self.locale = locale
    }

    public func open() {
        requestTask?.cancel()
        generation += 1
        resetPrivateState(presented: true)
    }

    public func close() {
        requestTask?.cancel()
        generation += 1
        resetPrivateState(presented: false)
    }

    public func retry() {
        if !results.isEmpty, hasMoreResults, notice != nil {
            loadMore()
        } else {
            scheduleFirstPage(debounced: false)
        }
    }

    public func submitImmediately() {
        scheduleFirstPage(debounced: false)
    }

    public func loadMore() {
        guard isPresented,
              !isLoadingMore,
              let cursor = nextCursor,
              !trimmedQuery.isEmpty
        else { return }
        requestTask?.cancel()
        generation += 1
        let stampedGeneration = generation
        let query = trimmedQuery
        isLoadingMore = true
        requestTask = Task { [weak self] in
            await self?.load(
                query: query,
                cursor: cursor,
                generation: stampedGeneration
            )
        }
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func queryChanged() {
        requestTask?.cancel()
        generation += 1
        results = []
        nextCursor = nil
        notice = nil
        isLoadingMore = false
        if trimmedQuery.isEmpty || !isPresented {
            status = .initial
        } else {
            status = .loading
            scheduleFirstPage(debounced: true, currentGeneration: generation)
        }
    }

    private func scheduleFirstPage(
        debounced: Bool,
        currentGeneration: Int? = nil
    ) {
        let query = trimmedQuery
        requestTask?.cancel()
        guard isPresented, !query.isEmpty else {
            if query.isEmpty {
                generation += 1
                results = []
                nextCursor = nil
                notice = nil
                isLoadingMore = false
                status = .initial
            }
            return
        }
        if currentGeneration == nil { generation += 1 }
        let stampedGeneration = currentGeneration ?? generation
        results = []
        nextCursor = nil
        notice = nil
        isLoadingMore = false
        status = .loading
        requestTask = Task { [weak self] in
            guard let self else { return }
            if debounced, self.debounceDuration > .zero {
                try? await self.clock.sleep(for: self.debounceDuration)
            }
            guard !Task.isCancelled else { return }
            await self.load(
                query: query,
                cursor: nil,
                generation: stampedGeneration
            )
        }
    }

    private func load(
        query: String,
        cursor: ChatMessageSearchCursor?,
        generation stampedGeneration: Int
    ) async {
        do {
            let page = try await messaging.searchMessages(
                conversationId: conversationId,
                query: query,
                before: cursor,
                limit: 25
            )
            guard !Task.isCancelled, stampedGeneration == generation else { return }
            let mapped = page.hits.compactMap(map)
            results = Self.deduplicated(cursor == nil ? mapped : results + mapped)
            nextCursor = page.nextCursor
            notice = nil
            isLoadingMore = false
            status = results.isEmpty ? .empty : .ready
        } catch is CancellationError {
            guard stampedGeneration == generation else { return }
            isLoadingMore = false
        } catch {
            guard stampedGeneration == generation else { return }
            isLoadingMore = false
            notice = Self.searchNotice
            if cursor == nil {
                results = []
                nextCursor = nil
                status = .notice
            }
        }
    }

    private func map(_ hit: ChatMessageSearchHit) -> MessageSearchResultUiModel? {
        guard hit.conversationId == conversationId else { return nil }
        let sender = hit.senderId == currentUserId ? "You" : participantName
        let excerpt = Self.normalizeWhitespace(hit.body)
        let day = ChatDayLabel.format(
            hit.createdAt,
            now: now(),
            calendar: calendar,
            locale: locale
        )
        let time = hit.createdAt.formatted(Date.FormatStyle(
            date: .omitted,
            time: .shortened,
            locale: locale,
            calendar: calendar,
            timeZone: calendar.timeZone
        ))
        let dateLabel = "\(day), \(time)"
        return MessageSearchResultUiModel(
            id: hit.id,
            senderLabel: sender,
            dateLabel: dateLabel,
            excerpt: excerpt,
            accessibilityLabel: "\(sender), \(excerpt), \(dateLabel)"
        )
    }

    private static func normalizeWhitespace(_ body: String) -> String {
        body.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static func deduplicated(
        _ values: [MessageSearchResultUiModel]
    ) -> [MessageSearchResultUiModel] {
        var seen = Set<String>()
        return values.filter { seen.insert($0.id).inserted }
    }

    private func resetPrivateState(presented: Bool) {
        isResetting = true
        query = ""
        isResetting = false
        status = .initial
        results = []
        nextCursor = nil
        isLoadingMore = false
        notice = nil
        isPresented = presented
    }
}
