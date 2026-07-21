import ChatCore
import ChatData
import DesignSystem
import Foundation
import SnapshotTesting
import SwiftUI
import Testing
import UIKit
@testable import PersonalChat

private struct SearchScreenError: Error {}

private actor SearchScreenMessaging: ChatMessagingProviding {
    private var pages: [ChatMessageSearchPage]
    private var delays: [Duration?]
    private let fails: Bool

    init(
        pages: [ChatMessageSearchPage],
        delays: [Duration?] = [],
        fails: Bool = false
    ) {
        self.pages = pages
        self.delays = delays
        self.fails = fails
    }

    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage {
        throw SearchScreenError()
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
        if let delay = delays.isEmpty ? nil : delays.removeFirst() {
            try await Task.sleep(for: delay)
        }
        if fails { throw SearchScreenError() }
        return pages.isEmpty
            ? ChatMessageSearchPage(hits: [], nextCursor: nil)
            : pages.removeFirst()
    }
}

@MainActor
struct MessageSearchScreenTests {
    @Test func stateMatrixSnapshots() async {
        let initial = makeModel(provider: SearchScreenMessaging(pages: []))
        initial.open()
        assertThemedSnapshots(
            of: MessageSearchScreen(model: initial, onSelect: { _ in }),
            named: "message-search-initial"
        )

        let loading = makeModel(
            provider: SearchScreenMessaging(
                pages: [],
                delays: [.seconds(10)]
            )
        )
        loading.open()
        loading.query = "practice"
        assertThemedSnapshots(
            of: MessageSearchScreen(model: loading, onSelect: { _ in }),
            named: "message-search-loading"
        )

        let results = makeModel(provider: SearchScreenMessaging(
            pages: [ChatMessageSearchPage(
                hits: [
                    searchHit("m3", senderId: "coach", body: "Try this phrase in your next meeting.", at: 300),
                    searchHit("m2", senderId: "me", body: "I will practice it today.", at: 200),
                ],
                nextCursor: nil
            )]
        ))
        results.open()
        results.query = "practice"
        await settle { results.status == .ready }
        assertThemedSnapshots(
            of: MessageSearchScreen(model: results, onSelect: { _ in }),
            named: "message-search-results"
        )
        assertAccessibilitySnapshots(
            of: MessageSearchScreen(model: results, onSelect: { _ in }),
            named: "message-search-results"
        )

        let empty = makeModel(provider: SearchScreenMessaging(
            pages: [ChatMessageSearchPage(hits: [], nextCursor: nil)]
        ))
        empty.open()
        empty.query = "missing"
        await settle { empty.status == .empty }
        assertThemedSnapshots(
            of: MessageSearchScreen(model: empty, onSelect: { _ in }),
            named: "message-search-empty"
        )

        let notice = makeModel(provider: SearchScreenMessaging(pages: [], fails: true))
        notice.open()
        notice.query = "practice"
        await settle { notice.status == .notice }
        assertThemedSnapshots(
            of: MessageSearchScreen(model: notice, onSelect: { _ in }),
            named: "message-search-notice"
        )

        let loadingMore = makeModel(provider: SearchScreenMessaging(
            pages: [
                ChatMessageSearchPage(
                    hits: [searchHit("m1", body: "Practice this line.")],
                    nextCursor: ChatMessageSearchCursor(createdAt: "1970-01-01T00:01:00Z", id: "m1")
                ),
                ChatMessageSearchPage(hits: [], nextCursor: nil),
            ],
            delays: [nil, .seconds(10)]
        ))
        loadingMore.open()
        loadingMore.query = "practice"
        await settle { loadingMore.status == MessageSearchModel.Status.ready }
        loadingMore.loadMore()
        await Task.yield()
        assertThemedSnapshots(
            of: MessageSearchScreen(model: loadingMore, onSelect: { _ in }),
            named: "message-search-loading-more"
        )

        Fonts.register()
        let host = UIHostingController(
            rootView: MessageSearchScreen(model: results, onSelect: { _ in })
                .environment(\.locale, Locale(identifier: "en_US"))
                .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                .background(Palette.bg)
        )
        assertSnapshot(
            of: host,
            as: .image(on: .iPadPro11(.portrait)),
            named: "message-search-results-ipad"
        )
        assertSnapshot(
            of: host,
            as: .image(on: .iPadPro11(.landscape)),
            named: "message-search-results-landscape"
        )
    }

    @MainActor
    private func makeModel(provider: SearchScreenMessaging) -> MessageSearchModel {
        MessageSearchModel(
            conversationId: "c1",
            currentUserId: "me",
            participantName: "Coach Mina",
            messaging: provider,
            now: { Date(timeIntervalSince1970: 400) },
            calendar: Calendar(identifier: .gregorian),
            locale: Locale(identifier: "en_US"),
            debounce: .zero
        )
    }

    @MainActor
    private func settle(
        until condition: @escaping @MainActor () -> Bool
    ) async {
        for _ in 0..<500 {
            if condition() { return }
            await Task.yield()
        }
    }

    private func searchHit(
        _ id: String,
        senderId: String = "coach",
        body: String,
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
}
