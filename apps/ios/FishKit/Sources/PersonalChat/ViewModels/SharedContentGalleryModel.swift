import ChatCore
import Foundation
import Observation

public enum SharedContentGalleryCategory: String, CaseIterable, Codable, Sendable, Identifiable {
    case media
    case files
    case links
    case voice

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .media: "Media"
        case .files: "Files"
        case .links: "Links"
        case .voice: "Voice"
        }
    }
}

public enum SharedContentTextDirection: Sendable, Equatable {
    case natural
    case isolate
}

public struct SharedContentMediaThumbnailHandle: Hashable, Sendable {
    public let itemId: String
    public let contentVersion: String

    public init(itemId: String, contentVersion: String) {
        precondition(!itemId.isEmpty)
        precondition(!contentVersion.isEmpty)
        self.itemId = itemId
        self.contentVersion = contentVersion
    }
}

public struct SharedContentMediaThumbnailRequest: Sendable, Equatable {
    public let ownerIdentityId: String
    public let conversationId: String
    public let identityGeneration: Int
    public let itemId: String
    public let contentVersion: String
    public let kind: String
    public let sourceMessageId: String?
    public let attachmentId: String?

    public init(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        itemId: String,
        contentVersion: String,
        kind: String,
        sourceMessageId: String?,
        attachmentId: String?
    ) {
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        self.identityGeneration = identityGeneration
        self.itemId = itemId
        self.contentVersion = contentVersion
        self.kind = kind
        self.sourceMessageId = sourceMessageId
        self.attachmentId = attachmentId
    }
}

public typealias SharedContentMediaThumbnailLoader = @Sendable (
    SharedContentMediaThumbnailRequest,
    SharedContentFetchIntent
) async -> Data?

public struct SharedContentGalleryAnchor: Sendable, Equatable {
    public let itemId: String
    public let scrollOffset: Double
    public let focusedItemId: String?

    public init(
        itemId: String,
        scrollOffset: Double = 0,
        focusedItemId: String? = nil
    ) {
        precondition(!itemId.isEmpty)
        precondition(scrollOffset >= 0)
        self.itemId = itemId
        self.scrollOffset = scrollOffset
        self.focusedItemId = focusedItemId
    }
}

public enum SharedContentGalleryItem: Sendable, Equatable, Identifiable {
    public struct Media: Sendable, Equatable {
        public let itemId: String
        public let kind: String
        public let title: String?
        public let itemDescription: String?
        public let width: Int?
        public let height: Int?
        public let thumbnailHandle: SharedContentMediaThumbnailHandle
        public let accessibilityLabel: String
        public let selectionEnabled: Bool
        let stickerId: String?

        public init(
            itemId: String,
            kind: String,
            title: String?,
            itemDescription: String?,
            width: Int?,
            height: Int?,
            thumbnailHandle: SharedContentMediaThumbnailHandle? = nil,
            accessibilityLabel: String,
            selectionEnabled: Bool,
            stickerId: String? = nil
        ) {
            self.itemId = itemId
            self.kind = kind
            self.title = title
            self.itemDescription = itemDescription
            self.width = width
            self.height = height
            self.thumbnailHandle = thumbnailHandle ?? .init(
                itemId: itemId,
                contentVersion: itemId
            )
            self.accessibilityLabel = accessibilityLabel
            self.selectionEnabled = selectionEnabled
            self.stickerId = stickerId
        }
    }

    public struct File: Sendable, Equatable {
        public let itemId: String
        public let kind: String
        public let filename: String
        public let filenameDirection: SharedContentTextDirection
        public let friendlyType: String
        public let sizeLabel: String?
        public let accessibilityLabel: String
        public let selectionEnabled: Bool
    }

    public struct Link: Sendable, Equatable {
        public let itemId: String
        public let kind: String
        public let title: String
        public let hostname: String?
        public let hostnameDirection: SharedContentTextDirection
        public let accessibilityLabel: String
        public let selectionEnabled: Bool
    }

    public struct Voice: Sendable, Equatable {
        public let itemId: String
        public let kind: String
        public let durationLabel: String
        public let accessibilityLabel: String
        public let selectionEnabled: Bool
    }

    case media(Media)
    case file(File)
    case link(Link)
    case voice(Voice)

    public var id: String {
        switch self {
        case .media(let item): item.itemId
        case .file(let item): item.itemId
        case .link(let item): item.itemId
        case .voice(let item): item.itemId
        }
    }

    public var category: SharedContentGalleryCategory {
        switch self {
        case .media: .media
        case .file: .files
        case .link: .links
        case .voice: .voice
        }
    }

    public var selectionEnabled: Bool {
        switch self {
        case .media(let item): item.selectionEnabled
        case .file(let item): item.selectionEnabled
        case .link(let item): item.selectionEnabled
        case .voice(let item): item.selectionEnabled
        }
    }
}

