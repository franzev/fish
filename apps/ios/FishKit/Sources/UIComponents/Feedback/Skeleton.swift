import DesignSystem
import SwiftUI

/// Loading placeholders that match final geometry and become static under
/// Reduce Motion. They are silent to assistive technology.
public struct SkeletonBar: View {
    private let width: CGFloat?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    public init(width: CGFloat? = nil) {
        self.width = width
    }

    public var body: some View {
        Capsule()
            .fill(Palette.surface2)
            .frame(width: width, height: TypeScale.label.size)
            .frame(
                maxWidth: width == nil ? .infinity : nil,
                alignment: .leading
            )
            .opacity(pulsing ? 0.7 : 0.4)
            .animation(
                Motion.skeletonPulse(reduceMotion: reduceMotion),
                value: pulsing
            )
            .onAppear { pulsing = !reduceMotion }
            .accessibilityHidden(true)
    }
}

public struct SkeletonAvatar: View {
    private let size: Avatar.Size
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
