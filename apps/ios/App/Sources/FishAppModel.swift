import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
import ChatCore
import ChatData
import DesignSystem
import Foundation
import Friends
import FriendsData
import Observation
import PersonalChat
import QuickLook
import SwiftUI
import UIKit
import UIComponents
import UserNotifications

@MainActor @Observable
final class FishAppModel {
    enum Phase { case loading, signedOut, inbox, opening, conversation }

    /// The add-friend sheet asked for a request to be reviewed. Held rather
    /// than acted on straight away: one screen presents one sheet at a time,
    /// so the requests sheet opens once the add sheet is actually gone.
    private struct PendingFriendRequestReview {
        /// `nil` opens the list unfiltered — exactly what the add sheet sends
        /// when it never learned an id.
        let requestId: String?
    }

    let configuration: FishAppConfiguration
    let gifProvider: KlipyGifProvider
    let imageLoader: MessageImageLoader
    let sharedContentIdentityCoordinator: SharedContentIdentityCoordinator
    private(set) var fileDownloader: AttachmentFileDownloader
    private let sharedContentCache: CoreDataSharedContentCache?
    private let sharedContentThumbnails: SharedContentThumbnailStore?
    private let sharedContentNetworkMonitor: SharedContentNetworkPolicyMonitor

    var phase: Phase = .loading
    var email = ""
    var password = ""
    var isShowingAccountSettings = false
    var isShowingAddFriend = false
    var isShowingFriendRequests = false
    private(set) var incomingRequestCount = 0
    /// Built fresh for each presentation, so a sheet never opens on the last
    /// person someone looked up.
    private(set) var addFriendModel: AddFriendModel?
    private(set) var friendRequestsModel: FriendRequestsModel?
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
    private(set) var sharedContentGalleryModel: SharedContentGalleryModel?
    private(set) var activeSharedContentIntent: SharedContentNavigationIntent?
    private(set) var sharedContentPreviewItemId: String?
    private var draftStore: (any ChatDraftProviding)?
    private var cacheStore: (any ChatDirectoryCaching)?
    private let notificationReplyStore = FileChatNotificationReplyStore.shared
    private var isProcessingNotificationReplies = false
    /// Set when `.fishQuickReply` fires again while a drain pass is already
    /// running; the in-flight pass loops once more instead of the trigger
    /// being silently dropped until the next unrelated invocation.
    private var notificationReplyDrainRequested = false
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
    private var friendDirectory: (any FriendDirectoryProviding)?
    private var friendCommands: (any FriendCommandsProviding)?
    private var friendEventsTask: Task<Void, Never>?
    private var friendsGeneration = UUID()
    private var friendRequestsPresentation: UUID?
    private var requestCountAttempt = 0
    private var pendingRequestReview: PendingFriendRequestReview?
    private var sharedContentStore: SharedContentStore?
    private var sharedContentMediaRuntime: SharedContentMediaRuntime?
    private var sharedContentCleanupTask: Task<Void, Never>?
    private var sharedContentCleanupGeneration = UUID()
    private var sharedContentRouteGeneration = UUID()
    private var sharedContentNetworkTask: Task<Void, Never>?
    private var sharedContentRealtimeTask: Task<Void, Never>?
    private var startTask: Task<Void, Never>?

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
        let imageLoader = MessageImageLoader(
            urlPolicy: SharedContentMediaURLPolicy(
                supabaseURL: configuration.supabaseUrl,
                allowsLocalDevelopment: configuration.allowsLocalDevelopmentMedia
            )
        )
        self.imageLoader = imageLoader
        let sharedContentCache = try? Self.makeSharedContentCache()
        let sharedContentThumbnails = try? SharedContentThumbnailStore()
        self.sharedContentCache = sharedContentCache
        self.sharedContentThumbnails = sharedContentThumbnails
        sharedContentNetworkMonitor = SharedContentNetworkPolicyMonitor()
        sharedContentIdentityCoordinator = SharedContentIdentityCoordinator(
            purgePort: DefaultSharedContentPurgePort(
                imageLoader: imageLoader,
                cache: sharedContentCache,
                thumbnailStore: sharedContentThumbnails,
                storageAvailable: sharedContentCache != nil && sharedContentThumbnails != nil
            )
        )
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

