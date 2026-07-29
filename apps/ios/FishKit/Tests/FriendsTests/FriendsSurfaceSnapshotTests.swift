import DesignSystem
import FriendsData
import SwiftUI
import Testing
@testable import Friends

/// Visual contract for the two friends sheets: every state a person can land
/// in, light and dark, plus AX-XL and RTL where layout or the @handle can
/// shift.
@MainActor
struct FriendsSurfaceSnapshotTests {
    // MARK: - Add a friend

    @Test func addFriendInput() async {
        let backend = ScriptedFriends()
        let model = AddFriendModel(directory: backend, commands: backend)
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-input")
        assertAccessibilitySnapshots(of: view, named: "add-friend-input")
    }

    @Test func addFriendEmptyUsername() async {
        let backend = ScriptedFriends()
        let model = AddFriendModel(directory: backend, commands: backend)
        model.search(" ")
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-empty-username")
        assertAccessibilitySnapshots(of: view, named: "add-friend-empty-username")
    }

    @Test func addFriendSearching() async {
        let backend = ScriptedFriends(
            searches: ["sam_lee": [.candidate(candidate(.none))]]
        )
        let model = AddFriendModel(directory: backend, commands: backend)
        await backend.holdSearches()
        model.search("sam_lee")
        #expect(await eventually { model.isSearching })

        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-searching")
        await backend.releaseSearches()
    }

    @Test func addFriendSearchFailed() async {
        let model = await settled(
            ScriptedFriends(searches: ["sam_lee": [.failure(.unavailable)]])
        ) { $0.isInput }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-search-failed")
        assertAccessibilitySnapshots(of: view, named: "add-friend-search-failed")
    }

    @Test func addFriendCandidate() async {
        let model = await settled(
            ScriptedFriends(searches: ["sam_lee": [.candidate(candidate(.none))]])
        ) { $0.candidate != nil }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-candidate")
        assertAccessibilitySnapshots(of: view, named: "add-friend-candidate")
    }

    @Test func addFriendSent() async {
        let backend = ScriptedFriends(
            searches: ["sam_lee": [.candidate(candidate(.none))]],
            sends: [FriendFixtures.outcome(FriendRequestStatus.pending)]
        )
        let model = await asked(backend) { $0.isSent }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-sent")
        assertAccessibilitySnapshots(of: view, named: "add-friend-sent")
    }

    @Test func addFriendAlreadyFriends() async {
        let model = await settled(
            ScriptedFriends(searches: ["sam_lee": [.candidate(candidate(.friends))]])
        ) { $0.candidate?.status == .friends }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-already-friends")
        assertAccessibilitySnapshots(of: view, named: "add-friend-already-friends")
    }

    @Test func addFriendIncoming() async {
        let incoming = FriendCandidate(
            status: .incomingPending,
            profile: FriendFixtures.sam,
            requestId: "request-1"
        )
        let model = await settled(
            ScriptedFriends(searches: ["sam_lee": [.candidate(incoming)]])
        ) { $0.candidate?.status == .incomingPending }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-incoming")
        assertAccessibilitySnapshots(of: view, named: "add-friend-incoming")
    }

