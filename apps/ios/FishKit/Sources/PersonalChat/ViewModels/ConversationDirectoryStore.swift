import ChatData
import Foundation
import Observation

@MainActor @Observable
public final class ConversationDirectoryStore {
    public enum Phase: Equatable, Sendable { case loading, ready, failed }

    public private(set) var phase = Phase.loading
    public private(set) var conversations: [ChatConversationPreview] = []
    public private(set) var notice: String?

    private let directory: any ConversationDirectoryProviding
    private let drafts: (any ChatDraftProviding)?
    private let cache: (any ChatDirectoryCaching)?
    private let sleep: @Sendable (Duration) async throws -> Void
    private var attentionTask: Task<Void, Never>?
    private var refreshTask: Task<Void, Never>?

    public init(
        directory: any ConversationDirectoryProviding,
        drafts: (any ChatDraftProviding)? = nil,
        cache: (any ChatDirectoryCaching)? = nil,
        sleep: @escaping @Sendable (Duration) async throws -> Void = {
            try await Task.sleep(for: $0)
        }
    ) {
        self.directory = directory
        self.drafts = drafts
        self.cache = cache
        self.sleep = sleep
    }

    public var route: ConversationRoute {
        ConversationRouting.route(for: conversations)
    }

    public func start() async {
        if let cache, let cached = try? await cache.conversations(), !cached.isEmpty {
            conversations = await decorated(cached)
            phase = .ready
        }
        await refresh()
        attentionTask?.cancel()
        let ids = conversations.map(\.conversationId)
        attentionTask = Task { [weak self] in
            guard let self else { return }
            for await _ in directory.attentionEvents(conversationIds: ids) {
                guard !Task.isCancelled else { return }
                self.scheduleRefresh()
            }
        }
    }

    public func stop() {
        attentionTask?.cancel()
        refreshTask?.cancel()
    }

    public func refresh() async {
        do {
            let loaded = try await directory.conversations()
            conversations = await decorated(loaded)
            phase = .ready
            notice = nil
            try? await cache?.save(loaded)
        } catch {
            phase = conversations.isEmpty ? .failed : .ready
            notice = conversations.isEmpty
                ? "Conversations aren’t available yet. Try again."
                : "Showing your saved conversations. They’ll update when you’re back online."
        }
    }

    /// `hasDraft` always comes from the live draft store, never from a cached
    /// preview, so a stale cache can never claim a draft that isn't there.
    private func decorated(_ previews: [ChatConversationPreview]) async -> [ChatConversationPreview] {
        let draftIds: Set<String>
        if let drafts {
            let local = try? await drafts.drafts(for: previews.map(\.conversationId))
            draftIds = Set(local?.keys.map { $0 } ?? [])
        } else {
            draftIds = []
        }
        return previews.map { preview in
            ChatConversationPreview(
                conversationId: preview.conversationId,
                participantId: preview.participantId,
                participantRole: preview.participantRole,
                participantDisplayName: preview.participantDisplayName,
                latestMessageSenderId: preview.latestMessageSenderId,
                latestMessageText: preview.latestMessageText,
                latestMessageCreatedAt: preview.latestMessageCreatedAt,
                unreadCount: preview.unreadCount,
                hasDraft: draftIds.contains(preview.conversationId),
                mute: preview.mute
            )
        }
    }

    private func scheduleRefresh() {
        refreshTask?.cancel()
        refreshTask = Task { [sleep] in
            do { try await sleep(.milliseconds(300)) } catch { return }
            guard !Task.isCancelled else { return }
            await self.refresh()
        }
    }
}
