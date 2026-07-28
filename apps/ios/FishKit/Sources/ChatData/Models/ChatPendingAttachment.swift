import Foundation

/// A staged attachment that has not finished sending. The staged bytes on
/// disk are the source of truth; ids are disposable because the server
/// deduplicates initialization by `clientUploadId`. Persisting this record
/// is what lets the upload pipeline resume after a relaunch.
public struct ChatPendingAttachment: Codable, Equatable, Sendable {
    public let conversationId: String
    /// The composer item id; stable across relaunch so records replace cleanly.
    public let itemId: String
    public var clientUploadId: String
    /// File name inside the `ChatOutbox` staging root. Stored relative so the
    /// record survives container path changes between launches.
    public let stagedFileName: String
    public let originalName: String
    public let sourceMimeType: String
    public let uploadMimeType: String
    public let sourceByteSize: Int
    public let uploadByteSize: Int
    public let width: Int?
    public let height: Int?
    public let sha256: String
    public var serverAttachmentId: String?
    public var readyAttachment: ChatAttachment?
    public let createdAt: Date

    public init(
        conversationId: String,
        itemId: String,
        clientUploadId: String,
        stagedFileName: String,
        originalName: String,
        sourceMimeType: String,
        uploadMimeType: String,
        sourceByteSize: Int,
        uploadByteSize: Int,
        width: Int? = nil,
        height: Int? = nil,
        sha256: String,
        serverAttachmentId: String? = nil,
        readyAttachment: ChatAttachment? = nil,
        createdAt: Date = Date()
    ) {
        self.conversationId = conversationId
        self.itemId = itemId
        self.clientUploadId = clientUploadId
        self.stagedFileName = stagedFileName
        self.originalName = originalName
        self.sourceMimeType = sourceMimeType
        self.uploadMimeType = uploadMimeType
        self.sourceByteSize = sourceByteSize
        self.uploadByteSize = uploadByteSize
        self.width = width
        self.height = height
        self.sha256 = sha256
        self.serverAttachmentId = serverAttachmentId
        self.readyAttachment = readyAttachment
        self.createdAt = createdAt
    }

    public func stagedFileUrl(in root: URL) -> URL {
        root.appending(path: stagedFileName)
    }
}
