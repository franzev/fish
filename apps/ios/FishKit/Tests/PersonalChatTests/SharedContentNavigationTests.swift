import Foundation
@testable import PersonalChat
import SwiftUI
import Testing
import UIKit

@Suite(.serialized)
@MainActor
struct SharedContentNavigationTests {
    @Test func headerOriginReturnsToConversationAndRestoresHeaderFocus() {
        let store = NavigationStoreSpy()
        let host = SharedContentNavigationContract(store: store)

        host.openSharedContent(from: .header)
        host.routeBodyEvaluated()
        host.routeBodyEvaluated()

        #expect(host.path == [.conversation, .sharedContent(.header)])
        #expect(store.openCount == 1)

        host.back(using: .systemGesture)

        #expect(host.path == [.conversation])
        #expect(host.focusedTarget == .headerSharedContent)
        #expect(store.closeCount == 1)
    }

    @Test func detailsOriginReturnsThroughDetailsBeforeConversation() {
        let store = NavigationStoreSpy()
        let host = SharedContentNavigationContract(store: store)

        host.openConversationDetails()
        host.openSharedContent(from: .details)
        #expect(host.path == [
            .conversation,
            .details,
            .sharedContent(.details),
        ])

        host.back(using: .navigationControl)
        #expect(host.path == [.conversation, .details])
        #expect(host.focusedTarget == .detailsSharedContent)

        host.back(using: .systemGesture)
        #expect(host.path == [.conversation])
        #expect(host.focusedTarget == .participantDetails)
        #expect(store.closeCount == 1)
    }

    @Test func systemGestureAndNavigationControlUseTheSameOriginBearingPop() {
        for backSource in NavigationBackSource.allCases {
            let store = NavigationStoreSpy()
            let host = SharedContentNavigationContract(store: store)
            host.openConversationDetails()
            host.openSharedContent(from: .details)

            host.back(using: backSource)

            #expect(host.path == [.conversation, .details])
            #expect(host.focusedTarget == .detailsSharedContent)
            #expect(store.closeCount == 1)
        }
    }

    @Test func participantDetailsAndSharedContentRemainDistinctAccessibleTargets() {
        let host = SharedContentNavigationContract(store: NavigationStoreSpy())

        #expect(host.headerSharedContentControl == .init(
            accessibleName: "Shared content",
            minimumTarget: 44,
            action: .openSharedContent
        ))
        #expect(host.participantDetailsControl == .init(
            accessibleName: "Conversation details",
            minimumTarget: 44,
            action: .openConversationDetails
        ))
        #expect(host.detailsSharedContentControl == .init(
            accessibleName: "Shared content",
            minimumTarget: 44,
            action: .openSharedContent
        ))
        #expect(host.headerSharedContentControl.action != host.participantDetailsControl.action)
    }

    @Test func routeEntryOpensExactlyOnceAndReopenCreatesANewSession() {
        let store = NavigationStoreSpy()
        let host = SharedContentNavigationContract(store: store)

        host.openSharedContent(from: .header)
        host.routeBodyEvaluated()
        host.routeBodyEvaluated()
        #expect(store.openCount == 1)

        host.back(using: .navigationControl)
        host.openSharedContent(from: .header)
        host.routeBodyEvaluated()

        #expect(store.openCount == 2)
        #expect(store.openEntryIds == [1, 2])
        #expect(store.closeCount == 1)
    }

    @Test func categoryScrollAndFocusAreSessionOnlyUntilGalleryPop() {
        let store = NavigationStoreSpy()
        let host = SharedContentNavigationContract(store: store)
        host.openSharedContent(from: .header)
        host.session.selectedCategory = "Links"
        host.session.anchors["Links"] = .init(itemId: "link-a", focusId: "link-focus")

        host.openChildDestination()
        host.back(using: .navigationControl)
        #expect(host.session.selectedCategory == "Links")
        #expect(host.session.anchors["Links"] == .init(itemId: "link-a", focusId: "link-focus"))

        host.back(using: .navigationControl)
        #expect(host.session.selectedCategory == nil)
        #expect(host.session.anchors.isEmpty)

        host.openSharedContent(from: .header)
        #expect(host.session.selectedCategory == nil)
        #expect(host.session.anchors.isEmpty)
    }

    @Test func screenRestoresRepeatedCategoryOffsetsAndFocusAfterAnchorRemoval() throws {
        let media = SharedContentGalleryAnchor(
            itemId: "media-8",
            scrollOffset: 31,
            focusedItemId: "media-8"
        )
        let files = SharedContentGalleryAnchor(
            itemId: "file-11",
            scrollOffset: 19,
            focusedItemId: "file-11"
        )

        for _ in 0..<3 {
            let mediaRestoration = try #require(sharedContentScrollRestoration(
                anchor: media,
                orderedItemIDs: ["media-7", "media-8", "media-9"]
            ))
            #expect(mediaRestoration.itemId == "media-8")
            #expect(mediaRestoration.pointOffset == 31)
            #expect(mediaRestoration.focusedItemId == "media-8")
            #expect(sharedContentRestoredContentOffset(
                alignedItemOffset: 200,
                recordedPointOffset: mediaRestoration.pointOffset,
                minimumOffset: 0,
                maximumOffset: 500
            ) == 231)

            let filesRestoration = try #require(sharedContentScrollRestoration(
                anchor: files,
                orderedItemIDs: ["file-10", "file-11", "file-12"]
            ))
            #expect(filesRestoration.itemId == "file-11")
            #expect(filesRestoration.pointOffset == 19)
            #expect(filesRestoration.focusedItemId == "file-11")
        }

        let reconciledFallback = SharedContentGalleryAnchor(
            itemId: "media-9",
            scrollOffset: 31,
            focusedItemId: "media-9"
        )
        let fallback = try #require(sharedContentScrollRestoration(
            anchor: reconciledFallback,
            orderedItemIDs: ["media-7", "media-9"]
        ))
        #expect(fallback.itemId == "media-9")
        #expect(fallback.pointOffset == 31)
        #expect(fallback.focusedItemId == "media-9")
    }

    @Test func screenAppliesMediaFallbackFocusAfterExactOffsetRestoration() throws {
        let fallbackAnchor = SharedContentGalleryAnchor(
            itemId: "media-9",
            scrollOffset: 31,
            focusedItemId: "media-9"
        )
        let restoration = try #require(sharedContentScrollRestoration(
            anchor: fallbackAnchor,
            orderedItemIDs: ["media-7", "media-9", "media-10"]
        ))
        let scrollView = UIScrollView(
            frame: CGRect(x: 0, y: 0, width: 390, height: 400)
        )
        scrollView.contentSize = CGSize(width: 390, height: 1_000)
        scrollView.contentOffset = CGPoint(x: 0, y: 200)
        var focusedItemID: String?

        let restoredOffset = applySharedContentRestoration(
            restoration,
            to: scrollView
        ) { itemID in
            #expect(scrollView.contentOffset.y == 231)
            focusedItemID = itemID
        }

        #expect(restoration.itemId == "media-9")
        #expect(restoration.pointOffset == 31)
        #expect(restoredOffset == 231)
        #expect(focusedItemID == "media-9")
    }

    @Test func dragRecordsLiveViewportWithoutRequestingRestorationThenCategoryAndBackApplyOnce() throws {
        var coordinator = SharedContentScrollRestorationCoordinator()
        var savedAnchor = SharedContentGalleryAnchor(
            itemId: "media-8",
            scrollOffset: 12,
            focusedItemId: "media-8"
        )
        let mediaIDs = ["media-7", "media-8", "media-9"]

        let initial = coordinator.request(
            reason: .categoryEntry,
            category: .media,
            anchor: savedAnchor,
            orderedItemIDs: mediaIDs
        )
        let beganInitialRestoration = coordinator.beginApplying(initial)
        #expect(beganInitialRestoration)
        #expect(!coordinator.shouldRecordViewport)
        coordinator.finishApplying(initial)
        #expect(coordinator.appliedRequestCount == 1)

        for offset in [18.0, 27.0, 43.0] {
            let frames = [
                "media-7": CGRect(x: 0, y: -100 - offset, width: 100, height: 80),
                "media-8": CGRect(x: 0, y: -offset, width: 100, height: 80),
                "media-9": CGRect(x: 0, y: 80 - offset, width: 100, height: 80),
            ]
            let report = sharedContentViewportReport(
                orderedItemIDs: mediaIDs,
                frames: frames,
                viewportHeight: 120
            )
            #expect(coordinator.shouldRecordViewport)
            savedAnchor = SharedContentGalleryAnchor(
                itemId: try #require(report.visibleItemIDs.first),
                scrollOffset: offset,
                focusedItemId: "media-8"
            )
        }
        #expect(savedAnchor.scrollOffset == 43)
        #expect(coordinator.pendingRequest == nil)
        #expect(coordinator.appliedRequestCount == 1)

        let category = coordinator.request(
            reason: .categoryEntry,
            category: .files,
            anchor: .init(
                itemId: "file-11",
                scrollOffset: 19,
                focusedItemId: "file-11"
            ),
            orderedItemIDs: ["file-10", "file-11", "file-12"]
        )
        let categoryResult = try applyExactlyOnce(
            category,
            coordinator: &coordinator,
            alignedOffset: 200,
            maximumOffset: 500
        )
        #expect(categoryResult?.offset == 219)
        #expect(categoryResult?.focus == "file-11")
        let duplicateCategoryApplication = try applyExactlyOnce(
            category,
            coordinator: &coordinator,
            alignedOffset: 200,
            maximumOffset: 500
        )
        #expect(duplicateCategoryApplication == nil)

        let routeReturn = coordinator.request(
            reason: .routeReturn,
            category: .media,
            anchor: savedAnchor,
            orderedItemIDs: mediaIDs
        )
        let returnResult = try applyExactlyOnce(
            routeReturn,
            coordinator: &coordinator,
            alignedOffset: 300,
            maximumOffset: 500
        )
        #expect(returnResult?.offset == 343)
        #expect(returnResult?.focus == "media-8")
        let duplicateReturnApplication = try applyExactlyOnce(
            routeReturn,
            coordinator: &coordinator,
            alignedOffset: 300,
            maximumOffset: 500
        )
        #expect(duplicateReturnApplication == nil)
        #expect(coordinator.appliedRequestCount == 3)
    }

    @Test func ownerSwitchRevokesGalleryBeforeAStaleRouteCanAcceptState() {
        let store = NavigationStoreSpy()
        let host = SharedContentNavigationContract(store: store)
        host.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        host.openSharedContent(from: .header)
        let oldGeneration = store.identityGeneration

        host.bind(ownerIdentityId: "owner-b", conversationId: "conversation-b")

        #expect(store.revokeCount == 1)
        #expect(store.closeCount == 1)
        #expect(host.path == [.conversation])
        #expect(host.session.selectedCategory == nil)
        #expect(!store.accepts(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            generation: oldGeneration
        ))
    }

    @Test func navigationContractContainsNoOutOfScopeDestination() {
        let allowed = Set(SharedContentDestination.allCases.map(\.rawValue))
        #expect(allowed == ["conversation", "details", "shared-content", "child-preview-placeholder"])

        let forbidden = [
            "search",
            "filter",
            "menu",
            "dashboard",
            "global-gallery",
            "export",
            "delete",
        ]
        #expect(forbidden.allSatisfy { !allowed.contains($0) })
    }

    @Test func productionNavigationContractHasExactlyTwoExplicitEntries() {
        #expect(SharedContentEntry.allCases == [
            .conversationHeader,
            .conversationDetails,
        ])
        #expect(SharedContentEntry.allCases.allSatisfy {
            $0.accessibilityLabel == "Shared content"
                && $0.minimumTarget >= 44
        })

        let context = SharedContentNavigationContext(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a"
        )
        let headerIntent = SharedContentNavigationIntent(
            entry: .conversationHeader,
            context: context
        )
        #expect(headerIntent.origin == .conversationHeader)
        #expect(headerIntent.context == context)
        #expect(headerIntent.focusTarget == .headerSharedContent)

        let detailsIntent = SharedContentNavigationIntent(
            entry: .conversationDetails,
            context: context
        )
        #expect(detailsIntent.origin == .conversationDetails)
        #expect(detailsIntent.context == context)
        #expect(detailsIntent.focusTarget == .detailsSharedContent)
    }

    @Test func productionEntryControlsRenderWithDistinctAccessibilityIdentity() {
        let headerImage = render(
            PersonalChatTopBar(
                participantName: "Coach Jordan",
                presence: nil,
                onOpenConversationDetails: {},
                onOpenSharedContent: {}
            )
        )
        let detailsImage = render(
            ConversationDetailsSheet(
                participantName: "Coach Jordan",
                presence: nil,
                onBack: {},
                onOpenSharedContent: {}
            )
        )

        #expect(headerImage.size == CGSize(width: 390, height: 844))
        #expect(detailsImage.size == CGSize(width: 390, height: 844))
        #expect(Set([
            SharedContentEntry.conversationHeader.accessibilityIdentifier,
            SharedContentEntry.conversationDetails.accessibilityIdentifier,
        ])
            == Set(SharedContentEntry.allCases.map(\.accessibilityIdentifier)))
    }
}

