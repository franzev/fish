import DesignSystem
import Foundation

extension ChatRules {
    public static func isSendable(_ draft: String) -> Bool {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && draft.count <= maxMessageLength
    }

    public static func counterGuidance(_ draft: String) -> String? {
        let count = draft.count
        guard count >= counterThreshold else { return nil }
        if count > maxMessageLength {
            return "Messages can hold \(maxMessageLength) characters. This one is \(count)."
        }
        return "\(count) of \(maxMessageLength) characters"
    }
}
