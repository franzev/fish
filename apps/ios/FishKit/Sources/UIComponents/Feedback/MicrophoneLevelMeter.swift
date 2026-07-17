import DesignSystem
import SwiftUI

/// Three quiet level bars mirroring the web `MicrophoneVolumeMeter`: bar
/// scale follows the smoothed microphone level, success tint while voice is
/// active, dim monochrome otherwise. Decorative — meaning always lives in the
/// accompanying status text.
public struct MicrophoneLevelMeter: View {
    private let level: Double
    private let active: Bool

    public init(level: Double, active: Bool? = nil) {
        let safeLevel = min(1, max(0, level))
        self.level = safeLevel
        self.active = active ?? (safeLevel >= 0.15)
    }

    private var barScales: [CGFloat] {
        [
            0.2 + level * 0.8,
            0.15 + level * 0.85,
            0.1 + level * 0.9,
        ].map { CGFloat(($0 * 100).rounded() / 100) }
    }

    private let barHeights: [CGFloat] = [Spacing.xs, Spacing.sm, Spacing.md]

    public var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.threeXs) {
            ForEach(0..<3, id: \.self) { index in
                Capsule()
                    .fill(active ? Palette.success : Palette.foreground.opacity(Opacity.meterIdle))
                    .frame(width: Spacing.twoXs, height: barHeights[index])
                    .scaleEffect(y: barScales[index], anchor: .bottom)
            }
        }
        .accessibilityHidden(true)
    }
}
