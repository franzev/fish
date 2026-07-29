import Foundation
import FriendsData
import Observation

/// Drives add-a-friend: one username in, at most one person out, and one tap
/// to ask. The server owns every outcome — a conflict it reports is usually
/// the answer the person actually wanted, so it becomes the calm end state
/// rather than an error.
///
/// Late answers never land on the wrong screen. A search carries an attempt
/// token and a send carries the candidate's `clientRequestId`; either one
/// finishing after the model moved on is dropped instead of overwriting
/// whoever is on screen now.
@MainActor @Observable
public final class AddFriendModel {
    public private(set) var state: AddFriendState = .input()

    @ObservationIgnored private let directory: any FriendDirectoryProviding
    @ObservationIgnored private let commands: any FriendCommandsProviding
    @ObservationIgnored private let onReviewRequested: (String?) -> Void

    /// Bumped by everything that takes the screen over, so a lookup that lands
    /// afterwards knows it is stale.
    @ObservationIgnored private var searchAttempt = 0

    public init(
        directory: any FriendDirectoryProviding,
        commands: any FriendCommandsProviding,
        onReviewRequested: @escaping (String?) -> Void = { _ in }
    ) {
        self.directory = directory
        self.commands = commands
        self.onReviewRequested = onReviewRequested
    }

    // MARK: - Commands

    /// Nothing typed never reaches the server: it is a note beside the field,
    /// not a failure.
    public func search(_ username: String) {
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            state = .input(fieldNotice: "Add a username to search.")
            return
        }
        if case .input(_, _, let isSearching) = state, isSearching { return }

        searchAttempt += 1
        let attempt = searchAttempt
        state = .input(isSearching: true)
        Task {
            do {
                let found = try await directory.searchCandidate(username: trimmed)
                guard attempt == searchAttempt else { return }
                state = .candidate(found, clientRequestId: Self.newClientRequestId())
            } catch is CancellationError {
                return
            } catch {
                guard attempt == searchAttempt else { return }
                state = .input(
                    notice: "The search didn’t go through. Give it a moment and try again."
                )
            }
        }
    }

    /// Back to the field. The username they typed is the view's to keep, so
    /// correcting a typo is one edit rather than a retype.
    public func searchAgain() {
        searchAttempt += 1
        state = .input()
    }

    public func sendRequest() {
        guard case .candidate(
            let found,
            let clientRequestId,
            let isSending,
            let isSent,
            _
        ) = state else { return }
        guard !isSending, !isSent, found.status == .none else { return }
        guard let profile = found.profile else { return }

        state = .candidate(found, clientRequestId: clientRequestId, isSending: true)
        Task {
            do {
                let outcome = try await commands.sendRequest(
                    targetId: profile.id,
                    clientRequestId: clientRequestId
                )
                guard let candidate = currentCandidate(matching: clientRequestId) else { return }
                state = resolve(outcome, on: candidate, clientRequestId: clientRequestId)
            } catch is CancellationError {
                return
            } catch let failure as FriendCommandFailure {
                guard currentCandidate(matching: clientRequestId) != nil else { return }
                await settle(
                    failure,
                    username: profile.username,
                    clientRequestId: clientRequestId
                )
            } catch {
                guard let candidate = currentCandidate(matching: clientRequestId) else { return }
                state = .candidate(
                    candidate,
                    clientRequestId: clientRequestId,
                    notice: FriendCommandFailure.unavailable.notice
                )
            }
        }
    }

    /// They asked first, so the next tap should be the answer rather than a
    /// hunt through the list.
    public func reviewRequest() {
        guard case .candidate(let found, _, _, _, _) = state,
              found.status == .incomingPending
        else { return }
        onReviewRequested(found.requestId)
    }

    // MARK: - Outcomes

    /// The server owns the outcome, even for a replay: a request that comes
    /// back already accepted means the two are friends.
    private func resolve(
        _ outcome: FriendRequestOutcome,
        on candidate: FriendCandidate,
        clientRequestId: String
    ) -> AddFriendState {
        switch outcome.status {
        case FriendRequestStatus.pending:
            .candidate(candidate, clientRequestId: clientRequestId, isSent: true)
        case FriendRequestStatus.accepted:
            .candidate(
                FriendCandidate(
                    status: .friends,
                    profile: candidate.profile,
                    requestId: candidate.requestId
                ),
                clientRequestId: clientRequestId
            )
        default:
            .candidate(
                FriendCandidate(status: .unavailable),
                clientRequestId: clientRequestId
            )
        }
    }

    /// Two of the server's conflicts are the outcome the person wanted, and a
    /// third means they were beaten to it. Everything else is the server's own
    /// sentence, shown exactly as written.
    private func settle(
        _ failure: FriendCommandFailure,
        username: String,
        clientRequestId: String
    ) async {
        switch failure.code {
        case FriendCommandCode.requestPending:
            guard let candidate = currentCandidate(matching: clientRequestId) else { return }
            state = .candidate(candidate, clientRequestId: clientRequestId, isSent: true)
        case FriendCommandCode.alreadyFriends:
            guard let candidate = currentCandidate(matching: clientRequestId) else { return }
            state = .candidate(
                FriendCandidate(
                    status: .friends,
                    profile: candidate.profile,
                    requestId: candidate.requestId
                ),
                clientRequestId: clientRequestId
            )
        case FriendCommandCode.incomingRequestExists:
            await pivotToIncomingRequest(
                username: username,
                clientRequestId: clientRequestId
            )
        default:
            guard let candidate = currentCandidate(matching: clientRequestId) else { return }
            state = .candidate(
                candidate,
                clientRequestId: clientRequestId,
                notice: failure.notice
            )
        }
    }

    /// They sent their own request between the search and the tap; a fresh
    /// lookup recovers the request id so review is one step away.
    private func pivotToIncomingRequest(
        username: String,
        clientRequestId: String
    ) async {
        let found = try? await directory.searchCandidate(username: username)
        guard let candidate = currentCandidate(matching: clientRequestId) else { return }
        if let found, found.status == .incomingPending {
            state = .candidate(found, clientRequestId: clientRequestId)
            return
        }
        state = .candidate(
            candidate,
            clientRequestId: clientRequestId,
            notice: "They already sent you a request."
        )
    }

    /// The candidate on screen right now, and only if it is still the one this
    /// answer belongs to.
    private func currentCandidate(matching clientRequestId: String) -> FriendCandidate? {
        guard case .candidate(let candidate, let current, _, _, _) = state,
              current == clientRequestId
        else { return nil }
        return candidate
    }

    private static func newClientRequestId() -> String {
        UUID().uuidString.lowercased()
    }
}
