import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
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
    @State private var deviceSettings = DeviceSettingsStore()
    @UIApplicationDelegateAdaptor(FishAppDelegate.self) private var appDelegate

    init() {
        Fonts.register()
    }

    var body: some Scene {
        WindowGroup {
            FishRoot(model: model, deviceSettings: deviceSettings)
                .onOpenURL { url in
                    model.handle(url: url)
                }
        }
    }
}

@MainActor
final class FishAppDelegate: NSObject, UIApplicationDelegate, @MainActor UNUserNotificationCenterDelegate {
    private let voipPushCoordinator = VoipPushCoordinator()
    private let notificationReplyStore = FileChatNotificationReplyStore.shared

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: fishMessageNotificationCategory,
                actions: [
                    UNTextInputNotificationAction(
                        identifier: fishMessageReplyAction,
                        title: "Reply",
                        options: [],
                        textInputButtonTitle: "Send",
                        textInputPlaceholder: "Message"
                    )
                ],
                intentIdentifiers: [],
                options: [.hiddenPreviewsShowTitle]
            )
        ])
        center.getNotificationSettings { settings in
            guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else {
                return
            }
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
        let userInfo = response.notification.request.content.userInfo
        if let conversationId = userInfo["conversationId"] as? String,
           !conversationId.isEmpty {
            let messageId = (userInfo["messageId"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .nilIfEmpty
            if response.actionIdentifier == fishMessageReplyAction,
               let textResponse = response as? UNTextInputNotificationResponse {
                let body = textResponse.userText.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !body.isEmpty, body.count <= 4_000 else {
                    completionHandler()
                    return
                }
                let reply = ChatNotificationReply(conversationId: conversationId, body: body)
                Task { @MainActor [notificationReplyStore] in
                    try? await notificationReplyStore.enqueue(reply)
                    NotificationCenter.default.post(
                        name: .fishQuickReply,
                        object: reply
                    )
                    completionHandler()
                }
                return
            }
            NotificationCenter.default.post(
                name: .fishOpenConversation,
                object: FishNotificationDestination(
                    conversationId: conversationId,
                    messageId: messageId,
                    notificationId: response.notification.request.identifier
                )
            )
        }
        completionHandler()
    }
}

private extension Notification.Name {
    static let fishPushToken = Notification.Name("fish.push-token")
    static let fishOpenConversation = Notification.Name("fish.open-conversation")
    static let fishQuickReply = Notification.Name("fish.quick-reply")
}

private let fishMessageNotificationCategory = "fish.message"
private let fishMessageReplyAction = "fish.message.reply"

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private struct FishNotificationDestination {
    let conversationId: String
    let messageId: String?
    let notificationId: String
}

private struct PendingConversationDestination {
    let conversationId: String
    let messageId: String?
    let notificationId: String?
}

struct FishRoot: View {
    @Bindable var model: FishAppModel
    @Bindable var deviceSettings: DeviceSettingsStore
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
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
            if let callModel = model.callModel, let callMedia = model.callMedia {
                CallOverlay(
                    model: callModel,
                    localVideo: { callMedia.localVideoView() },
                    remoteVideo: { callMedia.remoteVideoView() }
                )
            }
        }
        .background(Palette.bg)
        .preferredColorScheme(deviceSettings.appearance.colorScheme)
        .environment(
            \.fishReduceMotion,
            deviceSettings.effectiveReduceMotion(systemReduceMotion: systemReduceMotion)
        )
        .sheet(isPresented: $model.isShowingAccountSettings) {
            AccountSettingsView(
                displayName: model.accountDisplayName,
                presence: model.accountPresence,
                notificationStatus: model.notificationStatus,
                appearance: deviceSettings.appearance,
                motion: deviceSettings.motion,
                canManageBlockedPeople: model.canManageBlockedPeople,
                notice: model.notice,
                blockedPeopleState: model.blockedPeopleState,
                onRefreshNotifications: { model.refreshNotificationSettingsIfNeeded() },
                onAllowNotifications: { model.requestNotifications() },
                onOpenNotificationSettings: { model.openNotificationSettings() },
                onSetPresence: { visibility, duration in
                    model.setPresence(visibility: visibility, duration: duration)
                },
                onLoadBlockedPeople: { model.loadBlockedPeople() },
                onUnblock: { userId in model.unblock(userId: userId) },
                onOpenPrivacyPolicy: { model.openWebPage(.privacy) },
                onSetAppearance: deviceSettings.setAppearance,
                onSetMotion: deviceSettings.setMotion,
                onResetPassword: { model.openWebPage(.forgotPassword) },
                onSignOut: {
                    model.isShowingAccountSettings = false
                    Task { await model.signOut() }
                }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            model.refreshNotificationSettingsIfNeeded()
        }
        .task {
            model.refreshNotificationSettingsIfNeeded()
            await model.start()
        }
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
                ActionButton("Forgot password", variant: .link, fullWidth: true) {
                    model.openWebPage(.forgotPassword)
                }
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
                    accessibilityLabel: "Account settings",
                    action: model.showAccountSettings
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
            @Bindable var search = store.messageSearch
            let draft = Binding<String>(
                get: { store.draft },
                set: { store.draft = $0 }
            )
            let selection = Binding<ComposerSelection>(
                get: { store.selection },
                set: { store.selection = $0 }
            )
            let searchPresented = Binding<Bool>(
                get: { search.isPresented },
                set: { if !$0 { search.close() } }
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
                onFocusMessage: { id in Task { await store.focusMessage(id) } },
                onVisibleMessage: store.visibleMessage,
                onCancelComposerContext: store.cancelComposerContext,
                onComposerFocusChanged: store.composerFocusChanged,
                onBack: model.closeConversation,
                trailingContent: AnyView(
                    HStack(spacing: Spacing.xs) {
                        if let callModel = model.callModel,
                           let callMedia = model.callMedia,
                           let callKit = model.callKit {
                            CallEntryButtons(
                                recipientName: store.participantName,
                                busy: callModel.busy,
                                onStartCall: { kind in
                                    callKit.startOutgoing(
                                        model: callModel,
                                        media: callMedia,
                                        recipientId: store.participantId,
                                        recipientName: store.participantName,
                                        kind: kind
                                    )
                                }
                            )
                        }
                        IconButton(
                            .search,
                            accessibilityLabel: "Search messages",
                            action: store.openMessageSearch
                        )
                    }
                )
            )
            .sheet(isPresented: searchPresented, onDismiss: search.close) {
                MessageSearchScreen(
                    model: search,
                    onSelect: { id in
                        search.close()
                        Task { await store.focusMessage(id) }
                    }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
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
    var isShowingAccountSettings = false
    private(set) var notice: String?
    private(set) var isSubmitting = false
    private(set) var session: ChatLiveSession?
    private(set) var directory: ConversationDirectoryStore?
    private(set) var conversationStore: ConversationStore?
    private(set) var uploads: AttachmentUploadsModel?
    private(set) var currentUserId = ""
    private(set) var notificationStatus: AccountNotificationAuthorization = .notDetermined
    private(set) var callModel: CallSessionModel?
    private(set) var callMedia: LiveKitCallMedia?
    private(set) var callKit: CallKitCoordinator?
    private var draftStore: (any ChatDraftProviding)?
    private let notificationReplyStore = FileChatNotificationReplyStore.shared
    private var isProcessingNotificationReplies = false
    private(set) var accountPresence = AccountSettingsPresence()
    private(set) var blockedPeopleState = AccountSettingsBlockedPeopleState.hidden
    private let pushInstallationId: UUID
    private let appVersion: String
    private let notificationCenter: UNUserNotificationCenter
    private let application: UIApplication
    private var pendingPushToken: String?
    private var pendingVoipPushToken: String?
    private var pendingVoipCall: FishVoipPushDestination?
    private var handledVoipCallIds = Set<String>()
    private var pendingConversation: PendingConversationDestination?
    private var pendingShare: FishSharePayload?
    private var pushTokenObserver: NSObjectProtocol?
    private var voipPushTokenObserver: NSObjectProtocol?
    private var voipPushInvalidationObserver: NSObjectProtocol?
    private var incomingVoipCallObserver: NSObjectProtocol?
    private var openConversationObserver: NSObjectProtocol?
    private var isRefreshingNotifications = false
    private var isRequestingNotifications = false
    private var isLoadingBlockedPeople = false
    private var accountSettingsGeneration = UUID()

    init(
        configuration: FishAppConfiguration,
        notificationCenter: UNUserNotificationCenter = .current(),
        application: UIApplication = .shared
    ) {
        self.configuration = configuration
        self.notificationCenter = notificationCenter
        self.application = application
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
        callKit = CallKitCoordinator()
        pendingShare = FishShareStore.read()
        observeNotifications()
        if let pending = VoipPushCoordinator.consumePendingDestination() {
            handleIncomingVoipCall(pending)
        }
    }

    var accountDisplayName: String {
        session?.account?.displayName ?? "Your account"
    }

    var canManageBlockedPeople: Bool {
        session?.account?.role == .client
    }

    func showAccountSettings() {
        guard phase == .inbox else { return }
        notice = nil
        isShowingAccountSettings = true
        loadAccountPresence()
    }

    func refreshNotificationSettingsIfNeeded() {
        guard !isRefreshingNotifications else { return }
        isRefreshingNotifications = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            defer { isRefreshingNotifications = false }
            let settings = await notificationCenter.notificationSettings()
            notificationStatus = AccountNotificationAuthorization(
                authorizationStatus: settings.authorizationStatus
            )
            if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
                application.registerForRemoteNotifications()
            }
        }
    }

    func requestNotifications() {
        guard !isRequestingNotifications else { return }
        isRequestingNotifications = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            defer { isRequestingNotifications = false }
            let granted = (try? await notificationCenter.requestAuthorization(
                options: [.alert, .badge, .sound]
            )) == true
            if granted {
                application.registerForRemoteNotifications()
            }
            let settings = await notificationCenter.notificationSettings()
            notificationStatus = AccountNotificationAuthorization(
                authorizationStatus: settings.authorizationStatus
            )
            if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
                application.registerForRemoteNotifications()
            }
        }
    }

    func openNotificationSettings() {
        guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else {
            notice = "Notification settings aren’t available in this build."
            return
        }
        application.open(url, options: [:]) { [weak self] opened in
            guard !opened else { return }
            Task { @MainActor [weak self] in
                self?.notice = "Notification settings aren’t available in this build."
            }
        }
    }

    func setPresence(
        visibility: AccountPresenceVisibility,
        duration: AccountPresenceDuration
    ) {
        guard let session, !accountPresence.updating else { return }
        guard let chatVisibility = ChatPresenceVisibility(rawValue: visibility.rawValue),
              let chatDuration = ChatPresenceDuration(rawValue: duration.rawValue)
        else { return }
        accountPresence.updating = true
        accountPresence.notice = nil
        let generation = accountSettingsGeneration
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let result = try await ChatLive.setPresencePreference(
                    session,
                    visibility: chatVisibility,
                    duration: chatDuration
                )
                guard accountSettingsGeneration == generation,
                      self.session?.userId == session.userId
                else { return }
                accountPresence = AccountSettingsPresence(
                    visibility: AccountPresenceVisibility(
                        rawValue: result.preference.visibility.rawValue
                    ) ?? .automatic
                )
            } catch {
                accountPresence.updating = false
                accountPresence.notice = "Your status could not change. Try again."
            }
        }
    }

    func loadBlockedPeople() {
        guard canManageBlockedPeople,
              let session,
              !isLoadingBlockedPeople
        else { return }
        isLoadingBlockedPeople = true
        blockedPeopleState = .loading
        let generation = accountSettingsGeneration
        Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                if accountSettingsGeneration == generation {
                    isLoadingBlockedPeople = false
                }
            }
            do {
                let people = try await ChatLive.listBlockedPeople(session)
                guard accountSettingsGeneration == generation,
                      self.session?.userId == session.userId
                else { return }
                blockedPeopleState = .loaded(
                    people: people.map { person in
                        AccountSettingsBlockedPerson(
                            userId: person.userId,
                            displayName: person.displayName,
                            username: person.username
                        )
                    }
                )
            } catch {
                blockedPeopleState = .failed
            }
        }
    }

    func unblock(userId: String) {
        guard canManageBlockedPeople,
              let session,
              case .loaded(let people, let busyIds, _) = blockedPeopleState,
              let person = people.first(where: { $0.userId == userId }),
              !busyIds.contains(userId)
        else { return }
        blockedPeopleState = .loaded(
            people: people,
            busyIds: busyIds.union([userId])
        )
        let generation = accountSettingsGeneration
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                try await ChatLive.unblockUser(session, userId: userId)
                guard accountSettingsGeneration == generation,
                      self.session?.userId == session.userId
                else { return }
                blockedPeopleState = .loaded(
                    people: people.filter { $0.userId != userId },
                    notice: "\(person.displayName) is no longer blocked."
                )
            } catch {
                blockedPeopleState = .loaded(
                    people: people,
                    notice: "Blocked people aren’t available yet. Try again."
                )
            }
        }
    }

    func openWebPage(_ path: AccountSettingsWebPath) {
        guard let url = configuration.webURL(path) else {
            notice = path == .privacy
                ? "The privacy policy isn’t available in this build."
                : "Password help isn’t available in this build."
            return
        }
        application.open(url, options: [:]) { [weak self] opened in
            guard !opened else { return }
            Task { @MainActor [weak self] in
                self?.notice = path == .privacy
                    ? "The privacy policy isn’t available in this build."
                    : "Password help isn’t available in this build."
            }
        }
    }

    private func loadAccountPresence() {
        guard let session else { return }
        let generation = accountSettingsGeneration
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let preference = try await ChatLive.ownPresencePreference(session)
                guard accountSettingsGeneration == generation,
                      self.session?.userId == session.userId
                else { return }
                accountPresence = AccountSettingsPresence(
                    visibility: AccountPresenceVisibility(
                        rawValue: preference.visibility.rawValue
                    ) ?? .automatic
                )
            } catch {
                accountPresence = AccountSettingsPresence()
            }
        }
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
        isShowingAccountSettings = false
        accountSettingsGeneration = UUID()
        accountPresence = AccountSettingsPresence()
        blockedPeopleState = .hidden
        isLoadingBlockedPeople = false
        await stopConversation()
        if let draftStore {
            try? await draftStore.removeAllDrafts()
        }
        try? await notificationReplyStore.removeAll()
        if let callModel, callModel.state.hasLiveCall {
            if callModel.state.current.status == .ringing,
               callModel.state.current.direction == .incoming {
                await callModel.decline()
            } else {
                await callModel.end()
            }
        }
        callKit?.endAll()
        callModel?.shutdown()
        callModel = nil
        callMedia = nil
        pendingVoipCall = nil
        handledVoipCallIds.removeAll()
        directory?.stop()
        if let session {
            try? await ChatLive.unregisterPushDevice(session, installationId: pushInstallationId)
            try? await ChatLive.unregisterVoipPushDevice(session, installationId: pushInstallationId)
            await ChatLive.signOut(session)
        }
        session = nil
        directory = nil
        draftStore = nil
        currentUserId = ""
        try? await notificationCenter.setBadgeCount(0)
        notice = nil
        phase = .signedOut
    }

    func refreshDirectory() async {
        await directory?.refresh()
        await updateApplicationBadge()
    }

    @discardableResult
    func openConversation(
        _ id: String,
        messageId: String? = nil,
        notificationId: String? = nil
    ) async -> Bool {
        guard let session, let preview = directory?.conversations.first(where: {
            $0.conversationId == id
        }) else { return false }
        await stopConversation()
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
                gifProvider: gifProvider,
                drafts: draftStore
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
            await applyPendingShareIfReady()
            if let messageId {
                await store.focusMessage(messageId)
            }
            if let notificationId {
                notificationCenter.removeDeliveredNotifications(withIdentifiers: [notificationId])
            }
            return true
        } catch {
            await stopConversation()
            notice = "That conversation didn’t open yet. Try again."
            phase = .inbox
            return false
        }
    }

    func closeConversation() {
        Task { @MainActor [weak self] in
            guard let self else { return }
            await stopConversation()
            phase = .inbox
            await directory?.refresh()
        }
    }

    func handle(url: URL) {
        guard url.scheme == "fish" else { return }
        if url.host == "share" {
            pendingShare = FishShareStore.read()
            Task { await applyPendingShareIfReady() }
            return
        }
        guard url.host == "messages" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard let conversationId = parts.first else { return }
        pendingConversation = PendingConversationDestination(
            conversationId: conversationId,
            messageId: nil,
            notificationId: nil
        )
        Task { await openPendingConversationIfReady() }
    }

    private func attach(_ session: ChatLiveSession) async {
        self.session = session
        currentUserId = session.userId
        draftStore = FileChatDraftStore(accountId: session.userId)
        let callBackend = CallBackendConfiguration(
            supabaseUrl: session.backend.supabaseUrl,
            anonKey: session.backend.anonKey,
            accessToken: session.backend.accessToken
        )
        let callMedia = LiveKitCallMedia()
        let callModel = CallSessionModel(
            userId: session.userId,
            commands: EdgeFunctionCallCommands(configuration: callBackend),
            realtime: PollingCallRealtime(
                directory: RestCallDirectory(configuration: callBackend)
            ),
            media: callMedia
        )
        let callKit = callKit ?? CallKitCoordinator()
        callKit.bind(model: callModel, media: callMedia)
        callModel.onStateChange = { [weak callKit] state in
            callKit?.sync(state: state)
        }
        self.callMedia = callMedia
        self.callModel = callModel
        self.callKit = callKit
        await callModel.start()
        await registerPushDeviceIfPossible()
        await recoverPendingVoipCallIfReady()
        let directory = ConversationDirectoryStore(
            directory: session.directory,
            drafts: draftStore
        )
        self.directory = directory
        await directory.start()
        await updateApplicationBadge()
        await processPendingNotificationReplies()
        if pendingConversation != nil {
            if await openPendingConversationIfReady() {
                return
            }
        }
        switch directory.route {
        case .direct(let id): await openConversation(id)
        case .empty, .list: phase = .inbox
        }
    }

    private func stopConversation() async {
        uploads?.dismiss()
        if let conversationStore {
            await conversationStore.flushDraft()
            conversationStore.stop()
        }
        conversationStore = nil
        uploads = nil
    }

    private func updateApplicationBadge() async {
        let total = directory?.conversations.reduce(into: 0) { result, preview in
            result += max(0, preview.unreadCount)
        } ?? 0
        try? await notificationCenter.setBadgeCount(total)
    }

    private func applyPendingShareIfReady() async {
        guard let payload = pendingShare,
              let store = conversationStore,
              let uploads
        else { return }

        let sharedText = payload.text?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let sharedText, !sharedText.isEmpty {
            let existing = store.draft.trimmingCharacters(in: .whitespacesAndNewlines)
            store.draft = [existing, sharedText]
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
        }

        let candidates = payload.items.compactMap { item -> AttachmentCandidate? in
            guard let data = FishShareStore.data(for: item) else { return nil }
            return AttachmentCandidate(
                data: data,
                originalName: item.originalName,
                sourceMimeType: item.sourceMimeType
            )
        }
        let missingCount = payload.items.count - candidates.count
        let extraFailures = Array(
            repeating: AttachmentFailureReason.serverRejected("share_unavailable"),
            count: missingCount + payload.omittedCount
        )
        uploads.add(candidates, admissionFailures: extraFailures)
        pendingShare = nil
        FishShareStore.clear(payload)
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
            guard let destination = notification.object as? FishNotificationDestination else { return }
            Task { @MainActor [weak self] in
                self?.pendingConversation = PendingConversationDestination(
                    conversationId: destination.conversationId,
                    messageId: destination.messageId,
                    notificationId: destination.notificationId
                )
                await self?.openPendingConversationIfReady()
            }
        }
        voipPushTokenObserver = NotificationCenter.default.addObserver(
            forName: .fishVoipPushToken,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let token = notification.object as? String else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                pendingVoipPushToken = token
                await registerPushDeviceIfPossible()
            }
        }
        voipPushInvalidationObserver = NotificationCenter.default.addObserver(
            forName: .fishVoipPushTokenInvalidated,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                pendingVoipPushToken = nil
                if let session {
                    try? await ChatLive.unregisterVoipPushDevice(
                        session,
                        installationId: pushInstallationId
                    )
                }
            }
        }
        incomingVoipCallObserver = NotificationCenter.default.addObserver(
            forName: .fishIncomingVoipCall,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let destination = notification.object as? FishVoipPushDestination else { return }
            Task { @MainActor [weak self] in
                self?.handleIncomingVoipCall(destination)
            }
        }
        NotificationCenter.default.addObserver(
            forName: .fishQuickReply,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.processPendingNotificationReplies()
            }
        }
    }

    private func processPendingNotificationReplies() async {
        guard !isProcessingNotificationReplies,
              let session,
              let directory,
              directory.phase != .loading
        else { return }
        isProcessingNotificationReplies = true
        defer { isProcessingNotificationReplies = false }
        let replies = (try? await notificationReplyStore.pendingReplies()) ?? []
        for reply in replies {
            guard directory.conversations.contains(where: {
                $0.conversationId == reply.conversationId
            }) else {
                // The current account cannot access this conversation. Do not
                // retain a reply that could be sent after an account switch.
                try? await notificationReplyStore.remove(id: reply.id)
                continue
            }
            let request = SendChatMessageRequest(
                conversationId: reply.conversationId,
                body: reply.body,
                clientRequestId: reply.id
            )
            do {
                _ = try await session.messaging.send(request)
                try? await notificationReplyStore.remove(id: reply.id)
            } catch let failure as ChatCommandFailure {
                if failure.statusCode == 401 || failure.statusCode == 403 ||
                    ["conversation_not_available", "invalid_request"].contains(failure.code) {
                    try? await notificationReplyStore.remove(id: reply.id)
                }
            } catch {
                // Keep network failures durable for the next foreground pass.
            }
        }
    }

    private func registerPushDeviceIfPossible() async {
        guard let session else { return }
        if let token = pendingPushToken {
            try? await ChatLive.registerPushDevice(
                session,
                installationId: pushInstallationId,
                providerInstallationId: token,
                platform: "ios",
                appVersion: appVersion
            )
        }
        if let token = pendingVoipPushToken {
            try? await ChatLive.registerVoipPushDevice(
                session,
                installationId: pushInstallationId,
                providerInstallationId: token,
                appVersion: appVersion
            )
        }
    }

    private func handleIncomingVoipCall(_ destination: FishVoipPushDestination) {
        guard handledVoipCallIds.insert(destination.callId).inserted else { return }
        pendingVoipCall = destination
        callKit?.reportIncoming(
            callId: destination.callId,
            kind: CallKind(rawValue: destination.kind) ?? .audio,
            callerId: destination.callerId,
            callerName: destination.callerName
        )
        Task { @MainActor [weak self] in
            await self?.recoverPendingVoipCallIfReady()
        }
    }

    private func recoverPendingVoipCallIfReady() async {
        guard let destination = pendingVoipCall,
              let callModel,
              session != nil
        else { return }
        let recovered = await callModel.recover(callId: destination.callId)
        if !recovered {
            callKit?.end(callId: destination.callId, reason: .failed)
        }
        pendingVoipCall = nil
    }

    @discardableResult
    private func openPendingConversationIfReady() async -> Bool {
        guard let pendingConversation, let directory else { return false }
        guard directory.phase != .loading else { return false }
        guard directory.conversations.contains(where: {
            $0.conversationId == pendingConversation.conversationId
        }) else {
            self.pendingConversation = nil
            return false
        }
        self.pendingConversation = nil
        return await openConversation(
            pendingConversation.conversationId,
            messageId: pendingConversation.messageId,
            notificationId: pendingConversation.notificationId
        )
    }
}

