import Foundation
import Supabase

/// Catalog/auth-boundary bundle. Supabase SDK types stay internal to
/// ChatData; feature code receives provider-neutral protocols only.
public struct ChatLiveSession: Sendable {
    public let userId: String
    public let messaging: any ChatMessagingProviding
    public let commands: any ChatCommandProviding
    public let realtime: any ChatRealtimeProviding
    public let directory: any ConversationDirectoryProviding
    public let attachmentCommands: any AttachmentCommandProviding
    public let backend: ChatBackendConfiguration
    let client: SupabaseClient
}

public enum ChatLive {
    /// Restores the signed-in session from Supabase's platform storage.
    /// Returns `nil` when this installation has no valid session yet.
    public static func restore(
        supabaseUrl: URL,
        anonKey: String
    ) async throws -> ChatLiveSession? {
        let client = makeClient(supabaseUrl: supabaseUrl, anonKey: anonKey)
        guard let auth = try? await client.auth.session else { return nil }
        return await makeSession(client: client, auth: auth, supabaseUrl: supabaseUrl, anonKey: anonKey)
    }

    public static func signIn(
        supabaseUrl: URL,
        anonKey: String,
        email: String,
        password: String,
        persistSession: Bool = true
    ) async throws -> ChatLiveSession {
        let client = makeClient(
            supabaseUrl: supabaseUrl,
            anonKey: anonKey,
            persistSession: persistSession
        )
        let auth = try await client.auth.signIn(email: email, password: password)
        return await makeSession(client: client, auth: auth, supabaseUrl: supabaseUrl, anonKey: anonKey)
    }

    private static func makeClient(
        supabaseUrl: URL,
        anonKey: String,
        persistSession: Bool = true
    ) -> SupabaseClient {
        SupabaseClient(
            supabaseURL: supabaseUrl,
            supabaseKey: anonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    storage: persistSession
                        ? AuthClient.Configuration.defaultLocalStorage
                        : ChatInMemoryAuthStorage(),
                    storageKey: "fish.auth"
                )
            )
        )
    }

    private static func makeSession(
        client: SupabaseClient,
        auth: Session,
        supabaseUrl: URL,
        anonKey: String
    ) async -> ChatLiveSession {
        let userId = auth.user.id.uuidString.lowercased()
        await client.realtimeV2.setAuth(auth.accessToken)
        let backend = ChatBackendConfiguration(
            supabaseUrl: supabaseUrl,
            anonKey: anonKey,
            accessToken: { try? await client.auth.session.accessToken }
        )
        let attachmentCommands = EdgeFunctionAttachmentCommands(configuration: backend)
        let hydration = RestAttachmentHydration(
            configuration: backend,
            commands: attachmentCommands
        )
        let messaging = RestChatMessaging(
            configuration: backend,
            hydration: hydration
        )
        let realtime = SupabaseChatRealtime(client: client)
        let directory = RestConversationDirectory(
            configuration: backend,
            attentionEvents: { ids in attentionEvents(client: client, conversationIds: ids) }
        )
        return ChatLiveSession(
            userId: userId,
            messaging: messaging,
            commands: EdgeFunctionChatCommands(configuration: backend),
            realtime: realtime,
            directory: directory,
            attachmentCommands: attachmentCommands,
            backend: backend,
            client: client
        )
    }

    public static func signOut(_ session: ChatLiveSession) async {
        try? await session.client.auth.signOut()
    }

    public static func registerPushDevice(
        _ session: ChatLiveSession,
        installationId: UUID,
        providerInstallationId: String,
        platform: String,
        appVersion: String
    ) async throws {
        let request = PushDeviceCommand(
            action: "register",
            installationId: installationId,
            providerInstallationId: providerInstallationId,
            platform: platform,
            appVersion: appVersion
        )
        try await session.client.functions.invoke(
            "push-command",
            options: FunctionInvokeOptions(body: request)
        )
    }

    public static func unregisterPushDevice(
        _ session: ChatLiveSession,
        installationId: UUID
    ) async throws {
        try await session.client.functions.invoke(
            "push-command",
            options: FunctionInvokeOptions(
                body: PushDeviceCommand(
                    action: "unregister",
                    installationId: installationId
                )
            )
        )
    }
}

private struct PushDeviceCommand: Encodable, Sendable {
    let action: String
    let installationId: UUID
    let providerInstallationId: String?
    let platform: String?
    let appVersion: String?

    init(
        action: String,
        installationId: UUID,
        providerInstallationId: String? = nil,
        platform: String? = nil,
        appVersion: String? = nil
    ) {
        self.action = action
        self.installationId = installationId
        self.providerInstallationId = providerInstallationId
        self.platform = platform
        self.appVersion = appVersion
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(action, forKey: .action)
        try container.encode(installationId, forKey: .installationId)
        try container.encodeIfPresent(providerInstallationId, forKey: .providerInstallationId)
        try container.encodeIfPresent(platform, forKey: .platform)
        try container.encodeIfPresent(appVersion, forKey: .appVersion)
    }

    private enum CodingKeys: String, CodingKey {
        case action
        case installationId
        case providerInstallationId
        case platform
        case appVersion
    }
}

private final class ChatInMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
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

private func attentionEvents(
    client: SupabaseClient,
    conversationIds: [String]
) -> AsyncStream<String> {
    AsyncStream(bufferingPolicy: .bufferingNewest(20)) { continuation in
        let task = Task {
            guard !conversationIds.isEmpty,
                  let token = try? await client.auth.session.accessToken,
                  !token.isEmpty
            else {
                continuation.finish()
                return
            }
            await client.realtimeV2.setAuth(token)
            let channels = conversationIds.map { id in
                (
                    id,
                    client.channel("attention:conversation:\(id)") { $0.isPrivate = true }
                )
            }
            let streams = channels.map { ($0.0, $0.1.broadcastStream(event: "attention.changed")) }
            await withTaskGroup(of: Void.self) { group in
                for (id, stream) in streams {
                    group.addTask {
                        for await _ in stream { continuation.yield(id) }
                    }
                }
                group.addTask {
                    for (_, channel) in channels {
                        guard !Task.isCancelled else { return }
                        try? await channel.subscribeWithError()
                    }
                }
                await group.waitForAll()
            }
            for (_, channel) in channels { await client.removeChannel(channel) }
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}
