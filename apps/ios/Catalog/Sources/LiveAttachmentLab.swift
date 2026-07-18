import ChatData
import DesignSystem
import PersonalChat
import SwiftUI
import TestSupport
import UIComponents

/// Development-only configuration for exercising the complete attachment
/// path against a local Supabase stack. The page is absent when any required
/// value is missing, so catalog builds stay deterministic and offline-first.
struct LiveAttachmentLabConfiguration {
    let supabaseUrl: URL
    let anonKey: String
    let email: String
    let password: String
    let conversationId: String
    let participantName: String

    static func fromBundle() -> LiveAttachmentLabConfiguration? {
        func value(_ key: String) -> String? {
            let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed?.isEmpty == false ? trimmed : nil
        }
        guard
            let rawUrl = value("SupabaseUrl"),
            let url = URL(string: rawUrl),
            let anonKey = value("SupabaseAnonKey"),
            let email = value("SupabaseEmail"),
            let password = value("SupabasePassword"),
            let conversationId = value("SupabaseConversationId")
        else { return nil }
        return LiveAttachmentLabConfiguration(
            supabaseUrl: url,
            anonKey: anonKey,
            email: email,
            password: password,
            conversationId: conversationId,
            participantName: value("SupabaseRecipientName") ?? "Your chat partner"
        )
    }
}

@MainActor @Observable
final class LiveAttachmentLab {
    enum Phase {
        case signingIn
        case ready
        case failed(String)
    }

    private struct PendingSend {
        let payload: ChatSendPayload
        let clientRequestId: String
    }

    private(set) var phase: Phase = .signingIn
    private(set) var connection = ChatConnectionState.connecting
    private(set) var messages: [MessageUiModel] = []
    private(set) var uploads: AttachmentUploadsModel?
    private(set) var commands: EdgeFunctionAttachmentCommands?
    private(set) var imageLoader: MessageImageLoader
    private(set) var fileDownloader: AttachmentFileDownloader

    private let configuration: LiveAttachmentLabConfiguration
    private var messaging: RestChatMessaging?
    private var userId: String?
    private var pending: [String: PendingSend] = [:]
    private var refreshGeneration = 0

    init(configuration: LiveAttachmentLabConfiguration) {
        self.configuration = configuration
        imageLoader = MessageImageLoader(allowedHost: configuration.supabaseUrl.host)
        fileDownloader = AttachmentFileDownloader(allowedHost: configuration.supabaseUrl.host)
    }

    var model: PersonalChatUiModel {
        PersonalChatUiModel(
            participantName: configuration.participantName,
            phase: phase.isReady ? .ready : .loading,
            connection: connection,
            messages: messages
        )
    }

    func start() async {
        guard messaging == nil else {
            await refresh()
            return
        }
        do {
            let session = try await signIn()
            let backend = ChatBackendConfiguration(
                supabaseUrl: configuration.supabaseUrl,
                anonKey: configuration.anonKey,
                accessToken: { session.accessToken }
            )
            let commands = EdgeFunctionAttachmentCommands(configuration: backend)
            let hydration = RestAttachmentHydration(
                configuration: backend,
                commands: commands
            )
            let messaging = RestChatMessaging(
                configuration: backend,
                hydration: hydration
            )
            let uploads = AttachmentUploadsModel(
                conversationId: configuration.conversationId,
                commands: commands,
                uploader: SignedUrlByteUploader(configuration: backend),
                staging: try AttachmentStaging()
            )

            userId = session.userId
            self.commands = commands
            self.messaging = messaging
            self.uploads = uploads
            fileDownloader = AttachmentFileDownloader(
                allowedHost: configuration.supabaseUrl.host,
                commands: commands
            )
            phase = .ready
            connection = .connected
            await refresh()
        } catch {
            connection = .offline
            phase = .failed(
                "Sign-in didn’t complete. Check the local stack and the attachment lab keys."
            )
        }
    }

