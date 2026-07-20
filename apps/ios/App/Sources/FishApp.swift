import ChatData
import DesignSystem
import Foundation
import Observation
import PersonalChat
import SwiftUI
import UIKit
import UIComponents
import UserNotifications

@main
struct FishApp: App {
    @State private var model = FishAppModel(configuration: .fromBundle())
    @UIApplicationDelegateAdaptor(FishAppDelegate.self) private var appDelegate

    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            FishRoot(model: model)
                .onOpenURL { url in
                    model.handle(url: url)
                }
        }
    }
}

@MainActor
final class FishAppDelegate: NSObject, UIApplicationDelegate, @MainActor UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(name: .fishPushToken, object: token)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Push is an enhancement; direct chat remains available without it.
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Realtime chat already updates the visible conversation; avoid a
        // competing foreground banner.
        completionHandler([])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let conversationId = response.notification.request.content.userInfo["conversationId"] as? String,
           !conversationId.isEmpty {
            NotificationCenter.default.post(name: .fishOpenConversation, object: conversationId)
        }
        completionHandler()
    }
}

private extension Notification.Name {
    static let fishPushToken = Notification.Name("fish.push-token")
    static let fishOpenConversation = Notification.Name("fish.open-conversation")
}

struct FishRoot: View {
    @Bindable var model: FishAppModel

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                LoadingView()
            case .signedOut:
                SignInView(model: model)
            case .inbox:
                InboxView(model: model)
            case .opening:
                LoadingView(message: "Opening conversation…")
            case .conversation:
                ConversationView(model: model)
            }
        }
        .background(Palette.bg)
        .task { await model.start() }
    }
}

private struct LoadingView: View {
    var message = "Loading messages…"

    var body: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
            Text(message)
                .textStyle(.body)
                .foregroundStyle(Palette.body)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bg)
    }
}

private struct SignInView: View {
    @Bindable var model: FishAppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Spacer(minLength: Spacing.twoXl)
                Text("Messages")
                    .textStyle(.display)
                    .foregroundStyle(Palette.foreground)
                Text("Sign in to continue your conversations.")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                InputField(label: "Email", text: $model.email)
                InputField(
                    label: "Password",
                    text: $model.password,
                    isSecure: true
                )
                if let notice = model.notice {
                    Notice(tone: .notice, title: notice)
                }
                ActionButton(
                    "Sign in",
                    variant: .primary,
                    isLoading: model.isSubmitting,
                    fullWidth: true
                ) {
                    Task { await model.signIn() }
                }
                Spacer(minLength: Spacing.twoXl)
            }
            .padding(Spacing.page)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.bg)
    }
}

private struct InboxView: View {
    @Bindable var model: FishAppModel

    var body: some View {
        if let directory = model.directory {
            ConversationListScreen(
                conversations: directory.conversations,
                currentUserId: model.currentUserId,
                notice: directory.notice,
                onOpen: { id in Task { await model.openConversation(id) } },
                onRetry: { Task { await model.refreshDirectory() } },
                trailing: TopBarAction(
                    icon: .person,
                    accessibilityLabel: "Sign out",
                    action: { Task { await model.signOut() } }
                )
            )
        } else {
            LoadingView()
        }
    }
}

private struct ConversationView: View {
    @Bindable var model: FishAppModel

    var body: some View {
        if let store = model.conversationStore,
           let session = model.session,
           let uploads = model.uploads {
            let draft = Binding<String>(
                get: { store.draft },
                set: { store.draft = $0 }
            )
            let selection = Binding<ComposerSelection>(
                get: { store.selection },
                set: { store.selection = $0 }
            )
            PersonalChatScreen(
                model: store.model,
                draft: draft,
                selection: selection,
                gifProvider: model.gifProvider,
                attachmentUploads: uploads,
                attachmentCommands: session.attachmentCommands,
                imageLoader: model.imageLoader,
                fileDownloader: model.fileDownloader,
                onSend: { payload in Task { await store.send(payload) } },
                onRetryMessage: { id in Task { await store.retry(messageId: id) } },
                onRetryOlder: { Task { await store.loadOlder() } },
                onMessageAction: store.perform,
                onVisibleMessage: store.visibleMessage,
                onCancelComposerContext: store.cancelComposerContext,
                onComposerFocusChanged: store.composerFocusChanged,
                onBack: model.closeConversation
            )
        } else {
            LoadingView(message: "Opening conversation…")
        }
    }
}

