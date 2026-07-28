public struct ChatSendPayload: Equatable, Sendable {
    public let body: String
    public let selection: ComposerSelection
    public let attachmentIds: [String]
    public let optimisticAttachments: [MessageAttachmentUiModel]
    /// Ordered upload ids of every staged attachment in the send, ready or
    /// not. When some are still uploading (or the connection is down) the
    /// store queues the send and resolves these at flush time.
    public let attachmentClientUploadIds: [String]

    public init(
        body: String,
        selection: ComposerSelection,
        attachmentIds: [String],
        optimisticAttachments: [MessageAttachmentUiModel],
        attachmentClientUploadIds: [String] = []
    ) {
        self.body = body
        self.selection = selection
        self.attachmentIds = attachmentIds
        self.optimisticAttachments = optimisticAttachments
        self.attachmentClientUploadIds = attachmentClientUploadIds
    }
}