    /// One role signal for every client-only surface. The blocked-people row
    /// and friends read the same account, never two.
    private var isClientAccount: Bool {
        session?.account?.role == .client
    }

    var canManageBlockedPeople: Bool {
        isClientAccount
    }

    /// Friends belongs to clients, and only in a build that asked for it.
    /// Off, nothing here is constructed, subscribed to, or drawn.
    var friendsAvailable: Bool {
        configuration.friendsEnabled && isClientAccount
    }

    var sharedContentNavigationContext: SharedContentNavigationContext? {
        guard let session,
              let conversationStore,
              sharedContentCache != nil,
              sharedContentThumbnails != nil,
              sharedContentIdentityCoordinator.isGalleryEligible(for: session.userId)
        else { return nil }
        return SharedContentNavigationContext(
            ownerIdentityId: session.userId,
            conversationId: conversationStore.conversationId
        )
    }

    func prepareSharedContentRoute(_ intent: SharedContentNavigationIntent) async -> Bool {
        guard intent.context == sharedContentNavigationContext,
              let session,
              let cache = sharedContentCache,
              let thumbnails = sharedContentThumbnails
        else { return false }
        if activeSharedContentIntent == intent, sharedContentGalleryModel != nil {
            return true
        }

        await closeSharedContentRouteAndWait()
        let routeGeneration = UUID()
        sharedContentRouteGeneration = routeGeneration
        let ownerIdentityId = session.userId
        let conversationId = intent.context.conversationId
        let repository = SupabaseSharedContentRepository(
            configuration: session.backend,
            cache: cache,
            directory: session.directory,
            verifiedOwner: { [weak self] in
                await MainActor.run {
                    guard let self,
                          self.session?.userId == ownerIdentityId,
                          self.sharedContentIdentityCoordinator.isGalleryEligible(
                              for: ownerIdentityId
                          )
                    else { return nil }
                    return ownerIdentityId
                }
            }
        )
        let galleryModelHolder = SharedContentGalleryModelHolder()
        let store = SharedContentStore(
            provider: repository,
            thumbnailStore: thumbnails,
            submitDeliveryBatch: { [weak self, galleryModelHolder] batch in
                guard let galleryModel = galleryModelHolder.model else { return Task {} }
                return Task { @MainActor [weak self, weak galleryModel] in
                    guard let self,
                          let galleryModel,
                          !Task.isCancelled,
                          sharedContentRouteGeneration == routeGeneration
                    else { return }
                    for itemId in batch.ids {
                        guard !Task.isCancelled,
                              sharedContentRouteGeneration == routeGeneration,
                              let request = galleryModel.thumbnailRequest(itemId: itemId)
                        else { return }
                        _ = await galleryModel.thumbnailData(
                            for: .init(
                                itemId: request.itemId,
                                contentVersion: request.contentVersion
                            ),
                            intent: batch.intent
                        )
                        guard !Task.isCancelled,
                              sharedContentRouteGeneration == routeGeneration
                        else { return }
                    }
                }
            }
        )
        sharedContentIdentityCoordinator.attachStore(store)
        await store.bind(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId
        )
        store.connectivityChanged(await sharedContentNetworkMonitor.current())

        guard sharedContentRouteGeneration == routeGeneration,
              intent.context == sharedContentNavigationContext
        else {
            let cancelledTasks = store.close()
            for task in cancelledTasks {
                await task.value
            }
            if sharedContentRouteGeneration == routeGeneration {
                sharedContentIdentityCoordinator.attachStore(nil)
            }
            return false
        }

        let deliveryStore = SharedContentDeliveryStore(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: store.identityGeneration,
            commands: session.attachmentCommands
        )
        let mediaRuntime = SharedContentMediaRuntime(
            messaging: session.messaging,
            deliveryStore: deliveryStore,
            thumbnailStore: thumbnails,
            urlPolicy: SharedContentMediaURLPolicy(
                supabaseURL: session.backend.supabaseUrl,
                allowsLocalDevelopment: configuration.allowsLocalDevelopmentMedia
            )
        )
        let model = SharedContentGalleryModel(
            store: store,
            onSelectItem: { [weak self] itemId in
                self?.sharedContentPreviewItemId = itemId
            },
            thumbnailLoader: { request, intent in
                await mediaRuntime.load(request, intent: intent)
            }
        )
        galleryModelHolder.model = model
        sharedContentStore = store
        sharedContentMediaRuntime = mediaRuntime
        sharedContentGalleryModel = model
        activeSharedContentIntent = intent
        sharedContentNetworkTask = Task { @MainActor [weak self, weak store] in
            guard let self, let store else { return }
            for await policy in sharedContentNetworkMonitor.updates {
                guard !Task.isCancelled,
                      sharedContentRouteGeneration == routeGeneration,
                      sharedContentStore === store
                else { return }
                store.connectivityChanged(policy)
            }
        }
        sharedContentRealtimeTask = Task { @MainActor [weak self, weak store] in
            guard let self, let store else { return }
            for await changedConversationId in session.directory.attentionEvents(
                conversationIds: [conversationId]
            ) {
                guard !Task.isCancelled,
                      sharedContentRouteGeneration == routeGeneration,
                      sharedContentStore === store
                else { return }
                if changedConversationId == conversationId {
                    store.realtime()
                }
            }
        }
        return true
    }

