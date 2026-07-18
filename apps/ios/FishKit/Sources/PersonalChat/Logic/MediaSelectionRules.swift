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
        guard connectionReady, draft.count <= ChatRules.maxMessageLength else { return false }
        if !stagedAttachments.isEmpty {
            guard selection == .none,
                  stagedAttachments.allSatisfy(\.isReady) else { return false }
            return !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !stagedAttachments.isEmpty
        }
        return isSendable(draft: draft, selection: selection)
    }
}
