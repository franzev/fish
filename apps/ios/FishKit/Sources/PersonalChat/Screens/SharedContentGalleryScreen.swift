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
        .onDisappear {
            model.dispatch(.close)
        }
    }
}

private struct SharedContentGalleryRouteTaskID: Hashable {
    let generation: Int
}

struct SharedContentGalleryScreenContent: View {
    let categories: [SharedContentGalleryCategory]
    let selectedCategory: SharedContentGalleryCategory?
    let items: [SharedContentGalleryItem]
    let presentation: SharedContentPresentationContract
    let earlierState: SharedContentEarlierState
    let routeGeneration: Int
    let selectedAnchor: SharedContentGalleryAnchor?
    let onBack: () -> Void
    let onSelectCategory: (SharedContentGalleryCategory) -> Void
    let onRetry: () -> Void
    let onShowEarlier: () -> Void
    let onSelectItem: ((String) -> Void)?
    let onRecordAnchor: (
        SharedContentGalleryCategory,
        SharedContentGalleryAnchor
    ) -> Void
    let onReportVisibility: ([String], [String]) -> Void
    let loadThumbnail: (SharedContentMediaThumbnailHandle) async -> Data?
    let onThumbnailDisplayed: (SharedContentMediaThumbnailHandle) -> Void
    @AccessibilityFocusState private var focusedItemID: String?
    @State private var resolvedScrollView: UIScrollView?
    @State private var scrollViewResolution = 0
    @State private var restorationCoordinator = SharedContentScrollRestorationCoordinator()
    @State private var hasAppeared = false

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "Shared content", onBack: onBack)
            SharedContentCategoryBar(
                categories: categories,
                selectedCategory: selectedCategory,
                onSelect: onSelectCategory
            )
            ScrollViewReader { proxy in
                GeometryReader { viewport in
                    ScrollView {
                        content
                            .frame(maxWidth: Metrics.chatContentMaxWidth)
                            .frame(maxWidth: .infinity, alignment: .top)
                            .padding(.horizontal, Spacing.page)
                            .padding(.vertical, Spacing.md)
                            .padding(.bottom, Spacing.xl)
                    }
                    .background {
                        SharedContentScrollViewResolver { scrollView in
                            guard resolvedScrollView !== scrollView else { return }
                            resolvedScrollView = scrollView
                            scrollViewResolution += 1
                        }
                    }
                    .coordinateSpace(name: SharedContentViewportCoordinateSpace.name)
                    .onPreferenceChange(SharedContentItemFramesKey.self) { frames in
                        reportViewport(frames: frames, height: viewport.size.height)
                    }
                }
                .task(id: restorationTaskID) {
                    guard let request = restorationCoordinator.pendingRequest,
                          restorationCoordinator.beginApplying(request)
                    else { return }
                    var completed = false
                    defer {
                        if !completed {
                            restorationCoordinator.cancelApplying(request)
                        }
                    }
                    guard let restoration = sharedContentScrollRestoration(
                        anchor: request.anchor,
                        orderedItemIDs: request.orderedItemIDs
                    ) else {
                        restorationCoordinator.finishApplying(request)
                        completed = true
                        return
                    }
                    proxy.scrollTo(restoration.itemId, anchor: .top)
                    await Task.yield()
                    guard !Task.isCancelled else { return }
                    guard let resolvedScrollView else { return }
                    await Task.yield()
                    guard !Task.isCancelled else { return }
                    applySharedContentRestoration(
                        restoration,
                        to: resolvedScrollView,
                        focus: { focusedItemID = $0 }
                    )
                    await Task.yield()
                    guard !Task.isCancelled else { return }
                    restorationCoordinator.finishApplying(request)
                    completed = true
                }
                .onAppear {
                    let reason: SharedContentScrollRestorationReason =
                        hasAppeared ? .routeReturn : .categoryEntry
                    hasAppeared = true
                    requestRestoration(reason)
                }
                .onChange(of: restorationSnapshot) { previous, current in
                    let reason: SharedContentScrollRestorationReason =
                        previous.category == current.category
                            ? .itemSetReconciliation
                            : .categoryEntry
                    requestRestoration(reason)
                }
            }
        }
        .background(Palette.bg)
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .top
        )
    }

    private var restorationSnapshot: SharedContentScrollRestorationSnapshot {
        SharedContentScrollRestorationSnapshot(
            category: selectedCategory,
            orderedItemIDs: items.map(\.id)
        )
    }

    private var restorationTaskID: SharedContentScrollRestorationTaskID {
        SharedContentScrollRestorationTaskID(
            requestSequence: restorationCoordinator.pendingRequest?.sequence,
            scrollViewResolution: scrollViewResolution
        )
    }

    private func requestRestoration(_ reason: SharedContentScrollRestorationReason) {
        _ = restorationCoordinator.request(
            reason: reason,
            category: selectedCategory,
            anchor: selectedAnchor,
            orderedItemIDs: items.map(\.id)
        )
    }

    @ViewBuilder private var content: some View {
        if presentation.unavailableReason == .loading, items.isEmpty {
            SharedContentGallerySkeleton(category: selectedCategory)
        } else if categories.isEmpty {
            SharedContentUnavailableState(
                presentation: presentation,
                onRetry: onRetry
            )
        } else {
            VStack(alignment: .leading, spacing: Spacing.md) {
                SharedContentGalleryNotice(
                    presentation: presentation,
                    onRetry: onRetry
                )
                selectedContent
                ShowEarlierBoundary(
                    state: earlierState,
                    onShowEarlier: onShowEarlier
                )
            }
        }
    }

    @ViewBuilder private var selectedContent: some View {
        switch selectedCategory {
        case .media:
            SharedContentMediaGrid(
                items: items,
                onSelectItem: onSelectItem,
                accessibilityFocus: $focusedItemID,
                loadThumbnail: loadThumbnail,
                onThumbnailDisplayed: onThumbnailDisplayed
            )
        case .files, .links, .voice:
            LazyVStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    SharedContentMetadataRow(
                        item: item,
                        onSelectItem: onSelectItem
                    )
                    .id(item.id)
                    .sharedContentViewportItem(item.id)
                    .accessibilityFocused($focusedItemID, equals: item.id)
                    if index < items.count - 1 {
                        Palette.divider
                            .frame(height: 1)
                            .accessibilityHidden(true)
                    }
                }
            }
        case nil:
            EmptyView()
        }
    }

    private func recordAnchor(_ itemID: String) {
        guard let selectedCategory else { return }
        onRecordAnchor(
            selectedCategory,
            SharedContentGalleryAnchor(itemId: itemID)
        )
    }

    private func reportViewport(frames: [String: CGRect], height: CGFloat) {
        let report = sharedContentViewportReport(
            orderedItemIDs: items.map(\.id),
            frames: frames,
            viewportHeight: height
        )
        guard !report.visibleItemIDs.isEmpty || !report.lookaheadItemIDs.isEmpty else { return }
        if restorationCoordinator.shouldRecordViewport,
           let firstVisible = report.visibleItemIDs.first,
           let frame = frames[firstVisible] {
            guard let selectedCategory else { return }
            onRecordAnchor(
                selectedCategory,
                SharedContentGalleryAnchor(
                    itemId: firstVisible,
                    scrollOffset: max(0, -frame.minY),
                    focusedItemId: focusedItemID
                )
            )
        }
        onReportVisibility(report.visibleItemIDs, report.lookaheadItemIDs)
    }
}

