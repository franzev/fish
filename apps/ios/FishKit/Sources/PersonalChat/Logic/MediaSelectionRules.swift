import DesignSystem
import Foundation

/// Sendability once staged media joins the draft: media alone is sendable,
/// text alone follows the existing rule, and an over-limit draft blocks the
/// send even when media is staged (the server enforces the same bound).
public enum MediaSelectionRules {
    public static func isSendable(draft: String, selection: ComposerSelection) -> Bool {
        if case .none = selection {
            return ChatRules.isSendable(draft)
        }
        return draft.count <= ChatRules.maxMessageLength
    }

    public static func isSendable(
        draft: String,
        selection: ComposerSelection,
        stagedAttachments: [StagedAttachment],
        connectionReady: Bool
    ) -> Bool {
        guard draft.count <= ChatRules.maxMessageLength else { return false }
        if !stagedAttachments.isEmpty {
            // Attachment sends queue durably, so uploads still in flight do
            // not block the send — only an item that needs attention does.
            return selection == .none && stagedAttachments.allSatisfy { !$0.isFailed }
        }
        guard connectionReady else {
            // Offline, only durable payloads may send; text queues, media
            // expressions wait for the connection.
            return selection == .none && ChatRules.isSendable(draft)
        }
        return isSendable(draft: draft, selection: selection)
    }
}