@MainActor @Observable
final class FishAppModel {
    enum Phase { case loading, signedOut, inbox, opening, conversation }

    let configuration: FishAppConfiguration
    let gifProvider: KlipyGifProvider
    let imageLoader: MessageImageLoader
    private(set) var fileDownloader: AttachmentFileDownloader

    var phase: Phase = .loading
    var email = ""
    var password = ""
    private(set) var notice: String?
    private(set) var isSubmitting = false
    private(set) var session: ChatLiveSession?
    private(set) var directory: ConversationDirectoryStore?
    private(set) var conversationStore: ConversationStore?
    private(set) var uploads: AttachmentUploadsModel?
    private(set) var currentUserId = ""
    private let pushInstallationId: UUID
    private let appVersion: String
    private var pendingPushToken: String?
    private var pendingConversationId: String?
    private var pushTokenObserver: NSObjectProtocol?
    private var openConversationObserver: NSObjectProtocol?

    init(configuration: FishAppConfiguration) {
        self.configuration = configuration
        gifProvider = KlipyGifProvider(
            apiKey: configuration.klipyApiKey,
            clientKey: configuration.klipyClientKey
        )
        imageLoader = MessageImageLoader(allowedHost: configuration.supabaseUrl?.host)
        fileDownloader = AttachmentFileDownloader(allowedHost: configuration.supabaseUrl?.host)
        appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        if let stored = UserDefaults.standard.string(forKey: "fish.push.installation-id"),
           let uuid = UUID(uuidString: stored) {
            pushInstallationId = uuid
        } else {
            let uuid = UUID()
            pushInstallationId = uuid
            UserDefaults.standard.set(uuid.uuidString, forKey: "fish.push.installation-id")
        }
        observeNotifications()
    }

    func start() async {
        guard phase == .loading else { return }
        guard let supabaseUrl = configuration.supabaseUrl,
              let anonKey = configuration.anonKey
        else {
            notice = "Add the app connection settings before signing in."
            phase = .signedOut
            return
        }
        do {
            if let session = try await ChatLive.restore(
                supabaseUrl: supabaseUrl,
                anonKey: anonKey
            ) {
                await attach(session)
            } else {
                phase = .signedOut
            }
        } catch {
            notice = "Your session could not be restored. Sign in again."
            phase = .signedOut
        }
    }