private struct SharedContentScrollRestorationSnapshot: Hashable {
    let category: SharedContentGalleryCategory?
    let orderedItemIDs: [String]
}

private struct SharedContentScrollRestorationTaskID: Hashable {
    let requestSequence: Int?
    let scrollViewResolution: Int
}

public enum SharedContentScrollRestorationReason: Sendable, Equatable {
    case categoryEntry
    case routeReturn
    case itemSetReconciliation
}

public struct SharedContentScrollRestorationRequest: Sendable, Equatable {
    public let sequence: Int
    public let reason: SharedContentScrollRestorationReason
    public let category: SharedContentGalleryCategory?
    public let anchor: SharedContentGalleryAnchor?
    public let orderedItemIDs: [String]
}

/// Separates continuously recorded viewport memory from explicit one-shot
/// restoration transitions. A request can be applied at most once.
public struct SharedContentScrollRestorationCoordinator: Sendable {
    public private(set) var pendingRequest: SharedContentScrollRestorationRequest?
    public private(set) var appliedRequestCount = 0
    private var nextSequence = 0
    private var applyingSequence: Int?
    private var lastAppliedSequence: Int?

    public init() {}

    public var shouldRecordViewport: Bool {
        applyingSequence == nil
    }

    @discardableResult
    public mutating func request(
        reason: SharedContentScrollRestorationReason,
        category: SharedContentGalleryCategory?,
        anchor: SharedContentGalleryAnchor?,
        orderedItemIDs: [String]
    ) -> SharedContentScrollRestorationRequest {
        nextSequence += 1
        applyingSequence = nil
        let request = SharedContentScrollRestorationRequest(
            sequence: nextSequence,
            reason: reason,
            category: category,
            anchor: anchor,
            orderedItemIDs: orderedItemIDs
        )
        pendingRequest = request
        return request
    }

    @discardableResult
    public mutating func beginApplying(
        _ request: SharedContentScrollRestorationRequest
    ) -> Bool {
        guard pendingRequest?.sequence == request.sequence,
              applyingSequence == nil,
              lastAppliedSequence != request.sequence
        else { return false }
        applyingSequence = request.sequence
        return true
    }

    public mutating func finishApplying(
        _ request: SharedContentScrollRestorationRequest
    ) {
        guard applyingSequence == request.sequence else { return }
        applyingSequence = nil
        lastAppliedSequence = request.sequence
        appliedRequestCount += 1
        if pendingRequest?.sequence == request.sequence {
            pendingRequest = nil
        }
    }

