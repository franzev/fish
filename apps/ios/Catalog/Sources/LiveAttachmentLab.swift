import CallData
import CallMediaLiveKit
import Calls
import ChatData
import DesignSystem
import PersonalChat
import SwiftUI
import TestSupport
import UIComponents

/// Development-only live chat and call host. It appears only when all local
/// stack values are present, keeping normal catalog runs deterministic.
struct LiveChatLabConfiguration {
    let supabaseUrl: URL
    let anonKey: String
    let email: String
    let password: String

    static func fromBundle() -> LiveChatLabConfiguration? {
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
            let password = value("SupabasePassword")
        else { return nil }
        return LiveChatLabConfiguration(
            supabaseUrl: url,
            anonKey: anonKey,
            email: email,
            password: password
        )
    }
}

@MainActor @Observable
final class LiveChatLab {
    enum Phase { case signingIn, directory, opening, ready, failed(String) }

    private(set) var phase = Phase.signingIn
    private(set) var directoryStore: ConversationDirectoryStore?
    private(set) var store: ConversationStore?
    private(set) var uploads: AttachmentUploadsModel?
    private(set) var attachmentCommands: (any AttachmentCommandProviding)?
    private(set) var callModel: CallSessionModel?
    private(set) var callMedia: LiveKitCallMedia?
    private(set) var imageLoader: MessageImageLoader
    private(set) var fileDownloader: AttachmentFileDownloader
    private(set) var currentUserId = ""

    private let configuration: LiveChatLabConfiguration
    private var session: ChatLiveSession?

    init(configuration: LiveChatLabConfiguration) {
        self.configuration = configuration
        imageLoader = MessageImageLoader(allowedHost: configuration.supabaseUrl.host)
        fileDownloader = AttachmentFileDownloader(allowedHost: configuration.supabaseUrl.host)
    }

    func start() async {
        guard session == nil else { return }
        do {
            let session = try await ChatLive.signIn(
                supabaseUrl: configuration.supabaseUrl,
                anonKey: configuration.anonKey,
                email: configuration.email,
                password: configuration.password
            )
            self.session = session
            currentUserId = session.userId
            let directoryStore = ConversationDirectoryStore(directory: session.directory)
            self.directoryStore = directoryStore
            await directoryStore.start()
            await followDirectoryRoute()
        } catch {
            phase = .failed("Sign-in didn’t complete. Check the local stack and the chat lab keys.")
        }
    }

    func openConversation(_ conversationId: String) async {
        guard let preview = directoryStore?.conversations.first(where: {
            $0.conversationId == conversationId
        }) else { return }
        await openConversation(preview)
    }

    func retryDirectory() async {
        guard let directoryStore else { return }
        phase = .signingIn
        await directoryStore.refresh()
        await followDirectoryRoute()
    }

    func retry() async {
        phase = .signingIn
        if session == nil {
            await start()
        } else {
            await followDirectoryRoute()
        }
    }

    /// Returns true when the host should dismiss instead of showing a list.
    func closeConversation() -> Bool {
        cleanupConversation()
        guard (directoryStore?.conversations.count ?? 0) > 1 else { return true }
        phase = .directory
        Task { await directoryStore?.refresh() }
        return false
    }

    func startCall(_ kind: CallKind) async {
        guard
            let model = callModel,
            let store,
            !store.participantId.isEmpty
        else { return }
        await model.startCall(
            recipientId: store.participantId,
            recipientName: store.participantName,
            kind: kind
        )
    }

    func shutdown() {
        cleanupConversation()
        directoryStore?.stop()
        if let session {
            Task { await ChatLive.signOut(session) }
        }
        self.session = nil
    }

    private func followDirectoryRoute() async {
        guard let directoryStore else { return }
        switch directoryStore.route {
        case .empty, .list:
            phase = .directory
        case .direct(let id):
            await openConversation(id)
        }
    }

