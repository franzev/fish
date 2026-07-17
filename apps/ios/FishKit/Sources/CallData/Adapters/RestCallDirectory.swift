import Foundation

/// Durable-state reads over PostgREST — the iOS mirror of the web realtime
/// service's `findCall`/`findCurrentCall` (RLS-protected `calls` selects plus
/// the `get_call_counterpart_name` RPC).
public struct RestCallDirectory: Sendable {
    private let configuration: CallBackendConfiguration
    private let session: URLSession

    public init(configuration: CallBackendConfiguration, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    public func findCurrentCall(userId: String) async throws -> CallSnapshot? {
        let row = try await queryCalls([
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "status", value: "in.(ringing,connecting,active)"),
            URLQueryItem(name: "or", value: "(coach_id.eq.\(userId),client_id.eq.\(userId))"),
            URLQueryItem(name: "order", value: "created_at.desc"),
            URLQueryItem(name: "limit", value: "1"),
        ]).first
        guard let row else { return nil }
        return CallSnapshot(
            call: row.clientCall,
            counterpartName: await counterpartName(callId: row.id)
        )
    }

    public func findCall(id: String, userId _: String) async throws -> CallSnapshot? {
        let row = try await queryCalls([
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "id", value: "eq.\(id)"),
            URLQueryItem(name: "limit", value: "1"),
        ]).first
        guard let row else { return nil }
        return CallSnapshot(
            call: row.clientCall,
            counterpartName: await counterpartName(callId: row.id)
        )
    }

    // MARK: - PostgREST plumbing

    /// Snake-case row of `public.calls`, decoded with `convertFromSnakeCase`.
    private struct CallRow: Decodable {
        let id: String
        let lessonSlotId: String?
        let coachId: String
        let clientId: String
        let initiatedBy: String
        let kind: CallKind
        let status: ClientCallStatus
        let expiresAt: String
        let acceptedAt: String?
        let connectedAt: String?
        let endedAt: String?
        let endReason: String?
        let createdAt: String
        let updatedAt: String

        var clientCall: ClientCall {
            ClientCall(
                id: id,
                lessonSlotId: lessonSlotId,
                coachId: coachId,
                clientId: clientId,
                initiatedBy: initiatedBy,
                kind: kind,
                status: status,
                expiresAt: expiresAt,
                acceptedAt: acceptedAt,
                connectedAt: connectedAt,
                endedAt: endedAt,
                endReason: endReason,
                createdAt: createdAt,
                updatedAt: updatedAt
            )
        }
    }

    private func queryCalls(_ query: [URLQueryItem]) async throws -> [CallRow] {
        var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "rest/v1/calls"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = query
        guard let url = components?.url else { throw URLError(.badURL) }

        let (data, response) = try await session.data(for: await authorizedRequest(url: url))
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode([CallRow].self, from: data)
    }

    private func counterpartName(callId: String) async -> String {
        let fallback = "Your call partner"
        let url = configuration.supabaseUrl
            .appending(path: "rest/v1/rpc/get_call_counterpart_name")
        var request = await authorizedRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["p_call_id": callId])

        guard
            let (data, response) = try? await session.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let name = try? JSONDecoder().decode(String.self, from: data),
            !name.isEmpty
        else { return fallback }
        return name
    }

    private func authorizedRequest(url: URL) async -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        if let token = await configuration.accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }
}