    public mutating func cancelApplying(
        _ request: SharedContentScrollRestorationRequest
    ) {
        guard applyingSequence == request.sequence else { return }
        applyingSequence = nil
    }
}

public struct SharedContentScrollRestoration: Equatable, Sendable {
    public let itemId: String
    public let pointOffset: CGFloat
    public let focusedItemId: String?
}

public func sharedContentScrollRestoration(
    anchor: SharedContentGalleryAnchor?,
    orderedItemIDs: [String]
) -> SharedContentScrollRestoration? {
    guard let first = orderedItemIDs.first else { return nil }
    let acceptedAnchor = anchor.flatMap { saved in
        orderedItemIDs.contains(saved.itemId) ? saved : nil
    }
    return SharedContentScrollRestoration(
        itemId: acceptedAnchor?.itemId ?? first,
        pointOffset: CGFloat(acceptedAnchor?.scrollOffset ?? 0),
        focusedItemId: acceptedAnchor?.focusedItemId.flatMap { focused in
            orderedItemIDs.contains(focused) ? focused : nil
        }
    )
}

public func sharedContentRestoredContentOffset(
    alignedItemOffset: CGFloat,
    recordedPointOffset: CGFloat,
    minimumOffset: CGFloat,
    maximumOffset: CGFloat
) -> CGFloat {
    min(max(alignedItemOffset + recordedPointOffset, minimumOffset), maximumOffset)
}

@MainActor
@discardableResult
public func applySharedContentRestoration(
    _ restoration: SharedContentScrollRestoration,
    to scrollView: UIScrollView,
    focus: (String?) -> Void
) -> CGFloat {
    scrollView.layoutIfNeeded()
    let minimum = -scrollView.adjustedContentInset.top
    let maximum = max(
        minimum,
        scrollView.contentSize.height -
            scrollView.bounds.height +
            scrollView.adjustedContentInset.bottom
    )
    let restored = sharedContentRestoredContentOffset(
        alignedItemOffset: scrollView.contentOffset.y,
        recordedPointOffset: restoration.pointOffset,
        minimumOffset: minimum,
        maximumOffset: maximum
    )
    scrollView.setContentOffset(
        CGPoint(x: scrollView.contentOffset.x, y: restored),
        animated: false
    )
    focus(restoration.focusedItemId)
    return restored
}

public struct SharedContentViewportReport: Equatable {
    public let visibleItemIDs: [String]
    public let lookaheadItemIDs: [String]
}

public func sharedContentViewportReport(
    orderedItemIDs: [String],
    frames: [String: CGRect],
    viewportHeight: CGFloat
) -> SharedContentViewportReport {
    guard viewportHeight > 0, !frames.isEmpty else {
        return SharedContentViewportReport(visibleItemIDs: [], lookaheadItemIDs: [])
    }
    let viewport = CGRect(x: -1_000_000, y: 0, width: 2_000_000, height: viewportHeight)
    let lookaheadViewport = CGRect(
        x: -1_000_000,
        y: viewportHeight,
        width: 2_000_000,
        height: viewportHeight
    )
    let visible = orderedItemIDs.filter { id in
        frames[id].map { $0.intersects(viewport) } == true
    }
    let visibleSet = Set(visible)
    let lookahead = orderedItemIDs.filter { id in
        !visibleSet.contains(id) &&
            frames[id].map { $0.intersects(lookaheadViewport) } == true
    }
    return SharedContentViewportReport(
        visibleItemIDs: visible,
        lookaheadItemIDs: lookahead
    )
}

private enum SharedContentViewportCoordinateSpace {
    static let name = "shared-content-gallery-viewport"
}

private struct SharedContentItemFramesKey: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

extension View {
    func sharedContentViewportItem(_ itemID: String) -> some View {
        background {
            GeometryReader { geometry in
                Color.clear.preference(
                    key: SharedContentItemFramesKey.self,
                    value: [
                        itemID: geometry.frame(
                            in: .named(SharedContentViewportCoordinateSpace.name)
                        ),
                    ]
                )
            }
        }
        .id(itemID)
    }
}

private struct SharedContentScrollViewResolver: UIViewRepresentable {
    let onResolve: (UIScrollView) -> Void

    func makeUIView(context: Context) -> ResolverView {
        ResolverView(onResolve: onResolve)
    }

    func updateUIView(_ view: ResolverView, context: Context) {
        view.onResolve = onResolve
        view.resolve()
    }

    final class ResolverView: UIView {
        var onResolve: (UIScrollView) -> Void

        init(onResolve: @escaping (UIScrollView) -> Void) {
            self.onResolve = onResolve
            super.init(frame: .zero)
            isUserInteractionEnabled = false
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) is unavailable")
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            resolve()
        }

        func resolve() {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                var ancestor = superview
                while let current = ancestor {
                    if let scrollView = current as? UIScrollView {
                        onResolve(scrollView)
                        return
                    }
                    ancestor = current.superview
                }
            }
        }
    }
}