struct FishAppConfiguration: Sendable {
    let supabaseUrl: URL?
    let anonKey: String?
    let klipyApiKey: String?
    let klipyClientKey: String
    let webBaseURL: URL?
    let isRelease: Bool

    static func fromBundle(
        _ bundle: Bundle = .main,
        isRelease: Bool = {
            #if DEBUG
            false
            #else
            true
            #endif
        }()
    ) -> FishAppConfiguration {
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
            klipyClientKey: value("KLIPY_CLIENT_KEY") ?? "fish_chat_ios",
            webBaseURL: value("WEB_BASE_URL").flatMap(URL.init(string:)),
            isRelease: isRelease
        )
    }

    func webURL(_ path: AccountSettingsWebPath) -> URL? {
        AccountSettingsWebLinkPolicy.url(
            baseURL: webBaseURL,
            path: path,
            isRelease: isRelease
        )
    }
}

private extension AccountNotificationAuthorization {
    init(authorizationStatus: UNAuthorizationStatus) {
        switch authorizationStatus {
        case .authorized: self = .authorized
        case .provisional: self = .provisional
        case .ephemeral: self = .ephemeral
        case .denied: self = .denied
        case .notDetermined: self = .notDetermined
        @unknown default: self = .notDetermined
        }
    }
}
