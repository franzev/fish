import Foundation
import FriendsData
import Testing
@testable import Friends

@MainActor
struct FriendRequestsModelTests {
    private static let samRequest = FriendFixtures.request(id: "request-1", from: FriendFixtures.sam)
    private static let noorRequest = FriendFixtures.request(id: "request-2", from: FriendFixtures.noor)

    @Test func openingLoadsTheRequestsWaitingOnThem() async {
        let backend = ScriptedFriends(lists: [.requests([Self.samRequest, Self.noorRequest])])
        let model = makeModel(backend)

        model.load()

        #expect(await eventually { model.requests.count == 2 })
        #expect(model.requests.map(\.requestId) == ["request-1", "request-2"])
        #expect(model.selectedRequest == nil)
    }

    @Test func aListThatNeverArrivesExplainsItselfAndRetryRecovers() async {
        let backend = ScriptedFriends(
            lists: [.failure(.unavailable), .requests([Self.samRequest])]
        )
        let model = makeModel(backend)

        model.load()
        #expect(
            await eventually {
                model.state == .failed(notice: "Could not load friend requests.")
            }
        )

        model.load()
        #expect(await eventually { model.requests.count == 1 })
    }

    @Test func theReviewPivotOpensTheRequestTheSenderPointedAt() async {
        let backend = ScriptedFriends(lists: [.requests([Self.samRequest, Self.noorRequest])])
        let model = makeModel(backend)

        model.load(selecting: "request-2")

        #expect(await eventually { model.selectedRequest != nil })
        #expect(model.selectedRequest?.requestId == "request-2")
    }

    @Test func aPivotAtSomeoneWhoIsNoLongerWaitingLandsOnTheList() async {
        let backend = ScriptedFriends(lists: [.requests([Self.samRequest])])
        let model = makeModel(backend)

        model.load(selecting: "request-404")

        #expect(await eventually { model.requests.count == 1 })
        #expect(model.selectedRequest == nil)
    }

    // MARK: - Answering

    @Test func theSpinnerSitsOnTheAnswerTheyChose() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest, Self.noorRequest])],
            responses: [FriendFixtures.outcome(FriendRequestStatus.declined)]
        )
        let model = makeModel(backend)
        model.load()
        #expect(await eventually { model.requests.count == 2 })

        await backend.holdCommands()
        model.respond(requestId: "request-1", response: .decline)

        #expect(model.respondingWith["request-1"] == .decline)
        #expect(model.respondingWith["request-2"] == nil)
        await backend.releaseCommands()
        #expect(await eventually { model.requests.count == 1 })
    }

    @Test func aRequestAlreadyBeingAnsweredIsNotAnsweredTwice() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest])],
            responses: [FriendFixtures.outcome(FriendRequestStatus.accepted)]
        )
        let model = makeModel(backend)
        model.load()
        #expect(await eventually { model.requests.count == 1 })

        await backend.holdCommands()
        model.respond(requestId: "request-1", response: .accept)
        model.respond(requestId: "request-1", response: .decline)
        model.respond(requestId: "request-1", response: .accept)

        #expect(await eventually { await backend.respondedRequests.count == 1 })
        #expect(model.respondingWith["request-1"] == .accept)
        await backend.releaseCommands()
        #expect(await eventually { model.requests.isEmpty })
        #expect(await backend.respondedRequests.count == 1)
    }

    @Test func answeringARequestRemovesItsRowAndClearsTheReview() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest, Self.noorRequest])],
            responses: [FriendFixtures.outcome(FriendRequestStatus.accepted)]
        )
        let handled = Handled()
        let model = makeModel(backend, onAllRequestsHandled: { handled.calls += 1 })
        model.load()
        #expect(await eventually { model.requests.count == 2 })
        model.select(Self.samRequest)

        model.respond(requestId: "request-1", response: .accept)

        #expect(await eventually { model.requests.count == 1 })
        #expect(model.requests.map(\.requestId) == ["request-2"])
        #expect(model.selectedRequest == nil)
        #expect(model.respondingWith.isEmpty)
        // One request is still waiting, so the sheet stays open.
        #expect(handled.calls == 0)
    }

    @Test func handlingTheLastRequestSaysSo() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest])],
            responses: [FriendFixtures.outcome(FriendRequestStatus.declined)]
        )
        let handled = Handled()
        let model = makeModel(backend, onAllRequestsHandled: { handled.calls += 1 })
        model.load()
        #expect(await eventually { model.requests.count == 1 })

        model.respond(requestId: "request-1", response: .decline)

        #expect(await eventually { handled.calls == 1 })
        #expect(model.requests.isEmpty)
    }

    @Test func aRefusedAnswerKeepsTheRowAndShowsTheServersOwnWords() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest])],
            responses: [
                .failure(
                    FriendFixtures.failure(
                        FriendCommandCode.requestAlreadyResolved,
                        notice: "That request has already been answered."
                    )
                )
            ]
        )
        let handled = Handled()
        let model = makeModel(backend, onAllRequestsHandled: { handled.calls += 1 })
        model.load()
        #expect(await eventually { model.requests.count == 1 })
        model.select(Self.samRequest)

        model.respond(requestId: "request-1", response: .accept)

        #expect(
            await eventually {
                model.notice == "That request has already been answered."
            }
        )
        #expect(model.requests.count == 1)
        #expect(model.respondingWith.isEmpty)
        #expect(model.selectedRequest?.requestId == "request-1")
        #expect(handled.calls == 0)
    }

    /// A reload takes the screen over. The answer that was already in flight
    /// must not quietly edit — or empty — the list that replaced it.
    @Test func anAnswerThatLandsWhileTheListIsReloadingIsDropped() async {
        let backend = ScriptedFriends(
            lists: [
                .requests([Self.samRequest]),
                .requests([Self.samRequest, Self.noorRequest]),
            ],
            responses: [FriendFixtures.outcome(FriendRequestStatus.accepted)]
        )
        let handled = Handled()
        let model = makeModel(backend, onAllRequestsHandled: { handled.calls += 1 })
        model.load()
        #expect(await eventually { model.requests.count == 1 })

        await backend.holdCommands()
        model.respond(requestId: "request-1", response: .accept)
        #expect(await eventually { await backend.respondedRequests.count == 1 })

        await backend.holdLists()
        model.load()
        #expect(await eventually { await backend.listCalls == 2 })

        await backend.releaseCommands()
        let escaped = await eventually(within: .milliseconds(300)) { model.state != .loading }
        #expect(escaped == false)
        #expect(handled.calls == 0)

        await backend.releaseLists()
        #expect(await eventually { model.requests.count == 2 })
        #expect(model.requests.map(\.requestId) == ["request-1", "request-2"])
        #expect(handled.calls == 0)
    }

    @Test func aListThatLandsAfterAReloadIsDropped() async {
        let backend = ScriptedFriends(
            lists: [.requests([Self.samRequest]), .requests([Self.noorRequest])]
        )
        let model = makeModel(backend)

        await backend.holdLists()
        model.load()
        #expect(await eventually { await backend.listCalls == 1 })
        model.load()
        #expect(await eventually { await backend.listCalls == 2 })
        await backend.releaseLists()

        #expect(await eventually { model.requests.count == 1 })
        let stale = await eventually(within: .milliseconds(300)) {
            model.requests.map(\.requestId) == ["request-1"]
        }
        #expect(stale == false)
        #expect(model.requests.map(\.requestId) == ["request-2"])
    }

    // MARK: - Helpers

    private func makeModel(
        _ backend: ScriptedFriends,
        onAllRequestsHandled: @escaping () -> Void = {}
    ) -> FriendRequestsModel {
        FriendRequestsModel(
            directory: backend,
            commands: backend,
            onAllRequestsHandled: onAllRequestsHandled
        )
    }
}

@MainActor
private final class Handled {
    var calls = 0
}

extension FriendRequestsModel {
    var requests: [IncomingFriendRequest] {
        guard case .loaded(let requests, _, _) = state else { return [] }
        return requests
    }

    var respondingWith: [String: FriendRequestResponse] {
        guard case .loaded(_, let respondingWith, _) = state else { return [:] }
        return respondingWith
    }

    var notice: String? {
        switch state {
        case .loaded(_, _, let notice): notice
        case .failed(let notice): notice
        case .loading: nil
        }
    }
}