    private func openConversation(_ preview: ChatConversationPreview) async {
        guard let session else { return }
        cleanupConversation()
        phase = .opening
        do {
            let store = ConversationStore(
                conversationId: preview.conversationId,
                currentUserId: session.userId,
                participantId: preview.participantId,
                participantName: preview.participantDisplayName,
                currentUserRole: preview.participantRole == "client" ? .coach : .client,
                messaging: session.messaging,
                commands: session.commands,
                realtime: session.realtime,
                gifProvider: FixtureGifProvider()
            )
            let uploads = AttachmentUploadsModel(
                conversationId: preview.conversationId,
                commands: session.attachmentCommands,
                uploader: SignedUrlByteUploader(configuration: session.backend),
                staging: try AttachmentStaging()
            )
            self.store = store
            self.uploads = uploads
            attachmentCommands = session.attachmentCommands
            fileDownloader = AttachmentFileDownloader(
                allowedHost: configuration.supabaseUrl.host,
                commands: session.attachmentCommands
            )

            let backend = CallBackendConfiguration(
                supabaseUrl: session.backend.supabaseUrl,
                anonKey: session.backend.anonKey,
                accessToken: session.backend.accessToken
            )
            let media = LiveKitCallMedia()
            let callModel = CallSessionModel(
                userId: session.userId,
                commands: EdgeFunctionCallCommands(configuration: backend),
                realtime: PollingCallRealtime(
                    directory: RestCallDirectory(configuration: backend)
                ),
                media: media
            )
            callMedia = media
            self.callModel = callModel
            await callModel.start()
            phase = .ready
            await store.start()
        } catch {
            cleanupConversation()
            phase = .failed("That conversation didn’t open yet. Try again.")
        }
    }

    private func cleanupConversation() {
        uploads?.dismiss()
        store?.stop()
        callModel?.shutdown()
        uploads = nil
        store = nil
        callModel = nil
        callMedia = nil
        attachmentCommands = nil
    }
}

struct LiveChatLabPage: View {
    @State private var lab: LiveChatLab
    @Environment(\.dismiss) private var dismiss

    init(configuration: LiveChatLabConfiguration) {
        _lab = State(initialValue: LiveChatLab(configuration: configuration))
    }

    var body: some View {
        ZStack {
            content
            if let callModel = lab.callModel, let media = lab.callMedia, let store = lab.store {
                CallOverlay(
                    model: callModel,
                    localVideo: { media.localVideoView() },
                    remoteVideo: { media.remoteVideoView() },
                    chatContent: { AnyView(liveTranscript(store)) }
                )
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await lab.start() }
        .onDisappear { lab.shutdown() }
    }

    @ViewBuilder private var content: some View {
        switch lab.phase {
        case .signingIn:
            Text("Signing in to the local stack…")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Palette.bg)
        case .opening:
            Text("Opening conversation…")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Palette.bg)
        case .failed(let message):
            VStack(spacing: Spacing.md) {
                Notice(tone: .notice, title: message)
                ActionButton("Try again", variant: .primary) {
                    Task { await lab.retry() }
                }
            }
                .padding(Spacing.page)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(Palette.bg)
        case .directory:
            if let directory = lab.directoryStore {
                ConversationListScreen(
                    conversations: directory.conversations,
                    currentUserId: lab.currentUserId,
                    notice: directory.notice,
                    onOpen: { id in Task { await lab.openConversation(id) } },
                    onRetry: { Task { await lab.retryDirectory() } }
                )
            }
        case .ready:
            if let store = lab.store,
               let uploads = lab.uploads,
               let attachmentCommands = lab.attachmentCommands {
                @Bindable var store = store
                PersonalChatScreen(
                    model: store.model,
                    draft: $store.draft,
                    selection: $store.selection,
                    gifProvider: FixtureGifProvider(),
                    attachmentUploads: uploads,
                    attachmentCommands: attachmentCommands,
                    imageLoader: lab.imageLoader,
                    fileDownloader: lab.fileDownloader,
                    onSend: { payload in Task { await store.send(payload) } },
                    onRetryMessage: { id in Task { await store.retry(messageId: id) } },
                    onRetryOlder: { Task { await store.loadOlder() } },
                    onMessageAction: store.perform,
                    onVisibleMessage: store.visibleMessage,
                    onCancelComposerContext: store.cancelComposerContext,
                    onComposerFocusChanged: store.composerFocusChanged,
                    onBack: {
                        if lab.closeConversation() { dismiss() }
                    },
                    trailingContent: callButtons
                )
            }
        }
    }

    private var callButtons: AnyView? {
        guard let model = lab.callModel, let store = lab.store else { return nil }
        return AnyView(CallEntryButtons(
            recipientName: store.participantName,
            busy: model.busy,
            onStartCall: { kind in Task { await lab.startCall(kind) } }
        ))
    }

    private func liveTranscript(_ store: ConversationStore) -> some View {
        PersonalChatTranscript(
            items: TranscriptBuilder.build(messages: store.model.messages),
            olderMessages: store.model.olderMessages,
            onRetryMessage: { id in Task { await store.retry(messageId: id) } },
            onRetryOlder: { Task { await store.loadOlder() } },
            onMessageAction: store.perform,
            onVisibleMessage: store.visibleMessage,
            attachmentCommands: lab.attachmentCommands,
            imageLoader: lab.imageLoader,
            fileDownloader: lab.fileDownloader
        )
        .background(Palette.bg)
    }
}
