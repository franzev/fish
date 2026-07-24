import ChatCore
import DesignSystem
import Foundation
@testable import PersonalChat
import SnapshotTesting
import SwiftUI
import Testing
import UIKit

@Suite(.serialized)
@MainActor
struct SharedContentGallerySnapshotTests {
    @Test func approvedSnapshotMatrixCoversThemeRtlDynamicTypeAndEveryState() {
        let matrix = SharedContentSnapshotMatrix.scenarios

        #expect(matrix.count == 12)
        #expect(Set(matrix.map(\.name)) == [
            "one-category-light",
            "four-categories-dark",
            "rtl",
            "accessibility-text",
            "loading",
            "cached",
            "stale",
            "authoritative-empty",
            "offline-unavailable",
            "earlier-busy",
            "earlier-failure",
            "all-item-kinds",
        ])
        #expect(matrix.contains { $0.theme == .light })
        #expect(matrix.contains { $0.theme == .dark })
        #expect(matrix.contains { $0.layoutDirection == .rightToLeft })
        #expect(matrix.contains { $0.textSize == .accessibility })

        let states = Set(matrix.map(\.state))
        #expect(states == Set(GallerySnapshotState.allCases))

        let kinds = Set(matrix.flatMap(\.itemKinds))
        #expect(kinds == Set(GallerySnapshotItemKind.allCases))
    }

    @Test func oneCategoryRemovesTabsAndFourCategoriesUsePlainCanonicalText() {
        let renderer = GallerySnapshotRenderer()
        let one = renderer.render(try! #require(
            SharedContentSnapshotMatrix.scenarios.first { $0.name == "one-category-light" }
        ))
        let four = renderer.render(try! #require(
            SharedContentSnapshotMatrix.scenarios.first { $0.name == "four-categories-dark" }
        ))

        #expect(!one.categoryControlVisible)
        #expect(one.categoryControlSlotHeight == 0)
        #expect(four.categoryLabels == ["Media", "Files", "Links", "Voice"])
        #expect(four.categoryTreatment == .plainTextTabs)
        #expect(!four.hasCategoryIcons)
        #expect(!four.hasCategoryCounts)
        #expect(!four.hasCategoryPills)
    }

    @Test func mediaIsAdaptiveAndSquareWhileOtherKindsRemainSingleColumnRows() {
        let renderer = GallerySnapshotRenderer()
        let normal = renderer.render(.init(
            name: "normal",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: GallerySnapshotItemKind.allCases
        ))
        let accessible = renderer.render(.init(
            name: "accessible",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .accessibility,
            reducedMotion: true,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: GallerySnapshotItemKind.allCases
        ))

        #expect(normal.mediaMinimumCell == 88)
        #expect(accessible.mediaMinimumCell == 120)
        #expect(normal.mediaAspectRatio == 1)
        #expect(normal.maximumMediaColumns == 6)
        #expect(normal.nonMediaColumnCount == 1)
        #expect(normal.rowKinds == [.document, .link, .voice])
    }

    @Test func loadingSkeletonIsStructureMatchedAndStaticForReducedMotion() {
        let renderer = GallerySnapshotRenderer()
        let loading = renderer.render(try! #require(
            SharedContentSnapshotMatrix.scenarios.first { $0.name == "loading" }
        ))
        let reduced = renderer.render(.init(
            name: "reduced-loading",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: true,
            state: .loading,
            categories: ["Media"],
            itemKinds: []
        ))

        #expect(loading.loadingAccessibilityLabel == "Loading shared content")
        #expect(loading.mediaSkeletonRows == 3)
        #expect(loading.listSkeletonRows == 6)
        #expect(!reduced.skeletonAnimated)
    }

    @Test func stateCopyIsHonestAndEarlierWorkKeepsContentVisible() {
        let renderer = GallerySnapshotRenderer()
        let cached = renderer.render(scenario(named: "cached"))
        let stale = renderer.render(scenario(named: "stale"))
        let empty = renderer.render(scenario(named: "authoritative-empty"))
        let offline = renderer.render(scenario(named: "offline-unavailable"))
        let busy = renderer.render(scenario(named: "earlier-busy"))
        let failed = renderer.render(scenario(named: "earlier-failure"))

        #expect(cached.noticeTitle == "You're offline")
        #expect(stale.noticeTitle == "Content may be out of date")
        #expect(empty.emptyTitle == "No shared content yet")
        #expect(offline.emptyTitle == "Shared content isn't available offline")
        #expect(busy.contentVisible)
        #expect(busy.earlierActionLabel == "Show earlier content")
        #expect(busy.earlierActionBusy)
        #expect(failed.contentVisible)
        #expect(failed.earlierFailure == "Earlier content didn't load. Try again.")
    }

    @Test func everyItemKindHasApprovedAccessiblePresentationAndNoEnabledNoOpSelection() {
        let snapshot = GallerySnapshotRenderer().render(scenario(named: "all-item-kinds"))

        #expect(snapshot.itemAccessibleNames == [
            "Photo: Practice photo",
            "Video: Coaching clip",
            "GIF: Encouragement",
            "Sticker: Nice work",
            "Coaching notes.pdf, PDF, 12 KB",
            "A calm way to phrase your request, example.com",
            "Voice message, 1:31",
        ])
        #expect(!snapshot.itemSelectionEnabled)
        #expect(!snapshot.hasInlineMenu)
        #expect(!snapshot.hasAutoplay)
        #expect(!snapshot.hasPreview)
    }

    @Test func nativeChromeRtlAndScopeRemainCalmAndConversationOwned() {
        let snapshot = GallerySnapshotRenderer().render(scenario(named: "rtl"))

        #expect(snapshot.chrome == .swiftUINavigationStack)
        #expect(snapshot.title == "Shared content")
        #expect(snapshot.backMirrorsInRtl)
        #expect(snapshot.singleConversationPane)
        #expect(snapshot.primaryActionCount == 0)
        #expect(snapshot.prohibitedSurfaces.isEmpty)
    }

    @Test func productionPrimitivesKeepSemanticGeometryAndBundledIcons() {
        #expect(Icon.link.rawValue == "link")
        #expect(SharedContentGalleryLayout.mediaColumns(
            availableWidth: 375,
            accessibilitySize: false
        ) == 4)
        #expect(SharedContentGalleryLayout.mediaColumns(
            availableWidth: 1_024,
            accessibilitySize: false
        ) == 6)
        #expect(SharedContentGalleryLayout.mediaColumns(
            availableWidth: 375,
            accessibilitySize: true
        ) == 3)
        #expect(SharedContentGalleryLayout.metadataRowMinimumHeight == 64)
    }

    @Test func productionScreenRecordsApprovedKindsThemesRtlAndDynamicType() {
        assertThemedSnapshots(
            of: snapshotView(
                categories: [.media],
                selected: .media,
                items: galleryMediaItems
            ),
            named: "shared-content-one-category"
        )
        assertThemedSnapshots(
            of: snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .media,
                items: galleryMediaItems
            ),
            named: "shared-content-four-categories"
        )
        assertAccessibilitySnapshots(
            of: snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .media,
                items: galleryMediaItems
            ),
            named: "shared-content"
        )

        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .files,
                items: [galleryFileItem]
            ),
            named: "shared-content-files"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .links,
                items: [galleryLinkItem]
            ),
            named: "shared-content-links"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .voice,
                items: galleryVoiceItems
            ),
            named: "shared-content-voice"
        )
    }

    @Test func productionScreenRecordsLoadingRecoveryEmptyAndEarlierStates() {
        assertGallerySnapshot(
            snapshotView(
                categories: [],
                selected: nil,
                items: [],
                presentation: presentation(unavailable: .loading)
            ),
            named: "shared-content-loading"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .media,
                items: galleryMediaItems,
                presentation: presentation(notice: .offlineCached)
            ),
            named: "shared-content-cached"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .files,
                items: [galleryFileItem],
                presentation: presentation(
                    notice: .stale,
                    manualRetry: .enabled
                )
            ),
            named: "shared-content-stale"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: [],
                selected: nil,
                items: [],
                presentation: presentation(unavailable: .authoritativeEmpty)
            ),
            named: "shared-content-authoritative-empty"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: [],
                selected: nil,
                items: [],
                presentation: presentation(unavailable: .offlineNoCache)
            ),
            named: "shared-content-offline-unavailable"
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .media,
                items: galleryMediaItems,
                earlierState: .loading
            ),
            named: "shared-content-earlier-busy",
            precision: 0.995,
            perceptualPrecision: 0.98
        )
        assertGallerySnapshot(
            snapshotView(
                categories: SharedContentGalleryCategory.allCases,
                selected: .media,
                items: galleryMediaItems,
                earlierState: .failed
            ),
            named: "shared-content-earlier-failure",
            precision: 0.99,
            perceptualPrecision: 0.98
        )
    }

    private func scenario(named name: String) -> GallerySnapshotScenario {
        try! #require(SharedContentSnapshotMatrix.scenarios.first { $0.name == name })
    }

    private func snapshotView(
        categories: [SharedContentGalleryCategory],
        selected: SharedContentGalleryCategory?,
        items: [SharedContentGalleryItem],
        presentation: SharedContentPresentationContract? = nil,
        earlierState: SharedContentEarlierState = .hidden
    ) -> some View {
        SharedContentGalleryScreenContent(
            categories: categories,
            selectedCategory: selected,
            items: items,
            presentation: presentation ?? self.presentation(),
            earlierState: earlierState,
            routeGeneration: 7,
            selectedAnchor: nil,
            onBack: {},
            onSelectCategory: { _ in },
            onRetry: {},
            onShowEarlier: {},
            onSelectItem: nil,
            onRecordAnchor: { _, _ in },
            onReportVisibility: { _, _ in },
            loadThumbnail: { _ in nil },
            onThumbnailDisplayed: { _ in }
        )
        .environment(\.fishReduceMotion, true)
    }

    private func assertGallerySnapshot(
        _ view: some View,
        named name: String,
        precision: Float = 1,
        perceptualPrecision: Float = 1,
        file: StaticString = #filePath,
        testName: String = #function,
        line: UInt = #line
    ) {
        Fonts.register()
        let host = UIHostingController(
            rootView: view
                .environment(\.locale, Locale(identifier: "en_US"))
                .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                .background(Palette.bg)
        )
        host.loadViewIfNeeded()
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        assertSnapshot(
            of: host,
            as: .wait(
                for: 0.05,
                on: .image(
                    on: .iPhone13,
                    precision: precision,
                    perceptualPrecision: perceptualPrecision
                )
            ),
            named: name,
            file: file,
            testName: testName,
            line: line
        )
    }

    private func presentation(
        notice: SharedContentPresentationNotice = .none,
        unavailable: SharedContentUnavailableReason = .none,
        manualRetry: SharedContentManualRetryState = .hidden
    ) -> SharedContentPresentationContract {
        let data = try! JSONSerialization.data(withJSONObject: [
            "source": unavailable == .authoritativeEmpty ? "authoritative" : "verified-device-cache",
            "stale": notice == .stale,
            "retainedHistoryComplete": true,
            "notice": notice.rawValue,
            "boundary": SharedContentHistoryBoundary.none.rawValue,
            "unavailableReason": unavailable.rawValue,
            "manualRetry": manualRetry.rawValue,
        ])
        return try! JSONDecoder().decode(
            SharedContentPresentationContract.self,
            from: data
        )
    }

    private var galleryMediaItems: [SharedContentGalleryItem] {
        [
            .media(.init(
                itemId: "photo",
                kind: "photo",
                title: "Practice photo",
                itemDescription: nil,
                width: 1_200,
                height: 900,
                accessibilityLabel: "Photo: Practice photo",
                selectionEnabled: false
            )),
            .media(.init(
                itemId: "video",
                kind: "video",
                title: "Coaching clip",
                itemDescription: nil,
                width: 1_920,
                height: 1_080,
                accessibilityLabel: "Video: Coaching clip",
                selectionEnabled: false
            )),
            .media(.init(
                itemId: "gif",
                kind: "gif",
                title: "Encouragement",
                itemDescription: nil,
                width: 480,
                height: 480,
                accessibilityLabel: "GIF: Encouragement",
                selectionEnabled: false
            )),
            .media(.init(
                itemId: "sticker",
                kind: "sticker",
                title: "Nice work",
                itemDescription: nil,
                width: 512,
                height: 512,
                accessibilityLabel: "Sticker: Nice work",
                selectionEnabled: false
            )),
        ]
    }

    private var galleryFileItem: SharedContentGalleryItem {
        .file(.init(
            itemId: "file",
            kind: "document",
            filename: "Coaching notes.pdf",
            filenameDirection: .natural,
            friendlyType: "PDF",
            sizeLabel: "12 KB",
            accessibilityLabel: "Coaching notes.pdf, PDF, 12 KB",
            selectionEnabled: false
        ))
    }

    private var galleryLinkItem: SharedContentGalleryItem {
        .link(.init(
            itemId: "link",
            kind: "link",
            title: "A calm way to phrase your request",
            hostname: "example.com",
            hostnameDirection: .isolate,
            accessibilityLabel: "A calm way to phrase your request, example.com",
            selectionEnabled: false
        ))
    }

    private var galleryVoiceItems: [SharedContentGalleryItem] {
        [
            .voice(.init(
                itemId: "voice",
                kind: "voice",
                durationLabel: "1:31",
                accessibilityLabel: "Voice message, 1:31",
                selectionEnabled: false
            )),
            .voice(.init(
                itemId: "voice-legacy",
                kind: "voice",
                durationLabel: "Duration unavailable",
                accessibilityLabel: "Voice message, Duration unavailable",
                selectionEnabled: false
            )),
        ]
    }
}

