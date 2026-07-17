import Foundation
import Supabase

/// Live presence endpoints over `supabase-swift`: PostgREST RPCs for
/// heartbeats and the roster, the `presence-command` Edge Function, and the
/// realtime contract shared with web and Android — the private
/// `presence:user:{id}` broadcast topic plus `postgres_changes` on
/// `presence_snapshots`, chunked 100 subjects per channel. Constructed only
/// at the app boundary; the signed-in `SupabaseClient` carries auth.
public struct SupabasePresenceRemote: PresenceRemoteProviding {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Reads

    public func listVisible() async throws -> [PresenceSnapshot] {
        let rows: [PresenceSnapshotRow] = try await client
            .rpc("list_visible_presence")
            .execute()
            .value
        return rows.map(\.snapshot)
    }

    public func ownPreference() async throws -> PresencePreferenceSetting {
        let rows: [PresencePreferenceRow] = try await client
            .from("presence_preferences")
            .select("mode, expires_at")
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else { return PresencePreferenceSetting() }
        return row.setting(now: Date())
    }

    // MARK: - Writes

    public func touchSession(
        id: String,
        activity: Bool,
        ended: Bool
    ) async throws -> PresenceSnapshot {
        let row: PresenceSnapshotRow = try await client
            .rpc(
                "touch_presence_session",
                params: TouchPresenceParams(
                    sessionId: id,
                    activity: activity,
                    ended: ended
                )
            )
            .execute()
            .value
        return row.snapshot
    }

    public func setPreference(
        _ preference: PresencePreference,
        duration: PresenceDuration
    ) async throws -> PresenceCommandResult {
        let request = PresenceCommandRequest(
            mode: preference,
            durationSeconds: duration.seconds
        )
        // The Functions client has no per-invoke timeout; enforce the
        // web-parity 15-second budget ourselves.
        let response = try await withDeadline(PresenceRules.commandTimeout) {
            do {
                let response: PresenceCommandResponse = try await client.functions.invoke(
                    "presence-command",
                    options: FunctionInvokeOptions(body: request)
                )
                return response
            } catch let error as FunctionsError {
                if case .httpError(_, let data) = error {
                    throw PresenceCalmError.failure(from: data)
                }
                throw PresenceCommandFailure.unavailable
            }
        }
        return response.result
    }