public enum SharedContentGalleryIntent: Sendable, Equatable {
    case selectCategory(SharedContentGalleryCategory)
    case reportVisibility(visibleItemIds: [String], lookaheadItemIds: [String])
    case recordAnchor(category: SharedContentGalleryCategory, anchor: SharedContentGalleryAnchor)
    case retry
    case showEarlier
    case displayConfirmed(itemId: String, contentVersion: String)
    case selectItem(itemId: String)
    case close
}

/// Route-scoped, provider-neutral projection over the accepted Phase 12 store.
///
/// The model owns only category selection, memory-only anchors, native display
/// labels, and typed intents. Identity, persistence, paging, and delivery
/// authority remain in `SharedContentStore`.
@MainActor @Observable
public final class SharedContentGalleryModel {
    public static let durationUnavailable = "Duration unavailable"

    private let store: SharedContentStore
    private let locale: Locale
    private let onSelectItem: ((String) -> Void)?
    private let thumbnailLoader: SharedContentMediaThumbnailLoader?
    private var requestedCategory: SharedContentGalleryCategory?
    private var anchorRecords: [SharedContentGalleryCategory: AnchorRecord] = [:]
    private var closed = false

    public init(
        store: SharedContentStore,
        locale: Locale = .autoupdatingCurrent,
        onSelectItem: ((String) -> Void)? = nil,
        thumbnailLoader: SharedContentMediaThumbnailLoader? = nil
    ) {
        self.store = store
        self.locale = locale
        self.onSelectItem = onSelectItem
        self.thumbnailLoader = thumbnailLoader
    }

    public var routeGeneration: Int { store.identityGeneration }
    public var presentation: SharedContentPresentationContract { store.presentation }
    public var earlierState: SharedContentEarlierState { store.earlierState }
    public var itemSelectionEnabled: Bool { onSelectItem != nil && !closed }

    public var categories: [SharedContentGalleryCategory] {
        guard !closed else { return [] }
        return SharedContentGalleryCategory.allCases.filter { category in
            store.acceptedItems.contains { accepted in
                accepted.category == category.rawValue &&
                    Self.isDisplayEligible(accepted, category: category)
            }
        }
    }

    public var selectedCategory: SharedContentGalleryCategory? {
        let populated = categories
        if let requestedCategory, populated.contains(requestedCategory) {
            return requestedCategory
        }
        return populated.first
    }

    public var showCategoryControl: Bool { categories.count > 1 }

    /// Items for the selected category, in accepted server order.
    public var items: [SharedContentGalleryItem] {
        guard let selectedCategory else { return [] }
        return items(for: selectedCategory)
    }

    public var anchors: [SharedContentGalleryCategory: SharedContentGalleryAnchor] {
        Dictionary(uniqueKeysWithValues: categories.compactMap { category in
            anchor(for: category).map { (category, $0) }
        })
    }

    public func items(for category: SharedContentGalleryCategory) -> [SharedContentGalleryItem] {
        guard !closed, categories.contains(category) else { return [] }
        return store.acceptedItems.compactMap { accepted in
            guard accepted.category == category.rawValue else { return nil }
            return displayItem(accepted, category: category)
        }
    }

    public func open() {
        guard !closed else { return }
        store.open()
    }

    public func dispatch(_ intent: SharedContentGalleryIntent) {
        switch intent {
        case .selectCategory(let category):
            selectCategory(category)
        case .reportVisibility(let visibleItemIds, let lookaheadItemIds):
            visibility(
                visibleItemIds: visibleItemIds,
                lookaheadItemIds: lookaheadItemIds
            )
        case .recordAnchor(let category, let anchor):
            remember(anchor: anchor, for: category)
        case .retry:
            _ = retry()
        case .showEarlier:
            showEarlier()
        case .displayConfirmed(let itemId, let contentVersion):
            Task { @MainActor [weak self] in
                _ = await self?.displayConfirmed(
                    itemId: itemId,
                    contentVersion: contentVersion
                )
            }
        case .selectItem(let itemId):
            _ = selectItem(itemId)
        case .close:
            close()
        }
    }

    public func selectCategory(_ category: SharedContentGalleryCategory) {
        guard !closed, categories.contains(category) else { return }
        requestedCategory = category
    }

    public func remember(
        anchor: SharedContentGalleryAnchor,
        for category: SharedContentGalleryCategory
    ) {
        let orderedIds = store.acceptedItems
            .filter { $0.category == category.rawValue }
            .map(\.itemId)
        guard !closed, orderedIds.contains(anchor.itemId) else { return }
        let focusedItemId = anchor.focusedItemId.flatMap { focused in
            orderedIds.contains(focused) ? focused : nil
        }
        anchorRecords[category] = AnchorRecord(
            anchor: SharedContentGalleryAnchor(
                itemId: anchor.itemId,
                scrollOffset: anchor.scrollOffset,
                focusedItemId: focusedItemId
            ),
            orderedItemIds: orderedIds
        )
    }

