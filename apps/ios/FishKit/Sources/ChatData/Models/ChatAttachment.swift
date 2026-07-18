import Foundation

/// Provider-neutral attachment shape shared with `packages/core/src/chat.ts`.
/// Signed delivery URLs are deliberately optional because they expire and can
/// be refreshed independently of the stable storage paths.
public struct ChatAttachment: Identifiable, Equatable, Sendable, Codable {
    public enum Kind: String, Equatable, Sendable, Codable {
        case image
        case file

        public init(from decoder: any Decoder) throws {
            let value = try decoder.singleValueContainer().decode(String.self)
            self = value == Self.image.rawValue ? .image : .file
        }
    }

    public let id: String
    public let status: String
    public let kind: Kind
    public let originalName: String
    public let mimeType: String?
    public let byteSize: Int?
    public let width: Int?
    public let height: Int?
    public let thumbnailPath: String?
    public let displayPath: String
    public let thumbnailUrl: URL?
    public let displayUrl: URL?

    public init(
        id: String,
        status: String = "ready",
        kind: Kind,
        originalName: String,
        mimeType: String? = nil,
        byteSize: Int? = nil,
        width: Int? = nil,
        height: Int? = nil,
        thumbnailPath: String? = nil,
        displayPath: String,
        thumbnailUrl: URL? = nil,
        displayUrl: URL? = nil
    ) {
        self.id = id
        self.status = status
        self.kind = kind
        self.originalName = originalName
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.width = width
        self.height = height
        self.thumbnailPath = thumbnailPath
        self.displayPath = displayPath
        self.thumbnailUrl = thumbnailUrl
        self.displayUrl = displayUrl
    }

    public func withUrls(thumbnail: URL?, display: URL?) -> Self {
        Self(
            id: id,
            status: status,
            kind: kind,
            originalName: originalName,
            mimeType: mimeType,
            byteSize: byteSize,
            width: width,
            height: height,
            thumbnailPath: thumbnailPath,
            displayPath: displayPath,
            thumbnailUrl: thumbnail,
            displayUrl: display
        )
    }
}
