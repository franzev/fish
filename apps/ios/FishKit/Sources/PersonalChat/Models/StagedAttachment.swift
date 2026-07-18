import ChatData
import Foundation

public struct StagedAttachment: Identifiable, Equatable, Sendable {
    public enum Status: Equatable, Sendable {
        case loading
        case preparing
        case uploading
        case finishing(queuePosition: Int)
        case ready
        case failed(AttachmentFailureReason)
    }

    public let id: String
    public var clientUploadId: String
    public var originalName: String
    public var kind: ChatAttachment.Kind
    public var sourceMimeType: String
    public var localUrl: URL?
    public var progress: Double
    public var status: Status
    public var attachmentId: String?
    public var readyAttachment: ChatAttachment?
    public var notice: String?
    public var automaticAttempts: Int

    public init(
        id: String = UUID().uuidString,
        clientUploadId: String = UUID().uuidString,
        originalName: String = "Photo",
        kind: ChatAttachment.Kind = .image,
        sourceMimeType: String = "image/jpeg",
        localUrl: URL? = nil,
        progress: Double = 0,
        status: Status = .loading,
        attachmentId: String? = nil,
        readyAttachment: ChatAttachment? = nil,
        notice: String? = nil,
        automaticAttempts: Int = 0
    ) {
        self.id = id
        self.clientUploadId = clientUploadId
        self.originalName = originalName
        self.kind = kind
        self.sourceMimeType = sourceMimeType
        self.localUrl = localUrl
        self.progress = progress
        self.status = status
        self.attachmentId = attachmentId
        self.readyAttachment = readyAttachment
        self.notice = notice
        self.automaticAttempts = automaticAttempts
    }

    public var isReady: Bool { status == .ready && readyAttachment != nil }
    public var isFailed: Bool {
        if case .failed = status { return true }
        return false
    }
    public var isInFlight: Bool { !isReady && !isFailed }
}
