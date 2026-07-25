import ChatCore
import DesignSystem
import SwiftUI
import UIKit
import UIComponents

/// Full-screen, route-scoped browsing surface for accepted shared content.
///
/// The host owns native stack navigation and supplies the one back action.
/// Repository, cache, delivery, and identity authority remain in the injected
/// provider-neutral model.
public struct SharedContentGalleryScreen: View {
    @Bindable private var model: SharedContentGalleryModel
    private let onBack: () -> Void

    public init(
        model: SharedContentGalleryModel,
        onBack: @escaping () -> Void
    ) {
        self.model = model
        self.onBack = onBack
    }

    public var body: some View {
        SharedContentGalleryScreenContent(
            categories: model.categories,
            selectedCategory: model.selectedCategory,
            items: model.items,
            presentation: model.presentation,
            earlierState: model.earlierState,
            routeGeneration: model.routeGeneration,
            selectedAnchor: model.selectedCategory.flatMap {
                model.anchor(for: $0)
            },
            onBack: onBack,
            onSelectCategory: { model.dispatch(.selectCategory($0)) },
            onRetry: { model.dispatch(.retry) },
            onShowEarlier: { model.dispatch(.showEarlier) },
            onSelectItem: model.itemSelectionEnabled
                ? { model.dispatch(.selectItem(itemId: $0)) }
                : nil,
            onRecordAnchor: {
                model.dispatch(.recordAnchor(category: $0, anchor: $1))
            },
            onReportVisibility: {
                model.dispatch(.reportVisibility(
                    visibleItemIds: $0,
                    lookaheadItemIds: $1
                ))
            },
            loadThumbnail: { await model.thumbnailData(for: $0) },
            onThumbnailDisplayed: { handle in
                Task { @MainActor in
                    _ = await model.displayConfirmed(
                        itemId: handle.itemId,
                        contentVersion: handle.contentVersion
                    )
                }
            }
        )
        .task(id: SharedContentGalleryRouteTaskID(
            generation: model.routeGeneration
        )) {
            model.open()
        }
    }
}

private struct SharedContentGalleryRouteTaskID: Hashable {
    let generation: Int
}
