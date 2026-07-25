import DesignSystem
import SwiftUI

public struct SkeletonAvatar: View {
    private let size: Avatar.Size
    @Environment(\.fishReduceMotion) private var reduceMotion
    @State private var pulsing = false

    public init(size: Avatar.Size) {
        self.size = size
    }

    public var body: some View {
        Circle()
            .fill(Palette.surface2)
            .frame(width: size.points, height: size.points)
            .opacity(pulsing ? 0.7 : 0.4)
            .animation(
                Motion.skeletonPulse(reduceMotion: reduceMotion),
                value: pulsing
            )
            .onAppear { pulsing = !reduceMotion }
            .accessibilityHidden(true)
    }
}