    private func withDeadline<Value: Sendable>(
        _ limit: Duration,
        _ operation: @escaping @Sendable () async throws -> Value
    ) async throws -> Value {
        try await withThrowingTaskGroup(of: Value.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(for: limit)
                throw PresenceCommandFailure.unavailable
            }
            guard let first = try await group.next() else {
                throw PresenceCommandFailure.unavailable
            }
            group.cancelAll()
            return first
        }
    }

    // MARK: - Realtime

    public func realtimeEvents(
        userId: String,
        subjectIds: [String]
    ) -> AsyncStream<PresenceRealtimeEvent> {
        let client = client
        return AsyncStream { continuation in
            let task = Task {
                await runChannels(
                    client: client,
                    userId: userId,
                    subjectIds: subjectIds,
                    continuation: continuation
                )
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

// MARK: - Channel plumbing

/// Tracks per-channel subscription status and reports the combined state:
/// connected only while every channel is subscribed.
private actor ChannelAccounting {
    private let expected: Int
    private var subscribed: Set<String> = []
    private var lastReported: Bool?
    private let continuation: AsyncStream<PresenceRealtimeEvent>.Continuation

    init(
        expected: Int,
        continuation: AsyncStream<PresenceRealtimeEvent>.Continuation
    ) {
        self.expected = expected
        self.continuation = continuation
    }

    func update(topic: String, isSubscribed: Bool) {
        if isSubscribed {
            subscribed.insert(topic)
        } else {
            subscribed.remove(topic)
        }
        let allSubscribed = subscribed.count == expected
        guard allSubscribed != lastReported else { return }
        lastReported = allSubscribed
        continuation.yield(allSubscribed ? .connected : .disconnected)
    }
}

private func runChannels(
    client: SupabaseClient,
    userId: String,
    subjectIds: [String],
    continuation: AsyncStream<PresenceRealtimeEvent>.Continuation
) async {
    let preferenceChannel = client.channel("presence:user:\(userId)") {
        $0.isPrivate = true
    }
    let preferenceBroadcasts = preferenceChannel.broadcastStream(
        event: "presence.preference.changed"
    )
    let subjectBroadcasts = preferenceChannel.broadcastStream(
        event: "presence.subjects.changed"
    )

    let ids = Array(Set(subjectIds + [userId])).sorted()
    let subscriptionId = UUID().uuidString.lowercased()
    var snapshotChannels: [RealtimeChannelV2] = []
    var changeStreams: [AsyncStream<AnyAction>] = []
    for (index, chunk) in ids.chunks(of: PresenceRules.snapshotChannelChunk).enumerated() {
        let channel = client.channel(
            "presence:snapshots:\(userId):\(subscriptionId):\(index)"
        )
        changeStreams.append(channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "presence_snapshots",
            filter: .in("user_id", values: chunk)
        ))
        snapshotChannels.append(channel)
    }
    let channels = [preferenceChannel] + snapshotChannels
    let accounting = ChannelAccounting(
        expected: channels.count,
        continuation: continuation
    )

    // Register every stream before joining (SDK rule), and pre-create them
    // so buffered events survive the gap until the group starts iterating.
    let statusStreams = channels.map { ($0.topic, $0.statusChange) }
    // A snapshot channel is "ready" only once Realtime confirms the
    // postgres_changes subscription with a system ok — the join ack alone
    // does not guarantee WAL delivery yet. Same rule as the web client.
    let systemStreams = snapshotChannels.map { ($0.topic, $0.system()) }

    await withTaskGroup(of: Void.self) { group in
        for (topic, statuses) in statusStreams {
            group.addTask {
                for await status in statuses where status != .subscribed {
                    await accounting.update(topic: topic, isSubscribed: false)
                }
            }
        }
        group.addTask {
            for await status in preferenceChannel.statusChange
            where status == .subscribed {
                await accounting.update(
                    topic: preferenceChannel.topic,
                    isSubscribed: true
                )
            }
        }
        for (topic, systems) in systemStreams {
            group.addTask {
                for await message in systems {
                    let ok = message.payload["status"]?.stringValue == "ok"
                    await accounting.update(topic: topic, isSubscribed: ok)
                }
            }
        }
        group.addTask {
            for await envelope in preferenceBroadcasts {
                if let event = preferenceEvent(from: envelope) {
                    continuation.yield(event)
                }
            }
        }
        group.addTask {
            for await _ in subjectBroadcasts {
                continuation.yield(.subjectsChanged)
            }
        }
        for stream in changeStreams {
            group.addTask {
                for await action in stream {
                    if let snapshot = snapshot(from: action) {
                        continuation.yield(.snapshotChanged(snapshot))
                    }
                }
            }
        }
        group.addTask {
            for channel in channels {
                do {
                    try await channel.subscribeWithError()
                } catch {
                    continuation.yield(.disconnected)
                    return
                }
            }
        }
        await group.waitForAll()
    }

    for channel in channels {
        await client.removeChannel(channel)
    }
    continuation.finish()
}

private func preferenceEvent(from envelope: JSONObject) -> PresenceRealtimeEvent? {
    guard
        let payload = envelope["payload"]?.objectValue,
        let mode = payload["mode"]?.stringValue,
        let preference = PresencePreference(rawValue: mode),
        let revision = payload["revision"]?.intValue
    else { return nil }
    return .preferenceChanged(
        PresencePreferenceSetting(
            preference: preference,
            expiresAt: payload["expiresAt"]?.stringValue
        ),
        revision: Int64(revision)
    )
}

private func snapshot(from action: AnyAction) -> PresenceSnapshot? {
    let record: JSONObject
    switch action {
    case .insert(let insert):
        record = insert.record
    case .update(let update):
        record = update.record
    case .delete:
        return nil
    }
    guard let row = try? record.decode(as: PresenceSnapshotRow.self) else {
        return nil
    }
    return row.snapshot
}

extension Array {
    fileprivate func chunks(of size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
