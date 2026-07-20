import SwiftUI

private struct FishReduceMotionKey: EnvironmentKey {
    static let defaultValue = false
}

public extension EnvironmentValues {
    var fishReduceMotion: Bool {
        get { self[FishReduceMotionKey.self] }
        set { self[FishReduceMotionKey.self] = newValue }
    }
}
