public enum AttachmentUploadEvent: Equatable, Sendable {
    case staged
    case preparationStarted
    case initialized
    case uploadProgress(Double)
    case completionStarted(position: Int, total: Int)
    case completed(ChatAttachment)
    case failed(AttachmentFailureReason)
    case retry
    case remove
}

public enum AttachmentStateReducer {
    public static func reduce(
        _ state: AttachmentUploadItemState,
        _ event: AttachmentUploadEvent
    ) -> AttachmentUploadItemState {
        var next = state
        if case .remove = event {
            next.phase = .removed
            return next
        }
        guard state.phase != .removed else { return state }

        switch (state.phase, event) {
        case (.picked, .staged): next.phase = .staging
        case (.staging, .preparationStarted): next.phase = .preparing
        case (.staging, .initialized), (.preparing, .initialized): next.phase = .initializing
        case (.initializing, .uploadProgress(let progress)),
             (.uploading, .uploadProgress(let progress)):
            next.phase = .uploading(min(1, max(0, progress)))
        case (.uploading, .completionStarted(let position, let total)):
            next.phase = .completing(position: max(1, position), total: max(1, total))
        case (.completing, .completed(let attachment)):
            next.phase = .ready(attachment)
        case (_, .failed(let reason)):
            next.phase = .failed(reason)
        case (.failed, .retry):
            next.phase = .staging
        default:
            return state
        }
        return next
    }
}
