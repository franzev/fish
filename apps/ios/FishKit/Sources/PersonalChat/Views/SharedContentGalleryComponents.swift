import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

enum SharedContentGalleryLayout {
    static let normalMediaMinimum: CGFloat = 88
    static let accessibilityMediaMinimum: CGFloat = 120
    static let maximumMediaColumns = 6
    static let metadataRowMinimumHeight: CGFloat = 64

    static func mediaMaximumWidth(accessibilitySize: Bool) -> CGFloat {
        let minimum = accessibilitySize
            ? accessibilityMediaMinimum
            : normalMediaMinimum
        return (minimum * CGFloat(maximumMediaColumns)) +
            (Spacing.twoXs * CGFloat(maximumMediaColumns - 1))
    }

    static func mediaColumns(
        availableWidth: CGFloat,
        accessibilitySize: Bool
    ) -> Int {
        let minimum = accessibilitySize
            ? accessibilityMediaMinimum
            : normalMediaMinimum
        let usableWidth = max(availableWidth, minimum)
        let count = Int((usableWidth + Spacing.twoXs) / (minimum + Spacing.twoXs))
        return min(max(count, 1), maximumMediaColumns)
    }
}

struct SharedContentCategoryBar: View {
    let categories: [SharedContentGalleryCategory]
    let selectedCategory: SharedContentGalleryCategory?
    let onSelect: (SharedContentGalleryCategory) -> Void

    var body: some View {
        if categories.count > 1 {
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(categories) { category in
                            categoryButton(category)
                                .id(category)
                        }
                    }
                    .padding(.horizontal, Spacing.page)
                }
                .onChange(of: selectedCategory) { _, selected in
                    guard let selected else { return }
                    withAnimation(.none) {
                        proxy.scrollTo(selected, anchor: .center)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Shared content categories")
        }
    }

    private func categoryButton(
        _ category: SharedContentGalleryCategory
    ) -> some View {
        let selected = category == selectedCategory
        return Button {
            onSelect(category)
        } label: {
            VStack(spacing: Spacing.twoXs) {
                Text(category.label)
                    .textStyle(.ui)
                    .foregroundStyle(selected ? Palette.foreground : Palette.body)
                    .fixedSize(horizontal: true, vertical: false)
                Rectangle()
                    .fill(selected ? Palette.foreground : .clear)
                    .frame(height: Spacing.threeXs)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Metrics.targetTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(category.label)
        .accessibilityValue(selected ? "Selected" : "")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct SharedContentMediaGrid: View {
    let items: [SharedContentGalleryItem]
    let onSelectItem: ((String) -> Void)?
    let accessibilityFocus: AccessibilityFocusState<String?>.Binding
    let loadThumbnail: (SharedContentMediaThumbnailHandle) async -> Data?
    let onThumbnailDisplayed: (SharedContentMediaThumbnailHandle) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let minimum = dynamicTypeSize.isAccessibilitySize
            ? SharedContentGalleryLayout.accessibilityMediaMinimum
            : SharedContentGalleryLayout.normalMediaMinimum
        LazyVGrid(
            columns: [
                GridItem(
                    .adaptive(minimum: minimum),
                    spacing: Spacing.twoXs
                ),
            ],
            spacing: Spacing.twoXs
        ) {
            ForEach(items) { item in
                if case .media(let media) = item {
                    mediaTile(media)
                        .sharedContentViewportItem(media.itemId)
                }
            }
        }
        .frame(
            maxWidth: SharedContentGalleryLayout.mediaMaximumWidth(
                accessibilitySize: dynamicTypeSize.isAccessibilitySize
            ),
            alignment: .leading
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func mediaTile(_ item: SharedContentGalleryItem.Media) -> some View {
        let tile = SharedContentMediaThumbnail(
            item: item,
            loadThumbnail: loadThumbnail,
            onDisplayed: onThumbnailDisplayed
        )
            .aspectRatio(1, contentMode: .fit)
            .contentShape(Rectangle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.accessibilityLabel)

        if item.selectionEnabled, let onSelectItem {
            Button {
                onSelectItem(item.itemId)
            } label: {
                tile
            }
            .buttonStyle(.plain)
            .accessibilityFocused(accessibilityFocus, equals: item.itemId)
        } else {
            tile.accessibilityFocused(accessibilityFocus, equals: item.itemId)
        }
    }

}

private struct SharedContentMediaThumbnail: View {
    let item: SharedContentGalleryItem.Media
    let loadThumbnail: (SharedContentMediaThumbnailHandle) async -> Data?
    let onDisplayed: (SharedContentMediaThumbnailHandle) -> Void

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Palette.surface2
            if item.kind == "sticker", let stickerId = item.stickerId {
                StickerMedia(stickerId: stickerId, displaySize: .fill)
            } else if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .onAppear { onDisplayed(item.thumbnailHandle) }
            } else {
                fallback
            }
            if item.kind == "video", image != nil {
                Icon.video.image
                    .glyphFrame()
                    .foregroundStyle(Palette.foreground)
            }
            if item.kind == "gif", image != nil {
                Text("GIF")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.foreground)
            }
        }
        .clipShape(
            RoundedRectangle(
                cornerRadius: Radius.chatInner,
                style: .continuous
            )
        )
        .task(id: item.thumbnailHandle) {
            guard item.kind != "sticker",
                  let data = await loadThumbnail(item.thumbnailHandle)
            else { return }
            image = UIImage(data: data)
        }
    }

    @ViewBuilder private var fallback: some View {
        switch item.kind {
        case "video":
            Icon.video.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        case "gif":
            Text("GIF")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
        case "sticker":
            Icon.moodSmile.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        default:
            Icon.photo.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        }
    }
}

struct SharedContentMetadataRow: View {
    let item: SharedContentGalleryItem
    let onSelectItem: ((String) -> Void)?