@MainActor
private func applyExactlyOnce(
    _ request: SharedContentScrollRestorationRequest,
    coordinator: inout SharedContentScrollRestorationCoordinator,
    alignedOffset: CGFloat,
    maximumOffset: CGFloat
) throws -> (offset: CGFloat, focus: String?)? {
    guard coordinator.beginApplying(request) else { return nil }
    let restoration = try #require(sharedContentScrollRestoration(
        anchor: request.anchor,
        orderedItemIDs: request.orderedItemIDs
    ))
    let scrollView = UIScrollView(
        frame: CGRect(x: 0, y: 0, width: 390, height: 400)
    )
    scrollView.contentSize = CGSize(width: 390, height: maximumOffset + 400)
    scrollView.contentOffset = CGPoint(x: 0, y: alignedOffset)
    var focusedItemID: String?
    let restoredOffset = applySharedContentRestoration(
        restoration,
        to: scrollView,
        focus: { focusedItemID = $0 }
    )
    coordinator.finishApplying(request)
    return (restoredOffset, focusedItemID)
}

@MainActor
private func render<Content: View>(_ content: Content) -> UIImage {
    let renderer = ImageRenderer(
        content: content.frame(width: 390, height: 844)
    )
    renderer.scale = 1
    return renderer.uiImage ?? UIImage()
}

