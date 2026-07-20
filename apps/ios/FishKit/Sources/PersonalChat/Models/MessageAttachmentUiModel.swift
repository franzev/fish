import ChatData
import Foundation

public struct MessageAttachmentUiModel: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: ChatAttachment.Kind
    public let originalName: String
    public let mimeType: String?
    public let byteSize: Int?
    public let width: Int?
    public let height: Int?
    public let thumbnailPath: String?
    public let displayPath: String
    public let thumbnailUrl: URL?
    public let displayUrl: URL?
    public let localPreviewUrl: URL?
    public let isOptimistic: Bool

    public init(
        attachment: ChatAttachment,
        localPreviewUrl: URL? = nil,
        isOptimistic: Bool = false
    ) {
        id = attachment.id
        kind = attachment.kind
        originalName = attachment.originalName
        mimeType = attachment.mimeType
        byteSize = attachment.byteSize
        width = attachment.width
        height = attachment.height
        thumbnailPath = attachment.thumbnailPath
        displayPath = attachment.displayPath
        thumbnailUrl = attachment.thumbnailUrl
        displayUrl = attachment.displayUrl
        self.localPreviewUrl = localPreviewUrl
        self.isOptimistic = isOptimistic
    }

    public var aspectRatio: Double {
        guard let width, let height, width > 0, height > 0 else { return 1 }
        return Double(width) / Double(height)
    }

    public var isVoiceMessage: Bool {
        mimeType?.lowercased() == "audio/mp4"
    }
}