    func poll() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            await refresh()
        }
    }

    func send(_ payload: ChatSendPayload) async {
        await send(payload, clientRequestId: UUID().uuidString)
    }

    func retry(messageId: String) async {
        guard let retry = pending.removeValue(forKey: messageId) else { return }
        messages.removeAll { $0.id == messageId }
        await send(retry.payload, clientRequestId: retry.clientRequestId)
    }

    func shutdown() {
        uploads?.dismiss()
    }

    private func send(
        _ payload: ChatSendPayload,
        clientRequestId: String
    ) async {
        guard let messaging, let userId else { return }
        let optimisticId = "pending-\(clientRequestId)"
        let optimistic = MessageUiModel(
            id: optimisticId,
            direction: .outgoing,
            senderId: userId,
            senderName: "You",
            body: payload.body,
            attachments: payload.optimisticAttachments,
            sentAt: Date(),
            delivery: .sending
        )
        messages.append(optimistic)

        do {
            let sent = try await messaging.send(SendChatMessageRequest(
                conversationId: configuration.conversationId,
                body: payload.body,
                clientRequestId: clientRequestId,
                attachmentIds: payload.attachmentIds
            ))
            replaceMessage(
                optimisticId,
                with: presentation(
                    sent,
                    attachments: payload.optimisticAttachments,
                    delivery: .sent
                )
            )
            connection = .connected
            await refresh()
        } catch {
            pending[optimisticId] = PendingSend(
                payload: payload,
                clientRequestId: clientRequestId
            )
            replaceMessage(
                optimisticId,
                with: MessageUiModel(
                    id: optimisticId,
                    direction: .outgoing,
                    senderId: userId,
                    senderName: "You",
                    body: payload.body,
                    attachments: payload.optimisticAttachments,
                    sentAt: optimistic.sentAt,
                    delivery: .failed
                )
            )
        }
    }

    private func refresh() async {
        guard let messaging else { return }
        refreshGeneration += 1
        let generation = refreshGeneration
        do {
            let fetched = try await messaging.messages(
                conversationId: configuration.conversationId
            )
            guard generation == refreshGeneration else { return }
            let localPending = messages.filter {
                $0.delivery == .sending || $0.delivery == .failed
            }
            messages = fetched.map { presentation($0) } + localPending
            connection = .connected
        } catch {
            guard generation == refreshGeneration else { return }
            connection = .offline
        }
    }

    private func presentation(
        _ message: ChatMessage,
        attachments: [MessageAttachmentUiModel]? = nil,
        delivery: MessageDeliveryStatus? = nil
    ) -> MessageUiModel {
        let outgoing = message.senderId == userId
        return MessageUiModel(
            id: message.id,
            direction: outgoing ? .outgoing : .incoming,
            senderId: message.senderId,
            senderName: outgoing ? "You" : configuration.participantName,
            body: message.body,
            attachments: attachments ?? message.attachments.map {
                MessageAttachmentUiModel(attachment: $0)
            },
            sentAt: message.createdAt,
            delivery: outgoing ? (delivery ?? .sent) : nil
        )
    }

    private func replaceMessage(_ id: String, with replacement: MessageUiModel) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index] = replacement
    }

    // MARK: - Dev sign-in (password grant against the local stack)

    private struct SessionResponse: Decodable {
        struct User: Decodable { let id: String }
        let accessToken: String
        let user: User
    }

    private struct Session: Sendable {
        let accessToken: String
        let userId: String
    }

    private func signIn() async throws -> Session {
        var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "auth/v1/token"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        guard let url = components?.url else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONEncoder().encode([
            "email": configuration.email,
            "password": configuration.password,
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.userAuthenticationRequired)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let session = try decoder.decode(SessionResponse.self, from: data)
        return Session(accessToken: session.accessToken, userId: session.user.id)
    }
}

private extension LiveAttachmentLab.Phase {
    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }
}

struct LiveAttachmentLabPage: View {
    @State private var lab: LiveAttachmentLab
    @State private var draft = ""
    @State private var selection = ComposerSelection.none
    @Environment(\.dismiss) private var dismiss

    init(configuration: LiveAttachmentLabConfiguration) {
        _lab = State(initialValue: LiveAttachmentLab(configuration: configuration))
    }

    var body: some View {
        Group {
            switch lab.phase {
            case .signingIn:
                Text("Signing in to the local stack…")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.bg)
            case .failed(let message):
                Notice(tone: .notice, title: message)
                    .padding(Spacing.page)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .background(Palette.bg)
            case .ready:
                if let uploads = lab.uploads, let commands = lab.commands {
                    PersonalChatScreen(
                        model: lab.model,
                        draft: $draft,
                        selection: $selection,
                        gifProvider: FixtureGifProvider(),
                        attachmentUploads: uploads,
                        attachmentCommands: commands,
                        imageLoader: lab.imageLoader,
                        fileDownloader: lab.fileDownloader,
                        onSend: { payload in
                            draft = ""
                            selection = .none
                            Task { await lab.send(payload) }
                        },
                        onRetryMessage: { id in
                            Task { await lab.retry(messageId: id) }
                        },
                        onRetryOlder: {},
                        onBack: { dismiss() }
                    )
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await lab.start()
            await lab.poll()
        }
        .onDisappear { lab.shutdown() }
    }
}