private enum SharedContentOriginContract: Equatable {
    case header
    case details
}

private enum SharedContentRouteContract: Equatable {
    case conversation
    case details
    case sharedContent(SharedContentOriginContract)
    case childPreviewPlaceholder
}

private enum SharedContentDestination: String, CaseIterable {
    case conversation
    case details
    case sharedContent = "shared-content"
    case childPreviewPlaceholder = "child-preview-placeholder"
}

private enum NavigationBackSource: CaseIterable {
    case navigationControl
    case systemGesture
}

private enum NavigationFocusTarget: Equatable {
    case none
    case headerSharedContent
    case detailsSharedContent
    case participantDetails
}

private enum NavigationControlAction: Equatable {
    case openSharedContent
    case openConversationDetails
}

private struct NavigationControlContract: Equatable {
    let accessibleName: String
    let minimumTarget: Int
    let action: NavigationControlAction
}

private struct NavigationSessionAnchor: Equatable {
    let itemId: String
    let focusId: String
}

@MainActor
private final class NavigationSessionContract {
    var selectedCategory: String?
    var anchors: [String: NavigationSessionAnchor] = [:]

    func clear() {
        selectedCategory = nil
        anchors = [:]
    }
}

@MainActor
private final class NavigationStoreSpy {
    private(set) var openCount = 0
    private(set) var closeCount = 0
    private(set) var revokeCount = 0
    private(set) var openEntryIds: [Int] = []
    private(set) var ownerIdentityId: String?
    private(set) var conversationId: String?
    private(set) var identityGeneration = 0

