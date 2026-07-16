import DesignSystem

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
}
