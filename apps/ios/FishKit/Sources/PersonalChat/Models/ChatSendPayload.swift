public struct ChatSendPayload: Equatable, Sendable {
    public let body: String
    public let selection: ComposerSelection
    public let attachmentIds: [String]
    public let optimisticAttachments: [MessageAttachmentUiModel]
    /// Ordered item ids of every staged attachment in the send, ready or
    /// not. When some are still uploading (or the connection is down) the
    /// store queues the send and resolves these at flush time.
    public let attachmentItemIds: [String]

    public init(
        body: String,
        selection: ComposerSelection,
        attachmentIds: [String],
        optimisticAttachments: [MessageAttachmentUiModel],
        attachmentItemIds: [String] = []
    ) {
        self.body = body
        self.selection = selection
        self.attachmentIds = attachmentIds
        self.optimisticAttachments = optimisticAttachments
        self.attachmentItemIds = attachmentItemIds
    }
}
