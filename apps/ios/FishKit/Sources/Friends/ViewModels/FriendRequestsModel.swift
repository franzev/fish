import Foundation
import FriendsData
import Observation

/// Drives the incoming-request list and the one-request review behind it.
///
/// Answering is single-flight per request and remembers *which* answer is on
/// its way: a Decline that spins the Accept button tells someone the wrong
/// thing about their own choice. Both answers are unavailable while either is
/// in flight, and a refusal keeps the row with the server's own sentence.
@MainActor @Observable
public final class FriendRequestsModel {
    public private(set) var state: FriendRequestsState = .loading
    public private(set) var selectedRequest: IncomingFriendRequest?

    @ObservationIgnored private let directory: any FriendDirectoryProviding
    @ObservationIgnored private let commands: any FriendCommandsProviding
    @ObservationIgnored private let onAllRequestsHandled: () -> Void

    /// The request the add-friend pivot asked for, before the list arrived.
    @ObservationIgnored private var pendingSelectionId: String?

    /// Bumped by every load, so a list that arrives after a retry is dropped.
    @ObservationIgnored private var loadAttempt = 0

    public init(
        directory: any FriendDirectoryProviding,
        commands: any FriendCommandsProviding,
        onAllRequestsHandled: @escaping () -> Void = {}
    ) {
        self.directory = directory
        self.commands = commands
        self.onAllRequestsHandled = onAllRequestsHandled
    }

    // MARK: - Commands

    /// Opening the sheet loads; `selecting` opens straight onto one request
    /// when the add-friend pivot pointed at it.
    public func load(selecting requestId: String? = nil) {
        pendingSelectionId = requestId
        selectedRequest = nil
        state = .loading
        loadAttempt += 1
        let attempt = loadAttempt
        Task {
            do {
                let requests = try await directory.listIncomingRequests()
                guard attempt == loadAttempt else { return }
                state = .loaded(requests: requests)
                if let pending = pendingSelectionId {
                    pendingSelectionId = nil
                    selectedRequest = requests.first { $0.requestId == pending }
                }
            } catch is CancellationError {
                return
            } catch {
                guard attempt == loadAttempt else { return }
                state = .failed(notice: "Could not load friend requests.")
            }
        }
    }

    public func select(_ request: IncomingFriendRequest) {
        clearNotice()
        selectedRequest = request
    }

    public func clearSelection() {
        pendingSelectionId = nil
        clearNotice()
        selectedRequest = nil
    }

    public func respond(requestId: String, response: FriendRequestResponse) {
        guard case .loaded(let requests, let respondingWith, _) = state else { return }
        guard respondingWith[requestId] == nil else { return }

        var busy = respondingWith
        busy[requestId] = response
        state = .loaded(requests: requests, respondingWith: busy)

        Task {
            do {
                _ = try await commands.respondRequest(
                    requestId: requestId,
                    response: response
                )
                guard let settled = free(requestId) else { return }
                let remaining = settled.requests.filter { $0.requestId != requestId }
                state = .loaded(
                    requests: remaining,
                    respondingWith: settled.respondingWith
                )
                if selectedRequest?.requestId == requestId { selectedRequest = nil }
                // Handling the last one is the whole errand: leave.
                if remaining.isEmpty { onAllRequestsHandled() }
            } catch is CancellationError {
                return
            } catch {
                guard let settled = free(requestId) else { return }
                state = .loaded(
                    requests: settled.requests,
                    respondingWith: settled.respondingWith,
                    notice: notice(for: error)
                )
            }
        }
    }

    // MARK: - Outcomes

    /// The list as it stands now, with this request no longer answering. A
    /// reload while the answer was in flight owns the screen instead.
    private func free(
        _ requestId: String
    ) -> (requests: [IncomingFriendRequest], respondingWith: [String: FriendRequestResponse])? {
        guard case .loaded(let requests, let respondingWith, _) = state else { return nil }
        var freed = respondingWith
        freed[requestId] = nil
        return (requests, freed)
    }

    /// A refusal was about one request. Moving to another one — or back to
    /// the list — must not carry the last request's sentence along, or the
    /// next person's review opens accusing them of something that never
    /// happened.
    private func clearNotice() {
        guard case .loaded(let requests, let respondingWith, let notice) = state,
              notice != nil
        else { return }
        state = .loaded(requests: requests, respondingWith: respondingWith)
    }

    /// Server copy passes through verbatim; anything else reads as the one
    /// calm fallback line.
    private func notice(for error: Error) -> String {
        (error as? FriendCommandFailure)?.notice ?? FriendCommandFailure.unavailable.notice
    }
}