    public func anchor(
        for category: SharedContentGalleryCategory
    ) -> SharedContentGalleryAnchor? {
        guard !closed, let record = anchorRecords[category] else { return nil }
        let currentIds = store.acceptedItems
            .filter { $0.category == category.rawValue }
            .map(\.itemId)
        guard !currentIds.isEmpty else { return nil }

        if currentIds.contains(record.anchor.itemId) {
            let focus = record.anchor.focusedItemId.flatMap { focused in
                currentIds.contains(focused) ? focused : nil
            }
            return SharedContentGalleryAnchor(
                itemId: record.anchor.itemId,
                scrollOffset: record.anchor.scrollOffset,
                focusedItemId: focus
            )
        }

        let priorIndex = record.orderedItemIds.firstIndex(of: record.anchor.itemId) ?? 0
        let fallbackIndex = min(priorIndex, currentIds.count - 1)
        let fallback = currentIds[fallbackIndex]
        return SharedContentGalleryAnchor(
            itemId: fallback,
            scrollOffset: record.anchor.scrollOffset,
            focusedItemId: record.anchor.focusedItemId == nil ? nil : fallback
        )
    }

    public func visibility(
        visibleItemIds: [String],
        lookaheadItemIds: [String]
    ) {
        guard !closed else { return }
        let acceptedIds = Set(store.acceptedItems.map(\.itemId))
        _ = store.visibility(
            visibleItemIds: visibleItemIds.filter(acceptedIds.contains),
            lookaheadItemIds: lookaheadItemIds.filter(acceptedIds.contains)
        )
    }

    public func thumbnailData(
        for handle: SharedContentMediaThumbnailHandle,
        intent: SharedContentFetchIntent = .visibleThumbnail
    ) async -> Data? {
        guard !closed,
              let loader = thumbnailLoader,
              let request = thumbnailRequest(itemId: handle.itemId),
              request.contentVersion == handle.contentVersion
        else { return nil }
        return await loader(request, intent)
    }

    public func thumbnailRequest(
        itemId: String
    ) -> SharedContentMediaThumbnailRequest? {
        guard !closed,
              let accepted = store.acceptedItems.first(where: {
                  $0.itemId == itemId && $0.category == SharedContentGalleryCategory.media.rawValue
              })
        else { return nil }
        return SharedContentMediaThumbnailRequest(
            ownerIdentityId: store.ownerIdentityIdForMedia,
            conversationId: accepted.conversationId,
            identityGeneration: store.identityGeneration,
            itemId: accepted.itemId,
            contentVersion: accepted.contentVersion,
            kind: accepted.kind,
            sourceMessageId: accepted.sourceMessageId,
            attachmentId: accepted.attachmentId
        )
    }

    @discardableResult
    public func retry() -> Bool {
        !closed && store.retry()
    }

    public func showEarlier() {
        guard !closed else { return }
        store.loadEarlier()
    }

    @discardableResult
    public func displayConfirmed(
        itemId: String,
        contentVersion: String
    ) async -> Bool {
        guard !closed,
              store.acceptedItems.contains(where: { $0.itemId == itemId })
        else { return false }
        return await store.confirmDisplayed(
            itemId: itemId,
            contentVersion: contentVersion
        )
    }

    @discardableResult
    public func selectItem(_ itemId: String) -> Bool {
        guard !closed,
              store.acceptedItems.contains(where: { $0.itemId == itemId }),
              let onSelectItem
        else { return false }
        onSelectItem(itemId)
        return true
    }

    @discardableResult
    public func close() -> [Task<Void, Never>] {
        guard !closed else { return [] }
        closed = true
        requestedCategory = nil
        anchorRecords.removeAll()
        return store.close()
    }

