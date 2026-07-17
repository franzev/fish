import Foundation

/// "Use less data" preference — mirrors the web contract, including the
/// stored raw values, under the same key the web keeps in localStorage.
public enum VideoQualityPreference: String, Sendable, Equatable, CaseIterable {
    case auto
    case dataSaver = "data-saver"

    public static let storageKey = "fish.video-quality-preference"

    public static func read(from defaults: UserDefaults = .standard) -> VideoQualityPreference {
        defaults.string(forKey: storageKey)
            .flatMap(VideoQualityPreference.init(rawValue:)) ?? .auto
    }

    public func write(to defaults: UserDefaults = .standard) {
        defaults.set(rawValue, forKey: Self.storageKey)
    }
}
