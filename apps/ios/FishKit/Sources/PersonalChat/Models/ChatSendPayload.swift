public struct ChatSendPayload: Equatable, Sendable {
    public let body: String
    public let selection: ComposerSelection
    public let attachmentIds: [String]
    public let optimisticAttachments: [MessageAttachmentUiModel]

    public init(
        body: String,
        selection: ComposerSelection,
        attachmentIds: [String],
        optimisticAttachments: [MessageAttachmentUiModel]
    ) {
        self.body = body
        self.selection = selection
        self.attachmentIds = attachmentIds
        self.optimisticAttachments = optimisticAttachments
    }
}
