/// A standalone emoji gets the same visual emphasis it carries in
/// conversation (web renders it at display size). Port of the web rule:
/// exactly one emoji cluster — a flag pair, a keycap, or a pictograph with
/// optional presentation/skin/ZWJ additions — surrounded only by whitespace.
/// Deliberately stricter than "is emoji": plain digits, `#`, and `*` carry
/// the Unicode Emoji property but stay ordinary text.
public enum EmojiOnlyMessage {
    public static func isEmojiOnly(_ body: String) -> Bool {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count == 1, let character = trimmed.first else {
            return false
        }
        let scalars = Array(character.unicodeScalars)
        if scalars.count == 2 && scalars.allSatisfy(isRegionalIndicator) {
            return true
        }
        if scalars.last?.value == 0x20E3, let base = scalars.first {
            return isKeycapBase(base)
        }
        // Grapheme segmentation guarantees any trailing scalars are
        // presentation selectors, skin modifiers, or ZWJ continuations —
        // the base scalar decides whether the cluster is pictographic.
        guard let base = scalars.first else { return false }
        return base.properties.isEmoji
            && !isKeycapBase(base)
            && !isRegionalIndicator(base)
    }

    private static func isRegionalIndicator(_ scalar: Unicode.Scalar) -> Bool {
        (0x1F1E6...0x1F1FF).contains(scalar.value)
    }

    private static func isKeycapBase(_ scalar: Unicode.Scalar) -> Bool {
        scalar == "#" || scalar == "*" || ("0"..."9").contains(scalar)
    }
}
