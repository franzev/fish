import Foundation
import FriendsData
import Testing
@testable import Friends

@MainActor
struct AddFriendModelTests {
    @Test func aBlankUsernameNeverReachesTheServer() async {
        let backend = ScriptedFriends()
        let model = makeModel(backend)

        model.search("   ")

        #expect(model.state == .input(fieldNotice: "Add a username to search."))
        #expect(await backend.searchedUsernames.isEmpty)
    }

    @Test func aLookupThatNeverLandsExplainsItself() async {
        let backend = ScriptedFriends(searches: ["sam_lee": [.failure(.unavailable)]])
        let model = makeModel(backend)

        model.search("sam_lee")

        #expect(
            await eventually {
                model.state == .input(
                    notice: "The search didn’t go through. Give it a moment and try again."
                )
            }
        )
    }

    @Test func aLookupTrimsTheSpaceAroundWhatTheyTyped() async {
        let backend = ScriptedFriends(searches: ["sam_lee": [.candidate(found(.none))]])
        let model = makeModel(backend)

        model.search("  sam_lee \n")

        #expect(await eventually { model.candidate != nil })
        #expect(await backend.searchedUsernames == ["sam_lee"])
    }

    // MARK: - Send outcomes

    @Test func anAlreadyPendingRequestReadsAsSent() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [FriendFixtures.outcome(FriendRequestStatus.pending)]
            )
        )

        #expect(await eventually { model.isSent })
        #expect(model.candidate?.status == FriendCandidateStatus.none)
        #expect(model.notice == nil)
    }

    @Test func aPendingConflictAlsoReadsAsSent() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [.failure(FriendFixtures.failure(FriendCommandCode.requestPending))]
            )
        )

        #expect(await eventually { model.isSent })
        #expect(model.notice == nil)
    }

    @Test func aReplayedRequestThatCameBackAcceptedReadsAsAlreadyFriends() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [FriendFixtures.outcome(FriendRequestStatus.accepted)]
            )
        )

        #expect(await eventually { model.candidate?.status == .friends })
        #expect(model.candidate?.profile == FriendFixtures.sam)
    }

    @Test func anAlreadyFriendsConflictRendersFriends() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [.failure(FriendFixtures.failure(FriendCommandCode.alreadyFriends))]
            )
        )

        #expect(await eventually { model.candidate?.status == .friends })
        #expect(model.notice == nil)
    }

    /// Any other status the server settles on is not someone to render a card
    /// for — it collapses into the cause-less unavailable notice.
    @Test func anOutcomeThatIsNeitherPendingNorAcceptedFallsBackToUnavailable() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [FriendFixtures.outcome(FriendRequestStatus.declined)]
            )
        )

        #expect(await eventually { model.candidate?.status == .unavailable })
        #expect(model.candidate?.profile == nil)
    }

    @Test func aCrossedRequestPivotsToTheReviewTheyCanActOn() async {
        let backend = ScriptedFriends(
            searches: [
                "sam_lee": [
                    .candidate(found(.none)),
                    .candidate(
                        FriendCandidate(
                            status: .incomingPending,
                            profile: FriendFixtures.sam,
                            requestId: "request-1"
                        )
                    ),
                ]
            ],
            sends: [.failure(FriendFixtures.failure(FriendCommandCode.incomingRequestExists))]
        )
        let model = await sent(backend)

        #expect(await eventually { model.candidate?.status == .incomingPending })
        #expect(model.candidate?.requestId == "request-1")
        #expect(model.notice == nil)
        #expect(await backend.searchedUsernames == ["sam_lee", "sam_lee"])
    }

    @Test func aCrossedRequestWhoseLookupFailsStillSaysWhoAskedFirst() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none)), .failure(.unavailable)]],
                sends: [.failure(FriendFixtures.failure(FriendCommandCode.incomingRequestExists))]
            )
        )

        #expect(await eventually { model.notice == "They already sent you a request." })
        #expect(model.candidate?.status == FriendCandidateStatus.none)
        #expect(model.isSending == false)
    }

    @Test func aFailedSendShowsTheServersOwnWordsAndStaysRetryable() async {
        let model = await sent(
            ScriptedFriends(
                searches: ["sam_lee": [.candidate(found(.none))]],
                sends: [
                    .failure(
                        FriendFixtures.failure(
                            FriendCommandCode.rateLimited,
                            notice: "Pause for a moment before sending more requests."
                        )
                    )
                ]
            )
        )

        #expect(
            await eventually {
                model.notice == "Pause for a moment before sending more requests."
            }
        )
        #expect(model.isSending == false)
        #expect(model.isSent == false)
    }

    // MARK: - Request identity

    @Test
    func retryingOnePersonReusesTheirRequestIdAndANewSearchMintsAnother() async throws {
        let refusal = ScriptedFriends.CommandOutcome.failure(
            FriendFixtures.failure(FriendCommandCode.rateLimited, notice: "Try again soon.")
        )
        let backend = ScriptedFriends(
            searches: ["sam_lee": [.candidate(found(.none)), .candidate(found(.none))]],
            sends: [refusal, refusal]
        )
        let model = makeModel(backend)

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        let firstId = try #require(model.clientRequestId)

        model.sendRequest()
        #expect(await eventually { model.notice != nil })
        model.sendRequest()
        #expect(await eventually { await backend.sentRequests.count == 2 })

        model.searchAgain()
        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        let secondId = try #require(model.clientRequestId)

        #expect(await backend.sentRequests.map(\.clientRequestId) == [firstId, firstId])
        #expect(firstId != secondId)
        #expect(firstId == firstId.lowercased())
    }

    @Test func anUnavailablePersonIsNeverAskedAndCarriesNoProfile() async {
        let backend = ScriptedFriends(
            searches: ["sam_lee": [.candidate(FriendCandidate(status: .unavailable))]]
        )
        let model = makeModel(backend)

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        model.sendRequest()

        #expect(model.candidate?.status == .unavailable)
        #expect(model.candidate?.profile == nil)
        #expect(await backend.sentRequests.isEmpty)
    }

    @Test func searchingAgainReturnsToTheEmptyField() async {
        let backend = ScriptedFriends(searches: ["sam_lee": [.candidate(found(.none))]])
        let model = makeModel(backend)

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        model.searchAgain()

        #expect(model.state == .input())
    }

    // MARK: - Late answers

    @Test func aSendThatLandsAfterANewSearchLeavesTheNewPersonAlone() async throws {
        let backend = ScriptedFriends(
            searches: [
                "sam_lee": [.candidate(found(.none))],
                "noor_h": [
                    .candidate(FriendCandidate(status: .none, profile: FriendFixtures.noor))
                ],
            ],
            sends: [FriendFixtures.outcome(FriendRequestStatus.pending)]
        )
        let model = makeModel(backend)

        model.search("sam_lee")
        #expect(await eventually { model.candidate?.profile == FriendFixtures.sam })
        let first = try #require(model.clientRequestId)

        await backend.holdCommands()
        model.sendRequest()
        #expect(await eventually { await backend.sentRequests.count == 1 })

        model.searchAgain()
        model.search("noor_h")
        #expect(await eventually { model.candidate?.profile == FriendFixtures.noor })

        await backend.releaseCommands()
        // Sam's answer must not mark Noor as asked.
        let leaked = await eventually(within: .milliseconds(300)) { model.isSent }
        #expect(leaked == false)
        #expect(model.candidate?.profile == FriendFixtures.noor)
        #expect(model.clientRequestId != first)
    }

    @Test func aLookupThatLandsAfterTheScreenMovedOnIsDropped() async {
        let backend = ScriptedFriends(
            searches: [
                "sam_lee": [.candidate(found(.none))],
                "noor_h": [
                    .candidate(FriendCandidate(status: .none, profile: FriendFixtures.noor))
                ],
            ]
        )
        let model = makeModel(backend)

        await backend.holdSearches()
        model.search("sam_lee")
        #expect(await eventually { await backend.searchedUsernames.count == 1 })

        // A second lookup takes the screen over while the first is in flight.
        model.searchAgain()
        model.search("noor_h")
        #expect(await eventually { await backend.searchedUsernames.count == 2 })
        await backend.releaseSearches()

        #expect(await eventually { model.candidate != nil })
        let settled = await eventually(within: .milliseconds(300)) {
            model.candidate?.profile == FriendFixtures.sam
        }
        #expect(settled == false)
        #expect(model.candidate?.profile == FriendFixtures.noor)
    }

    // MARK: - Review pivot

    @Test func theReviewPivotHandsBackTheRequestTheSenderPointedAt() async {
        let backend = ScriptedFriends(
            searches: [
                "sam_lee": [
                    .candidate(
                        FriendCandidate(
                            status: .incomingPending,
                            profile: FriendFixtures.sam,
                            requestId: "request-9"
                        )
                    )
                ]
            ]
        )
        let reviewed = Reviewed()
        let model = AddFriendModel(
            directory: backend,
            commands: backend,
            onReviewRequested: {
                reviewed.requestId = $0
                reviewed.calls += 1
            }
        )

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        model.reviewRequest()

        #expect(reviewed.calls == 1)
        #expect(reviewed.requestId == "request-9")
    }

    /// The search can name someone who asked first without naming the request
    /// itself. Review must still fire — the sheet opens on the whole list —
    /// so the card is never a dead end.
    @Test func aPivotWithNoRequestIdStillAsksForTheReview() async {
        let backend = ScriptedFriends(
            searches: [
                "sam_lee": [
                    .candidate(
                        FriendCandidate(
                            status: .incomingPending,
                            profile: FriendFixtures.sam
                        )
                    )
                ]
            ]
        )
        let reviewed = Reviewed()
        let model = AddFriendModel(
            directory: backend,
            commands: backend,
            onReviewRequested: {
                reviewed.requestId = $0
                reviewed.calls += 1
            }
        )

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        model.reviewRequest()

        #expect(reviewed.calls == 1)
        #expect(reviewed.requestId == nil)
    }

    @Test func onlyAnIncomingCandidateCanBeReviewed() async {
        let backend = ScriptedFriends(searches: ["sam_lee": [.candidate(found(.none))]])
        let reviewed = Reviewed()
        let model = AddFriendModel(
            directory: backend,
            commands: backend,
            onReviewRequested: { _ in reviewed.calls += 1 }
        )

        model.search("sam_lee")
        #expect(await eventually { model.candidate != nil })
        model.reviewRequest()

        #expect(reviewed.calls == 0)
    }

    // MARK: - Helpers

    private func makeModel(_ backend: ScriptedFriends) -> AddFriendModel {
        AddFriendModel(directory: backend, commands: backend)
    }

    /// Searches for Sam and taps the one action on their card.
    private func sent(_ backend: ScriptedFriends) async -> AddFriendModel {
        let model = makeModel(backend)
        model.search("sam_lee")
        _ = await eventually { model.candidate != nil }
        model.sendRequest()
        return model
    }

    private func found(_ status: FriendCandidateStatus) -> FriendCandidate {
        FriendCandidate(status: status, profile: FriendFixtures.sam)
    }
}

@MainActor
private final class Reviewed {
    var requestId: String?
    var calls = 0
}

extension AddFriendModel {
    var candidate: FriendCandidate? {
        guard case .candidate(let candidate, _, _, _, _) = state else { return nil }
        return candidate
    }

    var clientRequestId: String? {
        guard case .candidate(_, let clientRequestId, _, _, _) = state else { return nil }
        return clientRequestId
    }

    var isSending: Bool {
        guard case .candidate(_, _, let isSending, _, _) = state else { return false }
        return isSending
    }

    var isSent: Bool {
        guard case .candidate(_, _, _, let isSent, _) = state else { return false }
        return isSent
    }

    var notice: String? {
        switch state {
        case .input(_, let notice, _): notice
        case .candidate(_, _, _, _, let notice): notice
        }
    }
}
