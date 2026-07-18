import Foundation

public struct ChatBackendConfiguration: Sendable {
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
