import Foundation
import Observation
import PresenceData

/// Binds the repository to presentations: consumes the state stream and a
/// 15-second clock, applies the formatter, and runs optimistic status
/// commands — single-flight, rolled back with calm copy on failure, and
/// superseded safely when a newer realtime revision lands first.
@MainActor @Observable
public final class PresenceModel {
    public private(set) var uiState = PresenceUiState()

    /// Increments once per confirmed status change — the account sheet
    /// dismisses on it.
    public private(set) var confirmations = 0

    private let repository: any PresenceRepository
    private let formatter: PresenceFormatter
    private let now: @Sendable () -> Date
    private let ticks: @Sendable () -> AsyncStream<Void>

    private var repositoryState = PresenceState()
    private var mutation: Mutation?
    private var notice: String?

    private struct Mutation {
        let id = UUID()
        let setting: PresencePreferenceSetting
    }

    public init(
        repository: any PresenceRepository,
        formatter: PresenceFormatter = PresenceFormatter(),
        now: @escaping @Sendable () -> Date = Date.init,
        ticks: @escaping @Sendable () -> AsyncStream<Void> = {
            AsyncStream { continuation in
                let timer = Task {
                    while !Task.isCancelled {
                        try? await Task.sleep(for: PresenceRules.presentationClock)
                        continuation.yield(())
                    }
                }
                continuation.onTermination = { _ in timer.cancel() }
            }
        }
    ) {
        self.repository = repository
        self.formatter = formatter
        self.now = now
        self.ticks = ticks
    }

    /// Runs until the surrounding task is cancelled.
    public func start() async {
        async let clock: Void = consumeTicks()
        for await state in repository.states() {
            repositoryState = state
            recompute()
        }
        await clock
    }

    private func consumeTicks() async {
        for await _ in ticks() {
            recompute()
        }
    }

    // MARK: - Commands

    public func setPreference(
        _ preference: PresencePreference,
        for duration: PresenceDuration
    ) {
        guard mutation == nil else { return }
        notice = nil
        let expiresAt = duration.seconds.map {
            ISO8601DateFormatter().string(from: now().addingTimeInterval(TimeInterval($0)))
        }
        let pending = Mutation(setting: PresencePreferenceSetting(
            preference: preference,
            expiresAt: expiresAt
        ))
        mutation = pending
        recompute()
        Task {
            let outcome = await repository.setPreference(preference, for: duration)
            guard mutation?.id == pending.id else { return }
            mutation = nil
            switch outcome {
            case .success:
                confirmations += 1
            case .failure(let failureNotice):
                notice = failureNotice
            }
            recompute()
        }
    }

    public func clearNotice() {
        guard notice != nil else { return }
        notice = nil
        recompute()
    }

    // MARK: - Presentation

    private func recompute() {
        let current = now()
        var effectiveSetting = mutation?.setting ?? repositoryState.ownPreference
        if formatter.expired(effectiveSetting, now: current) {
            effectiveSetting = PresencePreferenceSetting()
        }
        let ownSnapshot = repositoryState.currentUserId
            .flatMap { repositoryState.snapshots[$0] }
        var subjects: [String: PresencePresentation] = [:]
        subjects.reserveCapacity(repositoryState.snapshots.count)
        for (userId, snapshot) in repositoryState.snapshots {
            subjects[userId] = formatter.format(snapshot, now: current)
        }
        let next = PresenceUiState(
            currentUserId: repositoryState.currentUserId,
            own: formatter.formatOwn(
                snapshot: ownSnapshot,
                preference: effectiveSetting,
                now: current
            ),
            ownPreference: effectiveSetting,
            subjects: subjects,
            connection: repositoryState.connection,
            updating: mutation != nil,
            notice: notice
        )
        if next != uiState {
            uiState = next
        }
    }
}
