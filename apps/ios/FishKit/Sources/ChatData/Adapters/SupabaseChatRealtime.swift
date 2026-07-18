import ChatCore
import Foundation
import Supabase

struct SupabaseChatRealtime: ChatRealtimeProviding {
    let client: SupabaseClient

    func subscribe(
        conversationId: String,
        currentUserId: String
    ) -> ChatRealtimeSubscription {
        let events = AsyncStream<ChatRealtimeEvent>.makeStream(
            bufferingPolicy: .bufferingNewest(100)
        )
        let connections = AsyncStream<ChatRealtimeConnection>.makeStream(
            bufferingPolicy: .bufferingNewest(8)
        )
        let control = ChatSubscriptionControl()
        let typing = ChatTypingSender()
        connections.continuation.yield(.connecting)
        let task = Task {
            await runChatChannels(
                client: client,
                conversationId: conversationId,
                currentUserId: currentUserId,
                events: events.continuation,
                connections: connections.continuation,
                typing: typing
            )
        }
        control.install(task)
        let cancel: @Sendable () -> Void = {
            control.cancel()
        }
        events.continuation.onTermination = { _ in cancel() }
        connections.continuation.onTermination = { _ in cancel() }
        return ChatRealtimeSubscription(
            events: events.stream,
            connections: connections.stream,
            sendTyping: { value in await typing.send(value) },
            cancel: cancel
        )
    }
}

final class ChatSubscriptionControl: @unchecked Sendable {
    private let lock = NSLock()
    private var task: Task<Void, Never>?

    func install(_ task: Task<Void, Never>) {
        lock.withLock { self.task = task }
    }

    func cancel() {
        let task = lock.withLock { self.task }
        task?.cancel()
    }
}

actor ChatTypingSender {
    private var channel: RealtimeChannelV2?
    private var userId: String?

    func install(channel: RealtimeChannelV2, userId: String) {
        self.channel = channel
        self.userId = userId
    }

    func send(_ typing: Bool) async {
        guard let channel, let userId else { return }
        try? await channel.broadcast(
            event: ChatRealtimeWire.typingEvent,
            message: TypingPayload(userId: userId, typing: typing)
        )
    }
}

/// Purely coalesces four channel lifecycles. It is internal so lifecycle
/// behavior can be tested without opening sockets.
actor ChatChannelLifecycle {
    private let expected: Int
    private var subscribed: Set<String> = []
    private var allSubscribed = false
    private var connectedBefore = false

    init(expected: Int) { self.expected = expected }

    func update(topic: String, isSubscribed: Bool) -> [ChatRealtimeConnection] {
        if isSubscribed { subscribed.insert(topic) } else { subscribed.remove(topic) }
        let nextAll = subscribed.count == expected
        guard nextAll != allSubscribed else { return [] }
        allSubscribed = nextAll
        if nextAll {
            if connectedBefore { return [.reconnected] }
            connectedBefore = true
            return [.connected]
        }
        return connectedBefore ? [.disconnected] : []
    }
}

private struct TypingPayload: Codable { let userId: String; let typing: Bool }