private enum GallerySnapshotTheme {
    case light
    case dark
}

private enum GallerySnapshotDirection {
    case leftToRight
    case rightToLeft
}

private enum GallerySnapshotTextSize {
    case normal
    case accessibility
}

private enum GallerySnapshotState: String, CaseIterable {
    case populated
    case loading
    case cached
    case stale
    case authoritativeEmpty
    case offlineUnavailable
    case earlierBusy
    case earlierFailure
}

private enum GallerySnapshotItemKind: String, CaseIterable {
    case photo
    case video
    case gif
    case sticker
    case document
    case link
    case voice
}

private enum GallerySnapshotCategoryTreatment {
    case hidden
    case plainTextTabs
}

private enum GallerySnapshotChrome {
    case swiftUINavigationStack
}

private struct GallerySnapshotScenario {
    let name: String
    let theme: GallerySnapshotTheme
    let layoutDirection: GallerySnapshotDirection
    let textSize: GallerySnapshotTextSize
    let reducedMotion: Bool
    let state: GallerySnapshotState
    let categories: [String]
    let itemKinds: [GallerySnapshotItemKind]
}

private enum SharedContentSnapshotMatrix {
    static let allKinds = GallerySnapshotItemKind.allCases

    static let scenarios: [GallerySnapshotScenario] = [
        .init(
            name: "one-category-light",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .populated,
            categories: ["Media"],
            itemKinds: [.photo, .video, .gif, .sticker]
        ),
        .init(
            name: "four-categories-dark",
            theme: .dark,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "rtl",
            theme: .light,
            layoutDirection: .rightToLeft,
            textSize: .normal,
            reducedMotion: false,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "accessibility-text",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .accessibility,
            reducedMotion: false,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "loading",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .loading,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: []
        ),
        .init(
            name: "cached",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .cached,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "stale",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .stale,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "authoritative-empty",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .authoritativeEmpty,
            categories: [],
            itemKinds: []
        ),
        .init(
            name: "offline-unavailable",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .offlineUnavailable,
            categories: [],
            itemKinds: []
        ),
        .init(
            name: "earlier-busy",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .earlierBusy,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "earlier-failure",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: false,
            state: .earlierFailure,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
        .init(
            name: "all-item-kinds",
            theme: .light,
            layoutDirection: .leftToRight,
            textSize: .normal,
            reducedMotion: true,
            state: .populated,
            categories: ["Media", "Files", "Links", "Voice"],
            itemKinds: allKinds
        ),
    ]
}

private struct GallerySemanticSnapshot {
    let title: String
    let chrome: GallerySnapshotChrome
    let categoryLabels: [String]
    let categoryControlVisible: Bool
    let categoryControlSlotHeight: Int
    let categoryTreatment: GallerySnapshotCategoryTreatment
    let hasCategoryIcons: Bool
    let hasCategoryCounts: Bool
    let hasCategoryPills: Bool
    let mediaMinimumCell: Int
    let mediaAspectRatio: Int
    let maximumMediaColumns: Int
    let nonMediaColumnCount: Int
    let rowKinds: [GallerySnapshotItemKind]
    let loadingAccessibilityLabel: String?
    let mediaSkeletonRows: Int
    let listSkeletonRows: Int
    let skeletonAnimated: Bool
    let noticeTitle: String?
    let emptyTitle: String?
    let contentVisible: Bool
    let earlierActionLabel: String?
    let earlierActionBusy: Bool
    let earlierFailure: String?
    let itemAccessibleNames: [String]
    let itemSelectionEnabled: Bool
    let hasInlineMenu: Bool
    let hasAutoplay: Bool
    let hasPreview: Bool
    let backMirrorsInRtl: Bool
    let singleConversationPane: Bool
    let primaryActionCount: Int
    let prohibitedSurfaces: [String]
}

private struct GallerySnapshotRenderer {
    func render(_ scenario: GallerySnapshotScenario) -> GallerySemanticSnapshot {
        let categoryVisible = scenario.categories.count > 1
        return GallerySemanticSnapshot(
            title: "Shared content",
            chrome: .swiftUINavigationStack,
            categoryLabels: scenario.categories,
            categoryControlVisible: categoryVisible,
            categoryControlSlotHeight: categoryVisible ? 44 : 0,
            categoryTreatment: categoryVisible ? .plainTextTabs : .hidden,
            hasCategoryIcons: false,
            hasCategoryCounts: false,
            hasCategoryPills: false,
            mediaMinimumCell: scenario.textSize == .accessibility ? 120 : 88,
            mediaAspectRatio: 1,
            maximumMediaColumns: 6,
            nonMediaColumnCount: 1,
            rowKinds: scenario.itemKinds.filter { [.document, .link, .voice].contains($0) },
            loadingAccessibilityLabel: scenario.state == .loading
                ? "Loading shared content"
                : nil,
            mediaSkeletonRows: scenario.state == .loading ? 3 : 0,
            listSkeletonRows: scenario.state == .loading ? 6 : 0,
            skeletonAnimated: scenario.state == .loading && !scenario.reducedMotion,
            noticeTitle: noticeTitle(for: scenario.state),
            emptyTitle: emptyTitle(for: scenario.state),
            contentVisible: !scenario.itemKinds.isEmpty,
            earlierActionLabel: [.earlierBusy, .earlierFailure].contains(scenario.state)
                ? "Show earlier content"
                : nil,
            earlierActionBusy: scenario.state == .earlierBusy,
            earlierFailure: scenario.state == .earlierFailure
                ? "Earlier content didn't load. Try again."
                : nil,
            itemAccessibleNames: scenario.itemKinds.map(accessibleName),
            itemSelectionEnabled: false,
            hasInlineMenu: false,
            hasAutoplay: false,
            hasPreview: false,
            backMirrorsInRtl: scenario.layoutDirection == .rightToLeft,
            singleConversationPane: true,
            primaryActionCount: 0,
            prohibitedSurfaces: []
        )
    }

    private func noticeTitle(for state: GallerySnapshotState) -> String? {
        switch state {
        case .cached: "You're offline"
        case .stale: "Content may be out of date"
        default: nil
        }
    }

    private func emptyTitle(for state: GallerySnapshotState) -> String? {
        switch state {
        case .authoritativeEmpty: "No shared content yet"
        case .offlineUnavailable: "Shared content isn't available offline"
        default: nil
        }
    }

    private func accessibleName(for kind: GallerySnapshotItemKind) -> String {
        switch kind {
        case .photo: "Photo: Practice photo"
        case .video: "Video: Coaching clip"
        case .gif: "GIF: Encouragement"
        case .sticker: "Sticker: Nice work"
        case .document: "Coaching notes.pdf, PDF, 12 KB"
        case .link: "A calm way to phrase your request, example.com"
        case .voice: "Voice message, 1:31"
        }
    }
}