    func closeSharedContentRoute() {
        guard sharedContentStore != nil ||
                sharedContentGalleryModel != nil ||
                sharedContentMediaRuntime != nil
        else { return }
        sharedContentRouteGeneration = UUID()
        sharedContentNetworkTask?.cancel()
        sharedContentRealtimeTask?.cancel()
        sharedContentNetworkTask = nil
        sharedContentRealtimeTask = nil
        let generation = sharedContentStore?.identityGeneration
        let cancelledTasks: [Task<Void, Never>]
        if let sharedContentGalleryModel {
            cancelledTasks = sharedContentGalleryModel.close()
        } else {
            cancelledTasks = sharedContentStore?.close() ?? []
        }
        let mediaRuntime = sharedContentMediaRuntime
        let cleanupGeneration = UUID()
        sharedContentCleanupGeneration = cleanupGeneration
        sharedContentCleanupTask = Task {
            if let generation {
                await mediaRuntime?.close(generation: generation)
            }
            for task in cancelledTasks {
                await task.value
            }
        }
        sharedContentIdentityCoordinator.attachStore(nil)
        sharedContentStore = nil
        sharedContentMediaRuntime = nil
        sharedContentGalleryModel = nil
        sharedContentPreviewItemId = nil
        activeSharedContentIntent = nil
    }

    func closeSharedContentPreview() {
        sharedContentPreviewItemId = nil
    }

    var sharedContentPreviewItem: SharedContentAcceptedItem? {
        guard let id = sharedContentPreviewItemId else { return nil }
        return sharedContentGalleryModel?.acceptedItems.first { $0.itemId == id }
    }

    func sharedContentSenderName(
        for item: SharedContentAcceptedItem,
        store: ConversationStore
    ) -> String {
        if item.senderId == currentUserId { return accountDisplayName }
        if item.senderId == store.participantId { return store.participantName }
        return item.senderId.isEmpty ? "Sender unavailable" : item.senderId
    }

    func performSharedContentAction(
        _ action: SharedContentNativeAction,
        item: SharedContentAcceptedItem
    ) async -> SharedContentMediaRuntime.VerifiedFile? {
        guard let runtime = sharedContentMediaRuntime else { return nil }
        if action == .share || action == .save || action == .download,
           (!item.canExport || item.kind == "gif" || item.kind == "sticker") {
            return nil
        }
        let name = item.originalName ?? item.mediaTitle ?? "shared-content"
        guard let byteSize = item.byteSize,
              let mimeType = item.mimeType,
              byteSize > 0,
              let context = sharedContentNavigationContext
        else { return nil }
        return await runtime.loadFullContent(.init(
            ownerIdentityId: context.ownerIdentityId,
            conversationId: context.conversationId,
            identityGeneration: sharedContentGalleryModel?.routeGeneration ?? 0,
            itemId: item.itemId,
            contentVersion: item.contentVersion,
            kind: item.kind,
            attachmentId: item.attachmentId,
            name: name,
            mimeType: mimeType,
            expectedByteSize: byteSize
        ))
    }

