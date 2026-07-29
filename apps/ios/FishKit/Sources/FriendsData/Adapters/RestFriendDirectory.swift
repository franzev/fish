import Foundation

/// Live reads over the friends RPCs — the same three calls the web
/// repository makes, hand-rolled against `rest/v1/rpc/{name}` so this module
/// carries no SDK (the `RestConversationDirectory` precedent).
public struct RestFriendDirectory: FriendDirectoryProviding {
    static let requestTimeout: TimeInterval = 15
    /// The server clamps to 100; 50 is what the web and Android clients ask
    /// for, and the review surface pages by refetching.
    static let incomingRequestPageSize = 50

    private let configuration: FriendsBackendConfiguration
    private let session: URLSession

    public init(
        configuration: FriendsBackendConfiguration,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.session = session
    }

    public func searchCandidate(username: String) async throws -> FriendCandidate {
        try await rpc(
            "search_friend_candidate",
            body: SearchFriendCandidateParams(username: username),
            as: FriendCandidateWire.self
        ).domain
    }

    public func listIncomingRequests() async throws -> [IncomingFriendRequest] {
        try await rpc(
            "list_incoming_friend_requests",
            body: ListIncomingFriendRequestsParams(limit: Self.incomingRequestPageSize),
            as: [IncomingFriendRequestWire].self
        ).map(\.domain)
    }

    /// The count RPC returns a bare integer, so the body is decoded as a
    /// JSON scalar rather than a wrapper object.
    public func countIncomingRequests() async throws -> Int {
        try await rpc(
            "count_incoming_friend_requests",
            body: EmptyFriendsParams(),
            as: Int.self
        )
    }

    private func rpc<Request: Encodable, Response: Decodable>(
        _ name: String,
        body: Request,
        as type: Response.Type
    ) async throws -> Response {
        guard let token = await configuration.accessToken() else {
            throw FriendCommandFailure.notAuthenticated
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "rest/v1/rpc/\(name)")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        do {
            let (data, response) = try await session.data(for: request)
            let http = response as? HTTPURLResponse
            guard let http, (200..<300).contains(http.statusCode) else {
                throw friendFailure(data: data, statusCode: http?.statusCode)
            }
            return try JSONDecoder().decode(type, from: data)
        } catch is CancellationError {
            throw CancellationError()
        } catch let failure as FriendCommandFailure {
            throw failure
        } catch {
            throw FriendCommandFailure.unavailable
        }
    }
}
