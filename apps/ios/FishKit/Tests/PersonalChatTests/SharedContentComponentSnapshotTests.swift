import ChatCore
import DesignSystem
import Foundation
import SwiftUI
import Testing
@testable import PersonalChat

/// Component-level snapshot cases for the shared-content chrome. Each `named:`
/// string matches the `@Preview(name = …)` of its Compose counterpart so the
/// pair can be compared side by side. Whole-gallery cases live in
/// SharedContentGallerySnapshotTests.
struct SharedContentComponentSnapshotTests {
    // The contract has no public memberwise initialiser, so it is decoded the
    // same way SharedContentGallerySnapshotTests builds one.
    private func presentation(
        notice: SharedContentPresentationNotice = .none,
        unavailable: SharedContentUnavailableReason = .none,
        retry: SharedContentManualRetryState = .hidden
    ) -> SharedContentPresentationContract {
        let data = try! JSONSerialization.data(withJSONObject: [
            "source": unavailable == .authoritativeEmpty ? "authoritative" : "verified-device-cache",
            "stale": notice == .stale,
            "retainedHistoryComplete": true,
            "notice": notice.rawValue,
            "boundary": SharedContentHistoryBoundary.none.rawValue,
            "unavailableReason": unavailable.rawValue,
            "manualRetry": retry.rawValue,
        ])
        return try! JSONDecoder().decode(SharedContentPresentationContract.self, from: data)
    }

    @MainActor @Test func sharedContentChrome() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            SharedContentCategoryBar(
                categories: SharedContentGalleryCategory.allCases,
                selectedCategory: .media,
                onSelect: { _ in }
            )
            SharedContentGalleryNotice(
                presentation: presentation(notice: .checkingForUpdates),
                onRetry: {}
            )
            SharedContentGalleryNotice(
                presentation: presentation(notice: .stale, retry: .enabled),
                onRetry: {}
            )
            SharedContentGallerySkeleton(category: .media)
            SharedContentUnavailableState(
                presentation: presentation(unavailable: .authoritativeEmpty),
                onRetry: {}
            )
            SharedContentUnavailableState(
                presentation: presentation(unavailable: .offlineNoCache, retry: .enabled),
                onRetry: {}
            )
            ShowEarlierBoundary(state: .ready, onShowEarlier: {})
            ShowEarlierBoundary(state: .loading, onShowEarlier: {})
            ShowEarlierBoundary(state: .failed, onShowEarlier: {})
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "shared-content-chrome")
    }
}