    func bind(ownerIdentityId: String, conversationId: String) {
        identityGeneration += 1
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
    }

    func open(entryId: Int) {
        guard openEntryIds.last != entryId else { return }
        openEntryIds.append(entryId)
        openCount += 1
    }

    func close() {
        closeCount += 1
    }

    func revoke() {
        identityGeneration += 1
        ownerIdentityId = nil
        conversationId = nil
        revokeCount += 1
    }

    func accepts(
        ownerIdentityId: String,
        conversationId: String,
        generation: Int
    ) -> Bool {
        self.ownerIdentityId == ownerIdentityId
            && self.conversationId == conversationId
            && identityGeneration == generation
    }
}

@MainActor
private final class SharedContentNavigationContract {
    private let store: NavigationStoreSpy
    private var nextEntryId = 0
    private var activeEntryId: Int?

    private(set) var path: [SharedContentRouteContract] = [.conversation]
    private(set) var focusedTarget: NavigationFocusTarget = .none
    let session = NavigationSessionContract()

    let headerSharedContentControl = NavigationControlContract(
        accessibleName: "Shared content",
        minimumTarget: 44,
        action: .openSharedContent
    )
    let participantDetailsControl = NavigationControlContract(
        accessibleName: "Conversation details",
        minimumTarget: 44,
        action: .openConversationDetails
    )
    let detailsSharedContentControl = NavigationControlContract(
        accessibleName: "Shared content",
        minimumTarget: 44,
        action: .openSharedContent
    )