    func discardSharedContentFile(_ file: SharedContentMediaRuntime.VerifiedFile) async {
        await sharedContentMediaRuntime?.discard(file)
    }

    func deleteSharedContentSource(_ messageId: String) async -> Bool {
        guard let conversationStore else { return false }
        let accepted = await conversationStore.deleteSharedContentSource(messageId)
        if accepted { sharedContentStore?.realtime() }
        return accepted
    }

    private func closeSharedContentRouteAndWait() async {
        closeSharedContentRoute()
        let cleanupGeneration = sharedContentCleanupGeneration
        guard let cleanupTask = sharedContentCleanupTask else { return }
        await cleanupTask.value
        if sharedContentCleanupGeneration == cleanupGeneration {
            sharedContentCleanupTask = nil
        }
    }

    func sharedContentScenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .active:
            sharedContentStore?.foreground()
        case .background:
            sharedContentStore?.didEnterBackground()
        case .inactive:
            break
        @unknown default:
            break
        }
    }

    func showAccountSettings() {
        guard phase == .inbox else { return }
        notice = nil
        isShowingAccountSettings = true
        loadAccountPresence()
    }

    /// Guarded on being signed in rather than on the inbox phase: on iPad the
    /// list stays on screen beside an open conversation, and the action in it
    /// has to work from there too.
    func showAddFriend() {
        guard let friendDirectory, let friendCommands, isSignedInForFriends else { return }
        notice = nil
        pendingRequestReview = nil
        addFriendModel = AddFriendModel(
            directory: friendDirectory,
            commands: friendCommands,
            onReviewRequested: { [weak self] requestId in
                self?.reviewFriendRequest(requestId)
            }
        )
        isShowingAddFriend = true
    }

    func showFriendRequests() {
        openFriendRequests(selecting: nil)
    }

    /// The add sheet found that the person had already asked. Closing one
    /// sheet and opening the next is two steps because SwiftUI presents one
    /// at a time; the request travels in `pendingRequestReview` and is picked
    /// up the moment the add sheet is gone.
    private func reviewFriendRequest(_ requestId: String?) {
        pendingRequestReview = PendingFriendRequestReview(requestId: requestId)
        isShowingAddFriend = false
    }

    func addFriendDismissed() {
        addFriendModel = nil
        guard let pending = pendingRequestReview else { return }
        pendingRequestReview = nil
        openFriendRequests(selecting: pending.requestId)
    }

    func friendRequestsDismissed() {
        friendRequestsModel = nil
        refreshIncomingRequestCount()
    }

    /// `requestId` travels exactly as it arrived: `nil` opens the list rather
    /// than one person's review.
    private func openFriendRequests(selecting requestId: String?) {
        guard let friendDirectory, let friendCommands, isSignedInForFriends else { return }
        notice = nil
        // A dismissed sheet's model outlives the sheet for as long as its own
        // answer is in flight, and finishing the last request closes whatever
        // is open. Tying "leave" to the presentation that asked for it means a
        // late answer cannot close a sheet somebody has since reopened.
        let presentation = UUID()
        friendRequestsPresentation = presentation
        let requests = FriendRequestsModel(
            directory: friendDirectory,
            commands: friendCommands,
            onAllRequestsHandled: { [weak self] in
                guard let self, friendRequestsPresentation == presentation else { return }
                isShowingFriendRequests = false
            }
        )
        friendRequestsModel = requests
        requests.load(selecting: requestId)
        isShowingFriendRequests = true
    }

    private var isSignedInForFriends: Bool {
        friendsAvailable && session != nil && directory != nil
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

    /// `start()` is called from both FishRoot's task and the background
    /// drain; the phase guard alone doesn't close the window while
    /// `attach()` is in flight, so a second concurrent call would run it
    /// twice. Coalescing onto one in-flight task keeps the concurrent
    /// callers from being the ones to notice.
    func start() async {
        if let startTask {
            await startTask.value
            return
        }
        let task = Task { @MainActor [weak self] in
            _ = await self?.performStart()
        }
        startTask = task
        await task.value
    }

    private func performStart() async {
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
                await sharedContentIdentityCoordinator.start(verifiedOwnerIdentityId: nil)
                phase = .signedOut
            }
        } catch {
            await sharedContentIdentityCoordinator.start(verifiedOwnerIdentityId: nil)
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
        await closeSharedContentRouteAndWait()
        await sharedContentIdentityCoordinator.transition(to: nil)
        isShowingAccountSettings = false
        accountSettingsGeneration = UUID()
        accountPresence = AccountSettingsPresence()
        blockedPeopleState = .hidden
        isLoadingBlockedPeople = false
        stopFriends()
        await stopConversation()
        if let draftStore {
            // Delete the account's staged outbox bytes before the records
            // that reference them disappear with the drafts payload.
            if let staging = try? AttachmentStaging() {
                let stagingRoot = await staging.root
                let pending = (try? await draftStore.pendingAttachments()) ?? []
                for record in pending {
                    await staging.remove(record.stagedFileUrl(in: stagingRoot))
                }
            }
            try? await draftStore.removeAllDrafts()
        }
        try? await cacheStore?.removeAll()
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
        cacheStore = nil
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
                participantRole: preview.participantRole == "client" ? .client : .coach,
                currentUserRole: preview.participantRole == "client" ? .coach : .client,
                messaging: session.messaging,
                commands: session.commands,
                realtime: session.realtime,
                gifProvider: gifProvider,
                drafts: draftStore,
                cache: cacheStore,
                friendCommands: friendsAvailable ? friendCommands : nil,
                onBlocked: { [weak self] in self?.closeConversation() }
            )
            let staging = try AttachmentStaging()
            let uploads = AttachmentUploadsModel(
                conversationId: preview.conversationId,
                commands: session.attachmentCommands,
                uploader: SignedUrlByteUploader(configuration: session.backend),
                staging: staging,
                outbox: draftStore
            )
            store.attachmentResolver = uploads
            uploads.onQueuedItemReady = { [weak store] in
                Task { await store?.flushQueuedSends() }
            }
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
        await closeSharedContentRouteAndWait()
        await sharedContentIdentityCoordinator.transition(to: session.userId)
        self.session = session
        currentUserId = session.userId
        draftStore = FileChatDraftStore(accountId: session.userId)
        cacheStore = FileChatCacheStore(accountId: session.userId)
        let callBackend = CallBackendConfiguration(
            supabaseUrl: session.backend.supabaseUrl,
            anonKey: session.backend.anonKey,
            accessToken: session.backend.accessToken
        )
        // Ahead of the conversation directory below: the first join's
        // `.streamResumed` can land before `directory` exists, and refreshing
        // nothing is harmless because `directory.start()` is the fetch it
        // would have asked for.
        startFriends(session)
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
        callModel.onStateChange = { [weak self, weak callKit] state in
            callKit?.sync(state: state)
            guard let self,
                  let counterpartId = state.counterpartId,
                  self.conversationStore?.participantId == counterpartId,
                  [.ended, .rejected, .cancelled, .missed, .failed].contains(state.status)
            else { return }
            Task { @MainActor [weak self] in
                await self?.conversationStore?.refreshCallActivity()
            }
        }
        self.callMedia = callMedia
        self.callModel = callModel
        self.callKit = callKit
        await callModel.start()
        await registerPushDeviceIfPossible()
        await recoverPendingVoipCallIfReady()
        let directory = ConversationDirectoryStore(
            directory: session.directory,
            drafts: draftStore,
            cache: cacheStore
        )
        self.directory = directory
        await directory.start()
        await flushPendingTextOutbox()
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

    /// Nothing exists for a coach or a build with friends off: no adapters,
    /// no subscription, no count.
    private func startFriends(_ session: ChatLiveSession) {
        friendsGeneration = UUID()
        guard friendsAvailable else { return }
        let backend = FriendsBackendConfiguration(
            supabaseUrl: session.backend.supabaseUrl,
            anonKey: session.backend.anonKey,
            accessToken: session.backend.accessToken
        )
        friendDirectory = RestFriendDirectory(configuration: backend)
        friendCommands = EdgeFunctionFriendCommands(configuration: backend)
        startFriendEvents(
            userId: session.userId,
            events: FriendsLive(configuration: backend)
        )
        refreshIncomingRequestCount()
    }

    /// This subscription is the only thing that tells a sender their new
    /// conversation exists. Every event refetches the count; which ones also
    /// mean a conversation may have appeared is the event's own answer to
    /// give — see `FriendEventReason.refreshesDirectory`.
    private func startFriendEvents(
        userId: String,
        events: some FriendEventsProviding
    ) {
        let generation = friendsGeneration
        friendEventsTask?.cancel()
        friendEventsTask = Task { @MainActor [weak self] in
            for await event in events.events(userId: userId) {
                guard let self, friendsGeneration == generation else { return }
                refreshIncomingRequestCount()
                if event.reason.refreshesDirectory {
                    await refreshDirectory()
                }
            }
        }
    }

    /// The count is the difference between a row and no row, so a late answer
    /// never overwrites a newer one. A refusal leaves the last known count
    /// alone: friends being unreachable is not news worth a screen change.
    private func refreshIncomingRequestCount() {
        guard friendsAvailable, let friendDirectory else { return }
        let generation = friendsGeneration
        requestCountAttempt += 1
        let attempt = requestCountAttempt
        Task { @MainActor [weak self] in
            guard let count = try? await friendDirectory.countIncomingRequests() else { return }
            guard let self,
                  friendsGeneration == generation,
                  requestCountAttempt == attempt
            else { return }
            incomingRequestCount = count
        }
    }

    private func stopFriends() {
        friendsGeneration = UUID()
        friendEventsTask?.cancel()
        friendEventsTask = nil
        isShowingAddFriend = false
        isShowingFriendRequests = false
        addFriendModel = nil
        friendRequestsModel = nil
        friendRequestsPresentation = nil
        pendingRequestReview = nil
        friendDirectory = nil
        friendCommands = nil
        incomingRequestCount = 0
    }

    private func stopConversation() async {
        await closeSharedContentRouteAndWait()
        uploads?.dismiss()
        if let conversationStore {
            await conversationStore.flushDraft()
            conversationStore.stop()
        }
        conversationStore = nil
        uploads = nil
    }

    private static func makeSharedContentCache() throws -> CoreDataSharedContentCache {
        let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!.appending(path: "FishSharedContent", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: applicationSupport,
            withIntermediateDirectories: true
        )
        return try CoreDataSharedContentCache(
            configuration: SharedContentCacheConfiguration(
                storeURL: applicationSupport.appendingPathComponent("SharedContentCache.sqlite")
            )
        )
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
                await self?.drainNotificationRepliesWithBackgroundTime()
            }
        }
    }

    /// Sends a quick reply right away, even when the notification action
    /// launched the app straight into the background — `start()` is otherwise
    /// only driven by FishRoot's `.task`, which a background launch never
    /// reaches. The assertion keeps the process alive for the attempt; a
    /// reply that cannot finish in time stays durably queued exactly as
    /// before.
    func drainNotificationRepliesWithBackgroundTime() async {
        var taskId = UIBackgroundTaskIdentifier.invalid
        var ended = false
        func endAssertion() {
            guard !ended, taskId != .invalid else { return }
            ended = true
            application.endBackgroundTask(taskId)
        }
        taskId = application.beginBackgroundTask(withName: "fish.quick-reply-drain") {
            endAssertion()
        }
        defer { endAssertion() }
        if phase == .loading {
            await start()
        }
        // Up to ~15 s in 250 ms steps; well inside the ~30 s the system grants.
        _ = await DrainReadiness.waitUntilReady(
            isReady: {
                self.phase == .signedOut ||
                    (self.session != nil && self.directory != nil && self.directory?.phase != .loading)
            },
            attempts: 60,
            sleep: { try? await Task.sleep(nanoseconds: 250_000_000) }
        )
        await processPendingNotificationReplies()
    }

    private func processPendingNotificationReplies() async {
        if isProcessingNotificationReplies {
            // A pass is already running; ask it to loop again once it
            // finishes instead of dropping this trigger on the floor.
            notificationReplyDrainRequested = true
            return
        }
        guard let session,
              let directory,
              directory.phase == .ready
        else { return }
        isProcessingNotificationReplies = true
        defer { isProcessingNotificationReplies = false }
        // Frozen for the whole call: the sign-out guard below must keep
        // comparing against the account that started this drain, even
        // across repeat passes triggered by a follow-up `.fishQuickReply`.
        let ownerId = session.userId
        repeat {
            notificationReplyDrainRequested = false
            // Only a ready directory can answer authorization. A failed read
            // must keep replies queued — never silent loss — and sign-out
            // clears the store, so nothing leaks across accounts.
            guard let currentDirectory = self.directory, currentDirectory.phase == .ready else { return }
            let conversationIds = Set(currentDirectory.conversations.map(\.conversationId))
            let drainer = NotificationReplyDrainer(
                pendingReplies: { [notificationReplyStore] in
                    (try? await notificationReplyStore.pendingReplies()) ?? []
                },
                remove: { [notificationReplyStore] id in
                    try? await notificationReplyStore.remove(id: id)
                },
                isAuthorized: { conversationIds.contains($0) },
                send: { reply in
                    do {
                        _ = try await session.messaging.send(
                            SendChatMessageRequest(
                                conversationId: reply.conversationId,
                                body: reply.body,
                                clientRequestId: reply.id
                            )
                        )
                        return .sent
                    } catch let failure as ChatCommandFailure {
                        return NotificationReplyDrainer.outcome(for: failure)
                    } catch {
                        return .retryLater
                    }
                },
                markRead: { conversationId, messageId in
                    _ = try? await session.commands.markReadState(
                        conversationId: conversationId,
                        lastDeliveredMessageId: messageId,
                        lastReadMessageId: messageId
                    )
                },
                saveDraft: { [weak self] conversationId, body in
                    guard let self else { return false }
                    // A live composer for this conversation must receive the
                    // append directly — writing through the file-layer draft
                    // store instead would get silently clobbered when that
                    // conversation's `persistDraft()` debounce (250 ms) flushes
                    // its own, now-stale, in-memory text minutes later.
                    if let store = conversationStore, store.conversationId == conversationId {
                        store.appendDraft(body)
                        return true
                    }
                    guard let draftStore else { return false }
                    do {
                        let existing = try? await draftStore.draft(for: conversationId)
                        let joined = NotificationReplyDrainer.joinedDraft(existing: existing?.body, reply: body)
                        try await draftStore.saveDraft(joined, conversationId: conversationId)
                        return true
                    } catch {
                        return false
                    }
                },
                postFailureNotice: { [weak self, application, notificationCenter] reply in
                    // The delegate suppresses foreground banners for realtime
                    // parity (`willPresent` returns no options), so a system
                    // notification would silently vanish while the app is
                    // active. Surface the same calm message through the app's
                    // own notice surface instead.
                    if application.applicationState == .active {
                        self?.notice = "Your reply didn’t send. It’s kept as a draft in the conversation."
                    } else {
                        await Self.postReplyFailureNotice(for: reply, center: notificationCenter)
                    }
                },
                isStillCurrentAccount: { [weak self] in self?.session?.userId == ownerId }
            )
            let sentAny = await drainer.run()
            if sentAny {
                await refreshDirectory()
            }
        } while notificationReplyDrainRequested
        await flushPendingTextOutbox()
    }

    private func flushPendingTextOutbox() async {
        guard let session, let draftStore else { return }
        _ = await ChatTextOutboxFlusher(
            drafts: draftStore,
            messaging: session.messaging
        ).flush()
    }

    private static func postReplyFailureNotice(
        for reply: ChatNotificationReply,
        center: UNUserNotificationCenter
    ) async {
        let content = UNMutableNotificationContent()
        content.title = "Your reply didn’t send"
        content.body = "Tap to open the conversation and try again."
        content.threadIdentifier = reply.conversationId
        var userInfo: [String: Any] = ["conversationId": reply.conversationId]
        if let messageId = reply.messageId {
            userInfo["messageId"] = messageId
        }
        content.userInfo = userInfo
        let request = UNNotificationRequest(
            // Keyed by conversation, not reply id: repeat failures for the
            // same conversation replace the existing notice instead of
            // stacking a fresh banner per failed attempt.
            identifier: "fish.reply-failure.\(reply.conversationId)",
            content: content,
            trigger: nil
        )
        try? await center.add(request)
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
