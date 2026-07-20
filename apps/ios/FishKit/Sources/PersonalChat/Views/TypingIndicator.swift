import DesignSystem
import SwiftUI

/// Restrained dots plus a text label. Dots become static under Reduce Motion.
public struct TypingIndicator: View {
    private let name: String
    @Environment(\.fishReduceMotion) private var reduceMotion
    @State private var animating = false

    public init(name: String) {
        self.name = name
    }

    public var body: some View {
        HStack(spacing: Spacing.nudge) {
            HStack(spacing: Spacing.threeXs) {
                dot(delay: 0)
                dot(delay: MotionDuration.typingDelayShort)
                dot(delay: MotionDuration.typingDelayLong)
            }
            Text("\(name) is typing")
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, Spacing.page)
        .padding(.vertical, Spacing.threeXs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name) is typing")
        .onAppear {
            animating = !reduceMotion
            AccessibilityNotification.Announcement("\(name) is typing").post()
        }
    }

    private func dot(delay: TimeInterval) -> some View {
        Circle()
            .fill(Palette.muted)
            .frame(width: Spacing.nudge, height: Spacing.nudge)
            .offset(y: animating ? -Metrics.motionTypingOffset : 0)
            .opacity(animating ? 1 : 0.5)
            .animation(
                Motion.typingLoop(reduceMotion: reduceMotion, delay: delay),
                value: animating
            )
    }
}