private func runChatChannels(
    client: SupabaseClient,
    conversationId: String,
    currentUserId: String,
    events: AsyncStream<ChatRealtimeEvent>.Continuation,
    connections: AsyncStream<ChatRealtimeConnection>.Continuation,
    typing: ChatTypingSender
) async {
    guard let token = try? await client.auth.session.accessToken,
          !token.isEmpty
    else {
        connections.yield(.disconnected)
        events.finish()
        connections.finish()
        return
    }
    await client.realtimeV2.setAuth(token)

    let messageChannel = client.channel(ChatRealtimeWire.messageTopic(conversationId))
    let readChannel = client.channel(ChatRealtimeWire.readTopic(conversationId))
    let reactionChannel = client.channel(ChatRealtimeWire.reactionTopic(conversationId))
    let typingChannel = client.channel(ChatRealtimeWire.typingTopic(conversationId)) {
        $0.broadcast.receiveOwnBroadcasts = false
    }
    await typing.install(channel: typingChannel, userId: currentUserId)

    let messageChanges = messageChannel.postgresChange(
        AnyAction.self,
        schema: "public",
        table: "messages",
        filter: .eq("conversation_id", value: conversationId)
    )
    let readChanges = readChannel.postgresChange(
        AnyAction.self,
        schema: "public",
        table: "message_reads",
        filter: .eq("conversation_id", value: conversationId)
    )
    let reactionChanges = reactionChannel.postgresChange(
        AnyAction.self,
        schema: "public",
        table: "message_reactions",
        filter: .eq("conversation_id", value: conversationId)
    )
    let typingBroadcasts = typingChannel.broadcastStream(event: ChatRealtimeWire.typingEvent)

    let postgresChannels = [messageChannel, readChannel, reactionChannel]
    let channels = postgresChannels + [typingChannel]
    let lifecycle = ChatChannelLifecycle(expected: channels.count)
    let statusStreams = channels.map { ($0.topic, $0.statusChange) }
    let systemStreams = postgresChannels.map { ($0.topic, $0.system()) }

    await withTaskGroup(of: Void.self) { group in
        for (topic, statuses) in statusStreams {
            group.addTask {
                for await status in statuses where status != .subscribed {
                    for event in await lifecycle.update(topic: topic, isSubscribed: false) {
                        connections.yield(event)
                    }
                }
            }
        }
        group.addTask {
            for await status in typingChannel.statusChange where status == .subscribed {
                for event in await lifecycle.update(
                    topic: typingChannel.topic,
                    isSubscribed: true
                ) {
                    connections.yield(event)
                }
            }
        }
        for (topic, systems) in systemStreams {
            group.addTask {
                for await message in systems {
                    let ready = message.payload["status"]?.stringValue == "ok"
                    for event in await lifecycle.update(topic: topic, isSubscribed: ready) {
                        connections.yield(event)
                    }
                }
            }
        }
        group.addTask {
            for await action in messageChanges {
                if let message = chatMessage(from: action) {
                    events.yield(.messageChanged(message))
                }
            }
        }
        group.addTask {
            for await action in readChanges {
                if let read = readState(from: action) {
                    events.yield(.readStateChanged(read))
                }
            }
        }
        group.addTask {
            for await action in reactionChanges {
                if let id = reactionMessageId(from: action) {
                    events.yield(.reactionsChanged(messageId: id))
                }
            }
        }
        group.addTask {
            for await envelope in typingBroadcasts {
                guard
                    let payload = envelope["payload"]?.objectValue,
                    let userId = payload[ChatRealtimeWire.typingUserIdKey]?.stringValue,
                    userId != currentUserId,
                    let isTyping = payload[ChatRealtimeWire.typingValueKey]?.boolValue
                else { continue }
                events.yield(.typingChanged(userId: userId, typing: isTyping))
            }
        }
        group.addTask {
            for channel in channels {
                do {
                    try await channel.subscribeWithError()
                } catch {
                    connections.yield(.disconnected)
                    return
                }
            }
        }
        await group.waitForAll()
    }

    for channel in channels { await client.removeChannel(channel) }
    events.finish()
    connections.finish()
}

private func chatMessage(from action: AnyAction) -> ChatMessage? {
    let record: JSONObject
    switch action {
    case .insert(let value): record = value.record
    case .update(let value): record = value.record
    case .delete: return nil
    }
    return try? record.decode(as: ChatMessageWire.self, decoder: ChatWireDecoder.make()).domain
}

private func readState(from action: AnyAction) -> ChatReadState? {
    let record: JSONObject
    switch action {
    case .insert(let value): record = value.record
    case .update(let value): record = value.record
    case .delete: return nil
    }
    return try? record.decode(as: ChatReadStateWire.self).domain
}

private struct ReactionMessageId: Decodable {
    let messageId: String
    enum CodingKeys: String, CodingKey { case messageId = "message_id" }
}

private func reactionMessageId(from action: AnyAction) -> String? {
    let record: JSONObject
    switch action {
    case .insert(let value): record = value.record
    case .update(let value): record = value.record
    case .delete(let value): record = value.oldRecord
    }
    return try? record.decode(as: ReactionMessageId.self).messageId
}
