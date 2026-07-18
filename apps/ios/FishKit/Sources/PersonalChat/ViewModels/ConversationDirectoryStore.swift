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
    private let sleep: @Sendable (Duration) async throws -> Void
    private var attentionTask: Task<Void, Never>?
    private var refreshTask: Task<Void, Never>?

    public init(
        directory: any ConversationDirectoryProviding,
        sleep: @escaping @Sendable (Duration) async throws -> Void = {
            try await Task.sleep(for: $0)
        }
    ) {
        self.directory = directory
        self.sleep = sleep
    }

    public var route: ConversationRoute {
        ConversationRouting.route(for: conversations)
    }

    public func start() async {
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
            conversations = try await directory.conversations()
            phase = .ready
            notice = nil
        } catch {
            phase = conversations.isEmpty ? .failed : .ready
            notice = "Conversations aren’t available yet. Try again."
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