    private func displayItem(
        _ item: SharedContentAcceptedItem,
        category: SharedContentGalleryCategory
    ) -> SharedContentGalleryItem? {
        guard Self.isDisplayEligible(item, category: category) else { return nil }
        switch category {
        case .media:
            let kindLabel: String
            switch item.kind {
            case "photo": kindLabel = "Photo"
            case "video": kindLabel = "Video"
            case "gif": kindLabel = "GIF"
            case "sticker": kindLabel = "Sticker"
            default: return nil
            }
            let title = Self.nonempty(item.mediaTitle)
            return .media(.init(
                itemId: item.itemId,
                kind: item.kind,
                title: title,
                itemDescription: Self.nonempty(item.mediaDescription),
                width: item.width,
                height: item.height,
                thumbnailHandle: .init(
                    itemId: item.itemId,
                    contentVersion: item.contentVersion
                ),
                accessibilityLabel: title.map { "\(kindLabel), \($0)" } ?? kindLabel,
                selectionEnabled: itemSelectionEnabled,
                stickerId: item.stickerId
            ))
        case .files:
            let filename = Self.nonempty(item.originalName) ?? "File"
            let friendlyType = Self.friendlyFileType(
                filename: filename,
                mimeType: item.mimeType
            )
            let sizeLabel = item.byteSize.map {
                ByteCountFormatStyle(style: .file)
                    .locale(locale)
                    .format($0)
            }
            let metadata = [friendlyType, sizeLabel].compactMap(\.self).joined(separator: ", ")
            return .file(.init(
                itemId: item.itemId,
                kind: item.kind,
                filename: filename,
                filenameDirection: .natural,
                friendlyType: friendlyType,
                sizeLabel: sizeLabel,
                accessibilityLabel: "\(filename), \(metadata)",
                selectionEnabled: itemSelectionEnabled
            ))
        case .links:
            let hostname = Self.nonempty(item.linkHostname)
            let title = Self.nonempty(item.linkTitle) ?? hostname ?? "Link"
            let accessibilityLabel = [title, hostname]
                .compactMap(\.self)
                .reduce(into: [String]()) { labels, value in
                    if !labels.contains(value) { labels.append(value) }
                }
                .joined(separator: ", ")
            return .link(.init(
                itemId: item.itemId,
                kind: item.kind,
                title: title,
                hostname: hostname,
                hostnameDirection: .isolate,
                accessibilityLabel: accessibilityLabel,
                selectionEnabled: itemSelectionEnabled
            ))
        case .voice:
            let duration = item.durationMs.map {
                Self.formatDuration(milliseconds: $0, locale: locale)
            } ?? Self.durationUnavailable
            return .voice(.init(
                itemId: item.itemId,
                kind: item.kind,
                durationLabel: duration,
                accessibilityLabel: "Voice message, \(duration)",
                selectionEnabled: itemSelectionEnabled
            ))
        }
    }

    private static func isDisplayEligible(
        _ item: SharedContentAcceptedItem,
        category: SharedContentGalleryCategory
    ) -> Bool {
        switch (category, item.kind) {
        case (.media, "photo"), (.media, "video"), (.media, "gif"), (.media, "sticker"),
             (.files, "document"), (.links, "link"), (.voice, "voice"):
            true
        default:
            false
        }
    }

    private static func friendlyFileType(filename: String, mimeType: String?) -> String {
        let fileExtension = URL(filePath: filename).pathExtension.lowercased()
        let normalizedMime = mimeType?.lowercased()
        switch true {
        case fileExtension == "pdf" || normalizedMime == "application/pdf":
            return "PDF"
        case ["doc", "docx", "odt", "rtf"].contains(fileExtension) ||
            normalizedMime?.contains("word") == true:
            return "Document"
        case ["xls", "xlsx", "ods", "csv"].contains(fileExtension) ||
            normalizedMime?.contains("spreadsheet") == true:
            return "Spreadsheet"
        case ["ppt", "pptx", "odp"].contains(fileExtension) ||
            normalizedMime?.contains("presentation") == true:
            return "Presentation"
        case ["zip", "rar", "7z", "tar", "gz"].contains(fileExtension) ||
            normalizedMime?.contains("zip") == true:
            return "Archive"
        case ["txt", "md"].contains(fileExtension) ||
            normalizedMime?.hasPrefix("text/") == true:
            return "Text"
        case normalizedMime?.hasPrefix("image/") == true:
            return "Image"
        case normalizedMime?.hasPrefix("video/") == true:
            return "Video"
        case normalizedMime?.hasPrefix("audio/") == true:
            return "Audio"
        default:
            return "File"
        }
    }

    private static func formatDuration(milliseconds: Int64, locale: Locale) -> String {
        let totalSeconds = milliseconds / 1_000
        let hours = totalSeconds / 3_600
        let minutes = (totalSeconds % 3_600) / 60
        let seconds = totalSeconds % 60
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.usesGroupingSeparator = false

        func number(_ value: Int64, minimumDigits: Int) -> String {
            formatter.minimumIntegerDigits = minimumDigits
            return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
        }

        if hours > 0 {
            return "\(number(hours, minimumDigits: 1)):" +
                "\(number(minutes, minimumDigits: 2)):" +
                "\(number(seconds, minimumDigits: 2))"
        }
        return "\(number(minutes, minimumDigits: 1)):" +
            "\(number(seconds, minimumDigits: 2))"
    }

    private static func nonempty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty
        else { return nil }
        return value
    }
}

private struct AnchorRecord {
    let anchor: SharedContentGalleryAnchor
    let orderedItemIds: [String]
}