    var body: some View {
        if item.selectionEnabled, let onSelectItem {
            Button {
                onSelectItem(item.id)
            } label: {
                rowContent
            }
            .buttonStyle(.plain)
        } else {
            rowContent
        }
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            rowIcon.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
                .frame(
                    width: Metrics.targetTouch,
                    height: Metrics.targetTouch
                )
            VStack(alignment: .leading, spacing: Spacing.twoXs) {
                Text(title)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(nil)
                    .multilineTextAlignment(.leading)
                    .sharedContentDirectionIsolated(titleIsDirectionIsolated)
                if let metadata {
                    Text(metadata)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .lineLimit(nil)
                        .multilineTextAlignment(.leading)
                        .sharedContentDirectionIsolated(metadataIsDirectionIsolated)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(
            maxWidth: .infinity,
            minHeight: SharedContentGalleryLayout.metadataRowMinimumHeight,
            alignment: .leading
        )
        .padding(.vertical, Spacing.md)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var rowIcon: Icon {
        switch item {
        case .file: .fileText
        case .link: .link
        case .voice: .microphone
        case .media: .photo
        }
    }

    private var title: String {
        switch item {
        case .file(let item): item.filename
        case .link(let item): item.title
        case .voice: "Voice message"
        case .media(let item): item.title ?? "Media"
        }
    }

    private var metadata: String? {
        switch item {
        case .file(let item):
            return [item.friendlyType, item.sizeLabel]
                .compactMap { $0 }
                .joined(separator: " · ")
        case .link(let item):
            return item.hostname
        case .voice(let item):
            return item.durationLabel
        case .media:
            return nil
        }
    }

    private var accessibilityLabel: String {
        switch item {
        case .file(let item): item.accessibilityLabel
        case .link(let item): item.accessibilityLabel
        case .voice(let item): item.accessibilityLabel
        case .media(let item): item.accessibilityLabel
        }
    }

    private var titleIsDirectionIsolated: Bool {
        if case .file(let item) = item {
            return item.filenameDirection == .isolate
        }
        return false
    }

    private var metadataIsDirectionIsolated: Bool {
        if case .link(let item) = item {
            return item.hostnameDirection == .isolate
        }
        return false
    }
}

struct SharedContentGallerySkeleton: View {
    let category: SharedContentGalleryCategory?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if category == .media || category == nil {
                mediaSkeleton
            } else {
                listSkeleton
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading shared content")
    }

    private var mediaSkeleton: some View {
        let minimum = dynamicTypeSize.isAccessibilitySize
            ? SharedContentGalleryLayout.accessibilityMediaMinimum
            : SharedContentGalleryLayout.normalMediaMinimum
        let itemCount = dynamicTypeSize.isAccessibilitySize ? 6 : 9
        return LazyVGrid(
            columns: [
                GridItem(
                    .adaptive(minimum: minimum),
                    spacing: Spacing.twoXs
                ),
            ],
            spacing: Spacing.twoXs
        ) {
            ForEach(0..<itemCount, id: \.self) { _ in
                RoundedRectangle(
                    cornerRadius: Radius.chatInner,
                    style: .continuous
                )
                .fill(Palette.surface2)
                .aspectRatio(1, contentMode: .fit)
                .accessibilityHidden(true)
            }
        }
        .frame(
            maxWidth: SharedContentGalleryLayout.mediaMaximumWidth(
                accessibilitySize: dynamicTypeSize.isAccessibilitySize
            ),
            alignment: .leading
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var listSkeleton: some View {
        VStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { index in
                HStack(spacing: Spacing.sm) {
                    RoundedRectangle(
                        cornerRadius: Radius.control,
                        style: .continuous
                    )
                    .fill(Palette.surface2)
                    .frame(
                        width: Metrics.targetTouch,
                        height: Metrics.targetTouch
                    )
                    VStack(alignment: .leading, spacing: Spacing.twoXs) {
                        SkeletonBar()
                        SkeletonBar(width: SharedContentGalleryLayout.accessibilityMediaMinimum)
                    }
                }
                .padding(.vertical, Spacing.md)
                if index < 5 {
                    Palette.divider
                        .frame(height: 1)
                        .accessibilityHidden(true)
                }
            }
        }
    }
}

struct SharedContentGalleryNotice: View {
    let presentation: SharedContentPresentationContract
    let onRetry: () -> Void

    @ViewBuilder var body: some View {
        switch presentation.notice {
        case .none:
            EmptyView()
        case .checkingForUpdates:
            Notice(tone: .notice, title: "Checking for updates…")
        case .offlineCached:
            Notice(
                tone: .notice,
                title: "You're offline",
                message: "This content is saved on this device and may be out of date."
            )
        case .stale:
            Notice(
                tone: .notice,
                title: "Content may be out of date",
                message: "We couldn't check for updates.",
                actionLabel: presentation.manualRetry == .enabled ? "Try again" : nil,
                onAction: presentation.manualRetry == .enabled ? onRetry : nil
            )
        }
    }
}

struct SharedContentUnavailableState: View {
    let presentation: SharedContentPresentationContract
    let onRetry: () -> Void

    @ViewBuilder var body: some View {
        switch presentation.unavailableReason {
        case .none, .loading, .identityIneligible:
            EmptyView()
        case .authoritativeEmpty:
            EmptyState(
                title: "No shared content yet",
                message: "Items shared in this conversation will appear here."
            )
        case .offlineNoCache:
            EmptyState(
                title: "Shared content isn't available offline",
                message: "Connect to the internet to load it."
            )
        case .authorityUnavailable:
            EmptyState(
                title: "Shared content isn't available right now",
                message: "Reconnect and try again.",
                actionLabel: presentation.manualRetry == .enabled ? "Try again" : nil,
                onAction: presentation.manualRetry == .enabled ? onRetry : nil
            )
        }
    }
}

struct ShowEarlierBoundary: View {
    let state: SharedContentEarlierState
    let onShowEarlier: () -> Void

    @ViewBuilder var body: some View {
        switch state {
        case .hidden:
            EmptyView()
        case .ready:
            ActionButton(
                "Show earlier content",
                variant: .secondary,
                fullWidth: true,
                action: onShowEarlier
            )
        case .loading:
            ActionButton(
                "Show earlier content",
                variant: .secondary,
                isLoading: true,
                fullWidth: true,
                action: onShowEarlier
            )
        case .failed:
            Notice(
                tone: .notice,
                title: "Earlier content didn't load. Try again.",
                actionLabel: "Try again",
                onAction: onShowEarlier
            )
        case .offline:
            Text("Connect to see more shared content.")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .frame(
                    maxWidth: .infinity,
                    minHeight: Metrics.targetTouch,
                    alignment: .center
                )
                .multilineTextAlignment(.center)
        }
    }
}

private extension View {
    @ViewBuilder
    func sharedContentDirectionIsolated(_ isolated: Bool) -> some View {
        if isolated {
            environment(\.layoutDirection, .leftToRight)
        } else {
            self
        }
    }
}
