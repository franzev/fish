import Foundation

/// The application-scoped presence coordinator. One random per-process
/// session id; the session runs while the app is foregrounded with a signed-in
/// user, heartbeats every 30 seconds (retrying at 5/10/30 s), piggybacks
/// activity, refreshes authoritatively on every (re)connect, merges snapshots
/// and preference broadcasts revision-safely, and ends the session best-effort
/// on background or sign-out. Timing is injectable so tests are deterministic.
public actor DefaultPresenceRepository: PresenceRepository {
    private let remote: any PresenceRemoteProviding
    private let diagnostics: any PresenceDiagnostics
    private let now: @Sendable () -> Date
    private let sleep: @Sendable (Duration) async throws -> Void
    private let sessionId: String

    private var state = PresenceState()
    private var continuations: [UUID: AsyncStream<PresenceState>.Continuation] = [:]

    private var userId: String?
    private var foregrounded = false
    private var runningUserId: String?
    private var sessionTask: Task<Void, Never>?
    private var sessionGeneration = 0
    private var sessionEnded = false

    private var visibleSubjects: Set<String> = []
    private var lastActivityAt = Date.distantPast
    private var activityVersion: UInt64 = 0
    private var sentActivityVersion: UInt64 = 0
    private var writing = false
    private var refreshing = false
    private var refreshQueued = false

    public init(
        remote: any PresenceRemoteProviding,
        diagnostics: any PresenceDiagnostics = NoOpPresenceDiagnostics(),
        now: @escaping @Sendable () -> Date = Date.init,
        sleep: @escaping @Sendable (Duration) async throws -> Void = {
            try await Task.sleep(for: $0)
        },
        sessionId: String = UUID().uuidString
    ) {
        self.remote = remote
        self.diagnostics = diagnostics
        self.now = now
        self.sleep = sleep
        self.sessionId = sessionId
    }

    // MARK: - PresenceRepository

    public nonisolated func states() -> AsyncStream<PresenceState> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            Task { await self.register(continuation) }
        }
    }

    public func setAuthenticatedUser(_ userId: String?) {
        guard self.userId != userId else { return }
        self.userId = userId
        reconcile()
    }

    public func setAppForegrounded(_ foregrounded: Bool) {
        guard self.foregrounded != foregrounded else { return }
        self.foregrounded = foregrounded
        reconcile()
    }

    public func markActive() {
        let current = now()
        let wasIdle = current.timeIntervalSince(lastActivityAt) >= Self.idleSeconds
        lastActivityAt = current
        activityVersion &+= 1
        guard wasIdle, sessionTask != nil else { return }
        Task { await self.write(ended: false) }
    }

    @discardableResult
    public func setPreference(
        _ preference: PresencePreference,
        for duration: PresenceDuration
    ) async -> PresenceCommandOutcome {
        let started = now()
        do {
            let result = try await remote.setPreference(preference, duration: duration)
            record(.setPreference, since: started)
            mergeSnapshot(result.snapshot)
            mergePreference(result.setting, revision: result.snapshot.revision)
            return .success(result)
        } catch let failure as PresenceCommandFailure {
            record(.setPreference, since: started, failure: .remote)
            return .failure(notice: failure.notice)
        } catch {
            record(.setPreference, since: started, failure: category(for: error))
            return .failure(notice: PresenceCommandFailure.unavailable.notice)
        }
    }

    public func endSession() async {
        guard state.currentUserId != nil, !sessionEnded else { return }
        sessionGeneration += 1
        sessionTask?.cancel()
        sessionTask = nil
        runningUserId = nil
        sessionEnded = true
        await endBestEffort()
        var next = state
        next.connection = .disconnected
        setState(next)
    }

    // MARK: - Session driver

    private func reconcile() {
        let desired: String? = foregrounded ? userId : nil
        guard desired != runningUserId else {
            if userId == nil { setState(PresenceState()) }
            return
        }
        if runningUserId != nil {
            stopSession(signedOut: userId == nil)
        }
        runningUserId = desired
        if let desired {
            startSession(userId: desired)
        } else if userId == nil {
            setState(PresenceState())
        }
    }

    private func startSession(userId: String) {
        sessionGeneration += 1
        let generation = sessionGeneration
        sessionEnded = false
        lastActivityAt = now()
        activityVersion &+= 1
        var next = state
        next.currentUserId = userId
        next.connection = .connecting
        setState(next)
        sessionTask = Task { await self.runSession(userId: userId, generation: generation) }
    }

    private func stopSession(signedOut: Bool) {
        sessionGeneration += 1
        sessionTask?.cancel()
        sessionTask = nil
        if !sessionEnded {
            sessionEnded = true
            // Unstructured on purpose: the final write must outlive the
            // cancelled session, bounded by the end-session timeout.
            Task { await self.endBestEffort() }
        }
        if signedOut {
            setState(PresenceState())
        } else {
            var next = state
            next.connection = .disconnected
            setState(next)
        }
    }

    private func runSession(userId: String, generation: Int) async {
        await write(ended: false)
        guard generation == sessionGeneration, !Task.isCancelled else { return }
        await refresh(userId: userId)
        guard generation == sessionGeneration, !Task.isCancelled else { return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.heartbeatLoop(generation: generation) }
            group.addTask { await self.realtimeLoop(userId: userId, generation: generation) }
            await group.waitForAll()
        }
    }

    private func heartbeatLoop(generation: Int) async {
        while !Task.isCancelled, generation == sessionGeneration {
            do { try await sleep(PresenceRules.heartbeatInterval) } catch { break }
            guard !Task.isCancelled, generation == sessionGeneration else { break }
            await write(ended: false)
        }
    }

    // MARK: - Realtime

    private func realtimeLoop(userId: String, generation: Int) async {
        while !Task.isCancelled, generation == sessionGeneration {
            let subscribed = visibleSubjects.union([userId])
            let events = remote.realtimeEvents(
                userId: userId,
                subjectIds: subscribed.sorted()
            )
            var rebuild = false
            for await event in events {
                guard generation == sessionGeneration else { return }
                switch event {
                case .connected:
                    updateConnection(.connected)
                    await refresh(userId: userId)
                case .snapshotChanged(let snapshot):
                    mergeSnapshot(snapshot)
                case .preferenceChanged(let setting, let revision):
                    mergePreference(setting, revision: revision)
                case .subjectsChanged:
                    await refresh(userId: userId)
                case .disconnected:
                    updateConnection(.disconnected)
                }
                if visibleSubjects.union([userId]) != subscribed {
                    rebuild = true
                    break
                }
            }
            guard !Task.isCancelled, generation == sessionGeneration else { return }
            if rebuild { continue }
            updateConnection(.disconnected)
            do { try await sleep(PresenceRules.realtimeRetry) } catch { return }
        }
    }

    // MARK: - Writes

    @discardableResult
    private func write(ended: Bool) async -> Bool {
        if writing { return false }
        guard ended || sessionTask != nil else { return false }
        writing = true
        defer { writing = false }
        return await performTouch(ended: ended)
    }

    private func performTouch(ended: Bool) async -> Bool {
        var attempt = 0
        while true {
            let started = now()
            let sent = activityVersion
            do {
                let snapshot = try await remote.touchSession(
                    id: sessionId,
                    activity: sent > sentActivityVersion,
                    ended: ended
                )
                record(ended ? .endSession : .heartbeat, since: started)
                sentActivityVersion = max(sentActivityVersion, sent)
                mergeSnapshot(snapshot)
                return true
            } catch {
                record(
                    ended ? .endSession : .heartbeat,
                    since: started,
                    failure: category(for: error)
                )
                guard !ended, attempt < PresenceRules.retryDelays.count else {
                    return false
                }
                do { try await sleep(PresenceRules.retryDelays[attempt]) } catch {
                    return false
                }
                attempt += 1
            }
        }
    }

    /// Final `ended` write, raced against the 3-second teardown budget. Waits
    /// for any in-flight heartbeat to unwind so the end is not swallowed by
    /// the single-flight guard.
    private func endBestEffort() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                while await self.isWriting { await Task.yield() }
                guard !Task.isCancelled else { return }
                await self.write(ended: true)
            }
            group.addTask { [sleep] in
                try? await sleep(PresenceRules.endSessionTimeout)
            }
            await group.next()
            group.cancelAll()
        }
    }

    private var isWriting: Bool { writing }

    // MARK: - Reads and merges

    private func refresh(userId: String) async {
        if refreshing {
            refreshQueued = true
            return
        }
        refreshing = true
        defer { refreshing = false }
        repeat {
            refreshQueued = false
            let started = now()
            do {
                async let visibleCall = remote.listVisible()
                async let preferenceCall = remote.ownPreference()
                let (visible, preference) = try await (visibleCall, preferenceCall)
                record(.refresh, since: started)
                guard state.currentUserId == userId else { return }
                visibleSubjects = Set(visible.map(\.userId)).union([userId])
                var next = state
                next.snapshots = [:]
                for snapshot in visible {
                    if let existing = state.snapshots[snapshot.userId],
                       existing.revision > snapshot.revision {
                        next.snapshots[snapshot.userId] = existing
                    } else {
                        next.snapshots[snapshot.userId] = snapshot
                    }
                }
                if next.snapshots[userId] == nil {
                    next.snapshots[userId] = state.snapshots[userId]
                }
                if next.preferenceRevision == 0 {
                    next.ownPreference = preference
                }
                setState(next)
            } catch {
                record(.refresh, since: started, failure: category(for: error))
            }
        } while refreshQueued
    }

    private func mergeSnapshot(_ snapshot: PresenceSnapshot) {
        guard let currentUserId = state.currentUserId else { return }
        guard snapshot.userId == currentUserId
            || visibleSubjects.contains(snapshot.userId) else { return }
        if let existing = state.snapshots[snapshot.userId],
           existing.revision >= snapshot.revision { return }
        var next = state
        next.snapshots[snapshot.userId] = snapshot
        setState(next)
    }

    private func mergePreference(_ setting: PresencePreferenceSetting, revision: Int64) {
        guard revision > state.preferenceRevision else { return }
        var next = state
        next.preferenceRevision = revision
        next.ownPreference = setting
        setState(next)
    }

    private func updateConnection(_ connection: PresenceConnectionState) {
        guard state.connection != connection else { return }
        var next = state
        next.connection = connection
        setState(next)
    }

    // MARK: - Publication

    private func register(_ continuation: AsyncStream<PresenceState>.Continuation) {
        let id = UUID()
        continuations[id] = continuation
        continuation.yield(state)
        continuation.onTermination = { _ in
            Task { await self.unregister(id) }
        }
    }

    private func unregister(_ id: UUID) {
        continuations[id] = nil
    }

    private func setState(_ next: PresenceState) {
        guard next != state else { return }
        state = next
        for continuation in continuations.values {
            continuation.yield(next)
        }
    }

    // MARK: - Support

    private static let idleSeconds =
        TimeInterval(PresenceRules.idleAfter.components.seconds)

    private func record(
        _ operation: PresenceOperation,
        since started: Date,
        failure: PresenceFailureCategory? = nil
    ) {
        diagnostics.record(PresenceDiagnosticEvent(
            operation: operation,
            succeeded: failure == nil,
            duration: .seconds(now().timeIntervalSince(started)),
            failureCategory: failure
        ))
    }

    private func category(for error: any Error) -> PresenceFailureCategory {
        if error is DecodingError { return .malformed }
        if error is PresenceCommandFailure { return .remote }
        return .network
    }
}
