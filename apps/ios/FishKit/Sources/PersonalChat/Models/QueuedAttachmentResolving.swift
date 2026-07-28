import ChatData
import Foundation

/// What a queued send's staged attachment looks like right now.
public enum QueuedAttachmentResolution: Equatable, Sendable {
    /// Uploaded and confirmed; carries the server attachment.
    case ready(ChatAttachment)
    /// Still uploading, or paused on a transient failure the pipeline will
    /// retry on its own. Carries a placeholder for the bubble.
    case pending(ChatAttachment)
    /// Unrecoverable: the item is missing or failed in a way the pipeline
    /// will never retry. The send referencing it cannot complete.
    case gone
}

/// The upload pipeline's answers to the send queue, keyed by the stable
/// composer item id — upload ids are reminted on retry and must never be
/// used as a reference. Implemented by `AttachmentUploadsModel`; the
/// conversation store holds it weakly.
@MainActor
public protocol QueuedAttachmentResolving: AnyObject {
    func resolution(itemId: String) -> QueuedAttachmentResolution
    /// The send referencing these uploads finished (or died): drop the
    /// items, their durable records, and — after a short grace so optimistic
    /// bubbles can finish reading local previews — their staged bytes.
    func releaseQueued(itemIds: [String])
}