    init(store: NavigationStoreSpy) {
        self.store = store
    }

    func bind(ownerIdentityId: String, conversationId: String) {
        if store.ownerIdentityId != nil {
            if activeEntryId != nil { store.close() }
            store.revoke()
            path = [.conversation]
            activeEntryId = nil
            session.clear()
        }
        store.bind(ownerIdentityId: ownerIdentityId, conversationId: conversationId)
    }

    func openConversationDetails() {
        guard path.last == .conversation else { return }
        path.append(.details)
        focusedTarget = .none
    }

    func openSharedContent(from origin: SharedContentOriginContract) {
        switch (origin, path.last) {
        case (.header, .conversation?), (.details, .details?):
            nextEntryId += 1
            activeEntryId = nextEntryId
            path.append(.sharedContent(origin))
            focusedTarget = .none
            store.open(entryId: nextEntryId)
        default:
            return
        }
    }

    func openChildDestination() {
        guard case .sharedContent = path.last else { return }
        path.append(.childPreviewPlaceholder)
    }

    func routeBodyEvaluated() {
        guard let activeEntryId else { return }
        store.open(entryId: activeEntryId)
    }

    func back(using source: NavigationBackSource) {
        _ = source
        guard path.count > 1 else { return }
        switch path.removeLast() {
        case .sharedContent(let origin):
            store.close()
            activeEntryId = nil
            session.clear()
            focusedTarget = origin == .header
                ? .headerSharedContent
                : .detailsSharedContent
        case .details:
            focusedTarget = .participantDetails
        case .childPreviewPlaceholder:
            focusedTarget = .none
        case .conversation:
            break
        }
    }
}
