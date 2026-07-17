import Foundation
import Supabase

/// Dev-lab entry to the live backend: password sign-in against the local
/// stack, returning the live remote and ids while SDK types stay inside
/// PresenceData. The future product auth layer replaces this seam; nothing
/// outside the catalog lab may construct it today.
public struct PresenceLiveSession: Sendable {
    public let userId: String
    public let remote: SupabasePresenceRemote
    let client: SupabaseClient
}

public enum PresenceLive {
    public static func signIn(
        supabaseUrl: URL,
        anonKey: String,
        email: String,
        password: String
    ) async throws -> PresenceLiveSession {
        let client = SupabaseClient(
            supabaseURL: supabaseUrl,
            supabaseKey: anonKey,
            options: SupabaseClientOptions(
                // Lab sessions are deliberately not persisted — every open
                // signs in fresh, and headless harnesses never touch the
                // keychain.
                auth: .init(storage: InMemoryAuthStorage())
            )
        )
        let session = try await client.auth.signIn(email: email, password: password)
        return PresenceLiveSession(
            userId: session.user.id.uuidString.lowercased(),
            remote: SupabasePresenceRemote(client: client),
            client: client
        )
    }

    public static func signOut(_ session: PresenceLiveSession) async {
        try? await session.client.auth.signOut()
    }
}

private final class InMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
    private var values: [String: Data] = [:]
    private let lock = NSLock()

    func store(key: String, value: Data) throws {
        lock.withLock { values[key] = value }
    }

    func retrieve(key: String) throws -> Data? {
        lock.withLock { values[key] }
    }

    func remove(key: String) throws {
        lock.withLock { values[key] = nil }
    }
}
