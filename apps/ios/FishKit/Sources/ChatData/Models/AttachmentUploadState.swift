import Foundation

public struct AttachmentCandidate: Equatable, Sendable {
    public let data: Data
    public let originalName: String
    public let sourceMimeType: String

    public init(data: Data, originalName: String, sourceMimeType: String) {
        self.data = data
        self.originalName = originalName
        self.sourceMimeType = sourceMimeType.lowercased()
    }
}

public struct StagedAttachmentFile: Equatable, Sendable {
    public let url: URL
    public let originalName: String
    public let sourceMimeType: String
    public let uploadMimeType: String
    public let sourceByteSize: Int
    public let uploadByteSize: Int
    public let width: Int?
    public let height: Int?
    public let sha256: String

    public init(
        url: URL,
        originalName: String,
        sourceMimeType: String,
        uploadMimeType: String,
        sourceByteSize: Int,
        uploadByteSize: Int,
        width: Int? = nil,
        height: Int? = nil,
        sha256: String
    ) {
        self.url = url
        self.originalName = originalName
        self.sourceMimeType = sourceMimeType
        self.uploadMimeType = uploadMimeType
        self.sourceByteSize = sourceByteSize
        self.uploadByteSize = uploadByteSize
        self.width = width
        self.height = height
        self.sha256 = sha256
    }
}

public struct InitializeAttachmentRequest: Equatable, Sendable, Codable {
    public let action: String
    public let conversationId: String
    public let clientUploadId: String
    public let originalName: String
    public let sourceMimeType: String
    public let sourceByteSize: Int
    public let uploadMimeType: String
    public let uploadSha256: String

    public init(
        conversationId: String,
        clientUploadId: String,
        originalName: String,
        sourceMimeType: String,
        sourceByteSize: Int,
        uploadMimeType: String,
        uploadSha256: String
    ) {
        self.action = "initialize-upload"
        self.conversationId = conversationId
        self.clientUploadId = clientUploadId
        self.originalName = originalName
        self.sourceMimeType = sourceMimeType
        self.sourceByteSize = sourceByteSize
        self.uploadMimeType = uploadMimeType
        self.uploadSha256 = uploadSha256
    }
}

public struct AttachmentUploadAuthorization: Equatable, Sendable, Codable {
    public let attachmentId: String
    public let bucket: String
    public let objectPath: String
    public let uploadToken: String
    public let uploadMimeType: String
    public let signedUploadUrl: URL
    public let expiresAt: Date

    public init(
        attachmentId: String,
        bucket: String,
        objectPath: String,
        uploadToken: String,
        uploadMimeType: String,
        signedUploadUrl: URL,
        expiresAt: Date
    ) {
        self.attachmentId = attachmentId
        self.bucket = bucket
        self.objectPath = objectPath
        self.uploadToken = uploadToken
        self.uploadMimeType = uploadMimeType
        self.signedUploadUrl = signedUploadUrl
        self.expiresAt = expiresAt
    }
}

public struct SignedAttachmentUrl: Equatable, Sendable, Codable {
    public let attachmentId: String
    public let thumbnailUrl: URL?
    public let displayUrl: URL?

    public init(attachmentId: String, thumbnailUrl: URL?, displayUrl: URL?) {
        self.attachmentId = attachmentId
        self.thumbnailUrl = thumbnailUrl
        self.displayUrl = displayUrl
    }
}

public enum AttachmentFailureReason: Equatable, Sendable {
    case unsupportedType
    case tooLarge
    case preparationFailed
    case offline
    case rateLimited
    case serverRejected(String)
    case expired

    public var isTransient: Bool {
        switch self {
        case .offline,
             .serverRejected("processing"),
             .serverRejected("processing_failed"),
             .serverRejected("scan_unavailable"),
             .serverRejected("upload_unavailable"),
             .serverRejected("delivery_unavailable"):
            true
        default:
            false
        }
    }
}

public enum AttachmentUploadPhase: Equatable, Sendable {
    case picked
    case staging
    case preparing
    case initializing
    case uploading(Double)
    case completing(position: Int, total: Int)
    case ready(ChatAttachment)
    case failed(AttachmentFailureReason)
    case removed
}

public struct AttachmentUploadItemState: Equatable, Sendable {
    public let id: String
    public var phase: AttachmentUploadPhase

    public init(id: String, phase: AttachmentUploadPhase = .picked) {
        self.id = id
        self.phase = phase
    }
}

public struct AttachmentCommandFailure: Error, Equatable, Sendable {
    public let code: String
    public let notice: String
    public let statusCode: Int?

    public init(code: String, notice: String, statusCode: Int? = nil) {
        self.code = code
        self.notice = notice
        self.statusCode = statusCode
    }

    public static let unavailable = Self(
        code: "upload_unavailable",
        notice: "That attachment did not finish yet. Try again."
    )
}
