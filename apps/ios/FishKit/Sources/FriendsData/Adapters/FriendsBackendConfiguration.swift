import Foundation

/// Connection details the live friends adapters need. The access token is a
/// closure so the app boundary can hand over the signed-in session's current
/// token without this module owning auth (the `CallBackendConfiguration`
/// precedent).
public struct FriendsBackendConfiguration: Sendable {
    public let supabaseUrl: URL
    public let anonKey: String
    public let accessToken: @Sendable () async -> String?

    public init(
        supabaseUrl: URL,
        anonKey: String,
        accessToken: @escaping @Sendable () async -> String?
    ) {
        self.supabaseUrl = supabaseUrl
        self.anonKey = anonKey
        self.accessToken = accessToken
    }
}
