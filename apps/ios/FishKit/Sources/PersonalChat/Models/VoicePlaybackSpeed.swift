import Foundation

enum VoicePlaybackSpeed: Float, CaseIterable, Identifiable, Sendable {
    case slow = 0.75
    case normal = 1.0
    case fast = 1.5
    case veryFast = 2.0

    static let userDefaultsKey = "fish.voicePlaybackSpeed"

    var id: Float { rawValue }

    var label: String {
        switch self {
        case .slow: "0.75×"
        case .normal: "1×"
        case .fast: "1.5×"
        case .veryFast: "2×"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .slow: "0.75 times speed"
        case .normal: "Normal speed"
        case .fast: "1.5 times speed"
        case .veryFast: "2 times speed"
        }
    }

    static var persisted: Self {
        let stored = UserDefaults.standard.float(forKey: userDefaultsKey)
        guard stored > 0 else { return .normal }
        return allCases.min { abs($0.rawValue - stored) < abs($1.rawValue - stored) } ?? .normal
    }

    func persist() {
        UserDefaults.standard.set(rawValue, forKey: Self.userDefaultsKey)
    }
}