    func signIn() async {
        guard !isSubmitting else { return }
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !password.isEmpty
        else {
            notice = "Add your email and password to sign in."
            return
        }
        guard let supabaseUrl = configuration.supabaseUrl,
              let anonKey = configuration.anonKey
        else {
            notice = "Add the app connection settings before signing in."
            return
        }
        isSubmitting = true
        notice = nil
        defer { isSubmitting = false }
        do {
            let session = try await ChatLive.signIn(
                supabaseUrl: supabaseUrl,
                anonKey: anonKey,
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            password = ""
            await attach(session)
        } catch {
            notice = "That sign-in didn’t work. Check your details and try again."
            phase = .signedOut
        }
    }

    func signOut() async {
        stopConversation()
        directory?.stop()
        if let session {
            try? await ChatLive.unregisterPushDevice(session, installationId: pushInstallationId)
            await ChatLive.signOut(session)
        }
        session = nil
        directory = nil
        currentUserId = ""
        notice = nil
        phase = .signedOut
    }

    func refreshDirectory() async {
        await directory?.refresh()
    }

    func openConversation(_ id: String) async {
        guard let session, let preview = directory?.conversations.first(where: {
            $0.conversationId == id
        }) else { return }
        stopConversation()
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
                gifProvider: gifProvider
            )
            let staging = try AttachmentStaging()
            let uploads = AttachmentUploadsModel(
                conversationId: preview.conversationId,
                commands: session.attachmentCommands,
                uploader: SignedUrlByteUploader(configuration: session.backend),
                staging: staging
            )
            conversationStore = store
            self.uploads = uploads
            fileDownloader = AttachmentFileDownloader(
                allowedHost: session.backend.supabaseUrl.host,
                commands: session.attachmentCommands
            )
            phase = .conversation
            await store.start()
        } catch {
            stopConversation()
            notice = "That conversation didn’t open yet. Try again."
            phase = .inbox
        }
    }

    func closeConversation() {
        stopConversation()
        phase = .inbox
        Task { await directory?.refresh() }
    }

    func handle(url: URL) {
        guard url.scheme == "fish", url.host == "messages" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard let conversationId = parts.first else { return }
        pendingConversationId = conversationId
        Task { await openPendingConversationIfReady() }
    }

    private func attach(_ session: ChatLiveSession) async {
        self.session = session
        currentUserId = session.userId
        await registerPushDeviceIfPossible()
        let directory = ConversationDirectoryStore(directory: session.directory)
        self.directory = directory
        await directory.start()
        if pendingConversationId != nil {
            if await openPendingConversationIfReady() {
                return
            }
        }
        switch directory.route {
        case .direct(let id): await openConversation(id)
        case .empty, .list: phase = .inbox
        }
    }

    private func stopConversation() {
        uploads?.dismiss()
        conversationStore?.stop()
        conversationStore = nil
        uploads = nil
    }

    private func observeNotifications() {
        pushTokenObserver = NotificationCenter.default.addObserver(
            forName: .fishPushToken,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let token = notification.object as? String else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                pendingPushToken = token
                await registerPushDeviceIfPossible()
            }
        }
        openConversationObserver = NotificationCenter.default.addObserver(
            forName: .fishOpenConversation,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let conversationId = notification.object as? String else { return }
            Task { @MainActor [weak self] in
                self?.pendingConversationId = conversationId
                await self?.openPendingConversationIfReady()
            }
        }
    }

    private func registerPushDeviceIfPossible() async {
        guard let session, let token = pendingPushToken else { return }
        try? await ChatLive.registerPushDevice(
            session,
            installationId: pushInstallationId,
            providerInstallationId: token,
            platform: "ios",
            appVersion: appVersion
        )
    }

    @discardableResult
    private func openPendingConversationIfReady() async -> Bool {
        guard let id = pendingConversationId, let directory else { return false }
        guard directory.phase != .loading else { return false }
        guard directory.conversations.contains(where: { $0.conversationId == id }) else {
            pendingConversationId = nil
            return false
        }
        pendingConversationId = nil
        await openConversation(id)
        return true
    }
}

struct FishAppConfiguration: Sendable {
    let supabaseUrl: URL?
    let anonKey: String?
    let klipyApiKey: String?
    let klipyClientKey: String

    static func fromBundle(_ bundle: Bundle = .main) -> FishAppConfiguration {
        func value(_ key: String) -> String? {
            let raw = bundle.object(forInfoDictionaryKey: key) as? String
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty || trimmed.hasPrefix("$(") || trimmed.hasPrefix("${")
                ? nil
                : trimmed
        }
        return FishAppConfiguration(
            supabaseUrl: value("SUPABASE_URL").flatMap(URL.init(string:)),
            anonKey: value("SUPABASE_ANON_KEY"),
            klipyApiKey: value("KLIPY_API_KEY"),
            klipyClientKey: value("KLIPY_CLIENT_KEY") ?? "fish_chat_ios"
        )
    }
}
