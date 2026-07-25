import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
import ChatCore
import ChatData
import DesignSystem
import Foundation
import Observation
import PersonalChat
import QuickLook
import SwiftUI
import UIKit
import UIComponents
import UserNotifications

struct ConversationView: View {
    @Bindable var model: FishAppModel
    @State private var path: [ConversationDestination] = []
    @State private var requestedFocus: PersonalChatFocusTarget?
    @State private var sharedContentShareFile: SharedContentMediaRuntime.VerifiedFile?
    @State private var sharedContentShareURL: URL?
    @State private var sharedContentDocumentFile: SharedContentMediaRuntime.VerifiedFile?
    @State private var sharedContentQuickLookFile: SharedContentMediaRuntime.VerifiedFile?
    @State private var sharedContentQuickLookURL: URL?
    @State private var sharedContentReturnIntent: SharedContentNavigationIntent?
    @State private var preservingSharedContentRouteForSource = false

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
            NavigationStack(path: $path) {
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
                    onCallBack: { kind in
                        guard let callModel = model.callModel,
                              let callMedia = model.callMedia,
                              let callKit = model.callKit else { return }
                        callKit.startOutgoing(
                            model: callModel,
                            media: callMedia,
                            recipientId: store.participantId,
                            recipientName: store.participantName,
                            kind: CallKind(rawValue: kind) ?? .audio
                        )
                    },
                    onCancelComposerContext: store.cancelComposerContext,
                    onComposerFocusChanged: store.composerFocusChanged,
                    onBack: model.closeConversation,
                    sharedContentContext: model.sharedContentNavigationContext,
                    onOpenConversationDetails: {
                        guard let context = model.sharedContentNavigationContext else { return }
                        path.append(.details(context))
                    },
                    onOpenSharedContent: openSharedContent,
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
                    ),
                    requestedFocus: $requestedFocus
                )
                .navigationDestination(for: ConversationDestination.self) {
                    destinationView($0, store: store)
                }
            }
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: path, handlePathChange)
        .safeAreaInset(edge: .top, spacing: 0) {
            if let intent = sharedContentReturnIntent, path.isEmpty {
                ActionButton(
                    "Back to shared content",
                    variant: .secondary,
                    fullWidth: true
                ) {
                    sharedContentReturnIntent = nil
                    openSharedContent(intent)
                }
                .accessibilityHint("Returns to the shared content gallery")
                .padding(.horizontal, Spacing.page)
                .padding(.vertical, Spacing.xs)
                .background(Palette.bg)
            }
        }
        .sheet(
            isPresented: Binding(
                get: { sharedContentShareFile != nil },
                set: { presented in
                    if !presented, let file = sharedContentShareFile {
                        sharedContentShareFile = nil
                        Task { await model.discardSharedContentFile(file) }
                    }
                }
            ),
            onDismiss: {
                if let file = sharedContentShareFile {
                    sharedContentShareFile = nil
                    Task { await model.discardSharedContentFile(file) }
                }
            }
        ) {
            if let file = sharedContentShareFile {
                AttachmentActivitySheet(item: file.url)
            }
        }
        .sheet(
            isPresented: Binding(
                get: { sharedContentShareURL != nil },
                set: { if !$0 { sharedContentShareURL = nil } }
            ),
            onDismiss: { sharedContentShareURL = nil }
        ) {
            if let url = sharedContentShareURL {
                AttachmentActivitySheet(item: url)
            }
        }
        .sheet(
            isPresented: Binding(
                get: { sharedContentDocumentFile != nil },
                set: { presented in
                    if !presented, let file = sharedContentDocumentFile {
                        sharedContentDocumentFile = nil
                        Task { await model.discardSharedContentFile(file) }
                    }
                }
            ),
            onDismiss: {
                if let file = sharedContentDocumentFile {
                    sharedContentDocumentFile = nil
                    Task { await model.discardSharedContentFile(file) }
                }
            }
        ) {
            if let file = sharedContentDocumentFile {
                SharedContentDocumentExporter(url: file.url)
            }
        }
        .quickLookPreview($sharedContentQuickLookURL)
        .onChange(of: sharedContentQuickLookURL) { previous, current in
            guard current == nil, let previous else { return }
            Task {
                if let file = sharedContentQuickLookFile, file.url == previous {
                    sharedContentQuickLookFile = nil
                    await model.discardSharedContentFile(file)
                }
            }
        }
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

    @ViewBuilder
    private func destinationView(
        _ destination: ConversationDestination,
        store: ConversationStore
    ) -> some View {
        switch destination {
        case .details(let context):
            if context == model.sharedContentNavigationContext {
                ConversationDetailsSheet(
                    participantName: store.participantName,
                    presence: store.model.presence,
                    onBack: popDestination,
                    onOpenSharedContent: {
                        openSharedContent(SharedContentNavigationIntent(
                            entry: .conversationDetails,
                            context: context
                        ))
                    },
                    requestedFocus: $requestedFocus
                )
            } else {
                LoadingView(message: "Opening conversation…")
            }
        case .sharedContent(let intent):
            if intent == model.activeSharedContentIntent,
               let galleryModel = model.sharedContentGalleryModel {
                if let item = model.sharedContentPreviewItem {
                    SharedContentPreviewScreen(
                        item: item,
                        senderName: model.sharedContentSenderName(for: item, store: store),
                        onBack: model.closeSharedContentPreview,
                        onOpenSource: { messageId in
                            model.closeSharedContentPreview()
                            preservingSharedContentRouteForSource = true
                            sharedContentReturnIntent = intent
                            path.removeAll()
                            Task { await store.focusMessage(messageId) }
                        },
                        onNativeAction: { action in
                            Task { @MainActor in
                                if item.kind == "link",
                                   let rawURL = item.linkUrl,
                                   let url = URL(string: rawURL),
                                   let scheme = url.scheme?.lowercased(),
                                   ["http", "https"].contains(scheme),
                                   url.host?.isEmpty == false {
                                    if action == .open {
                                        await UIApplication.shared.open(url)
                                    } else if action == .share {
                                        sharedContentShareURL = url
                                    }
                                    return
                                }
                                guard let file = await model.performSharedContentAction(action, item: item)
                                else { return }
                                if action == .open {
                                    sharedContentQuickLookFile = file
                                    sharedContentQuickLookURL = file.url
                                } else if action == .share {
                                    sharedContentShareFile = file
                                } else {
                                    sharedContentDocumentFile = file
                                }
                            }
                        },
                        onDelete: { messageId in
                            Task { await model.deleteSharedContentSource(messageId) }
                        },
                        loadThumbnail: { await galleryModel.thumbnailData(for: $0) }
                    )
                } else {
                    SharedContentGalleryScreen(
                        model: galleryModel,
                        onBack: popDestination
                    )
                }
            } else {
                LoadingView(message: "Opening shared content…")
            }
        }
    }

    private func openSharedContent(_ intent: SharedContentNavigationIntent) {
        guard path.last != .sharedContent(intent) else { return }
        Task { @MainActor in
            guard await model.prepareSharedContentRoute(intent),
                  model.activeSharedContentIntent == intent
            else { return }
            path.append(.sharedContent(intent))
        }
    }

    private func popDestination() {
        guard let destination = path.last else { return }
        if case .sharedContent = destination {
            if preservingSharedContentRouteForSource {
                preservingSharedContentRouteForSource = false
                path.removeLast()
                return
            }
            model.closeSharedContentRoute()
        }
        sharedContentReturnIntent = nil
        path.removeLast()
    }

    private func handlePathChange(
        _ oldPath: [ConversationDestination],
        _ newPath: [ConversationDestination]
    ) {
        guard let removed = oldPath.last, !newPath.contains(removed) else { return }
        switch removed {
        case .sharedContent(let intent):
            if preservingSharedContentRouteForSource {
                preservingSharedContentRouteForSource = false
                return
            }
            model.closeSharedContentRoute()
            requestedFocus = intent.focusTarget
        case .details:
            requestedFocus = .participantDetails
        }
    }
}
