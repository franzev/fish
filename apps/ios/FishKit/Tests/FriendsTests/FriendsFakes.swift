import Foundation
import FriendsData

/// Scripted friends backend. Every answer is queued up front, every call is
/// recorded, and either side can be *held* so a test decides exactly when an
/// answer lands — the only way to prove a late answer never clobbers whoever
/// is on screen now.
///
/// Each call claims its scripted answer *before* it waits at a gate, so two
/// calls parked at once still get the answers they were written for whatever
/// order the gate releases them in.
actor ScriptedFriends: FriendDirectoryProviding, FriendCommandsProviding {
    enum SearchOutcome: Sendable {
        case candidate(FriendCandidate)
        case failure(FriendCommandFailure)
    }

    enum ListOutcome: Sendable {
        case requests([IncomingFriendRequest])
        case failure(FriendCommandFailure)
    }

    enum CommandOutcome: Sendable {
        case outcome(FriendRequestOutcome)
        case failure(FriendCommandFailure)
    }

    struct SentRequest: Sendable, Equatable {
        let targetId: String
        let clientRequestId: String
    }

    struct RespondedRequest: Sendable, Equatable {
        let requestId: String
        let response: FriendRequestResponse
    }

    struct ScriptExhausted: Error {}

    private struct Gate {
        var isClosed = false
        var parked: [CheckedContinuation<Void, Never>] = []
    }

    /// Keyed by username so a second lookup cannot be handed the first
    /// person's answer.
    private var searches: [String: [SearchOutcome]]
    private var lists: [ListOutcome]
    private var sends: [CommandOutcome]
    private var responses: [CommandOutcome]

    private var searchGate = Gate()
    private var listGate = Gate()
    private var commandGate = Gate()

    private(set) var searchedUsernames: [String] = []
    private(set) var sentRequests: [SentRequest] = []
    private(set) var respondedRequests: [RespondedRequest] = []
    private(set) var listCalls = 0

    init(
        searches: [String: [SearchOutcome]] = [:],
        lists: [ListOutcome] = [],
        sends: [CommandOutcome] = [],
        responses: [CommandOutcome] = []
    ) {
        self.searches = searches
        self.lists = lists
        self.sends = sends
        self.responses = responses
    }

    // MARK: - FriendDirectoryProviding

    func searchCandidate(username: String) async throws -> FriendCandidate {
        searchedUsernames.append(username)
        var queue = searches[username] ?? []
        let claimed = queue.isEmpty ? nil : queue.removeFirst()
        searches[username] = queue

        await waitAtSearchGate()
        guard let claimed else { throw ScriptExhausted() }
        switch claimed {
        case .candidate(let candidate): return candidate
        case .failure(let failure): throw failure
        }
    }

    func listIncomingRequests() async throws -> [IncomingFriendRequest] {
        let index = listCalls
        listCalls += 1
        let claimed = index < lists.count ? lists[index] : nil

        await waitAtListGate()
        guard let claimed else { throw ScriptExhausted() }
        switch claimed {
        case .requests(let requests): return requests
        case .failure(let failure): throw failure
        }
    }

    func countIncomingRequests() async throws -> Int {
        switch lists.first {
        case .requests(let requests): return requests.count
        default: return 0
        }
    }

    // MARK: - FriendCommandsProviding

    func sendRequest(
        targetId: String,
        clientRequestId: String
    ) async throws -> FriendRequestOutcome {
        let index = sentRequests.count
        sentRequests.append(
            SentRequest(targetId: targetId, clientRequestId: clientRequestId)
        )
        let claimed = index < sends.count ? sends[index] : nil

        await waitAtCommandGate()
        return try unwrap(claimed)
    }

    func respondRequest(
        requestId: String,
        response: FriendRequestResponse
    ) async throws -> FriendRequestOutcome {
        let index = respondedRequests.count
        respondedRequests.append(
            RespondedRequest(requestId: requestId, response: response)
        )
        let claimed = index < responses.count ? responses[index] : nil

        await waitAtCommandGate()
        return try unwrap(claimed)
    }

    // MARK: - Gates

    func holdSearches() { searchGate.isClosed = true }
    func holdLists() { listGate.isClosed = true }
    func holdCommands() { commandGate.isClosed = true }
    func releaseSearches() { open(&searchGate) }
    func releaseLists() { open(&listGate) }
    func releaseCommands() { open(&commandGate) }

    private func open(_ gate: inout Gate) {
        gate.isClosed = false
        let parked = gate.parked
        gate.parked = []
        for continuation in parked { continuation.resume() }
    }

    private func waitAtSearchGate() async {
        guard searchGate.isClosed else { return }
        await withCheckedContinuation { searchGate.parked.append($0) }
    }

    private func waitAtListGate() async {
        guard listGate.isClosed else { return }
        await withCheckedContinuation { listGate.parked.append($0) }
    }

    private func waitAtCommandGate() async {
        guard commandGate.isClosed else { return }
        await withCheckedContinuation { commandGate.parked.append($0) }
    }

    private func unwrap(_ outcome: CommandOutcome?) throws -> FriendRequestOutcome {
        switch outcome {
        case .outcome(let value): return value
        case .failure(let failure): throw failure
        case nil: throw ScriptExhausted()
        }
    }
}

enum FriendFixtures {
    static let sam = FriendProfile(
        id: "profile-sam",
        displayName: "Sam Lee",
        username: "sam_lee"
    )

    static let noor = FriendProfile(
        id: "profile-noor",
        displayName: "Noor Haddad",
        username: "noor_h"
    )

    static let priya = FriendProfile(
        id: "profile-priya",
        displayName: "Priya Raghunathan",
        username: "priya_raghunathan"
    )

    static func request(
        id: String,
        from sender: FriendProfile,
        at createdAt: String = "2026-07-20T09:00:00.000Z"
    ) -> IncomingFriendRequest {
        IncomingFriendRequest(requestId: id, sender: sender, createdAt: createdAt)
    }

    static func outcome(
        _ status: String,
        requestId: String? = "request-1"
    ) -> ScriptedFriends.CommandOutcome {
        .outcome(FriendRequestOutcome(requestId: requestId, status: status))
    }

    static func failure(
        _ code: String,
        notice: String = "Something needs a moment."
    ) -> FriendCommandFailure {
        FriendCommandFailure(code: code, notice: notice)
    }
}

/// Polls a predicate with tiny real sleeps — the repo's established idiom for
/// awaiting actor-driven state (`TimingSupport` precedent).
@MainActor
func eventually(
    within limit: Duration = .seconds(2),
    _ predicate: @MainActor () async -> Bool
) async -> Bool {
    let deadline = ContinuousClock.now.advanced(by: limit)
    while ContinuousClock.now < deadline {
        if await predicate() { return true }
        try? await Task.sleep(for: .milliseconds(2))
    }
    return await predicate()
}
