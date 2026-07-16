import SwiftUI

/// Calm tokenized motion. Under Reduce Motion, state changes apply without
/// animation and loops stop instead of flickering.
public enum Motion {
    public static func animation(
        _ duration: TimeInterval,
        reduceMotion: Bool
    ) -> Animation? {
        reduceMotion ? nil : .easeOut(duration: duration)
    }

    public static func skeletonPulse(reduceMotion: Bool) -> Animation? {
        reduceMotion
            ? nil
            : .easeInOut(duration: MotionDuration.skeleton)
                .repeatForever(autoreverses: true)
    }

    public static func typingLoop(
        reduceMotion: Bool,
        delay: TimeInterval
    ) -> Animation? {
        reduceMotion
            ? nil
            : .easeInOut(duration: MotionDuration.typing)
                .repeatForever(autoreverses: false)
                .delay(delay)
    }
}