    @Test func addFriendUnavailable() async {
        let model = await settled(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(FriendCandidate(status: .unavailable))]]
            )
        ) { $0.candidate?.status == .unavailable }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-unavailable")
        assertAccessibilitySnapshots(of: view, named: "add-friend-unavailable")
    }

    @Test func addFriendRefused() async {
        let backend = ScriptedFriends(
            searches: ["sam_lee": [.candidate(candidate(.none))]],
            sends: [
                .failure(
                    FriendFixtures.failure(
                        FriendCommandCode.rateLimited,
                        notice: "Pause for a moment before sending more requests."
                    )
                )
            ]
        )
        let model = await asked(backend) { $0.notice != nil }
        let view = AddFriendSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "add-friend-refused")
        assertAccessibilitySnapshots(of: view, named: "add-friend-refused")
    }

    // MARK: - Friend requests

    /// Reduce Motion is pinned so the skeleton pulse holds still for the
    /// camera (`SharedContentGallerySnapshotTests` precedent).
    @Test func friendRequestsLoading() async {
        let backend = ScriptedFriends(lists: [.requests([])])
        let model = FriendRequestsModel(directory: backend, commands: backend)
        await backend.holdLists()
        model.load()
        #expect(await eventually { await backend.listCalls == 1 })

        let view = FriendRequestsSheet(model: model, onClose: {})
            .environment(\.fishReduceMotion, true)
        assertThemedSnapshots(of: view, named: "friend-requests-loading")
        await backend.releaseLists()
    }

    @Test func friendRequestsList() async {
        let model = await loaded(
            [
                FriendFixtures.request(id: "request-1", from: FriendFixtures.sam),
                FriendFixtures.request(id: "request-2", from: FriendFixtures.noor),
                FriendFixtures.request(id: "request-3", from: FriendFixtures.priya),
            ]
        )
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-requests-list")
        assertAccessibilitySnapshots(of: view, named: "friend-requests-list")
    }

    @Test func friendRequestsEmpty() async {
        let model = await loaded([])
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-requests-empty")
        assertAccessibilitySnapshots(of: view, named: "friend-requests-empty")
    }

    @Test func friendRequestsFailed() async {
        let backend = ScriptedFriends(lists: [.failure(.unavailable)])
        let model = FriendRequestsModel(directory: backend, commands: backend)
        model.load()
        #expect(await eventually { model.isFailed })
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-requests-failed")
        assertAccessibilitySnapshots(of: view, named: "friend-requests-failed")
    }

    @Test func friendRequestReview() async {
        let request = FriendFixtures.request(id: "request-1", from: FriendFixtures.sam)
        let model = await loaded([request])
        model.select(request)
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-request-review")
        assertAccessibilitySnapshots(of: view, named: "friend-request-review")
    }

    @Test func friendRequestAccepting() async {
        let (model, backend) = await answering(.accept)
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-request-accepting")
        assertAccessibilitySnapshots(of: view, named: "friend-request-accepting")
        await backend.releaseCommands()
    }

    @Test func friendRequestDeclining() async {
        let (model, backend) = await answering(.decline)
        let view = FriendRequestsSheet(model: model, onClose: {})
        assertThemedSnapshots(of: view, named: "friend-request-declining")
        assertAccessibilitySnapshots(of: view, named: "friend-request-declining")
        await backend.releaseCommands()
    }

    // MARK: - Helpers

    private func candidate(_ status: FriendCandidateStatus) -> FriendCandidate {
        FriendCandidate(status: status, profile: FriendFixtures.sam)
    }

    private func settled(
        _ backend: ScriptedFriends,
        until condition: @escaping @MainActor (AddFriendModel) -> Bool
    ) async -> AddFriendModel {
        let model = AddFriendModel(directory: backend, commands: backend)
        model.search("sam_lee")
        _ = await eventually { condition(model) }
        return model
    }

    private func asked(
        _ backend: ScriptedFriends,
        until condition: @escaping @MainActor (AddFriendModel) -> Bool
    ) async -> AddFriendModel {
        let model = AddFriendModel(directory: backend, commands: backend)
        model.search("sam_lee")
        _ = await eventually { model.candidate != nil }
        model.sendRequest()
        _ = await eventually { condition(model) }
        return model
    }

    private func loaded(_ requests: [IncomingFriendRequest]) async -> FriendRequestsModel {
        let backend = ScriptedFriends(lists: [.requests(requests)])
        let model = FriendRequestsModel(directory: backend, commands: backend)
        model.load()
        _ = await eventually { model.isLoaded }
        return model
    }

    /// A review page with one answer on its way. The gate stays shut for the
    /// life of the snapshot so the spinner never resolves mid-render.
    private func answering(
        _ response: FriendRequestResponse
    ) async -> (FriendRequestsModel, ScriptedFriends) {
        let request = FriendFixtures.request(id: "request-1", from: FriendFixtures.sam)
        let backend = ScriptedFriends(
            lists: [.requests([request])],
            responses: [FriendFixtures.outcome(FriendRequestStatus.accepted)]
        )
        let model = FriendRequestsModel(directory: backend, commands: backend)
        model.load()
        _ = await eventually { model.isLoaded }
        model.select(request)
        await backend.holdCommands()
        model.respond(requestId: request.requestId, response: response)
        _ = await eventually { await backend.respondedRequests.count == 1 }
        return (model, backend)
    }
}

extension AddFriendModel {
    var isInput: Bool {
        guard case .input(_, let notice, _) = state else { return false }
        return notice != nil
    }

    var isSearching: Bool {
        guard case .input(_, _, let isSearching) = state else { return false }
        return isSearching
    }
}

extension FriendRequestsModel {
    var isLoaded: Bool {
        guard case .loaded = state else { return false }
        return true
    }

    var isFailed: Bool {
        guard case .failed = state else { return false }
        return true
    }
}
