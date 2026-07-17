import Foundation

/// Connection details the live call adapters need. The access token is a
/// closure so a future auth layer can refresh sessions; today the catalog's
/// live lab injects a fixed development token.
public struct CallBackendConfiguration: Sendable {
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
